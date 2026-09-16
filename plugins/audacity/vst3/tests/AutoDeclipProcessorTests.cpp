#include "AutoDeclipProcessor.h"

#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/vstspeaker.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <type_traits>
#include <vector>

namespace {

void require(bool condition, const char* message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

template <typename Sample>
std::vector<std::vector<Sample>> makeInput(int channels)
{
    constexpr std::size_t kSamples = 192;
    std::vector<std::vector<Sample>> input(channels, std::vector<Sample>(kSamples));
    for (int channel = 0; channel < channels; ++channel)
    {
        const auto sign = channel == 0 ? 1.0 : -1.0;
        for (std::size_t i = 0; i < kSamples; ++i)
        {
            const auto value = sign * (0.18 + 0.05 * std::sin(static_cast<double>(i) * 0.07));
            input[channel][i] = static_cast<Sample>(value);
        }

        input[channel][60] = static_cast<Sample>(sign * 0.72);
        input[channel][61] = static_cast<Sample>(sign * 0.86);
        for (std::size_t i = 62; i <= 65; ++i)
        {
            input[channel][i] = static_cast<Sample>(sign);
        }
        input[channel][66] = static_cast<Sample>(sign * 0.87);
        input[channel][67] = static_cast<Sample>(sign * 0.73);
    }
    return input;
}

template <typename Sample>
std::vector<std::vector<Sample>> render(
    int channels,
    Steinberg::int32 sampleSize,
    const std::vector<Steinberg::int32>& blocks)
{
    Travny::Vst3::AutoDeclipProcessor processor;
    require(processor.initialize(nullptr) == Steinberg::kResultOk, "processor initialization failed");

    auto arrangement = channels == 1
        ? Steinberg::Vst::SpeakerArr::kMono
        : Steinberg::Vst::SpeakerArr::kStereo;
    auto outputArrangement = arrangement;
    require(processor.setBusArrangements(&arrangement, 1, &outputArrangement, 1) == Steinberg::kResultOk,
            "processor rejected supported bus arrangement");
    require(processor.canProcessSampleSize(sampleSize) == Steinberg::kResultTrue,
            "processor rejected supported sample size");
    require(processor.getLatencySamples() == 66, "processor latency contract changed");

    Steinberg::Vst::ProcessSetup setup{};
    setup.processMode = Steinberg::Vst::kRealtime;
    setup.symbolicSampleSize = sampleSize;
    setup.maxSamplesPerBlock = 192;
    setup.sampleRate = 48000.0;
    require(processor.setupProcessing(setup) == Steinberg::kResultOk,
            "processor setup failed");
    require(processor.setActive(true) == Steinberg::kResultOk,
            "processor activation failed");

    auto input = makeInput<Sample>(channels);
    std::vector<std::vector<Sample>> output(channels, std::vector<Sample>(input[0].size()));
    std::size_t offset = 0;
    for (const auto blockSamples : blocks)
    {
        require(blockSamples > 0, "invalid test block size");
        require(offset + static_cast<std::size_t>(blockSamples) <= input[0].size(),
                "test block exceeds fixture");

        std::vector<Sample*> inputPointers(channels);
        std::vector<Sample*> outputPointers(channels);
        for (int channel = 0; channel < channels; ++channel)
        {
            inputPointers[channel] = input[channel].data() + offset;
            outputPointers[channel] = output[channel].data() + offset;
        }

        Steinberg::Vst::AudioBusBuffers inputBus{};
        inputBus.numChannels = channels;
        Steinberg::Vst::AudioBusBuffers outputBus{};
        outputBus.numChannels = channels;

        if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>)
        {
            inputBus.channelBuffers32 = inputPointers.data();
            outputBus.channelBuffers32 = outputPointers.data();
        }
        else
        {
            inputBus.channelBuffers64 = inputPointers.data();
            outputBus.channelBuffers64 = outputPointers.data();
        }
        Steinberg::Vst::ProcessData data{};
        data.processMode = Steinberg::Vst::kRealtime;
        data.symbolicSampleSize = sampleSize;
        data.numSamples = blockSamples;
        data.numInputs = 1;
        data.numOutputs = 1;
        data.inputs = &inputBus;
        data.outputs = &outputBus;

        require(processor.process(data) == Steinberg::kResultOk,
                "processor rejected a valid audio block");
        offset += static_cast<std::size_t>(blockSamples);
    }

    require(offset == input[0].size(), "test blocks did not cover the fixture");
    processor.setActive(false);
    processor.terminate();
    return output;
}

template <typename Sample>
void requireLatencyAndSignal(const std::vector<std::vector<Sample>>& output)
{
    constexpr std::size_t kLatency = 66;
    for (const auto& channel : output)
    {
        for (std::size_t i = 0; i < kLatency; ++i)
        {
            require(channel[i] == Sample{0}, "audio escaped before reported latency");
        }
        const auto hasPostLatencySignal = std::any_of(
            channel.begin() + static_cast<std::ptrdiff_t>(kLatency),
            channel.end(),
            [](Sample value) { return value != Sample{0}; });
        require(hasPostLatencySignal, "processor produced no post-latency signal");
    }
}

template <typename Sample>
void testFormatAndBlockContinuity(int channels, Steinberg::int32 sampleSize)
{
    const auto oneBlock = render<Sample>(channels, sampleSize, {192});
    const auto splitBlocks = render<Sample>(channels, sampleSize, {64, 128});

    requireLatencyAndSignal(oneBlock);
    require(oneBlock.size() == splitBlocks.size(), "channel count changed across renders");
    for (std::size_t channel = 0; channel < oneBlock.size(); ++channel)
    {
        require(oneBlock[channel] == splitBlocks[channel],
                "output changed when a clipping run crossed process-block boundary");
    }
}

} // namespace

int main()
{
    try
    {
        testFormatAndBlockContinuity<Steinberg::Vst::Sample32>(1, Steinberg::Vst::kSample32);
        testFormatAndBlockContinuity<Steinberg::Vst::Sample32>(2, Steinberg::Vst::kSample32);
        testFormatAndBlockContinuity<Steinberg::Vst::Sample64>(1, Steinberg::Vst::kSample64);
        testFormatAndBlockContinuity<Steinberg::Vst::Sample64>(2, Steinberg::Vst::kSample64);
        std::cout << "Auto Declip processor tests passed\n";
        return EXIT_SUCCESS;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
