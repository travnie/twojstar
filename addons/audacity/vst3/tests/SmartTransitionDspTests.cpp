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
                    SmartTransitionMode mode = SmartTransitionMode::Auto)
{
    SmartTransitionDsp dsp;
    dsp.configure(sampleRate);
    dsp.setStrength(strength);
    dsp.setMaxTransitionMilliseconds(maxTransitionMilliseconds);
    dsp.setMode(mode);

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
    double peak = 0.0;
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const auto phase = i < 500 ? pi / 6.0 : (285.0 * pi / 180.0);
        const auto value = 0.9 * std::sin(2.0 * pi * 500.0 *
            static_cast<double>(i) / 48000.0 + phase);
        input[i] = {value, value * 0.85};
        peak = std::max(peak, std::abs(value));
    }
    const auto music = render(input, 2, {1, 31, 127}, 1.0, 4.0, 48000.0,
        SmartTransitionMode::Music);
    require(music.hasPlan, "phase-jump fixture did not trigger Music mode");
    for (const auto& frame : music.output)
        for (const auto value : frame)
            require(std::isfinite(value) && std::abs(value) <= peak + 1e-10,
                    "Music mode introduced a peak above the source envelope");

    const auto seam = static_cast<std::size_t>(globalAnchor(music));
    require(seam > 0 && seam < input.size(), "Music mode selected an invalid seam");
    const auto beforeJump = std::abs(input[seam][0] - input[seam - 1][0]);
    const auto afterJump = std::abs(music.output[seam][0] - music.output[seam - 1][0]);
    require(afterJump < beforeJump, "Music equal-power bridge did not smooth the seam");
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
        std::cout << "SmartTransition DSP tests passed\n";
        return EXIT_SUCCESS;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
