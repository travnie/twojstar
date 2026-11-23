#pragma once

#include "SmartTransitionCids.h"
#include "SmartTransitionDsp.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "public.sdk/source/vst/vstaudioeffect.h"

#include <atomic>

namespace Travny::Vst3 {

class SmartTransitionProcessor final : public Steinberg::Vst::AudioEffect
{
public:
    SmartTransitionProcessor();

    static Steinberg::FUnknown* createInstance(void*)
    {
        return static_cast<Steinberg::Vst::IAudioProcessor*>(new SmartTransitionProcessor());
    }

    Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API setActive(Steinberg::TBool state) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API setProcessing(Steinberg::TBool state) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API setupProcessing(Steinberg::Vst::ProcessSetup& setup) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API setBusArrangements(
        Steinberg::Vst::SpeakerArrangement* inputs,
        Steinberg::int32 numIns,
        Steinberg::Vst::SpeakerArrangement* outputs,
        Steinberg::int32 numOuts) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API canProcessSampleSize(Steinberg::int32 symbolicSampleSize) SMTG_OVERRIDE;
    Steinberg::uint32 PLUGIN_API getLatencySamples() SMTG_OVERRIDE;
    Steinberg::uint32 PLUGIN_API getTailSamples() SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API process(Steinberg::Vst::ProcessData& data) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API setState(Steinberg::IBStream* state) SMTG_OVERRIDE;
    Steinberg::tresult PLUGIN_API getState(Steinberg::IBStream* state) SMTG_OVERRIDE;

private:
    template <typename Sample>
    bool processBlock(
        Sample** input,
        Sample** output,
        Steinberg::int32 channels,
        Steinberg::int32 samples,
        Steinberg::uint64 inputSilenceFlags,
        Steinberg::Vst::IParamValueQueue* strengthQueue) noexcept;

    // State callbacks may run concurrently with the audio thread.
    // Only process() touches DSP strength; atomics transfer restored state.
    std::atomic<double> pendingStrength_{1.0};
    std::atomic<double> pendingMaxTransition_{1.0};
    std::atomic<double> audioStrength_{1.0};
    std::atomic<double> audioMaxTransition_{1.0};
    std::atomic<Steinberg::uint64> restoreGeneration_{0};
    std::atomic<Steinberg::uint64> audioGeneration_{0};
    // Two normalized values form one state snapshot. Single-writer epochs
    // prevent host state reads from mixing separate audio updates.
    std::atomic<Steinberg::uint64> restoreEpoch_{0};
    std::atomic<Steinberg::uint64> audioEpoch_{0};
    void publishAudioState(Steinberg::uint64 generation) noexcept;
    Steinberg::uint64 appliedRestoreGeneration_{0};
    Travny::Audio::SmartTransitionDsp dsp_{};
};

} // namespace Travny::Vst3
