using Microsoft.ML.OnnxRuntime;
using System;

namespace Travny.PaintDotNet.AI;

internal static class InferenceSessionOptions
{
    public const ExecutionProviderDevicePolicy Policy = ExecutionProviderDevicePolicy.MAX_PERFORMANCE;

    public static SessionOptions Create()
    {
        var options = new SessionOptions
        {
            GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,
            ExecutionMode = ExecutionMode.ORT_SEQUENTIAL,
            InterOpNumThreads = 1,
            IntraOpNumThreads = Math.Clamp(Environment.ProcessorCount / 2, 1, 4)
        };
        options.SetEpSelectionPolicy(Policy);
        return options;
    }
}
