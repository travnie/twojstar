#include "SmartTransitionController.h"
#include "SmartTransitionParams.h"
#include "SmartTransitionProcessor.h"
#include "base/source/fstreamer.h"
#include "public.sdk/source/common/memorystream.h"
#include "public.sdk/source/vst/hosting/parameterchanges.h"
#include "pluginterfaces/vst/vstspeaker.h"

#include <algorithm>
#include <array>
#include <vector>

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <memory>

int main()
{
    using namespace Travny::Vst3;
    SmartTransitionController controller;
    if (controller.initialize(nullptr) != Steinberg::kResultOk) return EXIT_FAILURE;

    Steinberg::Vst::ParameterInfo info{};
    bool visibleStrength = false;
    bool visibleMaxTransition = false;
    for (Steinberg::int32 i = 0; i < controller.getParameterCount(); ++i)
    {
        if (controller.getParameterInfo(i, info) != Steinberg::kResultOk) continue;
        if (info.id == kSmartTransitionStrengthId)
        {
            visibleStrength = info.stepCount == 0 &&
                info.defaultNormalizedValue == 1.0 &&
                (info.flags & Steinberg::Vst::ParameterInfo::kCanAutomate) != 0 &&
                (info.flags & Steinberg::Vst::ParameterInfo::kIsHidden) == 0;
        }
        if (info.id == kSmartTransitionMaxTransitionId)
        {
            visibleMaxTransition = info.stepCount == 3 &&
                info.defaultNormalizedValue == 1.0 &&
                (info.flags & Steinberg::Vst::ParameterInfo::kCanAutomate) != 0 &&
                (info.flags & Steinberg::Vst::ParameterInfo::kIsHidden) == 0;
        }
    }
    if (!visibleMaxTransition)
    {
        std::cerr << "Max transition must be visible and automatable\n";
        return EXIT_FAILURE;
    }
    if (!visibleStrength) { std::cerr << "Strength must be visible and automatable\n"; return EXIT_FAILURE; }

    auto source = std::make_unique<SmartTransitionProcessor>();
    if (source->initialize(nullptr) != Steinberg::kResultOk) return EXIT_FAILURE;
    Steinberg::MemoryStream input;
    Steinberg::IBStreamer writer(&input, kLittleEndian);
    if (!writer.writeDouble(0.35) || !writer.writeDouble(1.0 / 3.0)) return EXIT_FAILURE;
    input.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
    if (source->setState(&input) != Steinberg::kResultOk) return EXIT_FAILURE;

    Steinberg::MemoryStream saved;
    if (source->getState(&saved) != Steinberg::kResultOk) return EXIT_FAILURE;
    source->terminate();
    saved.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);

    auto restored = std::make_unique<SmartTransitionProcessor>();
    if (restored->initialize(nullptr) != Steinberg::kResultOk ||
        restored->setState(&saved) != Steinberg::kResultOk) return EXIT_FAILURE;
    Steinberg::MemoryStream controllerState;
    if (restored->getState(&controllerState) != Steinberg::kResultOk) return EXIT_FAILURE;
    restored->terminate();
    controllerState.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
    if (controller.setComponentState(&controllerState) != Steinberg::kResultOk) return EXIT_FAILURE;
    if (std::abs(controller.getParamNormalized(kSmartTransitionMaxTransitionId) - (1.0 / 3.0)) > 1e-9)
    {
        std::cerr << "Max transition lost during state round-trip\n";
        return EXIT_FAILURE;
    }
    if (std::abs(controller.getParamNormalized(kSmartTransitionStrengthId) - 0.35) > 1e-9)
    {
        std::cerr << "Strength lost during state round-trip\n";
        return EXIT_FAILURE;
    }

    Steinberg::MemoryStream legacyEmptyState;
    if (controller.setComponentState(&legacyEmptyState) != Steinberg::kResultOk ||
        controller.getParamNormalized(kSmartTransitionStrengthId) != 1.0 ||
        controller.getParamNormalized(kSmartTransitionMaxTransitionId) != 1.0)
    {
        std::cerr << "Legacy empty state must restore full strength\n";
        return EXIT_FAILURE;
    }
    // Strength-only presets from previous builds default Max transition to 4 ms.
    Steinberg::MemoryStream legacyStrength;
    Steinberg::IBStreamer legacyWriter(&legacyStrength, kLittleEndian);
    if (!legacyWriter.writeDouble(0.75)) return EXIT_FAILURE;
    legacyStrength.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
    if (controller.setComponentState(&legacyStrength) != Steinberg::kResultOk ||
        controller.getParamNormalized(kSmartTransitionStrengthId) != 0.75 ||
        controller.getParamNormalized(kSmartTransitionMaxTransitionId) != 1.0)
        return EXIT_FAILURE;
    controller.terminate();

    constexpr Steinberg::int32 kFrames = 13000;
    std::vector<double> audio(kFrames, 0.25);
    for (int i = 500; i < kFrames; ++i) audio[i] = -0.6;

    const auto render = [&](int split, bool step, bool ramp, double restoredStrength = 1.0,
                            double restoredMax = 1.0, int maxStepAt = -1,
                            double maxStepNormalized = 0.0)
    {
        auto processor = std::make_unique<SmartTransitionProcessor>();
        if (processor->initialize(nullptr) != Steinberg::kResultOk) std::abort();
        auto arrangement = Steinberg::Vst::SpeakerArr::kMono;
        auto outputArrangement = arrangement;
        if (processor->setBusArrangements(&arrangement, 1, &outputArrangement, 1) != Steinberg::kResultOk)
            std::abort();
        Steinberg::Vst::ProcessSetup setup{};
        setup.processMode = Steinberg::Vst::kRealtime;
        setup.symbolicSampleSize = Steinberg::Vst::kSample64;
        setup.sampleRate = 48000.0;
        setup.maxSamplesPerBlock = kFrames;
        if (processor->setupProcessing(setup) != Steinberg::kResultOk ||
            processor->setActive(true) != Steinberg::kResultOk) std::abort();

        Steinberg::MemoryStream restoredState;
        Steinberg::IBStreamer restoredWriter(&restoredState, kLittleEndian);
        if (!restoredWriter.writeDouble(restoredStrength) ||
            !restoredWriter.writeDouble(restoredMax)) std::abort();
        restoredState.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
        if (processor->setState(&restoredState) != Steinberg::kResultOk) std::abort();

        std::vector<double> output(kFrames);
        for (int begin = 0; begin < kFrames;)
        {
            const int end = split > 0 && begin == 0 ? split : kFrames;
            const auto size = end - begin;
            Steinberg::Vst::ParameterChanges changes;
            Steinberg::int32 parameterIndex = 0;
            auto* queue = changes.addParameterData(kSmartTransitionStrengthId, parameterIndex);
            Steinberg::int32 pointIndex = 0;
            if (step)
            {
                if (split == 0)
                {
                    queue->addPoint(3499, 1.0, pointIndex);
                    queue->addPoint(3500, 0.0, pointIndex);
                }
                else if (begin == split)
                    queue->addPoint(0, 0.0, pointIndex);
            }
            if (maxStepAt >= begin && maxStepAt < end)
            {
                auto* maxQueue = changes.addParameterData(kSmartTransitionMaxTransitionId, parameterIndex);
                maxQueue->addPoint(maxStepAt - begin, maxStepNormalized, pointIndex);
            }
            if (ramp)
            {
                if (split == 0)
                    queue->addPoint(5999, 0.0, pointIndex);
                else if (begin == 0)
                    queue->addPoint(split - 1, 1.0 - static_cast<double>(split) / 6000.0, pointIndex);
                else
                    queue->addPoint(5999 - split, 0.0, pointIndex);
            }

            double* inputPtr = audio.data() + begin;
            double* outputPtr = output.data() + begin;
            Steinberg::Vst::AudioBusBuffers in{};
            Steinberg::Vst::AudioBusBuffers out{};
            in.numChannels = 1;
            out.numChannels = 1;
            in.channelBuffers64 = &inputPtr;
            out.channelBuffers64 = &outputPtr;
            Steinberg::Vst::ProcessData data{};
            data.processMode = Steinberg::Vst::kRealtime;
            data.symbolicSampleSize = Steinberg::Vst::kSample64;
            data.numSamples = size;
            data.numInputs = 1;
            data.numOutputs = 1;
            data.inputs = &in;
            data.outputs = &out;
            data.inputParameterChanges = (step || ramp || maxStepAt >= 0) ? &changes : nullptr;
            if (processor->process(data) != Steinberg::kResultOk) std::abort();
            begin = end;
        }

        // Non-finite audio must not make tolerance assertions pass vacuously.
        if (!std::all_of(output.begin(), output.end(), [](double value) { return std::isfinite(value); }))
        {
            std::cerr << "Rendered audio contains a non-finite sample\n";
            std::abort();
        }

        // Audio automation must replace the restored value in a saved preset.
        Steinberg::MemoryStream savedState;
        if (processor->getState(&savedState) != Steinberg::kResultOk) std::abort();
        savedState.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
        Steinberg::IBStreamer savedReader(&savedState, kLittleEndian);
        double savedStrength = -1.0;
        const auto expected = (step || ramp) ? 0.0 : restoredStrength;
        double savedMax = -1.0;
        const auto expectedMax = maxStepAt >= 0
            ? static_cast<double>(std::min(3, static_cast<int>(
                std::clamp(maxStepNormalized, 0.0, 1.0) * 4.0))) / 3.0
            : restoredMax;
        if (!savedReader.readDouble(savedStrength) || !savedReader.readDouble(savedMax) ||
            !std::isfinite(savedStrength) || std::abs(savedStrength - expected) > 1e-12 ||
            std::abs(savedMax - expectedMax) > 1e-12)
        {
            std::cerr << "Saved state ignored processed Strength automation\n";
            std::abort();
        }

        // Zero-sample parameter flushes must also update the saved state.
        Steinberg::Vst::ParameterChanges flushChanges;
        Steinberg::int32 parameterIndex = 0;
        auto* flushQueue = flushChanges.addParameterData(kSmartTransitionStrengthId, parameterIndex);
        Steinberg::int32 pointIndex = 0;
        flushQueue->addPoint(0, 0.25, pointIndex);
        auto* maxQueue = flushChanges.addParameterData(kSmartTransitionMaxTransitionId, parameterIndex);
        maxQueue->addPoint(0, 0.0, pointIndex);
        Steinberg::Vst::ProcessData flush{};
        flush.numSamples = 0;
        flush.inputParameterChanges = &flushChanges;
        if (processor->process(flush) != Steinberg::kResultOk) std::abort();
        Steinberg::MemoryStream flushedState;
        if (processor->getState(&flushedState) != Steinberg::kResultOk) std::abort();
        flushedState.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
        Steinberg::IBStreamer flushedReader(&flushedState, kLittleEndian);
        if (!flushedReader.readDouble(savedStrength) || !flushedReader.readDouble(savedMax) ||
            !std::isfinite(savedStrength) || std::abs(savedStrength - 0.25) > 1e-12 ||
            savedMax != 0.0)
        {
            std::cerr << "Parameter-only Strength flush was not persisted\n";
            std::abort();
        }
        processor->setActive(false);
        processor->terminate();
        return output;
    };

    const auto wet = render(0, false, false);
    const auto restoredHalf = render(0, false, false, 0.5);
    const auto capped = render(0, false, false, 1.0, 0.0);
    const auto capBefore = render(0, false, false, 1.0, 1.0, 300);
    const auto capBeforeSplit = render(300, false, false, 1.0, 1.0, 300);
    const auto capAfter = render(0, false, false, 1.0, 1.0, 700);
    const auto midNormalized = render(0, false, false, 1.0, 1.0, 300, 0.8);
    const auto lateStep = render(0, true, false);
    const auto splitStep = render(3500, true, false);
    const auto fullRamp = render(0, false, true);
    const auto splitRamp = render(3000, false, true);
    if (capBefore != capped || capBeforeSplit != capped ||
        capAfter != wet || midNormalized != wet)
    {
        std::cerr << "Max transition automation lost source sample alignment or block determinism\n";
        return EXIT_FAILURE;
    }
    bool capChangesAudio = false;
    for (int i = 5290; i < 5330; ++i)
    {
        capChangesAudio |= std::abs(capped[i] - wet[i]) > 1e-9;
    }
    if (!capChangesAudio)
    {
        std::cerr << "Max transition control did not change the repaired audio\n";
        return EXIT_FAILURE;
    }

    bool repaired = false;
    for (int i = 5290; i < 5330; ++i)
    {
        const auto sourceIndex = i - 4800;
        const auto dry = audio[sourceIndex];
        repaired |= std::abs(wet[i] - dry) > 1e-6;
        if (wet[i] != lateStep[i])
        {
            std::cerr << "Late Strength automation changed an earlier source sample\n";
            return EXIT_FAILURE;
        }
        if (std::abs(restoredHalf[i] - (dry + 0.5 * (wet[i] - dry))) > 1e-11)
        {
            std::cerr << "Restored 50% Strength did not affect unautomated audio\n";
            return EXIT_FAILURE;
        }

        // The ramp is defined in SOURCE coordinates. A 4800-sample lookahead
        // must not shift its wet/dry blend ahead of the source.
        const auto sourceStrength = 1.0 - static_cast<double>(sourceIndex + 1) / 6000.0;
        const auto expectedRamp = dry + (wet[i] - dry) * sourceStrength;
        if (std::abs(fullRamp[i] - expectedRamp) > 1e-11)
        {
            std::cerr << "Strength automation drifted by lookahead latency\n";
            return EXIT_FAILURE;
        }
    }
    if (!repaired)
    {
        std::cerr << "Automation fixture did not exercise a repaired seam\n";
        return EXIT_FAILURE;
    }
    for (int i = 0; i < kFrames; ++i)
    {
        if (std::abs(lateStep[i] - splitStep[i]) > 1e-12 ||
            std::abs(fullRamp[i] - splitRamp[i]) > 1e-12)
        {
            std::cerr << "Strength automation depends on host block partition\n";
            return EXIT_FAILURE;
        }
    }

    // Exercise a seam after the automation boundary, not only the first
    // 1600 output frames that remain after the lookahead in short fixtures.
    std::fill(audio.begin(), audio.end(), 0.25);
    std::fill(audio.begin() + 5000, audio.end(), -0.6);
    const auto lateWet = render(0, false, false);
    const auto lateStepOneBlock = render(0, true, false);
    const auto lateStepSplit = render(3500, true, false);
    const auto lateRampOneBlock = render(0, false, true);
    const auto lateRampSplit = render(3000, false, true);
    const auto capAfterLateSeam = render(0, false, false, 1.0, 1.0, 5300);
    bool lateRepair = false;
    for (int i = 9790; i < 9830; ++i)
    {
        const auto sourceIndex = i - 4800;
        const auto dry = audio[sourceIndex];
        lateRepair |= std::abs(lateWet[i] - dry) > 1e-6;
        if (capAfterLateSeam[i] != lateWet[i])
        {
            std::cerr << "Max transition automation drifted forward by lookahead latency\n";
            return EXIT_FAILURE;
        }
        if (std::abs(lateStepOneBlock[i] - dry) > 1e-12 ||
            std::abs(lateStepSplit[i] - dry) > 1e-12)
        {
            std::cerr << "Post-automation seam was not fully dry\n";
            return EXIT_FAILURE;
        }
        const auto sourceStrength = 1.0 - static_cast<double>(sourceIndex + 1) / 6000.0;
        const auto expected = dry + (lateWet[i] - dry) * sourceStrength;
        if (std::abs(lateRampOneBlock[i] - expected) > 1e-11 ||
            std::abs(lateRampSplit[i] - expected) > 1e-11)
        {
            std::cerr << "Post-automation seam blended at the wrong source time\n";
            return EXIT_FAILURE;
        }
    }
    if (!lateRepair)
    {
        std::cerr << "Late seam fixture did not trigger repair\n";
        return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
}
