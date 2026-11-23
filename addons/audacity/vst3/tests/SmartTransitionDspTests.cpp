#include "SmartTransitionDsp.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <vector>

using Travny::Audio::SmartEditPlan;
using Travny::Audio::SmartTransitionDsp;
using Travny::Audio::SmartTransitionMode;
using Travny::Audio::SmartFadeCurve;
using Travny::Audio::SmartRepairMode;

namespace {

using Frame = std::array<double, 2>;

void require(bool condition, const char* message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

struct RenderResult
{
    std::vector<Frame> output;
    SmartEditPlan plan{};
    std::int64_t planWindowStart{0};
    bool hasPlan{false};
};

RenderResult render(const std::vector<Frame>& input, std::size_t channels, const std::vector<std::size_t>& chunks = {}, double strength = 1.0, double maxTransitionMilliseconds = 4.0, double sampleRate = 48000.0,
                    SmartTransitionMode mode = SmartTransitionMode::Auto, bool repairAuto = false)
{
    SmartTransitionDsp dsp;
    dsp.configure(sampleRate);
    dsp.setStrength(strength);
    dsp.setMaxTransitionMilliseconds(maxTransitionMilliseconds);
    dsp.setMode(mode);
    dsp.setRepairAuto(repairAuto);

    std::vector<Frame> raw;
    raw.reserve(input.size() + dsp.latencySamples());

    std::size_t position = 0;
    std::size_t chunkIndex = 0;
    while (position < input.size())
    {
        const auto requested = chunks.empty() ? input.size() : chunks[chunkIndex++ % chunks.size()];
        const auto count = std::min(requested, input.size() - position);
        for (std::size_t i = 0; i < count; ++i)
        {
            Frame out{};
            dsp.processFrame(input[position + i].data(), out.data(), channels);
            raw.push_back(out);
        }
        position += count;
    }

    for (std::size_t i = 0; i < dsp.latencySamples(); ++i)
    {
        Frame out{};
        dsp.drainFrame(out.data(), channels);
        raw.push_back(out);
    }

    RenderResult result;
    result.output.assign(
        raw.begin() + static_cast<std::ptrdiff_t>(dsp.latencySamples()),
        raw.begin() + static_cast<std::ptrdiff_t>(dsp.latencySamples() + input.size()));
    result.hasPlan = dsp.hasPlan();
    result.plan = dsp.plan();
    result.planWindowStart = dsp.planWindowStartSamples();
    return result;
}

std::vector<Frame> cleanSine(std::size_t count, std::size_t channels = 2)
{
    std::vector<Frame> input(count);
    for (std::size_t i = 0; i < count; ++i)
    {
        const auto phase = static_cast<double>(i) * 0.05;
        input[i][0] = 0.55 * std::sin(phase);
        input[i][1] = channels > 1 ? 0.35 * std::sin(phase + 0.13) : 0.0;
    }
    return input;
}

std::vector<Frame> withHardSeam(std::size_t count, std::size_t seam)
{
    auto input = cleanSine(count);
    for (std::size_t i = seam; i < count; ++i)
    {
        input[i][0] += 0.45;
        input[i][1] += 0.38;
    }
    return input;
}

std::int64_t globalAnchor(const RenderResult& result)
{
    return result.planWindowStart + result.plan.seamAnchorSamples;
}

void testConservativeSpectralRepair()
{
    const auto input = withHardSeam(1400, 500);
    const auto off = render(input, 2, {17, 53});
    const auto autoA = render(input, 2, {17, 53}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Auto, true);
    const auto autoB = render(input, 2, {1400}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Auto, true);
    require(off.hasPlan && autoA.hasPlan, "spectral fixture missed seam");
    require(globalAnchor(off) == globalAnchor(autoA), "Repair moved seam");
    require(autoA.output == autoB.output, "Repair changed with block partition");
    // Auto may reject its proposed spectral blend if the ordinary fade
    // already has a lower peak transient. Bypass is the safety contract.
    if (autoA.plan.repairMode == SmartRepairMode::Spectral)
        require(autoA.plan.repairStartOffsetSamples == -8 &&
            autoA.plan.repairLengthSamples == 16, "Repair window out of bounds");
    else
        require(autoA.plan.repairMode == SmartRepairMode::None &&
            autoA.plan.repairLengthSamples == 0 &&
            autoA.plan.repairStartOffsetSamples == 0,
            "Rejected repair left an invalid plan");
    bool changed = false;
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        changed |= off.output[i] != autoA.output[i];
        if (i < 492 || i >= 508)
            require(off.output[i] == autoA.output[i], "Repair leaked outside window");
        for (const auto value : autoA.output[i])
            require(std::isfinite(value), "Repair produced non-finite audio");
    }
    if (autoA.plan.repairMode == SmartRepairMode::Spectral)
        require(changed, "accepted spectral repair was a no-op");
    else
        require(!changed, "rejected spectral repair modified the audio");
    constexpr double pi = 3.14159265358979323846;
    std::vector<Frame> phaseSplice(1400);
    for (std::size_t i = 0; i < phaseSplice.size(); ++i)
    {
        const auto phase = i < 500 ? pi / 12.0 : 13.0 * pi / 12.0;
        const auto value = 0.9 * std::sin(2.0 * pi * 125.0 * i / 48000.0 + phase);
        phaseSplice[i] = {value, value * 0.85};
    }
    const auto musicOff = render(phaseSplice, 2, {}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Music, false);
    const auto musicAuto = render(phaseSplice, 2, {}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Music, true);
    require(musicAuto.hasPlan, "phase splice was not detected");
    const auto entry = globalAnchor(musicAuto) - 8;
    require(entry > 1, "invalid repair entry");
    for (std::size_t channel = 0; channel < 2; ++channel)
    {
        double maxDryJump = 0.0;
        double maxAutoJump = 0.0;
        for (auto i = entry; i <= entry + 16; ++i)
        {
            maxDryJump = std::max(maxDryJump,
                std::abs(musicOff.output[i][channel] - musicOff.output[i - 1][channel]));
            maxAutoJump = std::max(maxAutoJump,
                std::abs(musicAuto.output[i][channel] - musicAuto.output[i - 1][channel]));
        }
        require(maxAutoJump <= maxDryJump * 1.05 + 0.005,
            "Repair Auto introduced a larger phase-splice transient");
    }
    std::vector<Frame> softerPhase(1400);
    for (std::size_t i = 0; i < softerPhase.size(); ++i)
    {
        const auto phase = i < 500 ? pi / 12.0 : pi / 3.0;
        const auto value = 0.9 * std::sin(2.0 * pi * 300.0 *
            (static_cast<double>(i) - 500.0) / 48000.0 + phase);
        softerPhase[i] = {value, value * 0.85};
    }
    const auto softerOff = render(softerPhase, 2, {}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Auto);
    const auto softerAuto = render(softerPhase, 2, {}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Auto, true);
    require(softerOff.hasPlan && softerAuto.hasPlan,
        "300 Hz phase fixture did not detect the seam");
    const auto softerEntry = globalAnchor(softerOff) - 8;
    for (std::size_t channel = 0; channel < 2; ++channel)
    {
        double dryMax = 0.0;
        double autoMax = 0.0;
        for (auto i = softerEntry; i <= softerEntry + 16; ++i)
        {
            dryMax = std::max(dryMax,
                std::abs(softerOff.output[i][channel] - softerOff.output[i - 1][channel]));
            autoMax = std::max(autoMax,
                std::abs(softerAuto.output[i][channel] - softerAuto.output[i - 1][channel]));
        }
        require(autoMax <= dryMax * 1.05 + 0.005,
            "Repair Auto sharpened an already-smooth join");
    }
    // Positive control: some discontinuities must benefit from spectral
    // repair. Otherwise a permanently bypassed Auto implementation passes.
    bool acceptedSpectral = false;
    for (int frequency : {125, 256, 500, 703})
    {
        if (acceptedSpectral) break;
        for (int leftDegrees : {15, 60, 135, 225, 300})
        {
            if (acceptedSpectral) break;
            for (int rightDegrees : {15, 90, 165, 240, 315})
            {
                std::vector<Frame> signal(1000);
                for (std::size_t i = 0; i < signal.size(); ++i)
                {
                    const auto degrees = i < 500 ? leftDegrees : rightDegrees;
                    const auto phase = degrees * pi / 180.0;
                    const auto value = 0.9 * std::sin(2.0 * pi * frequency *
                        (static_cast<double>(i) - 500.0) / 48000.0 + phase);
                    signal[i] = {value, value * 0.8};
                }
                const auto result = render(signal, 2, {13, 41, 67}, 1.0, 4.0,
                    48000.0, SmartTransitionMode::Auto, true);
                if (result.plan.repairMode == SmartRepairMode::Spectral)
                {
                    const auto without = render(signal, 2);
                    require(result.output != without.output,
                        "Accepted spectral plan was not rendered");
                    acceptedSpectral = true;
                    break;
                }
            }
        }
    }
    require(acceptedSpectral, "Repair Auto never accepted a spectral improvement");
    const auto clean = cleanSine(1400);
    require(render(clean, 2, {}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Auto, true).output == clean, "Repair changed clean signal");
}

void testCleanAudioIsBitTransparent()
{
    const auto input = cleanSine(1200);
    const auto result = render(input, 2, {1, 7, 64, 13, 128});

    require(!result.hasPlan, "clean sine should not produce a transition plan");
    require(result.plan.affectedChannelsMask == 0, "no-op plan marked an affected channel");
    require(result.output.size() == input.size(), "clean output size changed");
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        require(result.output[i][0] == input[i][0], "clean left channel changed");
        require(result.output[i][1] == input[i][1], "clean right channel changed");
    }
}

void testHardSeamIsDetectedAndSmoothed()
{
    constexpr std::size_t seam = 500;
    const auto input = withHardSeam(1400, seam);
    const auto result = render(input, 2, {31, 97, 5, 128});

    require(result.hasPlan, "hard seam was not detected");
    require(!result.plan.noOp, "hard seam produced a no-op plan");
    require(result.plan.affectedChannelsMask == 0b11, "stereo hard seam did not mark both channels");
    require(result.plan.fadeLengthSamples > 0, "hard seam has no transition length");
    require(result.plan.confidence >= 0.62, "hard seam confidence below threshold");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(seam)) <= 2,
            "detected seam moved away from the actual splice");

    const auto beforeJump = std::abs(input[seam][0] - input[seam - 1][0]);
    const auto afterJump = std::abs(result.output[seam][0] - result.output[seam - 1][0]);
    require(afterJump < beforeJump * 0.55, "transition did not sufficiently soften the seam");

    require(result.output[40] == input[40], "samples far before the seam changed");
    require(result.output[1200] == input[1200], "samples far after the seam changed");
}

void testPlanWindowContainsTransition()
{
    constexpr std::size_t seam = 500;
    const auto input = withHardSeam(1400, seam);
    const auto result = render(input, 2, {61, 17, 89});

    require(result.hasPlan, "plan-window fixture did not produce a plan");
    const auto fadeLength = static_cast<std::int64_t>(result.plan.fadeLengthSamples);
    const auto halfFade = fadeLength / 2;
    const auto transitionStart = globalAnchor(result) - halfFade;
    const auto transitionEnd = transitionStart + fadeLength;
    require(result.planWindowStart <= transitionStart,
            "transition starts before the advertised plan window");
    require(transitionEnd + 1 < static_cast<std::int64_t>(input.size()),
            "transition ends outside the buffered plan window");
}

void testBlockPartitionIsDeterministic()
{
    const auto input = withHardSeam(1500, 620);
    const auto a = render(input, 2, {1500});
    const auto b = render(input, 2, {1, 2, 3, 5, 8, 13, 21, 34, 55, 89});

    require(a.hasPlan && b.hasPlan, "partition test did not produce plans");
    require(a.planWindowStart == b.planWindowStart, "plan window changed with block partition");
    require(a.plan.seamAnchorSamples == b.plan.seamAnchorSamples, "seam changed with block partition");
    require(a.plan.affectedChannelsMask == b.plan.affectedChannelsMask, "channel mask changed with block partition");
    require(a.plan.confidence == b.plan.confidence, "confidence changed with block partition");
    require(a.plan.rightGainDb == b.plan.rightGainDb, "gain plan changed with block partition");
    require(a.plan.dcDelta == b.plan.dcDelta, "DC plan changed with block partition");
    require(a.plan.fadeLengthSamples == b.plan.fadeLengthSamples, "fade length changed with block partition");
    require(a.output == b.output, "rendered samples changed with block partition");
}

void testOverlappingCandidatesCompeteBeforeCommit()
{
    constexpr std::size_t firstSeam = 500;
    constexpr std::size_t strongerSeam = 650;
    std::vector<Frame> input(1500);
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const double value = i < firstSeam ? 0.40 : (i < strongerSeam ? 0.50 : -0.50);
        input[i] = {value, value * 0.9};
    }

    const auto result = render(input, 2, {23, 41, 67});
    require(result.hasPlan, "overlapping-candidate fixture did not produce a plan");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(strongerSeam)) <= 2,
            "an earlier weaker overlapping seam committed before the stronger candidate");
}

void testOverlapChainDoesNotPullInDistantSeam()
{
    constexpr std::size_t firstSeam = 500;
    constexpr std::size_t bridgeSeam = 650;
    constexpr std::size_t distantSeam = 800;
    auto input = cleanSine(1800);
    for (auto& frame : input)
    {
        frame[0] *= 0.25;
        frame[1] *= 0.25;
    }
    for (std::size_t i = firstSeam; i < input.size(); ++i)
    {
        input[i][0] += 0.35;
        input[i][1] += 0.30;
    }
    for (std::size_t i = bridgeSeam; i < input.size(); ++i)
    {
        input[i][0] += 0.22;
        input[i][1] += 0.19;
    }
    for (std::size_t i = distantSeam; i < input.size(); ++i)
    {
        input[i][0] -= 0.75;
        input[i][1] -= 0.65;
    }

    const auto result = render(input, 2, {19, 47, 71});
    require(result.hasPlan, "overlap-chain fixture did not produce a plan");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(firstSeam)) <= 2,
            "a distant seam replaced the earlier winner through a chained overlap");
}

void testProgressivelyStrongerOverlapChainKeepsSeedFrontier()
{
    constexpr std::size_t firstSeam = 500;
    constexpr std::size_t bridgeSeam = 650;
    constexpr std::size_t distantSeam = 800;
    auto input = cleanSine(1800);
    for (std::size_t i = firstSeam; i < input.size(); ++i)
    {
        input[i][0] += 0.20;
        input[i][1] += 0.172;
    }
    for (std::size_t i = bridgeSeam; i < input.size(); ++i)
    {
        input[i][0] += 0.40;
        input[i][1] += 0.344;
    }
    for (std::size_t i = distantSeam; i < input.size(); ++i)
    {
        input[i][0] -= 0.90;
        input[i][1] -= 0.774;
    }

    const auto result = render(input, 2, {11, 53, 79});
    require(result.hasPlan, "progressively-stronger overlap fixture did not produce a plan");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(bridgeSeam)) <= 2,
            "a progressively stronger distant seam advanced the seed competition frontier");
}

void testFinalClusterCommitsDuringDrain()
{
    constexpr std::size_t seam = 700;
    std::vector<Frame> input(800);
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const double value = i < seam ? 0.25 : -0.60;
        input[i] = {value, value * 0.8};
    }

    const auto result = render(input, 2, {37, 19, 71});
    require(result.hasPlan, "final fully observed seam was lost at end-of-input");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(seam)) <= 2,
            "drain committed the wrong final seam");
}

void testShortSelectionShrinksAnalysisSymmetrically()
{
    constexpr std::size_t seam = 40;
    std::vector<Frame> input(80);
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const double value = i < seam ? 0.30 : -0.50;
        input[i] = {value, value * 0.85};
    }

    const auto result = render(input, 2, {7, 11, 5});
    require(result.hasPlan, "short selection did not shrink analysis context");
    require(result.plan.fadeLengthSamples < 192, "short selection did not shrink transition to available context");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(seam)) <= 2,
            "short-selection seam anchor is incorrect");
}

void testAntiPhaseStereoSeamDoesNotCancelDetection()
{
    constexpr std::size_t seam = 500;
    std::vector<Frame> input(1400);
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        input[i] = i < seam ? Frame{0.45, -0.45} : Frame{-0.45, 0.45};
    }

    const auto result = render(input, 2, {29, 3, 83});
    require(result.hasPlan, "anti-phase stereo seam cancelled out of detection");
    require(result.plan.affectedChannelsMask == 0b11, "anti-phase seam did not mark both channels");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(seam)) <= 2,
            "anti-phase stereo seam anchor is incorrect");

    for (std::size_t channel = 0; channel < 2; ++channel)
    {
        const auto beforeJump = std::abs(input[seam][channel] - input[seam - 1][channel]);
        const auto afterJump = std::abs(result.output[seam][channel] - result.output[seam - 1][channel]);
        require(afterJump < beforeJump * 0.55, "anti-phase stereo seam was not smoothed on both channels");
    }
}

void testSingleChannelStereoSeamQualifies()
{
    constexpr std::size_t seam = 500;
    for (std::size_t changedChannel = 0; changedChannel < 2; ++changedChannel)
    {
        const auto companionChannel = 1U - changedChannel;
        std::vector<Frame> input(1400, Frame{0.20, 0.20});
        for (std::size_t i = seam; i < input.size(); ++i)
        {
            input[i][changedChannel] = -0.75;
        }

        const auto result = render(input, 2, {43, 7, 101});
        require(result.hasPlan, "single-channel stereo seam was ignored");
        require(result.plan.affectedChannelsMask == static_cast<std::uint8_t>(1U << changedChannel),
                "single-channel seam marked the clean companion channel");
        require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(seam)) <= 2,
                "single-channel stereo seam anchor is incorrect");

        const auto beforeJump = std::abs(input[seam][changedChannel] - input[seam - 1][changedChannel]);
        const auto afterJump = std::abs(result.output[seam][changedChannel] - result.output[seam - 1][changedChannel]);
        require(afterJump < beforeJump * 0.55, "single-channel stereo seam was not smoothed");

        for (std::size_t i = 0; i < input.size(); ++i)
        {
            require(result.output[i][companionChannel] == input[i][companionChannel],
                    "single-channel seam altered the clean companion channel");
        }
    }
}

void testMonoPath()
{
    constexpr std::size_t seam = 420;
    auto input = cleanSine(1200, 1);
    for (std::size_t i = seam; i < input.size(); ++i)
    {
        input[i][0] -= 0.50;
    }

    const auto result = render(input, 1, {17, 63, 4});
    require(result.hasPlan, "mono seam was not detected");
    require(result.plan.affectedChannelsMask == 0b01, "mono seam has invalid affected-channel mask");
    require(std::llabs(globalAnchor(result) - static_cast<std::int64_t>(seam)) <= 2,
            "mono seam anchor is incorrect");
}

void testResetStartsFreshRun()
{
    SmartTransitionDsp dsp;
    dsp.configure(48000.0);
    const auto input = withHardSeam(1300, 500);
    for (const auto& frame : input)
    {
        Frame out{};
        dsp.processFrame(frame.data(), out.data(), 2);
    }
    require(dsp.hasPlan(), "first run did not commit a plan");

    dsp.reset();
    require(!dsp.hasPlan(), "reset retained the accepted plan");
    require(dsp.plan().noOp, "reset plan is not neutral");
    require(dsp.plan().affectedChannelsMask == 0, "reset retained an affected-channel mask");

    const auto clean = cleanSine(300);
    for (const auto& frame : clean)
    {
        Frame out{};
        dsp.processFrame(frame.data(), out.data(), 2);
    }
    require(!dsp.hasPlan(), "fresh run inherited seam state");
}

void testMaxTransitionCapsFadeWithoutMovingSeam()
{
    const auto input = withHardSeam(1400, 500);
    const auto automatic = render(input, 2, {17, 71});
    const auto capped = render(input, 2, {1, 3, 11}, 1.0, 1.0);
    const auto cappedOtherChunks = render(input, 2, {1400}, 1.0, 1.0);

    require(automatic.hasPlan && capped.hasPlan, "duration cap prevented seam detection");
    require(automatic.plan.fadeLengthSamples == 192, "4 ms default fade changed");
    require(capped.plan.fadeLengthSamples == 48, "1 ms cap did not shorten the fade");
    require(globalAnchor(automatic) == globalAnchor(capped), "duration cap moved seam anchor");
    require(capped.plan.fadeLengthSamples == cappedOtherChunks.plan.fadeLengthSamples &&
            capped.output == cappedOtherChunks.output,
            "duration cap depends on processing blocks");

    bool changed = false;
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        if (capped.output[i] != automatic.output[i]) changed = true;
        if (i < 476 || i >= 524)
        {
            require(capped.output[i] == input[i], "capped fade modified audio outside 1 ms window");
        }
    }
    require(changed, "duration cap did not affect rendered audio");

    constexpr std::size_t firstSeam = 500;
    constexpr std::size_t strongerSeam = 650;
    std::vector<Frame> overlapping(1500);
    for (std::size_t i = 0; i < overlapping.size(); ++i)
    {
        const double value = i < firstSeam ? 0.40 : (i < strongerSeam ? 0.50 : -0.50);
        overlapping[i] = {value, value * 0.9};
    }
    const auto autoWinner = render(overlapping, 2);
    const auto cappedWinner = render(overlapping, 2, {3, 19, 47}, 1.0, 1.0);
    require(autoWinner.hasPlan && cappedWinner.hasPlan, "overlapping seam fixture did not qualify");
    require(globalAnchor(autoWinner) == globalAnchor(cappedWinner) &&
            std::llabs(globalAnchor(cappedWinner) - static_cast<std::int64_t>(strongerSeam)) <= 2,
            "duration cap changed the winning splice");

    for (double rate : {8000.0, 16000.0, 22050.0, 32000.0, 44100.0, 88200.0, 96000.0})
    {
        const auto lowRate = render(input, 2, {7, 59}, 1.0, 1.0, rate);
        if (lowRate.hasPlan)
        {
            const auto length = lowRate.plan.fadeLengthSamples;
            require(length >= static_cast<int>(SmartTransitionDsp::kMinFadeLengthSamples) &&
                    length <= static_cast<int>(std::floor(rate * 0.001)),
                    "selected fade exceeded 1 ms at a lower sample rate");
        }
        else
        {
            require(lowRate.output == input, "shorter-than-minimum fade modified source audio");
        }
    }

    // Previous 88.2 kHz defaults rounded 352.8 up to an even 354 frames.
    // Max transition is a strict 4 ms ceiling, so the revised length is 352.
    const auto strictDefault = render(input, 2, {37, 61}, 1.0, 4.0, 88200.0);
    require(strictDefault.hasPlan && strictDefault.plan.fadeLengthSamples == 352,
            "88.2 kHz default exceeded its requested 4 ms ceiling");

    SmartTransitionDsp dsp;
    dsp.setMaxTransitionMilliseconds(-10.0);
    require(dsp.maxTransitionMilliseconds() == 1.0, "negative cap was not clamped");
    dsp.setMaxTransitionMilliseconds(99.0);
    require(dsp.maxTransitionMilliseconds() == 4.0, "oversized cap was not clamped");
    dsp.setMaxTransitionMilliseconds(std::numeric_limits<double>::quiet_NaN());
    require(dsp.maxTransitionMilliseconds() == 4.0, "non-finite cap did not restore default");
}

void testUnrepairableCapKeepsLaterSplicesDry()
{
    // Adjacent and distant clusters both stay dry after an unrepairable first seam.
    for (const std::size_t secondSeam : {std::size_t{540}, std::size_t{1000}})
    {
        SmartTransitionDsp dsp;
        dsp.configure(8000.0);
        std::vector<Frame> input(1600);
        for (std::size_t i = 0; i < input.size(); ++i)
        {
            const auto value = i < 500 ? 0.30 : (i < secondSeam ? -0.50 : 0.70);
            input[i] = {value, value * 0.85};
        }

        dsp.setMaxTransitionMilliseconds(1.0);
        std::vector<Frame> raw;
        raw.reserve(input.size() + dsp.latencySamples());
        for (std::size_t i = 0; i < input.size(); ++i)
        {
            if (i == secondSeam - 25) dsp.setMaxTransitionMilliseconds(4.0);
            Frame out{};
            dsp.processFrame(input[i].data(), out.data(), 2);
            raw.push_back(out);
        }
        for (std::size_t i = 0; i < dsp.latencySamples(); ++i)
        {
            Frame out{};
            dsp.drainFrame(out.data(), 2);
            raw.push_back(out);
        }
        require(!dsp.hasPlan(), "rejected cap committed a later adjacent/distant seam");
        for (std::size_t i = 0; i < input.size(); ++i)
            require(raw[i + dsp.latencySamples()] == input[i],
                    "later seam changed after an unrepairable first transition");
    }
}

void testModePoliciesAreSourceAlignedAndDeterministic()
{
    const auto input = withHardSeam(1400, 500);
    const auto automatic = render(input, 2, {37, 97});
    const auto speech = render(input, 2, {19, 61}, 1.0, 4.0, 48000.0, SmartTransitionMode::Speech);
    const auto music = render(input, 2, {1400}, 1.0, 4.0, 48000.0, SmartTransitionMode::Music);
    const auto hard = render(input, 2, {1, 13, 83}, 1.0, 4.0, 48000.0, SmartTransitionMode::HardSplice);
    const auto speechSplit = render(input, 2, {1400}, 1.0, 4.0, 48000.0, SmartTransitionMode::Speech);
    const auto musicSplit = render(input, 2, {5, 31, 41}, 1.0, 4.0, 48000.0, SmartTransitionMode::Music);
    const auto hardSplit = render(input, 2, {1400}, 1.0, 4.0, 48000.0, SmartTransitionMode::HardSplice);

    require(automatic.hasPlan && speech.hasPlan && music.hasPlan && hard.hasPlan,
            "mode change discarded the accepted seam");
    require(globalAnchor(automatic) == globalAnchor(speech) &&
            globalAnchor(automatic) == globalAnchor(music) &&
            globalAnchor(automatic) == globalAnchor(hard),
            "mode changed seam selection");
    require(automatic.plan.fadeLengthSamples == 192 &&
            speech.plan.fadeLengthSamples == 96 &&
            music.plan.fadeLengthSamples == 192 &&
            hard.plan.fadeLengthSamples == 48,
            "mode duration policy changed");
    require(automatic.plan.fadeCurve == SmartFadeCurve::SCurve &&
            speech.plan.fadeCurve == SmartFadeCurve::ConstantAmplitude &&
            music.plan.fadeCurve == SmartFadeCurve::EqualPower &&
            hard.plan.fadeCurve == SmartFadeCurve::SCurve,
            "mode fade curve policy changed");
    require(speech.output == speechSplit.output && music.output == musicSplit.output &&
            hard.output == hardSplit.output, "mode repair depends on host block boundaries");
    require(automatic.output != speech.output && automatic.output != music.output &&
            automatic.output != hard.output, "mode control did not change repaired audio");
    for (const auto mode : {SmartTransitionMode::Auto, SmartTransitionMode::Speech,
                            SmartTransitionMode::Music, SmartTransitionMode::HardSplice})
    {
        const auto clean = cleanSine(1200);
        require(render(clean, 2, {1, 7, 19}, 1.0, 4.0, 48000.0, mode).output == clean,
                "mode changed clean audio");
    }

    SmartTransitionDsp dsp;
    dsp.setMode(SmartTransitionMode::Music);
    require(dsp.mode() == SmartTransitionMode::Music, "selected mode was not retained");
    dsp.setMode(static_cast<SmartTransitionMode>(255));
    require(dsp.mode() == SmartTransitionMode::Auto, "invalid mode did not select Auto");
}

void testMusicModeDoesNotIntroduceFullScaleOvers()
{
    constexpr double pi = 3.14159265358979323846;
    std::vector<Frame> input(1400);
    std::array<double, 2> peaks{};
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const auto phase = i < 500 ? pi / 6.0 : (285.0 * pi / 180.0);
        const auto value = 0.9 * std::sin(2.0 * pi * 500.0 *
            static_cast<double>(i) / 48000.0 + phase);
        input[i] = {value, value * 0.85};
        peaks[0] = std::max(peaks[0], std::abs(value));
        peaks[1] = std::max(peaks[1], std::abs(value * 0.85));
    }
    const auto music = render(input, 2, {1, 31, 127}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Music);
    require(music.hasPlan, "phase-jump fixture did not trigger Music mode");
    for (const auto& frame : music.output)
        for (std::size_t channel = 0; channel < frame.size(); ++channel)
            require(std::isfinite(frame[channel]) && std::abs(frame[channel]) <= peaks[channel] + 1e-10,
                    "Music mode introduced a per-channel peak above the source envelope");

    const auto seam = static_cast<std::size_t>(globalAnchor(music));
    require(seam > 0 && seam < input.size(), "Music mode selected an invalid seam");
    const auto beforeJump = std::abs(input[seam][0] - input[seam - 1][0]);
    const auto afterJump = std::abs(music.output[seam][0] - music.output[seam - 1][0]);
    require(afterJump < beforeJump, "Music equal-power bridge did not smooth the seam");
}

void testMusicModeFixedCeilingAndEqualPowerGains()
{
    constexpr double pi = 3.14159265358979323846;
    std::vector<Frame> source(1400);
    for (std::size_t i = 0; i < source.size(); ++i)
    {
        const auto phase = i < 500 ? 270.0 * pi / 180.0 : 225.0 * pi / 180.0;
        const auto value = 0.9 * std::sin(2.0 * pi * 125.0 *
            (static_cast<double>(i) - 500.0) / 48000.0 + phase);
        source[i] = {value, value * 0.8};
    }
    const auto music = render(source, 2, {31, 7, 83}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Music);
    require(music.hasPlan, "same-polarity splice was not detected");
    const auto anchor = globalAnchor(music);
    require(anchor > 1 && anchor < static_cast<std::int64_t>(source.size()), "invalid seam anchor");
    const auto beforeJump = std::abs(source[anchor][0] - source[anchor - 1][0]);
    const auto afterJump = std::abs(music.output[anchor][0] - music.output[anchor - 1][0]);
    require(afterJump < beforeJump * 0.25,
            "Music peak guard retained an audible same-polarity splice");

    const auto fade = static_cast<std::int64_t>(music.plan.fadeLengthSamples);
    const auto start = anchor - fade / 2;
    const auto end = start + fade;
    double peak = 0.0;
    for (auto i = start - 2; i <= end + 1; ++i)
        peak = std::max(peak, std::abs(source[i][0]));

    // Reconstruct an unclipped left-side sample and check the actual
    // equal-power gain law, not only the absence of digital overs.
    const auto leftEdge = source[start - 1][0];
    const auto rightEdge = source[end][0];
    const auto leftSlope = leftEdge - source[start - 2][0];
    const auto rightSlope = source[end + 1][0] - rightEdge;
    bool checkedPower = false;
    for (auto i = start + fade / 4 + 2; i < anchor - 8; ++i)
    {
        const auto tau = static_cast<double>(i - start + 1) / static_cast<double>(fade + 1);
        const auto t2 = tau * tau;
        const auto t3 = t2 * tau;
        const auto bridge = std::clamp(
            (2.0 * t3 - 3.0 * t2 + 1.0) * leftEdge +
            (t3 - 2.0 * t2 + tau) * static_cast<double>(fade + 1) * leftSlope +
            (-2.0 * t3 + 3.0 * t2) * rightEdge +
            (t3 - t2) * static_cast<double>(fade + 1) * rightSlope, -peak, peak);
        const auto weight = std::sin(pi * tau);
        const auto dry = source[i][0];
        const auto expected = std::clamp(
            dry * std::cos(0.5 * pi * weight) + bridge * std::sin(0.5 * pi * weight), -peak, peak);
        const auto linear = std::clamp(dry * (1.0 - weight) + bridge * weight, -peak, peak);
        if (std::abs(expected - linear) > 1e-4 && std::abs(expected) < peak - 1e-4)
        {
            require(std::abs(music.output[i][0] - expected) < 1e-11,
                    "Music renderer did not use equal-power gains");
            checkedPower = true;
            break;
        }
    }
    require(checkedPower, "phase fixture did not exercise an unclipped power-law sample");
}

void testMusicModeFadeEntranceDoesNotClick()
{
    constexpr double pi = 3.14159265358979323846;
    std::vector<Frame> input(1400);
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const auto left = i < 500;
        const auto phase = left ? pi : 0.5 * pi;
        const auto amplitude = left ? 0.6 : 0.9;
        const auto value = amplitude * std::sin(2.0 * pi * 500.0 *
            (static_cast<double>(i) - 500.0) / 48000.0 + phase);
        input[i] = {value, value * 0.7};
    }
    const auto music = render(input, 2, {17, 31, 23}, 1.0, 1.0, 48000.0,
        SmartTransitionMode::Music);
    require(music.hasPlan, "Music entrance-click fixture was not detected");
    const auto anchor = globalAnchor(music);
    const auto start = anchor - music.plan.fadeLengthSamples / 2;
    require(start >= 2, "Music fade starts before the input");
    const auto sourceOnset = std::abs(input[start][0] - input[start - 1][0]);
    const auto repairedOnset = std::abs(music.output[start][0] - music.output[start - 1][0]);
    require(repairedOnset < sourceOnset + 0.012,
            "Music mode introduced a new fade entrance click");
    const auto sourceJump = std::abs(input[anchor][0] - input[anchor - 1][0]);
    const auto repairedJump = std::abs(music.output[anchor][0] - music.output[anchor - 1][0]);
    require(repairedJump < sourceJump * 0.5, "Music mode failed to soften the phase splice");
}

void testMusicModeFadeExitDoesNotClick()
{
    constexpr double pi = 3.14159265358979323846;
    // Exercise both drain-only short selections and normal streaming output.
    for (const std::size_t seam : {std::size_t{500}, std::size_t{5500}})
    {
        const auto frames = seam + 900;
        std::vector<Frame> input(frames);
        for (std::size_t i = 0; i < input.size(); ++i)
        {
            const auto left = i < seam;
            const auto phase = left ? -0.5 * pi : 0.0;
            const auto amplitude = left ? 0.6 : 0.9;
            const auto value = amplitude * std::sin(2.0 * pi * 500.0 *
                (static_cast<double>(i) - static_cast<double>(seam)) / 48000.0 + phase);
            input[i] = {value, value * 0.7};
        }
        const auto music = render(input, 2, {11, 61}, 1.0, 1.0, 48000.0,
            SmartTransitionMode::Music);
        require(music.hasPlan, "Music exit-click fixture was not detected");
        const auto anchor = globalAnchor(music);
        const auto end = anchor + music.plan.fadeLengthSamples / 2;
        require(end > 1 && end < static_cast<std::int64_t>(input.size()),
                "Music fade exits outside the input");
        bool renderedRepair = false;
        for (auto index = anchor - music.plan.fadeLengthSamples / 2;
             index < anchor + music.plan.fadeLengthSamples / 2; ++index)
            renderedRepair |= std::abs(music.output[index][0] - input[index][0]) > 1e-6;
        require(renderedRepair, "streaming Music fixture did not actually render a repair");
        for (std::size_t channel = 0; channel < 2; ++channel)
        {
            const auto originalJump = std::abs(input[end][channel] - input[end - 1][channel]);
            const auto processedJump = std::abs(music.output[end][channel] -
                music.output[end - 1][channel]);
            require(processedJump < originalJump + 0.012,
                    "Music mode introduced a fade exit click");
        }
    }
}

void testStrengthBlendsWithoutChangingDetection()
{
    const auto input = withHardSeam(1400, 500);
    const auto dry = render(input, 2, {17, 31, 47}, 0.0);
    const auto half = render(input, 2, {1, 5, 13, 31}, 0.5);
    const auto full = render(input, 2, {1400}, 1.0);
    require(dry.hasPlan && half.hasPlan && full.hasPlan, "strength changed seam detection");
    require(globalAnchor(dry) == globalAnchor(full) && globalAnchor(half) == globalAnchor(full),
            "strength changed seam selection");
    require(dry.output == input, "0% strength changed source samples");
    for (std::size_t i = 0; i < input.size(); ++i)
        for (std::size_t channel = 0; channel < 2; ++channel)
        {
            const auto midpoint = input[i][channel] + 0.5 * (full.output[i][channel] - input[i][channel]);
            require(std::abs(half.output[i][channel] - midpoint) < 1e-12,
                    "50% strength is not the half-wet blend");
        }

    SmartTransitionDsp dsp;
    dsp.setStrength(-0.5);
    require(dsp.strength() == 0.0, "negative strength was not clamped");
    dsp.setStrength(2.0);
    require(dsp.strength() == 1.0, "strength above unity was not clamped");
    dsp.setStrength(std::numeric_limits<double>::quiet_NaN());
    require(dsp.strength() == 1.0, "non-finite strength was not rejected");
}

} // namespace

int main()
{
    try
    {
        testConservativeSpectralRepair();
        testCleanAudioIsBitTransparent();
        testHardSeamIsDetectedAndSmoothed();
        testPlanWindowContainsTransition();
        testBlockPartitionIsDeterministic();
        testOverlappingCandidatesCompeteBeforeCommit();
        testOverlapChainDoesNotPullInDistantSeam();
        testProgressivelyStrongerOverlapChainKeepsSeedFrontier();
        testFinalClusterCommitsDuringDrain();
        testShortSelectionShrinksAnalysisSymmetrically();
        testAntiPhaseStereoSeamDoesNotCancelDetection();
        testSingleChannelStereoSeamQualifies();
        testMonoPath();
        testResetStartsFreshRun();
        testStrengthBlendsWithoutChangingDetection();
        testMaxTransitionCapsFadeWithoutMovingSeam();
        testUnrepairableCapKeepsLaterSplicesDry();
        testModePoliciesAreSourceAlignedAndDeterministic();
        testMusicModeDoesNotIntroduceFullScaleOvers();
        testMusicModeFixedCeilingAndEqualPowerGains();
        testMusicModeFadeEntranceDoesNotClick();
        testMusicModeFadeExitDoesNotClick();
        std::cout << "SmartTransition DSP tests passed\n";
        return EXIT_SUCCESS;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
