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

[[nodiscard]] Steinberg::Vst::IParamValueQueue* findStrengthQueue(
    Steinberg::Vst::IParameterChanges* changes) noexcept
{
    if (!changes) return nullptr;
    for (Steinberg::int32 index = 0; index < changes->getParameterCount(); ++index)
    {
        auto* queue = changes->getParameterData(index);
        if (queue && queue->getParameterId() == kSmartTransitionStrengthId)
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
    dsp_.setStrength(savedStrength);
    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API SmartTransitionProcessor::getState(Steinberg::IBStream* state)
{
    if (!state) return Steinberg::kResultFalse;
    Steinberg::IBStreamer streamer(state, kLittleEndian);
    return streamer.writeDouble(dsp_.strength()) ? Steinberg::kResultOk : Steinberg::kResultFalse;
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
    Steinberg::Vst::IParamValueQueue* strengthQueue) noexcept
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

    bool allSilent = true;
    const auto channelCount = std::clamp<Steinberg::int32>(channels, 1, 2);

    for (Steinberg::int32 sample = 0; sample < samples; ++sample)
    {
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
    auto* strengthQueue = findStrengthQueue(data.inputParameterChanges);

    if (data.numInputs == 0 || data.numOutputs == 0 || data.numSamples <= 0)
    {
        return Steinberg::kResultOk;
    }

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
            strengthQueue);
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
            strengthQueue);
    }
    else
    {
        return Steinberg::kResultFalse;
    }

    data.outputs[0].silenceFlags = allSilent ? silenceMask : unavailableOutputs;
    return Steinberg::kResultOk;
}

} // namespace Travny::Vst3
