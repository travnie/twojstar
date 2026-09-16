#include "AutoDeclipDsp.h"

#include <algorithm>
#include <cmath>

namespace Travny::Audio {
namespace {
constexpr double kSafePeak = 0.999;
}

void AutoDeclipDsp::reset() noexcept
{
    buffer_.fill(0.0);
    nextIndex_ = 0;
    clipStart_ = 0;
    pendingStart_ = 0;
    pendingEnd_ = 0;
    inClip_ = false;
    repairPending_ = false;
}

double AutoDeclipDsp::sampleAt(std::uint64_t index) const noexcept
{
    return buffer_[static_cast<std::size_t>(index % kBufferSize)];
}

double& AutoDeclipDsp::sampleAt(std::uint64_t index) noexcept
{
    return buffer_[static_cast<std::size_t>(index % kBufferSize)];
}

double AutoDeclipDsp::processSampleImpl(double input) noexcept
{
    const std::uint64_t index = nextIndex_++;
    sampleAt(index) = input;

    const bool clipped = std::isfinite(input) && std::abs(input) >= kClipThreshold;
    if (clipped)
    {
        if (!inClip_)
        {
            clipStart_ = index;
            inClip_ = true;
        }
    }
    else if (inClip_)
    {
        const std::uint64_t runLength = index - clipStart_;
        if (runLength >= 2 && runLength <= kMaxRepairSamples && clipStart_ >= 1)
        {
            pendingStart_ = clipStart_;
            pendingEnd_ = index;
            repairPending_ = true;
        }
        inClip_ = false;
    }

    if (repairPending_ && index > pendingEnd_)
    {
        repairPendingRun(index);
        repairPending_ = false;
    }

    if (index < kLatencySamples)
    {
        return 0.0;
    }

    return sampleAt(index - kLatencySamples);
}

void AutoDeclipDsp::repairPendingRun(std::uint64_t rightContextIndex) noexcept
{
    const std::uint64_t runLength = pendingEnd_ - pendingStart_;
    if (runLength < 2 || runLength > kMaxRepairSamples || pendingStart_ == 0)
    {
        return;
    }

    const double left = sampleAt(pendingStart_ - 1);
    const double right = sampleAt(pendingEnd_);
    const double rightContext = sampleAt(rightContextIndex);
    const bool haveLeftSlope = pendingStart_ >= 2;
    const double leftContext = haveLeftSlope ? sampleAt(pendingStart_ - 2) : left;
    if (!std::isfinite(leftContext) || !std::isfinite(left)
        || !std::isfinite(right) || !std::isfinite(rightContext))
    {
        return;
    }

    const bool sameSign = (left >= 0.0 && right >= 0.0) || (left <= 0.0 && right <= 0.0);
    const bool nearPeak = std::abs(left) >= 0.5 && std::abs(right) >= 0.5;
    const bool cleanRightContext = std::abs(rightContext) < kClipThreshold;
    if (!sameSign || !nearPeak || !cleanRightContext)
    {
        return;
    }

    const double span = static_cast<double>(runLength + 1);
    const double leftSlope = left - leftContext;
    const double rightSlope = rightContext - right;

    for (std::uint64_t offset = 0; offset < runLength; ++offset)
    {
        const double t = static_cast<double>(offset + 1) / span;
        const double linear = left + (right - left) * t;
        double repaired = linear;
        if (haveLeftSlope)
        {
            const double t2 = t * t;
            const double t3 = t2 * t;
            const double h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
            const double h10 = t3 - 2.0 * t2 + t;
            const double h01 = -2.0 * t3 + 3.0 * t2;
            const double h11 = t3 - t2;
            repaired = h00 * left + h10 * span * leftSlope
                + h01 * right + h11 * span * rightSlope;
        }

        sampleAt(pendingStart_ + offset) = std::clamp(repaired, -kSafePeak, kSafePeak);
    }
}

} // namespace Travny::Audio
