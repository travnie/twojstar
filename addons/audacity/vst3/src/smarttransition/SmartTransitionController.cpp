#include "SmartTransitionController.h"

#include "SmartTransitionParams.h"
#include "base/source/fstreamer.h"
#include "public.sdk/source/vst/vstparameters.h"

#include <algorithm>
#include <cmath>

namespace Travny::Vst3 {

Steinberg::tresult PLUGIN_API SmartTransitionController::initialize(Steinberg::FUnknown* context)
{
    const auto result = EditController::initialize(context);
    if (result != Steinberg::kResultOk) return result;

    parameters.addParameter(new Steinberg::Vst::RangeParameter(
        STR16("Strength"), kSmartTransitionStrengthId, STR16("%"),
        0.0, 100.0, 100.0, 0, Steinberg::Vst::ParameterInfo::kCanAutomate));
    parameters.addParameter(new Steinberg::Vst::RangeParameter(
        STR16("Max transition"), kSmartTransitionMaxTransitionId, STR16("ms"),
        1.0, 4.0, 4.0, 3, Steinberg::Vst::ParameterInfo::kCanAutomate));
    auto* mode = new Steinberg::Vst::StringListParameter(STR16("Mode"), kSmartTransitionModeId);
    mode->appendString(STR16("Auto"));
    mode->appendString(STR16("Speech"));
    mode->appendString(STR16("Music"));
    mode->appendString(STR16("Hard splice"));
    parameters.addParameter(mode);
    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API SmartTransitionController::setComponentState(Steinberg::IBStream* state)
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

    const auto normalized = std::isfinite(savedStrength)
        ? std::clamp(savedStrength, 0.0, 1.0)
        : 1.0;
    if (auto* parameter = parameters.getParameter(kSmartTransitionStrengthId))
    {
        parameter->setNormalized(normalized);
    }
    if (auto* parameter = parameters.getParameter(kSmartTransitionMaxTransitionId))
    {
        parameter->setNormalized(std::isfinite(savedMaxTransition)
            ? std::clamp(savedMaxTransition, 0.0, 1.0) : 1.0);
    }
    if (auto* parameter = parameters.getParameter(kSmartTransitionModeId))
    {
        parameter->setNormalized(std::isfinite(savedMode)
            ? std::clamp(savedMode, 0.0, 1.0) : 0.0);
    }
    return Steinberg::kResultOk;
}

} // namespace Travny::Vst3
