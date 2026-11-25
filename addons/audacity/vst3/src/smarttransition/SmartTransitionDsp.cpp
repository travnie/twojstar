#include "SmartTransitionDsp.h"

#include <algorithm>
#include <cmath>

namespace Travny::Audio {
namespace {

constexpr double kPi = 3.141592653589793238462643383279502884;
constexpr double kCandidateThreshold = 0.62;

[[nodiscard]] double dbToGain(double db) noexcept
{
    return std::pow(10.0, db / 20.0);
}

[[nodiscard]] double clampFinite(double value, double low, double high) noexcept
{
    return std::isfinite(value) ? std::clamp(value, low, high) : 0.0;
}

} // namespace

SmartTransitionDsp::SmartTransitionDsp() noexcept
{
    configure(48000.0);
}

void SmartTransitionDsp::configure(double sampleRate) noexcept
{
    sampleRate_ = std::isfinite(sampleRate) && sampleRate > 1000.0 ? sampleRate : 48000.0;

    lookaheadSamples_ = static_cast<std::size_t>(std::clamp<long long>(
        std::llround(sampleRate_ * 0.100),
        static_cast<long long>(kMinLookaheadSamples),
        static_cast<long long>(kMaxLookaheadSamples)));

    analysisRadius_ = static_cast<std::size_t>(std::clamp<long long>(
        std::llround(sampleRate_ * 0.001), 32, 128));

    // Default 4 ms fade. Candidate competition never depends on the user's cap.
    const auto maxFade = std::max<std::size_t>(32, lookaheadSamples_ / 2);
    fadeLengthSamples_ = static_cast<std::size_t>(std::clamp<long long>(
        std::llround(sampleRate_ * 0.004), 32, static_cast<long long>(maxFade)));
    if ((fadeLengthSamples_ & 1U) != 0U) ++fadeLengthSamples_;
    competitionRadius_ = std::max(analysisRadius_, fadeLengthSamples_);
    reset();
}

void SmartTransitionDsp::reset() noexcept
{
    inputCount_ = 0;
    hostPrimerSamples_ = 0;
    firstProgramSample_ = -1;
    firstChannelProgramSample_.fill(-1);
    drainStarted_ = false;
    clusterBest_ = {};
    clusterSeedAnchor_ = -1;
    clusterActive_ = false;
    plan_ = {};
    planCommitted_ = false;
    rejectedByCap_ = false;
    committedAnchor_ = -1;
    planWindowStart_ = 0;
    transitionPeak_.fill(0.0);
}

void SmartTransitionDsp::setStrength(double normalized) noexcept
{
    strength_ = std::isfinite(normalized) ? std::clamp(normalized, 0.0, 1.0) : 1.0;
}

void SmartTransitionDsp::setMaxTransitionMilliseconds(double milliseconds) noexcept
{
    maxTransitionMilliseconds_ = std::isfinite(milliseconds)
        ? std::round(std::clamp(milliseconds, 1.0, 4.0))
        : 4.0;
}

void SmartTransitionDsp::setMode(SmartTransitionMode mode) noexcept
{
    switch (mode)
    {
    case SmartTransitionMode::Speech:
    case SmartTransitionMode::Music:
    case SmartTransitionMode::HardSplice:
        mode_ = mode;
        break;
    default:
        mode_ = SmartTransitionMode::Auto;
        break;
    }
}

void SmartTransitionDsp::processFrame(const double* input, double* output, std::size_t channels) noexcept
{
    processFrameInternal(input, output, channels, true);
}

void SmartTransitionDsp::drainFrame(double* output, std::size_t channels) noexcept
{
    if (!drainStarted_)
    {
        drainStarted_ = true;

        if (!planCommitted_ && clusterActive_ && inputCount_ > 0)
        {
            finalizeCluster(inputCount_ - 1);
        }

        if (!planCommitted_ && !clusterActive_)
        {
            scanShortSelection(channels);
        }
    }

    const std::array<double, kMaxChannels> silence{};
    processFrameInternal(silence.data(), output, channels, false);
}

void SmartTransitionDsp::processFrameInternal(
    const double* input,
    double* output,
    std::size_t channels,
    bool analyze) noexcept
{
    channels = std::clamp<std::size_t>(channels, 1, kMaxChannels);
    const auto inputIndex = inputCount_;
    storeFrame(input, channels, inputIndex);
    ++inputCount_;

    if (analyze && !planCommitted_ && !rejectedByCap_)
    {
        const auto rightContext = static_cast<std::int64_t>(analysisRadius_);
        if (inputIndex >= rightContext + static_cast<std::int64_t>(analysisRadius_) + 2)
        {
            const auto anchor = inputIndex - rightContext;
            considerCandidate(scoreCandidate(anchor, channels, analysisRadius_), inputIndex);
        }
    }

    const auto outputIndex = inputIndex - static_cast<std::int64_t>(lookaheadSamples_);
    for (std::size_t channel = 0; channel < channels; ++channel)
    {
        output[channel] = outputIndex >= 0 ? renderSample(channel, outputIndex) : 0.0;
    }
    for (std::size_t channel = channels; channel < kMaxChannels; ++channel)
    {
        if (output != nullptr)
        {
            output[channel] = 0.0;
        }
    }
}

void SmartTransitionDsp::storeFrame(const double* input, std::size_t channels, std::int64_t index) noexcept
{
    const auto slot = static_cast<std::size_t>(index) % kRingCapacity;
    // The host may prime with zero-filled samples before selected audio.
    // Remember the first real sample so only that boundary is ignored.
    if (input != nullptr)
    {
        for (std::size_t channel = 0; channel < channels; ++channel)
        {
            if (firstChannelProgramSample_[channel] < 0 &&
                std::isfinite(input[channel]) && std::abs(input[channel]) > 1e-3)
            {
                firstChannelProgramSample_[channel] = index;
                if (firstProgramSample_ < 0)
                    firstProgramSample_ = index;
            }
        }
    }
    strengthRing_[slot] = strength_;
    maxTransitionRing_[slot] = static_cast<std::uint8_t>(maxTransitionMilliseconds_);
    modeRing_[slot] = static_cast<std::uint8_t>(mode_);
    repairRing_[slot] = repairAuto_ ? 1 : 0;
    for (std::size_t channel = 0; channel < kMaxChannels; ++channel)
    {
        ring_[channel][slot] = channel < channels && input != nullptr && std::isfinite(input[channel])
            ? input[channel]
            : 0.0;
    }
}

double SmartTransitionDsp::sampleAt(std::size_t channel, std::int64_t index) const noexcept
{
    if (channel >= kMaxChannels || index < 0 || index >= inputCount_)
    {
        return 0.0;
    }

    const auto age = inputCount_ - 1 - index;
    if (age >= static_cast<std::int64_t>(kRingCapacity))
    {
        return 0.0;
    }

    return ring_[channel][static_cast<std::size_t>(index) % kRingCapacity];
}

SmartTransitionDsp::Candidate SmartTransitionDsp::scoreCandidate(
    std::int64_t anchor,
    std::size_t channels,
    std::size_t radiusValue) const noexcept
{
    Candidate candidate{};
    candidate.anchor = anchor;
    candidate.analysisRadius = radiusValue;

    channels = std::clamp<std::size_t>(channels, 1, kMaxChannels);
    const auto radius = static_cast<std::int64_t>(radiusValue);
    if (radius < static_cast<std::int64_t>(kMinAnalysisRadiusSamples) ||
        anchor < radius + 2 || anchor + radius >= inputCount_)
    {
        return candidate;
    }

    double strongestScore = 0.0;
    std::size_t affectedChannels = 0;
    for (std::size_t channel = 0; channel < channels; ++channel)
    {
        // Suppress only each channel's own first audio onset after the host
        // priming silence. Delayed startup channels are handled independently;
        // real cuts just a few samples later still compete normally.
        const auto first = firstChannelProgramSample_[channel];
        if (hostPrimerSamples_ > 0 &&
            first >= hostPrimerSamples_ &&
            first - hostPrimerSamples_ < static_cast<std::int64_t>(analysisRadius_) &&
            anchor >= first - 1 && anchor <= first + 1)
            continue;

        double leftSum = 0.0;
        double rightSum = 0.0;
        double leftSquares = 0.0;
        double rightSquares = 0.0;
        for (std::int64_t i = 0; i < radius; ++i)
        {
            const auto left = sampleAt(channel, anchor - radius + i);
            const auto right = sampleAt(channel, anchor + i);
            leftSum += left;
            rightSum += right;
            leftSquares += left * left;
            rightSquares += right * right;
        }

        const auto leftMean = leftSum / static_cast<double>(radius);
        const auto rightMean = rightSum / static_cast<double>(radius);
        const auto leftRms = std::sqrt(leftSquares / static_cast<double>(radius));
        const auto rightRms = std::sqrt(rightSquares / static_cast<double>(radius));

        double derivativeSum = 0.0;
        std::int64_t derivativeCount = 0;
        for (std::int64_t i = anchor - radius + 1; i < anchor; ++i)
        {
            derivativeSum += std::abs(sampleAt(channel, i) - sampleAt(channel, i - 1));
            ++derivativeCount;
        }
        for (std::int64_t i = anchor + 1; i < anchor + radius; ++i)
        {
            derivativeSum += std::abs(sampleAt(channel, i) - sampleAt(channel, i - 1));
            ++derivativeCount;
        }

        const auto baselineDerivative = derivativeCount > 0
            ? derivativeSum / static_cast<double>(derivativeCount)
            : 0.0;
        const auto jump = std::abs(sampleAt(channel, anchor) - sampleAt(channel, anchor - 1));
        const auto meanGap = std::abs(rightMean - leftMean);
        const auto localLevel = 0.5 * (leftRms + rightRms);
        const auto epsilon = 1e-9;

        const auto jumpScore = jump / (jump + 4.0 * baselineDerivative + epsilon);
        const auto meanScore = meanGap / (meanGap + 0.25 * localLevel + 4.0 * baselineDerivative + epsilon);
        const auto channelScore = std::clamp(0.82 * jumpScore + 0.18 * meanScore, 0.0, 1.0);
        strongestScore = std::max(strongestScore, channelScore);

        if (channelScore >= kCandidateThreshold)
        {
            candidate.affectedChannelsMask = static_cast<std::uint8_t>(
                candidate.affectedChannelsMask | static_cast<std::uint8_t>(std::uint8_t{1} << channel));
            candidate.leftMean += leftMean;
            candidate.rightMean += rightMean;
            candidate.leftRms += leftRms;
            candidate.rightRms += rightRms;
            ++affectedChannels;
        }
    }

    if (affectedChannels > 0)
    {
        const auto channelScale = 1.0 / static_cast<double>(affectedChannels);
        candidate.leftMean *= channelScale;
        candidate.rightMean *= channelScale;
        candidate.leftRms *= channelScale;
        candidate.rightRms *= channelScale;
    }

    const auto score = strongestScore;
    if (!std::isfinite(score))
    {
        return candidate;
    }

    candidate.scoreKey = static_cast<std::int64_t>(std::llround(score * static_cast<double>(kScoreScale)));
    candidate.confidence = static_cast<double>(candidate.scoreKey) / static_cast<double>(kScoreScale);
    candidate.valid = candidate.confidence >= kCandidateThreshold &&
        candidate.affectedChannelsMask != 0;
    return candidate;
}

void SmartTransitionDsp::considerCandidate(const Candidate& candidate, std::int64_t currentInputIndex) noexcept
{
    if (planCommitted_ || rejectedByCap_)
    {
        return;
    }

    // Keep the competition frontier pinned to the earliest qualifying candidate in this
    // local group. A stronger overlapping winner may replace clusterBest_, but it must not
    // slide the frontier forward and pull in a transitive A-B-C overlap chain.
    if (clusterActive_ && clusterSeedAnchor_ >= 0 &&
        candidate.anchor - clusterSeedAnchor_ > static_cast<std::int64_t>(competitionRadius_))
    {
        finalizeCluster(currentInputIndex);
        if (planCommitted_ || rejectedByCap_)
        {
            return;
        }
    }

    if (!candidate.valid)
    {
        return;
    }

    if (!clusterActive_)
    {
        clusterActive_ = true;
        clusterBest_ = candidate;
        clusterSeedAnchor_ = candidate.anchor;
        return;
    }

    if (candidate.scoreKey > clusterBest_.scoreKey ||
        (candidate.scoreKey == clusterBest_.scoreKey && candidate.anchor < clusterBest_.anchor))
    {
        clusterBest_ = candidate;
    }
}

void SmartTransitionDsp::scanShortSelection(std::size_t channels) noexcept
{
    if (planCommitted_ || rejectedByCap_ || clusterActive_ || inputCount_ <= 0 ||
        inputCount_ >= static_cast<std::int64_t>(2 * analysisRadius_ + 4))
    {
        return;
    }

    Candidate best{};
    const auto minimumRadius = static_cast<std::int64_t>(kMinAnalysisRadiusSamples);
    for (std::int64_t anchor = minimumRadius + 2;
         anchor + minimumRadius < inputCount_;
         ++anchor)
    {
        const auto leftAvailable = anchor - 2;
        const auto rightAvailable = inputCount_ - anchor - 1;
        const auto radius = static_cast<std::size_t>(std::min<std::int64_t>({
            static_cast<std::int64_t>(analysisRadius_), leftAvailable, rightAvailable}));
        if (radius < kMinAnalysisRadiusSamples)
        {
            continue;
        }

        const auto candidate = scoreCandidate(anchor, channels, radius);
        if (!candidate.valid)
        {
            continue;
        }

        if (!best.valid || candidate.scoreKey > best.scoreKey ||
            (candidate.scoreKey == best.scoreKey && candidate.anchor < best.anchor))
        {
            best = candidate;
        }
    }

    if (best.valid)
    {
        clusterActive_ = true;
        clusterBest_ = best;
        clusterSeedAnchor_ = best.anchor;
        finalizeCluster(inputCount_ - 1);
    }
}

void SmartTransitionDsp::finalizeCluster(std::int64_t currentInputIndex) noexcept
{
    if (!clusterActive_ || !clusterBest_.valid || planCommitted_)
    {
        clusterActive_ = false;
        clusterBest_ = {};
        clusterSeedAnchor_ = -1;
        return;
    }

    const auto leftCapacity = clusterBest_.anchor - 2;
    const auto rightCapacity = inputCount_ - clusterBest_.anchor - 2;
    // Use the cap captured at the seam's SOURCE sample, not the current
    // input position after lookahead. Automation remains block-independent.
    const auto durationMs = maxTransitionRing_[
        static_cast<std::size_t>(clusterBest_.anchor) % kRingCapacity];
    const auto mode = static_cast<SmartTransitionMode>(
        modeRing_[static_cast<std::size_t>(clusterBest_.anchor) % kRingCapacity]);
    const auto modeLimitMs = mode == SmartTransitionMode::Speech ? 2.0
        : (mode == SmartTransitionMode::HardSplice ? 1.0 : 4.0);
    const auto effectiveLimitMs = std::min(static_cast<double>(durationMs), modeLimitMs);
    const auto maxSamples = static_cast<std::size_t>(std::floor(sampleRate_ * 0.001 * effectiveLimitMs));
    const auto cappedFade = std::min(fadeLengthSamples_, maxSamples) & ~std::size_t{1};
    if (cappedFade < kMinFadeLengthSamples)
    {
        // One accepted seam per run: an unrepairable cap means bypass, not
        // an opportunistic repair of a later unrelated splice.
        rejectedByCap_ = true;
        clusterActive_ = false;
        clusterBest_ = {};
        clusterSeedAnchor_ = -1;
        return;
    }
    const auto preferredHalfFade = static_cast<std::int64_t>(cappedFade / 2);
    const auto halfFade = std::min({preferredHalfFade, leftCapacity, rightCapacity});
    const auto effectiveFadeLength = halfFade > 0 ? static_cast<std::size_t>(halfFade * 2) : 0;

    const auto transitionStart = clusterBest_.anchor - halfFade;
    const auto transitionEnd = transitionStart + static_cast<std::int64_t>(effectiveFadeLength);
    const auto emissionFrontier = currentInputIndex - static_cast<std::int64_t>(lookaheadSamples_);

    if (effectiveFadeLength >= kMinFadeLengthSamples &&
        transitionStart >= 2 && transitionEnd + 1 < inputCount_ && emissionFrontier <= transitionStart)
    {
        plan_ = makePlan(clusterBest_, effectiveFadeLength);
        const auto analysisStart = clusterBest_.anchor - static_cast<std::int64_t>(clusterBest_.analysisRadius);
        planWindowStart_ = std::min(analysisStart, transitionStart);
        plan_.seamAnchorSamples = clusterBest_.anchor - planWindowStart_;
        committedAnchor_ = clusterBest_.anchor;
        planCommitted_ = !plan_.noOp;
        if (planCommitted_ && plan_.fadeCurve == SmartFadeCurve::EqualPower)
        {
            // One fixed source peak per channel, computed before emission.
            // Never let the limiter inherit the splice's per-sample envelope jump.
            for (std::size_t channel = 0; channel < kMaxChannels; ++channel)
            {
                transitionPeak_[channel] = 0.0;
                if ((plan_.affectedChannelsMask & (std::uint8_t{1} << channel)) == 0)
                    continue;
                for (auto index = transitionStart - 2; index <= transitionEnd + 1; ++index)
                    transitionPeak_[channel] = std::max(
                        transitionPeak_[channel], std::abs(sampleAt(channel, index)));
            }
        }
        // Source-aligned Repair Auto. Only strong seams get a 16-sample
        // low-harmonic spectral bridge. Fixed arrays, no audio-thread allocation.
        if (planCommitted_ && repairRing_[static_cast<std::size_t>(
                committedAnchor_) % kRingCapacity] != 0 &&
            plan_.confidence >= 0.85 && effectiveFadeLength >= 32 &&
            committedAnchor_ >= 24 && committedAnchor_ + 24 < inputCount_)
        {
            bool severe = false;
            for (std::size_t channel = 0; channel < kMaxChannels; ++channel)
            {
                if ((plan_.affectedChannelsMask & (std::uint8_t{1} << channel)) != 0)
                    severe |= std::abs(sampleAt(channel, committedAnchor_) -
                        sampleAt(channel, committedAnchor_ - 1)) >= 0.10;
            }
            if (severe)
            {
                constexpr int window = 16;
                plan_.repairMode = SmartRepairMode::Spectral;
                plan_.repairStartOffsetSamples = -8;
                plan_.repairLengthSamples = window;
                for (std::size_t channel = 0; channel < kMaxChannels; ++channel)
                {
                    if ((plan_.affectedChannelsMask & (std::uint8_t{1} << channel)) == 0)
                        continue;
                    std::array<std::array<double, 4>, 2> real{};
                    std::array<std::array<double, 4>, 2> imaginary{};
                    for (int side = 0; side < 2; ++side)
                    {
                        const auto start = committedAnchor_ + (side == 0 ? -24 : 8);
                        for (int n = 0; n < window; ++n)
                        {
                            const auto sample = sampleAt(channel, start + n) / window;
                            for (int k = 0; k < 4; ++k)
                            {
                                const auto phase = 2.0 * kPi * k * n / window;
                                real[side][k] += sample * std::cos(phase);
                                imaginary[side][k] -= sample * std::sin(phase);
                            }
                        }
                    }
                    for (int n = 0; n < window; ++n)
                    {
                        std::array<double, 2> prediction{};
                        for (int side = 0; side < 2; ++side)
                        {
                            const auto position = side == 0 ? window + n : n - window;
                            prediction[side] = real[side][0];
                            for (int k = 1; k < 4; ++k)
                            {
                                const auto phase = 2.0 * kPi * k * position / window;
                                prediction[side] += 2.0 *
                                    (real[side][k] * std::cos(phase) -
                                     imaginary[side][k] * std::sin(phase));
                            }
                        }
                        const auto t = static_cast<double>(n + 1) / (window + 1);
                        spectralRepair_[channel][n] =
                            prediction[0] * (1.0 - t) + prediction[1] * t;
                    }
                }

                // Compare both complete renderings, including both edges,
                // before accepting the spectral correction. A good ordinary
                // fade must never gain a stronger transient from Repair Auto.
                bool acceptable = true;
                for (std::size_t channel = 0; channel < kMaxChannels; ++channel)
                {
                    if ((plan_.affectedChannelsMask & (std::uint8_t{1} << channel)) == 0)
                        continue;
                    double baselinePeak = 0.0;
                    double repairedPeak = 0.0;
                    plan_.repairMode = SmartRepairMode::None;
                    auto baselinePrevious = renderSample(channel, committedAnchor_ - 9);
                    plan_.repairMode = SmartRepairMode::Spectral;
                    auto repairedPrevious = renderSample(channel, committedAnchor_ - 9);
                    for (auto index = committedAnchor_ - 8;
                         index <= committedAnchor_ + 8; ++index)
                    {
                        plan_.repairMode = SmartRepairMode::None;
                        const auto baseline = renderSample(channel, index);
                        plan_.repairMode = SmartRepairMode::Spectral;
                        const auto repaired = renderSample(channel, index);
                        baselinePeak = std::max(baselinePeak,
                            std::abs(baseline - baselinePrevious));
                        repairedPeak = std::max(repairedPeak,
                            std::abs(repaired - repairedPrevious));
                        baselinePrevious = baseline;
                        repairedPrevious = repaired;
                    }
                    if (repairedPeak > baselinePeak * 1.05 + 0.005)
                        acceptable = false;
                }
                if (!acceptable)
                {
                    plan_.repairMode = SmartRepairMode::None;
                    plan_.repairStartOffsetSamples = 0;
                    plan_.repairLengthSamples = 0;
                }
            }
        }
    }

    clusterActive_ = false;
    clusterBest_ = {};
    clusterSeedAnchor_ = -1;
}

SmartEditPlan SmartTransitionDsp::makePlan(const Candidate& candidate, std::size_t fadeLength) const noexcept
{
    SmartEditPlan plan{};
    if (!candidate.valid || candidate.affectedChannelsMask == 0 || fadeLength < kMinFadeLengthSamples)
    {
        return plan;
    }

    const auto epsilon = 1e-9;
    const auto ratio = (candidate.leftRms + epsilon) / (candidate.rightRms + epsilon);
    auto rightGainDb = clampFinite(20.0 * std::log10(ratio), -3.0, 3.0);
    if (std::abs(rightGainDb) < 0.10)
    {
        rightGainDb = 0.0;
    }

    plan.confidence = candidate.confidence;
    plan.affectedChannelsMask = candidate.affectedChannelsMask;
    plan.leftGainDb = 0.0;
    plan.rightGainDb = rightGainDb;
    plan.dcDelta = clampFinite(candidate.rightMean - candidate.leftMean, -0.35, 0.35);
    plan.timingOffsetSamples = 0;
    plan.fadeLengthSamples = static_cast<std::int32_t>(fadeLength);
    const auto mode = static_cast<SmartTransitionMode>(
        modeRing_[static_cast<std::size_t>(candidate.anchor) % kRingCapacity]);
    plan.fadeCurve = mode == SmartTransitionMode::Music ? SmartFadeCurve::EqualPower
        : (mode == SmartTransitionMode::Speech ? SmartFadeCurve::ConstantAmplitude
            : SmartFadeCurve::SCurve);
    plan.repairMode = SmartRepairMode::None;
    plan.noOp = false;
    return plan;
}

double SmartTransitionDsp::renderSample(std::size_t channel, std::int64_t outputIndex) const noexcept
{
    const auto source = sampleAt(channel, outputIndex);
    if (!planCommitted_ || committedAnchor_ < 0 || plan_.fadeLengthSamples <= 0)
    {
        return source;
    }

    const auto channelBit = static_cast<std::uint8_t>(std::uint8_t{1} << channel);
    if ((plan_.affectedChannelsMask & channelBit) == 0)
    {
        return source;
    }

    const auto fadeLength = static_cast<std::int64_t>(plan_.fadeLengthSamples);
    const auto start = committedAnchor_ - fadeLength / 2;
    const auto end = start + fadeLength;
    if (outputIndex < start || outputIndex >= end)
    {
        return source;
    }

    const auto t = static_cast<double>(outputIndex - start + 1) / static_cast<double>(fadeLength + 1);
    const auto pulse = std::sin(kPi * t);
    auto bridgeWeight = std::pow(pulse, 2.0);
    if (plan_.fadeCurve == SmartFadeCurve::EqualPower)
        bridgeWeight = pulse;
    else if (plan_.fadeCurve == SmartFadeCurve::ConstantAmplitude)
        bridgeWeight = std::pow(pulse, 4.0);

    const auto leftEdge = sampleAt(channel, start - 1);
    const auto rightEdge = sampleAt(channel, end);
    const auto leftSlope = leftEdge - sampleAt(channel, start - 2);
    const auto rightSlope = sampleAt(channel, end + 1) - rightEdge;
    const auto span = static_cast<double>(fadeLength + 1);

    const auto t2 = t * t;
    const auto t3 = t2 * t;
    const auto h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
    const auto h10 = t3 - 2.0 * t2 + t;
    const auto h01 = -2.0 * t3 + 3.0 * t2;
    const auto h11 = t3 - t2;
    auto bridge = h00 * leftEdge + h10 * span * leftSlope + h01 * rightEdge + h11 * span * rightSlope;

    const auto envelope = std::max({std::abs(source), std::abs(leftEdge), std::abs(rightEdge), 1e-6});
    const auto peakLimit = plan_.fadeCurve == SmartFadeCurve::EqualPower
        ? transitionPeak_[channel] : envelope;
    const auto bridgeLimit = plan_.fadeCurve == SmartFadeCurve::EqualPower
        ? peakLimit : 1.5 * envelope;
    bridge = std::clamp(bridge, -bridgeLimit, bridgeLimit);

    auto corrected = source;
    if (outputIndex < committedAnchor_)
    {
        const auto denominator = std::max<std::int64_t>(1, committedAnchor_ - start);
        const auto amount = static_cast<double>(outputIndex - start + 1) / static_cast<double>(denominator);
        corrected *= dbToGain(plan_.leftGainDb * std::clamp(amount, 0.0, 1.0));
    }
    else
    {
        const auto denominator = std::max<std::int64_t>(1, end - committedAnchor_);
        const auto amount = static_cast<double>(end - outputIndex) / static_cast<double>(denominator);
        const auto taper = std::clamp(amount, 0.0, 1.0);
        corrected = corrected * dbToGain(plan_.rightGainDb * taper) - plan_.dcDelta * taper;
    }

    auto repaired = corrected * (1.0 - bridgeWeight) + bridge * bridgeWeight;
    if (plan_.fadeCurve == SmartFadeCurve::EqualPower)
    {
        // Equal-power gains preserve squared gain sum. Guard local peak
        // against coherent reinforcement and Hermite overshoot.
        const auto dryGain = std::cos(0.5 * kPi * bridgeWeight);
        const auto wetGain = std::sin(0.5 * kPi * bridgeWeight);
        const auto mixed = corrected * dryGain + bridge * wetGain;
        // Feather the power-law mix into unchanged edges. Pure equal-power
        // reinforcement at the first sample creates a new onset click.
        const auto edge = std::clamp(std::min(t, 1.0 - t) / 0.25, 0.0, 1.0);
        const auto edgeTaper = edge * edge * (3.0 - 2.0 * edge);
        repaired = std::clamp(source + edgeTaper * (mixed - source),
            -peakLimit, peakLimit);
    }
    if (plan_.repairMode == SmartRepairMode::Spectral)
    {
        const auto index = outputIndex - (committedAnchor_ +
            plan_.repairStartOffsetSamples);
        if (index >= 0 && index < plan_.repairLengthSamples)
        {
            const auto t = static_cast<double>(index + 1) /
                static_cast<double>(plan_.repairLengthSamples + 1);
            const auto weight = 0.25 * std::pow(std::sin(kPi * t), 2.0);
            const auto spectrum = spectralRepair_[channel][static_cast<std::size_t>(index)];
            const auto bound = std::max({std::abs(source),
                std::abs(sampleAt(channel, committedAnchor_ - 1)),
                std::abs(sampleAt(channel, committedAnchor_)), 1e-6});
            // Limit only the spectral contribution. Clamping the existing
            // fade to the seam-local bound creates a click at window entry.
            repaired += weight * (std::clamp(spectrum, -bound, bound) - repaired);
        }
    }
    // This sample left the lookahead buffer later than it entered.
    // Use Strength captured alongside its source sample, not the current input.
    const auto strength = strengthRing_[static_cast<std::size_t>(outputIndex) % kRingCapacity];
    if (strength == 1.0) return repaired;
    if (strength == 0.0) return source;
    return source + (repaired - source) * strength;
}

} // namespace Travny::Audio
