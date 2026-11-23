#include "SmartTransitionController.h"
#include "SmartTransitionParams.h"
#include "SmartTransitionProcessor.h"
#include "base/source/fstreamer.h"
#include "public.sdk/source/common/memorystream.h"

#include <cmath>
#include <cstdlib>
#include <iostream>

int main()
{
    using namespace Travny::Vst3;
    SmartTransitionController controller;
    if (controller.initialize(nullptr) != Steinberg::kResultOk) return EXIT_FAILURE;

    Steinberg::Vst::ParameterInfo info{};
    bool visibleStrength = false;
    for (Steinberg::int32 i = 0; i < controller.getParameterCount(); ++i)
    {
        if (controller.getParameterInfo(i, info) == Steinberg::kResultOk &&
            info.id == kSmartTransitionStrengthId)
        {
            visibleStrength = info.stepCount == 0 &&
                info.defaultNormalizedValue == 1.0 &&
                (info.flags & Steinberg::Vst::ParameterInfo::kCanAutomate) != 0 &&
                (info.flags & Steinberg::Vst::ParameterInfo::kIsHidden) == 0;
            break;
        }
    }
    if (!visibleStrength) { std::cerr << "Strength must be visible and automatable\n"; return EXIT_FAILURE; }

    SmartTransitionProcessor source;
    if (source.initialize(nullptr) != Steinberg::kResultOk) return EXIT_FAILURE;
    Steinberg::MemoryStream input;
    Steinberg::IBStreamer writer(&input, kLittleEndian);
    if (!writer.writeDouble(0.35)) return EXIT_FAILURE;
    input.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
    if (source.setState(&input) != Steinberg::kResultOk) return EXIT_FAILURE;

    Steinberg::MemoryStream saved;
    if (source.getState(&saved) != Steinberg::kResultOk) return EXIT_FAILURE;
    source.terminate();
    saved.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);

    SmartTransitionProcessor restored;
    if (restored.initialize(nullptr) != Steinberg::kResultOk ||
        restored.setState(&saved) != Steinberg::kResultOk) return EXIT_FAILURE;
    Steinberg::MemoryStream controllerState;
    if (restored.getState(&controllerState) != Steinberg::kResultOk) return EXIT_FAILURE;
    restored.terminate();
    controllerState.seek(0, Steinberg::IBStream::kIBSeekSet, nullptr);
    if (controller.setComponentState(&controllerState) != Steinberg::kResultOk) return EXIT_FAILURE;
    if (std::abs(controller.getParamNormalized(kSmartTransitionStrengthId) - 0.35) > 1e-9)
    {
        std::cerr << "Strength lost during state round-trip\n";
        return EXIT_FAILURE;
    }

    Steinberg::MemoryStream legacyEmptyState;
    if (controller.setComponentState(&legacyEmptyState) != Steinberg::kResultOk ||
        controller.getParamNormalized(kSmartTransitionStrengthId) != 1.0)
    {
        std::cerr << "Legacy empty state must restore full strength\n";
        return EXIT_FAILURE;
    }
    controller.terminate();
    return EXIT_SUCCESS;
}
