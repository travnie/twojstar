#include "SmartTransitionProcessor.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/vstspeaker.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>

using Travny::Vst3::SmartTransitionProcessor;
constexpr int kRate = 48000;
constexpr int kStart = 557 * kRate / 100;
constexpr int kEnd = 650 * kRate / 100;
constexpr int kJoin = 6 * kRate - kStart;
constexpr int kPrime = 64;
constexpr double kPi = 3.14159265358979323846;

using Frame = std::array<float, 2>;

std::vector<Frame> selection()
{
    std::vector<Frame> signal;
    signal.reserve(kEnd - kStart);
    for (int index = kStart; index < kEnd; ++index)
    {
        const double sample = 0.2 * std::sin(2 * kPi * 440.0 * index / kRate)
            + (index >= 6 * kRate ? 0.45 : 0.0);
        signal.push_back({static_cast<float>(sample),
            static_cast<float>(sample * 0.8)});
    }
    return signal;
}

std::vector<Frame> run(const std::vector<Frame>& signal, int blockSize)
{
    auto processor = std::make_unique<SmartTransitionProcessor>();
    if (processor->initialize(nullptr) != Steinberg::kResultOk)
        throw std::runtime_error("initialize");
    auto arrangement = Steinberg::Vst::SpeakerArr::kStereo;
    if (processor->setBusArrangements(&arrangement, 1, &arrangement, 1)
        != Steinberg::kResultOk)
        throw std::runtime_error("stereo arrangement");
    Steinberg::Vst::ProcessSetup setup{};
    setup.processMode = Steinberg::Vst::kOffline;
    setup.symbolicSampleSize = Steinberg::Vst::kSample32;
    setup.sampleRate = kRate;
    setup.maxSamplesPerBlock = 1024;
    if (processor->setupProcessing(setup) != Steinberg::kResultOk ||
        processor->setActive(true) != Steinberg::kResultOk)
        throw std::runtime_error("activate");
    const auto startResult = processor->setProcessing(true);
    if (startResult != Steinberg::kResultOk &&
        startResult != Steinberg::kNotImplemented)
        throw std::runtime_error("start processing");
    const auto latency = static_cast<int>(processor->getLatencySamples());
    if (latency <= 0) throw std::runtime_error("latency unreported");

    std::vector<Frame> raw;
    raw.reserve(kPrime + signal.size() + latency);
    auto processRegion = [&](const std::vector<Frame>& input, int chunk)
    {
        for (std::size_t start = 0; start < input.size();)
        {
            const int count = static_cast<int>(std::min(
                input.size() - start, static_cast<std::size_t>(chunk)));
            std::vector<float> left(count), right(count), outLeft(count), outRight(count);
            for (int i = 0; i < count; ++i)
            {
                left[i] = input[start + i][0];
                right[i] = input[start + i][1];
            }
            float* inputChannels[] = {left.data(), right.data()};
            float* outputChannels[] = {outLeft.data(), outRight.data()};
            Steinberg::Vst::AudioBusBuffers inputBus{};
            Steinberg::Vst::AudioBusBuffers outputBus{};
            inputBus.numChannels = 2;
            outputBus.numChannels = 2;
            inputBus.channelBuffers32 = inputChannels;
            outputBus.channelBuffers32 = outputChannels;
            Steinberg::Vst::ProcessData data{};
            data.processMode = Steinberg::Vst::kOffline;
            data.symbolicSampleSize = Steinberg::Vst::kSample32;
            data.numSamples = count;
            data.numInputs = 1;
            data.numOutputs = 1;
            data.inputs = &inputBus;
            data.outputs = &outputBus;
            if (processor->process(data) != Steinberg::kResultOk)
                throw std::runtime_error("process");
            for (int i = 0; i < count; ++i)
                raw.push_back({outLeft[i], outRight[i]});
            start += count;
        }
    };

    // Audacity VST3Wrapper::Initialize() always feeds this distinct 64-frame
    // silence block *after* setProcessing(true), before the actual selection.
    processRegion(std::vector<Frame>(kPrime), kPrime);
    processRegion(signal, blockSize);
    processRegion(std::vector<Frame>(static_cast<std::size_t>(latency)), blockSize);

    const auto stopResult = processor->setProcessing(false);
    if ((stopResult != Steinberg::kResultOk &&
         stopResult != Steinberg::kNotImplemented) ||
        processor->setActive(false) != Steinberg::kResultOk ||
        processor->terminate() != Steinberg::kResultOk)
        throw std::runtime_error("deactivate");
    const auto begin = raw.begin() + static_cast<std::ptrdiff_t>(kPrime + latency);
    return {begin, begin + static_cast<std::ptrdiff_t>(signal.size())};
}

void verify(const std::vector<Frame>& input, const std::vector<Frame>& output)
{
    if (input.size() != output.size()) throw std::runtime_error("wrong frame count");
    for (int i = 0; i < 2; ++i)
    {
        double startDelta = 0.0;
        double joinDelta = 0.0;
        for (std::size_t s = 0; s < input.size(); ++s)
        {
            const auto delta = std::abs(input[s][i] - output[s][i]);
            if (s < 960) startDelta = std::max(startDelta, static_cast<double>(delta));
            if (std::abs(static_cast<int>(s) - kJoin) < 192)
                joinDelta = std::max(joinDelta, static_cast<double>(delta));
        }
        std::cout << "channel=" << i
                  << " start_delta=" << startDelta
                  << " join_delta=" << joinDelta << '\n';
        if (startDelta > 1e-6)
            throw std::runtime_error("VST3 primer altered selection start");
        if (joinDelta < 0.05)
            throw std::runtime_error("VST3 adapter missed actual 6s join");
    }
}

int main()
{
    try
    {
        const auto input = selection();
        const auto single = run(input, 1024);
        verify(input, single);
        for (const int chunk : {13, 64, 256, 511})
        {
            const auto other = run(input, chunk);
            if (single != other)
                throw std::runtime_error("VST3 block partition changed audio");
        }
        // The right channel starts 16 samples after the left. Its onboarding
        // boundary must not steal the true 6-second join.
        auto staggered = input;
        for (int i = 0; i < 16; ++i)
            staggered[static_cast<std::size_t>(i)][1] = 0.0f;
        const auto staggeredReference = run(staggered, 1024);
        verify(staggered, staggeredReference);
        for (const int chunk : {13, 64, 256, 511})
        {
            if (run(staggered, chunk) != staggeredReference)
                throw std::runtime_error("Staggered-onset VST3 chunk drift");
        }
        std::cout << "VST3 priming and block-boundary regression passed\n";
        return EXIT_SUCCESS;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
