#include "AutoDeclipDsp.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <vector>

using Travny::Audio::AutoDeclipDsp;

namespace {

void require(bool condition, const char* message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

std::vector<double> render(const std::vector<double>& input)
{
    AutoDeclipDsp dsp;
    std::vector<double> output;
    output.reserve(input.size() + AutoDeclipDsp::kLatencySamples);

    for (double sample : input)
    {
        output.push_back(dsp.processSample(sample));
    }
    for (std::size_t i = 0; i < AutoDeclipDsp::kLatencySamples; ++i)
    {
        output.push_back(dsp.processSample(0.0));
    }
    return output;
}

std::vector<double> aligned(const std::vector<double>& rendered, std::size_t originalSize)
{
    return {rendered.begin() + static_cast<std::ptrdiff_t>(AutoDeclipDsp::kLatencySamples),
            rendered.begin() + static_cast<std::ptrdiff_t>(AutoDeclipDsp::kLatencySamples + originalSize)};
}

void testCleanPassThrough()
{
    std::vector<double> input(256);
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        input[i] = 0.8 * std::sin(static_cast<double>(i) * 0.07);
    }

    const auto output = aligned(render(input), input.size());
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        require(std::abs(output[i] - input[i]) < 1e-12, "clean audio changed");
    }
}

void testShortPositiveClipIsRepaired()
{
    std::vector<double> input(160, 0.0);
    input[76] = 0.72;
    input[77] = 0.86;
    input[78] = 1.0;
    input[79] = 1.0;
    input[80] = 1.0;
    input[81] = 1.0;
    input[82] = 0.87;
    input[83] = 0.73;

    const auto output = aligned(render(input), input.size());
    for (std::size_t i = 78; i <= 81; ++i)
    {
        require(output[i] < 0.9995, "positive clipping plateau survived");
        require(output[i] > 0.86, "positive repair collapsed below clean edges");
    }
    require(std::abs(output[77] - input[77]) < 1e-12, "left clean edge changed");
    require(std::abs(output[82] - input[82]) < 1e-12, "right clean edge changed");
}

void testShortNegativeClipIsRepaired()
{
    std::vector<double> input(160, 0.0);
    input[76] = -0.71;
    input[77] = -0.85;
    input[78] = -1.0;
    input[79] = -1.0;
    input[80] = -1.0;
    input[81] = -0.86;
    input[82] = -0.72;

    const auto output = aligned(render(input), input.size());
    for (std::size_t i = 78; i <= 80; ++i)
    {
        require(output[i] > -0.9995, "negative clipping plateau survived");
        require(output[i] < -0.84, "negative repair collapsed above clean edges");
    }
}

void testGeneratedClipRepairReducesReferenceError()
{
    constexpr std::size_t kCenter = 80;
    constexpr std::size_t kClipStart = 78;
    constexpr std::size_t kClipEnd = 82;
    std::vector<double> clean(160);
    for (std::size_t i = 0; i < clean.size(); ++i)
    {
        clean[i] = 0.78 + 0.20 * std::cos((static_cast<double>(i) - kCenter) * 0.11);
    }

    auto damaged = clean;
    for (std::size_t i = kClipStart; i < kClipEnd; ++i)
    {
        damaged[i] = 1.0;
    }

    const auto repaired = aligned(render(damaged), damaged.size());
    double damagedError = 0.0;
    double repairedError = 0.0;
    for (std::size_t i = kClipStart; i < kClipEnd; ++i)
    {
        const double damagedDelta = damaged[i] - clean[i];
        const double repairedDelta = repaired[i] - clean[i];
        damagedError += damagedDelta * damagedDelta;
        repairedError += repairedDelta * repairedDelta;
    }

    require(damagedError > 0.0, "generated clipping fixture has no reference error");
    require(repairedError < damagedError * 0.02,
            "cubic declipping repair did not reduce generated clipping error by at least 98%");
}

void testHardLimitedMasterBelowClipThresholdIsUntouched()
{
    constexpr double kLimiterCeiling = 0.994;
    std::vector<double> input(4096);
    std::size_t limitedSamples = 0;
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        const double sample = 1.25 * std::sin(static_cast<double>(i) * 0.071)
            + 0.48 * std::sin(static_cast<double>(i) * 0.019 + 0.7)
            + 0.22 * std::sin(static_cast<double>(i) * 0.137 + 1.1);
        input[i] = std::clamp(sample, -kLimiterCeiling, kLimiterCeiling);
        limitedSamples += std::abs(input[i]) == kLimiterCeiling ? 1 : 0;
    }

    require(limitedSamples > 500, "fixture is not strongly hard-limited");
    const auto output = aligned(render(input), input.size());
    for (std::size_t i = 0; i < input.size(); ++i)
    {
        require(output[i] == input[i],
                "declipping detector changed intentionally limited audio below its clip threshold");
    }
}

void testNearStartClipUsesSafeLinearFallback()
{
    std::vector<double> input(96, 0.0);
    input[0] = 0.80;
    input[1] = 1.0;
    input[2] = 1.0;
    input[3] = 0.82;
    input[4] = 0.74;

    const auto output = aligned(render(input), input.size());
    require(output[1] > 0.80 && output[1] < 0.82,
            "near-start fallback did not interpolate the first clipped sample");
    require(output[2] > 0.80 && output[2] < 0.82,
            "near-start fallback did not interpolate the second clipped sample");
    require(output[0] == input[0] && output[3] == input[3],
            "near-start fallback changed clean edges");
}

void testMaxLengthClipFallsBackBeforeReclipping()
{
    constexpr std::size_t kStart = 80;
    std::vector<double> input(220, 0.0);
    input[kStart - 2] = 0.70;
    input[kStart - 1] = 0.80;
    for (std::size_t i = 0; i < AutoDeclipDsp::kMaxRepairSamples; ++i)
    {
        input[kStart + i] = 1.0;
    }
    input[kStart + AutoDeclipDsp::kMaxRepairSamples] = 0.80;
    input[kStart + AutoDeclipDsp::kMaxRepairSamples + 1] = 0.70;

    const auto output = aligned(render(input), input.size());
    for (std::size_t i = 0; i < AutoDeclipDsp::kMaxRepairSamples; ++i)
    {
        require(std::abs(output[kStart + i]) < AutoDeclipDsp::kClipThreshold,
                "Hermite overshoot recreated a clipped plateau");
    }
}

void testSinglePeakIsUntouched()
{
    std::vector<double> input(140, 0.0);
    input[70] = 1.0;
    const auto output = aligned(render(input), input.size());
    require(output[70] == 1.0, "isolated full-scale sample should not be guessed away");
}

void testLongClipIsUntouched()
{
    std::vector<double> input(220, 0.0);
    for (std::size_t i = 80; i < 80 + AutoDeclipDsp::kMaxRepairSamples + 4; ++i)
    {
        input[i] = 1.0;
    }

    const auto output = aligned(render(input), input.size());
    for (std::size_t i = 80; i < 80 + AutoDeclipDsp::kMaxRepairSamples + 4; ++i)
    {
        require(output[i] == 1.0, "long clipping should be left for a stronger repair stage");
    }
}

void testSignChangingRunIsUntouched()
{
    std::vector<double> input(150, 0.0);
    input[69] = 0.8;
    input[70] = 1.0;
    input[71] = 1.0;
    input[72] = -0.8;
    input[73] = -0.6;

    const auto output = aligned(render(input), input.size());
    require(output[70] == 1.0 && output[71] == 1.0,
            "sign-changing ambiguous transient should remain untouched");
}

void testLowConfidenceEdgesAreUntouched()
{
    std::vector<double> input(150, 0.0);
    input[69] = 0.3;
    input[70] = 1.0;
    input[71] = 1.0;
    input[72] = 0.3;
    input[73] = 0.2;

    const auto output = aligned(render(input), input.size());
    require(output[70] == 1.0 && output[71] == 1.0,
            "plateau with weak edge evidence should remain untouched");
}

void testNonFiniteEdgeDoesNotSpread()
{
    std::vector<double> input(150, 0.0);
    input[69] = 0.85;
    input[70] = 1.0;
    input[71] = 1.0;
    input[72] = std::numeric_limits<double>::quiet_NaN();
    input[73] = 0.7;

    const auto output = aligned(render(input), input.size());
    require(output[70] == 1.0 && output[71] == 1.0,
            "non-finite context must not rewrite a finite clipping run");
    require(std::isnan(output[72]), "the original non-finite sample should not be spread or disguised");
}

} // namespace

int main()
{
    try
    {
        testCleanPassThrough();
        testShortPositiveClipIsRepaired();
        testShortNegativeClipIsRepaired();
        testGeneratedClipRepairReducesReferenceError();
        testHardLimitedMasterBelowClipThresholdIsUntouched();
        testNearStartClipUsesSafeLinearFallback();
        testMaxLengthClipFallsBackBeforeReclipping();
        testSinglePeakIsUntouched();
        testLongClipIsUntouched();
        testSignChangingRunIsUntouched();
        testLowConfidenceEdgesAreUntouched();
        testNonFiniteEdgeDoesNotSpread();
        std::cout << "AutoDeclip DSP tests passed\n";
        return EXIT_SUCCESS;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
