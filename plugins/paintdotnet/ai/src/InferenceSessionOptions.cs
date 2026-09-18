using Microsoft.ML.OnnxRuntime;
using System;
using System.Collections.Generic;

namespace Travny.PaintDotNet.AI;

internal static class InferenceSessionOptions
{
    internal const string DirectMlExecutionProvider = "DmlExecutionProvider";
    internal const string DisableSpecifiedOptimizersKey = "optimization.disable_specified_optimizers";
    internal const string SimplifiedLayerNormFusionOptimizer = "SimplifiedLayerNormFusion";

    public static SessionOptions Create(params string[] disabledOptimizers)
    {
        var options = new SessionOptions
        {
            GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,
            ExecutionMode = ExecutionMode.ORT_SEQUENTIAL,
            InterOpNumThreads = 1,
            IntraOpNumThreads = Math.Clamp(Environment.ProcessorCount / 2, 1, 4)
        };

        if (disabledOptimizers.Length > 0)
        {
            options.AddSessionConfigEntry(
                DisableSpecifiedOptimizersKey,
                string.Join(",", disabledOptimizers));
        }

        OrtEnv env = OrtEnv.Instance();
        OrtEpDevice? directMlDevice = FindDirectMlDiscreteGpu(env.GetEpDevices());
        if (directMlDevice is not null)
        {
            options.EnableMemoryPattern = false;
            options.AppendExecutionProvider(
                env,
                new[] { directMlDevice },
                new Dictionary<string, string>());
        }

        return options;
    }

    internal static OrtEpDevice? FindDirectMlDiscreteGpu(IReadOnlyList<OrtEpDevice> devices)
    {
        foreach (OrtEpDevice device in devices)
        {
            if (!string.Equals(device.EpName, DirectMlExecutionProvider, StringComparison.Ordinal) ||
                device.HardwareDevice.Type != OrtHardwareDeviceType.GPU)
            {
                continue;
            }

            IReadOnlyDictionary<string, string> metadata = device.HardwareDevice.Metadata.Entries;
            if (!metadata.TryGetValue("Discrete", out string? discrete) || discrete != "1")
            {
                continue;
            }

            if (metadata.TryGetValue("is_virtual", out string? virtualDevice) && virtualDevice == "1")
            {
                continue;
            }

            return device;
        }

        return null;
    }
}
