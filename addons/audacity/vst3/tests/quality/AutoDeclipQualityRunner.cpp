#include "AutoDeclipDsp.h"
#include "DeClickDsp.h"
#include "DeHumDsp.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

struct WavData {
    std::uint16_t channels{};
    std::uint16_t bits{};
    std::uint32_t sampleRate{};
    std::vector<std::int32_t> samples;
};

std::uint16_t read16(const unsigned char* p) {
    return static_cast<std::uint16_t>(p[0] | (p[1] << 8));
}

std::uint32_t read32(const unsigned char* p) {
    return static_cast<std::uint32_t>(p[0]) |
           (static_cast<std::uint32_t>(p[1]) << 8) |
           (static_cast<std::uint32_t>(p[2]) << 16) |
           (static_cast<std::uint32_t>(p[3]) << 24);
}

void write16(std::ostream& out, std::uint16_t value) {
    const std::array<char, 2> bytes{static_cast<char>(value), static_cast<char>(value >> 8)};
    out.write(bytes.data(), bytes.size());
}

void write32(std::ostream& out, std::uint32_t value) {
    const std::array<char, 4> bytes{
        static_cast<char>(value), static_cast<char>(value >> 8),
        static_cast<char>(value >> 16), static_cast<char>(value >> 24)};
    out.write(bytes.data(), bytes.size());
}

WavData readWav(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    if (!in) throw std::runtime_error("cannot open input WAV");
    std::array<unsigned char, 12> header{};
    in.read(reinterpret_cast<char*>(header.data()), header.size());
    if (!in || std::string(reinterpret_cast<char*>(header.data()), 4) != "RIFF" ||
        std::string(reinterpret_cast<char*>(header.data() + 8), 4) != "WAVE")
        throw std::runtime_error("expected RIFF/WAVE input");

    WavData wav;
    std::uint16_t format = 0;
    std::vector<unsigned char> data;
    while (in) {
        std::array<unsigned char, 8> chunk{};
        in.read(reinterpret_cast<char*>(chunk.data()), chunk.size());
        if (!in) break;
        const std::string id(reinterpret_cast<char*>(chunk.data()), 4);
        const auto size = read32(chunk.data() + 4);
        std::vector<unsigned char> bytes(size);
        in.read(reinterpret_cast<char*>(bytes.data()), size);
        if (!in) throw std::runtime_error("truncated WAV chunk");
        if (id == "fmt ") {
            if (size < 16) throw std::runtime_error("invalid fmt chunk");
            format = read16(bytes.data());
            wav.channels = read16(bytes.data() + 2);
            wav.sampleRate = read32(bytes.data() + 4);
            wav.bits = read16(bytes.data() + 14);
        } else if (id == "data") {
            data = std::move(bytes);
        }
        if (size & 1U) in.get();
    }

    if (format != 1 || (wav.channels != 1 && wav.channels != 2) ||
        (wav.bits != 16 && wav.bits != 24 && wav.bits != 32) || data.empty())
        throw std::runtime_error("expected mono/stereo PCM16/24/32 WAV");
    const std::size_t width = wav.bits / 8;
    if (data.size() % (width * wav.channels) != 0)
        throw std::runtime_error("misaligned WAV data");
    wav.samples.reserve(data.size() / width);
    for (std::size_t i = 0; i < data.size(); i += width) {
        std::uint32_t raw = 0;
        for (std::size_t byte = 0; byte < width; ++byte)
            raw |= static_cast<std::uint32_t>(data[i + byte]) << (8 * byte);
        if (width < 4 && (raw & (1U << (wav.bits - 1))))
            raw |= ~((1U << wav.bits) - 1U);
        wav.samples.push_back(static_cast<std::int32_t>(raw));
    }
    return wav;
}

void writeWav(const std::string& path, const WavData& wav) {
    std::ofstream out(path, std::ios::binary);
    if (!out) throw std::runtime_error("cannot open output WAV");
    const std::uint16_t width = wav.bits / 8;
    const auto dataSize = static_cast<std::uint32_t>(wav.samples.size() * width);
    out.write("RIFF", 4); write32(out, 36 + dataSize); out.write("WAVE", 4);
    out.write("fmt ", 4); write32(out, 16); write16(out, 1); write16(out, wav.channels);
    write32(out, wav.sampleRate);
    write32(out, wav.sampleRate * wav.channels * width);
    write16(out, static_cast<std::uint16_t>(wav.channels * width));
    write16(out, wav.bits);
    out.write("data", 4); write32(out, dataSize);
    for (const auto sample : wav.samples) {
        const auto raw = static_cast<std::uint32_t>(sample);
        for (std::uint16_t byte = 0; byte < width; ++byte)
            out.put(static_cast<char>(raw >> (8 * byte)));
    }
}

WavData process(const WavData& input, bool pipeline) {
    using Travny::Audio::AutoDeclipDsp;
    using Travny::Audio::DeClickDsp;
    using Travny::Audio::DeHumDsp;
    WavData output = input;
    output.samples.assign(input.samples.size(), 0);
    const std::size_t frames = input.samples.size() / input.channels;
    const double scale = std::ldexp(1.0, input.bits - 1);
    const auto minimum = static_cast<std::int64_t>(-scale);
    const auto maximum = static_cast<std::int64_t>(scale - 1.0);
    std::vector<AutoDeclipDsp> declip(input.channels);
    std::vector<DeClickDsp> deClick(input.channels);
    std::vector<DeHumDsp> deHum(input.channels);
    for (auto& channel : deHum) channel.configure(input.sampleRate);
    const std::size_t latency = AutoDeclipDsp::kLatencySamples
        + (pipeline ? DeClickDsp::kLatencySamples : 0);

    for (std::size_t streamFrame = 0; streamFrame < frames + latency; ++streamFrame) {
        for (std::size_t channel = 0; channel < input.channels; ++channel) {
            const double source = streamFrame < frames
                ? static_cast<double>(input.samples[streamFrame * input.channels + channel]) / scale
                : 0.0;
            double rendered = declip[channel].processSample(source);
            if (pipeline) {
                rendered = deClick[channel].processSample(rendered);
                rendered = deHum[channel].processSample(rendered);
            }
            if (streamFrame < latency) continue;
            const auto frame = streamFrame - latency;
            if (frame >= frames) continue;
            const auto quantized = std::clamp<std::int64_t>(
                static_cast<std::int64_t>(std::llround(rendered * scale)), minimum, maximum);
            output.samples[frame * input.channels + channel] = static_cast<std::int32_t>(quantized);
        }
    }
    return output;
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc != 4 || (std::string(argv[3]) != "core" && std::string(argv[3]) != "pipeline")) {
            std::cerr << "usage: AutoDeclipQualityRunner <input.wav> <output.wav> <core|pipeline>\n";
            return 2;
        }
        const auto input = readWav(argv[1]);
        writeWav(argv[2], process(input, std::string(argv[3]) == "pipeline"));
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "AutoDeclipQualityRunner: " << error.what() << '\n';
        return 1;
    }
}
