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
        0.0, 100.0, 0.0, 100.0, Steinberg::Vst::ParameterInfo::kCanAutomate));
    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API SmartTransitionController::setComponentState(Steinberg::IBStream* state)
{
    if (!state) return Steinberg::kResultFalse;
    Steinberg::IBStreamer streamer(state, kLittleEndian);
    double savedStrength = 1.0;
    if (!streamer.readDouble(savedStrength)) savedStrength = 1.0;

    const auto normalized = std::isfinite(savedStrength)
        ? std::clamp(savedStrength, 0.0, 1.0)
        : 1.0;
    if (auto* parameter = parameters.getParameter(kSmartTransitionStrengthId))
    {
        parameter->setNormalized(normalized);
    }
    return Steinberg::kResultOk;
}

} // namespace Travny::Vst3
