#include "SmartTransitionProcessor.h"

#include "SmartTransitionParams.h"
#include "base/source/fstreamer.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"

#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/vstspeaker.h"

#include <algorithm>
#include <array>
#include <cmath>

namespace Travny::Vst3 {
namespace {

[[nodiscard]] Steinberg::uint64 channelMask(Steinberg::int32 channels) noexcept
{
    return (Steinberg::uint64{1} << static_cast<Steinberg::uint32>(channels)) - 1;
}

template <typename Sample>
[[nodiscard]] Steinberg::uint64 missingOutputMask(Sample** output, Steinberg::int32 channels) noexcept
{
    Steinberg::uint64 mask = 0;
    for (Steinberg::int32 channel = 0; channel < channels; ++channel)
    {
        if (output == nullptr || output[channel] == nullptr)
        {
            mask |= Steinberg::uint64{1} << static_cast<Steinberg::uint32>(channel);
        }
    }
    return mask;
}

[[nodiscard]] double maxTransitionMillisecondsFromNormalized(double normalized) noexcept
{
    if (!std::isfinite(normalized)) return 4.0;
    // Match RangeParameter::toPlain for four discrete values: floor(n * 4).
    const auto step = std::min(3, static_cast<int>(std::clamp(normalized, 0.0, 1.0) * 4.0));
    return static_cast<double>(step + 1);
}

[[nodiscard]] Travny::Audio::SmartTransitionMode modeFromNormalized(double normalized) noexcept
{
    if (!std::isfinite(normalized)) return Travny::Audio::SmartTransitionMode::Auto;
    // Match StringListParameter: floor(normalized * 4), capped at 3.
    const auto index = std::min(3, static_cast<int>(std::clamp(normalized, 0.0, 1.0) * 4.0));
    return static_cast<Travny::Audio::SmartTransitionMode>(index);
}

[[nodiscard]] Steinberg::Vst::IParamValueQueue* findParameterQueue(
    Steinberg::Vst::IParameterChanges* changes,
    Steinberg::Vst::ParamID id) noexcept
{
    if (!changes) return nullptr;
    for (Steinberg::int32 index = 0; index < changes->getParameterCount(); ++index)
    {
        auto* queue = changes->getParameterData(index);
        if (queue && queue->getParameterId() == id)
            return queue;
    }
    return nullptr;
}

} // namespace

SmartTransitionProcessor::SmartTransitionProcessor()
{
    setControllerClass(kSmartTransitionControllerUid);
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::initialize(Steinberg::FUnknown* context)
{
    const auto result = AudioEffect::initialize(context);
    if (result != Steinberg::kResultOk)
    {
        return result;
    }

    addAudioInput(STR16("Input"), Steinberg::Vst::SpeakerArr::kStereo);
    addAudioOutput(STR16("Output"), Steinberg::Vst::SpeakerArr::kStereo);
    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::setState(Steinberg::IBStream* state)
{
    if (!state) return Steinberg::kResultFalse;
    Steinberg::IBStreamer streamer(state, kLittleEndian);
    double savedStrength = 1.0;
    if (!streamer.readDouble(savedStrength)) savedStrength = 1.0;
    // Older presets contain only Strength.
    double savedMaxTransition = 1.0;
    if (!streamer.readDouble(savedMaxTransition)) savedMaxTransition = 1.0;
    double savedMode = 0.0;
    if (!streamer.readDouble(savedMode)) savedMode = 0.0;
    double savedRepair = 0.0;
    if (!streamer.readDouble(savedRepair)) savedRepair = 0.0;
    const auto normalized = std::isfinite(savedStrength) ? std::clamp(savedStrength, 0.0, 1.0) : 1.0;
    const auto maxNormalized = std::isfinite(savedMaxTransition)
        ? std::clamp(savedMaxTransition, 0.0, 1.0) : 1.0;
    restoreEpoch_.fetch_add(1, std::memory_order_acq_rel);
    pendingStrength_.store(normalized, std::memory_order_relaxed);
    pendingMaxTransition_.store(maxNormalized, std::memory_order_relaxed);
    pendingMode_.store(std::isfinite(savedMode) ? std::clamp(savedMode, 0.0, 1.0) : 0.0,
        std::memory_order_relaxed);
    pendingRepair_.store(std::isfinite(savedRepair) ? std::clamp(savedRepair, 0.0, 1.0) : 0.0,
        std::memory_order_relaxed);
    restoreGeneration_.fetch_add(1, std::memory_order_release);
    restoreEpoch_.fetch_add(1, std::memory_order_release);
    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::getState(Steinberg::IBStream* state)
{
    if (!state) return Steinberg::kResultFalse;
    Steinberg::IBStreamer streamer(state, kLittleEndian);
    // Read a stable pair while the host may be processing audio or restoring state.
    double strength = 1.0;
    double maxTransition = 1.0;
    double mode = 0.0;
    double repair = 0.0;
    for (;;)
    {
        const auto restoreStart = restoreEpoch_.load(std::memory_order_acquire);
        const auto audioStart = audioEpoch_.load(std::memory_order_acquire);
        if ((restoreStart & 1U) != 0 || (audioStart & 1U) != 0) continue;
        const auto generation = restoreGeneration_.load(std::memory_order_acquire);
        if (audioGeneration_.load(std::memory_order_acquire) == generation)
        {
            strength = audioStrength_.load(std::memory_order_relaxed);
            maxTransition = audioMaxTransition_.load(std::memory_order_relaxed);
            mode = audioMode_.load(std::memory_order_relaxed);
            repair = audioRepair_.load(std::memory_order_relaxed);
        }
        else
        {
            strength = pendingStrength_.load(std::memory_order_relaxed);
            maxTransition = pendingMaxTransition_.load(std::memory_order_relaxed);
            mode = pendingMode_.load(std::memory_order_relaxed);
            repair = pendingRepair_.load(std::memory_order_relaxed);
        }
        if (generation == restoreGeneration_.load(std::memory_order_acquire) &&
            restoreStart == restoreEpoch_.load(std::memory_order_acquire) &&
            audioStart == audioEpoch_.load(std::memory_order_acquire))
            break;
    }
    return streamer.writeDouble(strength) && streamer.writeDouble(maxTransition) &&
        streamer.writeDouble(mode) && streamer.writeDouble(repair)
        ? Steinberg::kResultOk : Steinberg::kResultFalse;
}

void SmartTransitionProcessor::publishAudioState(Steinberg::uint64 generation) noexcept
{
    audioEpoch_.fetch_add(1, std::memory_order_acq_rel);
    audioStrength_.store(dsp_.strength(), std::memory_order_relaxed);
    audioMaxTransition_.store((dsp_.maxTransitionMilliseconds() - 1.0) / 3.0,
        std::memory_order_relaxed);
    audioMode_.store(static_cast<double>(dsp_.mode()) / 3.0, std::memory_order_relaxed);
    audioRepair_.store(dsp_.repairAuto() ? 1.0 : 0.0, std::memory_order_relaxed);
    audioGeneration_.store(generation, std::memory_order_release);
    audioEpoch_.fetch_add(1, std::memory_order_release);
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::setActive(Steinberg::TBool state)
{
    dsp_.reset();
    return AudioEffect::setActive(state);
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::setProcessing(Steinberg::TBool state)
{
    dsp_.reset();
    return AudioEffect::setProcessing(state);
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::setupProcessing(Steinberg::Vst::ProcessSetup& setup)
{
    const auto result = AudioEffect::setupProcessing(setup);
    if (result == Steinberg::kResultOk)
    {
        dsp_.configure(setup.sampleRate);
    }
    return result;
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::setBusArrangements(
    Steinberg::Vst::SpeakerArrangement* inputs,
    Steinberg::int32 numIns,
    Steinberg::Vst::SpeakerArrangement* outputs,
    Steinberg::int32 numOuts)
{
    if (numIns != 1 || numOuts != 1)
    {
        return Steinberg::kResultFalse;
    }

    const auto inputChannels = Steinberg::Vst::SpeakerArr::getChannelCount(inputs[0]);
    const auto outputChannels = Steinberg::Vst::SpeakerArr::getChannelCount(outputs[0]);
    if (inputChannels != outputChannels || (inputChannels != 1 && inputChannels != 2))
    {
        return Steinberg::kResultFalse;
    }

    getAudioInput(0)->setArrangement(inputs[0]);
    getAudioOutput(0)->setArrangement(outputs[0]);
    dsp_.reset();
    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::canProcessSampleSize(Steinberg::int32 symbolicSampleSize)
{
    return symbolicSampleSize == Steinberg::Vst::kSample32 || symbolicSampleSize == Steinberg::Vst::kSample64
        ? Steinberg::kResultTrue
        : Steinberg::kResultFalse;
}

Steinberg::uint32 PLUGIN_API SmartTransitionProcessor::getLatencySamples()
{
    return static_cast<Steinberg::uint32>(dsp_.latencySamples());
}

Steinberg::uint32 PLUGIN_API SmartTransitionProcessor::getTailSamples()
{
    // Lookahead is reported as latency. Smart Transition generates no post-input effect tail.
    return Steinberg::Vst::kNoTail;
}

template <typename Sample>
bool SmartTransitionProcessor::processBlock(
    Sample** input,
    Sample** output,
    Steinberg::int32 channels,
    Steinberg::int32 samples,
    Steinberg::uint64 inputSilenceFlags,
    Steinberg::Vst::IParamValueQueue* strengthQueue,
    Steinberg::Vst::IParamValueQueue* maxTransitionQueue,
    Steinberg::Vst::IParamValueQueue* modeQueue,
    Steinberg::Vst::IParamValueQueue* repairQueue) noexcept
{
    // Process continuous VST3 automation at its sample offsets, not per block.
    auto previousOffset = Steinberg::int32{-1};
    auto previousValue = dsp_.strength();
    auto nextOffset = Steinberg::int32{0};
    auto nextValue = previousValue;
    auto pointIndex = Steinberg::int32{0};
    const auto pointCount = strengthQueue ? strengthQueue->getPointCount() : 0;
    auto hasNext = false;
    const auto advancePoint = [&]() noexcept
    {
        hasNext = false;
        while (pointIndex < pointCount)
        {
            Steinberg::int32 offset = 0;
            Steinberg::Vst::ParamValue value = 1.0;
            if (strengthQueue->getPoint(pointIndex++, offset, value) != Steinberg::kResultTrue ||
                offset < 0 || offset >= samples || offset < previousOffset)
                continue;
            nextOffset = offset;
            nextValue = std::isfinite(value) ? std::clamp(value, 0.0, 1.0) : 1.0;
            hasNext = true;
            break;
        }
    };
    advancePoint();

    // Discrete 1/2/3/4 ms automation is a step at the original source offset.
    // DSP retains each value alongside its source sample until the seam commits.
    Steinberg::int32 maxPointIndex = 0;
    Steinberg::int32 maxNextOffset = 0;
    double maxNextValue = 1.0;
    bool hasNextMax = false;
    const auto maxPointCount = maxTransitionQueue ? maxTransitionQueue->getPointCount() : 0;
    const auto advanceMaxPoint = [&]() noexcept
    {
        hasNextMax = false;
        while (maxPointIndex < maxPointCount)
        {
            Steinberg::int32 offset = 0;
            Steinberg::Vst::ParamValue normalized = 1.0;
            if (maxTransitionQueue->getPoint(maxPointIndex++, offset, normalized) != Steinberg::kResultTrue ||
                offset < 0 || offset >= samples || offset < maxNextOffset)
                continue;
            maxNextOffset = offset;
            maxNextValue = std::isfinite(normalized) ? std::clamp(normalized, 0.0, 1.0) : 1.0;
            hasNextMax = true;
            break;
        }
    };
    advanceMaxPoint();

    Steinberg::int32 modePointIndex = 0;
    Steinberg::int32 nextModeOffset = 0;
    double nextModeValue = 0.0;
    bool hasNextMode = false;
    const auto modePointCount = modeQueue ? modeQueue->getPointCount() : 0;
    const auto advanceModePoint = [&]() noexcept
    {
        hasNextMode = false;
        while (modePointIndex < modePointCount)
        {
            Steinberg::int32 offset = 0;
            Steinberg::Vst::ParamValue normalized = 0.0;
            if (modeQueue->getPoint(modePointIndex++, offset, normalized) != Steinberg::kResultTrue ||
                offset < 0 || offset >= samples || offset < nextModeOffset)
                continue;
            nextModeOffset = offset;
            nextModeValue = normalized;
            hasNextMode = true;
            break;
        }
    };
    advanceModePoint();

    Steinberg::int32 repairPointIndex = 0;
    Steinberg::int32 repairNextOffset = 0;
    double repairNextValue = 0.0;
    bool hasNextRepair = false;
    const auto repairPointCount = repairQueue ? repairQueue->getPointCount() : 0;
    const auto advanceRepairPoint = [&]() noexcept
    {
        hasNextRepair = false;
        while (repairPointIndex < repairPointCount)
        {
            Steinberg::int32 offset = 0;
            Steinberg::Vst::ParamValue value = 0.0;
            if (repairQueue->getPoint(repairPointIndex++, offset, value) != Steinberg::kResultTrue ||
                offset < 0 || offset >= samples || offset < repairNextOffset)
                continue;
            repairNextOffset = offset;
            repairNextValue = value;
            hasNextRepair = true;
            break;
        }
    };
    advanceRepairPoint();
    bool allSilent = true;
    const auto channelCount = std::clamp<Steinberg::int32>(channels, 1, 2);

    for (Steinberg::int32 sample = 0; sample < samples; ++sample)
    {
        while (hasNextRepair && repairNextOffset <= sample)
        {
            dsp_.setRepairAuto(std::isfinite(repairNextValue) && repairNextValue >= 0.5);
            advanceRepairPoint();
        }
        while (hasNextMode && nextModeOffset <= sample)
        {
            dsp_.setMode(modeFromNormalized(nextModeValue));
            advanceModePoint();
        }
        while (hasNextMax && maxNextOffset <= sample)
        {
            dsp_.setMaxTransitionMilliseconds(maxTransitionMillisecondsFromNormalized(maxNextValue));
            advanceMaxPoint();
        }
        while (hasNext && nextOffset <= sample)
        {
            previousOffset = nextOffset;
            previousValue = nextValue;
            advancePoint();
        }

        const auto strength = hasNext && nextOffset > previousOffset
            ? previousValue + (nextValue - previousValue) *
                static_cast<double>(sample - previousOffset) /
                static_cast<double>(nextOffset - previousOffset)
            : previousValue;
        dsp_.setStrength(strength);

        std::array<double, Travny::Audio::SmartTransitionDsp::kMaxChannels> inputFrame{};
        std::array<double, Travny::Audio::SmartTransitionDsp::kMaxChannels> outputFrame{};
        for (Steinberg::int32 channel = 0; channel < channelCount; ++channel)
        {
            const auto bit = Steinberg::uint64{1} << static_cast<Steinberg::uint32>(channel);
            const auto* channelInput = input != nullptr ? input[channel] : nullptr;
            const auto channelIsSilent = (inputSilenceFlags & bit) != 0 || channelInput == nullptr;
            inputFrame[static_cast<std::size_t>(channel)] = channelIsSilent
                ? 0.0
                : static_cast<double>(channelInput[sample]);
        }

        // Always advance the DSP clock. If a host supplies no writable buffer for a channel,
        // outputFrame is the fixed-size discard sink for that channel and no allocation is needed.
        dsp_.processFrame(inputFrame.data(), outputFrame.data(), static_cast<std::size_t>(channelCount));
        for (Steinberg::int32 channel = 0; channel < channelCount; ++channel)
        {
            const auto value = static_cast<Sample>(outputFrame[static_cast<std::size_t>(channel)]);
            auto* channelOutput = output != nullptr ? output[channel] : nullptr;
            if (channelOutput != nullptr)
            {
                channelOutput[sample] = value;
            }
            allSilent = allSilent && value == static_cast<Sample>(0);
        }
    }

    return allSilent;
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::process(Steinberg::Vst::ProcessData& data)
{
    // One bounded snapshot attempt. The audio thread never spins while
    // setState() publishes a new preset; an incomplete restore waits until
    // the next process block.
    const auto restoreStart = restoreEpoch_.load(std::memory_order_acquire);
    if ((restoreStart & 1U) == 0)
    {
        const auto restoredGeneration = restoreGeneration_.load(std::memory_order_acquire);
        if (restoredGeneration != appliedRestoreGeneration_)
        {
            const auto strength = pendingStrength_.load(std::memory_order_relaxed);
            const auto maxTransition = pendingMaxTransition_.load(std::memory_order_relaxed);
            const auto mode = pendingMode_.load(std::memory_order_relaxed);
            const auto repair = pendingRepair_.load(std::memory_order_relaxed);
            std::atomic_thread_fence(std::memory_order_acquire);
            if (restoreStart == restoreEpoch_.load(std::memory_order_acquire) &&
                restoredGeneration == restoreGeneration_.load(std::memory_order_acquire))
            {
                dsp_.setStrength(strength);
                dsp_.setMaxTransitionMilliseconds(maxTransitionMillisecondsFromNormalized(maxTransition));
                dsp_.setMode(modeFromNormalized(mode));
                dsp_.setRepairAuto(repair >= 0.5);
                appliedRestoreGeneration_ = restoredGeneration;
            }
        }
    }

    // Publish only the generation actually applied to DSP.
    const auto generation = appliedRestoreGeneration_;

    auto* strengthQueue = findParameterQueue(data.inputParameterChanges, kSmartTransitionStrengthId);
    auto* maxQueue = findParameterQueue(data.inputParameterChanges, kSmartTransitionMaxTransitionId);
    auto* modeQueue = findParameterQueue(data.inputParameterChanges, kSmartTransitionModeId);
    auto* repairQueue = findParameterQueue(data.inputParameterChanges, kSmartTransitionRepairId);
    if (data.numSamples <= 0)
    {
        // Hosts may flush only parameter changes without audio buffers.
        if (strengthQueue && strengthQueue->getPointCount() > 0)
        {
            Steinberg::int32 offset = 0;
            Steinberg::Vst::ParamValue value = 1.0;
            if (strengthQueue->getPoint(strengthQueue->getPointCount() - 1, offset, value) == Steinberg::kResultTrue)
                dsp_.setStrength(value);
        }
        if (maxQueue)
        {
            for (Steinberg::int32 i = 0; i < maxQueue->getPointCount(); ++i)
            {
                Steinberg::int32 offset = 0;
                Steinberg::Vst::ParamValue normalized = 1.0;
                if (maxQueue->getPoint(i, offset, normalized) == Steinberg::kResultTrue && offset >= 0)
                    dsp_.setMaxTransitionMilliseconds(
                        maxTransitionMillisecondsFromNormalized(normalized));
            }
        }
        if (modeQueue)
        {
            for (Steinberg::int32 i = 0; i < modeQueue->getPointCount(); ++i)
            {
                Steinberg::int32 offset = 0;
                Steinberg::Vst::ParamValue normalized = 0.0;
                if (modeQueue->getPoint(i, offset, normalized) == Steinberg::kResultTrue && offset >= 0)
                    dsp_.setMode(modeFromNormalized(normalized));
            }
        }
        if (repairQueue)
        {
            for (Steinberg::int32 i = 0; i < repairQueue->getPointCount(); ++i)
            {
                Steinberg::int32 offset = 0;
                Steinberg::Vst::ParamValue value = 0.0;
                if (repairQueue->getPoint(i, offset, value) == Steinberg::kResultTrue && offset >= 0)
                    dsp_.setRepairAuto(std::isfinite(value) && value >= 0.5);
            }
        }
        publishAudioState(generation);
        return Steinberg::kResultOk;
    }
    if (data.numInputs == 0 || data.numOutputs == 0)
        return Steinberg::kResultOk;

    const auto channels = data.inputs[0].numChannels;
    if (channels < 1 || channels > 2 || data.outputs[0].numChannels != channels)
    {
        return Steinberg::kResultFalse;
    }

    const auto silenceMask = channelMask(channels);
    const auto inputSilenceFlags = data.inputs[0].silenceFlags;
    Steinberg::uint64 unavailableOutputs = 0;
    bool allSilent = false;
    if (data.symbolicSampleSize == Steinberg::Vst::kSample32)
    {
        auto** output = data.outputs[0].channelBuffers32;
        unavailableOutputs = missingOutputMask(output, channels);
        allSilent = processBlock(
            data.inputs[0].channelBuffers32,
            output,
            channels,
            data.numSamples,
            inputSilenceFlags,
            strengthQueue,
            maxQueue,
            modeQueue,
            repairQueue);
    }
    else if (data.symbolicSampleSize == Steinberg::Vst::kSample64)
    {
        auto** output = data.outputs[0].channelBuffers64;
        unavailableOutputs = missingOutputMask(output, channels);
        allSilent = processBlock(
            data.inputs[0].channelBuffers64,
            output,
            channels,
            data.numSamples,
            inputSilenceFlags,
            strengthQueue,
            maxQueue,
            modeQueue,
            repairQueue);
    }
    else
    {
        return Steinberg::kResultFalse;
    }

    data.outputs[0].silenceFlags = allSilent ? silenceMask : unavailableOutputs;
    publishAudioState(generation);
    return Steinberg::kResultOk;
}

} // namespace Travny::Vst3
