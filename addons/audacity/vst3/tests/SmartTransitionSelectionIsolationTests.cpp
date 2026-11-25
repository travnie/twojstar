#include "SmartTransitionDsp.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <vector>

using Travny::Audio::SmartTransitionDsp;
using Frame = std::array<double, 2>;

constexpr int kRate = 48000;
constexpr int kSeam = 6 * kRate;
constexpr int kSelectionStart = 557 * kRate / 100;
constexpr int kSelectionEnd = 650 * kRate / 100;
constexpr double kPi = 3.14159265358979323846;

std::vector<Frame> fixture()
{
    std::vector<Frame> result(12 * kRate);
    for (std::size_t i = 0; i < result.size(); ++i)
    {
        const auto value = 0.2 * std::sin(2 * kPi * 440.0 * i / kRate)
            + (static_cast<int>(i) >= kSeam ? 0.45 : 0.0);
        result[i] = {value, value * 0.8};
    }
    return result;
}

struct Result
{
    std::vector<Frame> audio;
    std::vector<Frame> primer;
    std::int64_t anchor{-1};
};

Result processSelection(const std::vector<Frame>& source,
                        int prefixSilence, const std::vector<std::size_t>& chunks)
{
    SmartTransitionDsp dsp;
    dsp.configure(kRate);
    std::vector<Frame> input(static_cast<std::size_t>(prefixSilence));
    input.insert(input.end(),
        source.begin() + kSelectionStart, source.begin() + kSelectionEnd);
    std::vector<Frame> raw;
    raw.reserve(input.size() + dsp.latencySamples());

    std::size_t position = 0;
    std::size_t index = 0;
    while (position < input.size())
    {
        auto count = std::min(input.size() - position,
            chunks[index++ % chunks.size()]);
        if (prefixSilence > 0 && position < static_cast<std::size_t>(prefixSilence))
            count = std::min(count, static_cast<std::size_t>(prefixSilence) - position);
        if (count == 0) throw std::runtime_error("Invalid chunk");
        for (std::size_t j = 0; j < count; ++j)
        {
            Frame output{};
            dsp.processFrame(input[position + j].data(), output.data(), 2);
            raw.push_back(output);
        }
        position += count;
        if (prefixSilence > 0 &&
            position >= static_cast<std::size_t>(prefixSilence) &&
            position - count < static_cast<std::size_t>(prefixSilence))
            dsp.markHostPrimer(prefixSilence);
    }
    for (std::size_t i = 0; i < dsp.latencySamples(); ++i)
    {
        Frame output{};
        dsp.drainFrame(output.data(), 2);
        raw.push_back(output);
    }

    Result result;
    // Check the compensated prefix independently. A real host can also map
    // samples outside the selection, which remains a separate host QA gate.
    result.primer.assign(raw.begin() + static_cast<std::ptrdiff_t>(dsp.latencySamples()),
        raw.begin() + static_cast<std::ptrdiff_t>(dsp.latencySamples()) + prefixSilence);
    result.audio.assign(raw.begin() + static_cast<std::ptrdiff_t>(dsp.latencySamples())
                       + prefixSilence,
        raw.begin() + static_cast<std::ptrdiff_t>(dsp.latencySamples())
                       + static_cast<std::ptrdiff_t>(input.size()));
    if (dsp.hasPlan())
        result.anchor = dsp.planWindowStartSamples() + dsp.plan().seamAnchorSamples
            - prefixSilence;
    return result;
}

void require(bool ok, const char* reason)
{
    if (!ok) throw std::runtime_error(reason);
}

int main()
{
    try
    {
        const auto source = fixture();
        const auto plain = processSelection(source, 0, {57, 1000, 13});
        const auto whole = processSelection(source, 0, {kSelectionEnd - kSelectionStart});
        const auto expected = kSeam - kSelectionStart;
        require(plain.anchor >= expected - 8 && plain.anchor <= expected + 8,
                "Isolated DSP selected the wrong seam");
        require(plain.audio == whole.audio, "Chunking changed compensated audio");

        // Differential diagnostic: some hosts may deliver a zero-filled
        // processing pre-roll before the actual selected samples.
        for (int prefix : {0, 48, 64, 128, 256, 4800})
        {
            const auto padded = processSelection(source, prefix, {13, 57, 512});
            double maxStartChange = 0.0;
            double maxSeamChange = 0.0;
            for (std::size_t i = 0; i < padded.audio.size(); ++i)
            {
                const auto absolute = kSelectionStart + static_cast<int>(i);
                const auto delta = std::abs(padded.audio[i][0] - source[absolute][0]);
                if (i < 2 * kRate / 100)
                    maxStartChange = std::max(maxStartChange, delta);
                if (std::abs(absolute - kSeam) < 4 * kRate / 1000)
                    maxSeamChange = std::max(maxSeamChange, delta);
            }
            std::cout << "prefix=" << prefix << " anchor=" << padded.anchor
                      << " expected=" << expected
                      << " start_delta=" << maxStartChange
                      << " seam_delta=" << maxSeamChange << '\n';
            for (const auto& frame : padded.primer)
                require(frame == Frame{0.0, 0.0},
                    "Compensated priming prefix contains non-silent output");
            require(padded.anchor >= expected - 8 &&
                        padded.anchor <= expected + 8,
                    "Priming silence stole the real splice candidate");
            require(padded.audio == plain.audio,
                    "Priming silence changed compensated selection output");
        }
        std::cout << "Smart Transition selection isolation passed\n";
        return 0;
    }
    catch (const std::exception& e)
    {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
