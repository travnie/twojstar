using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Travny.PaintDotNet.AI;

internal sealed class ImageModelSession : IDisposable
{
    private readonly InferenceSession session;
    private readonly string inputName;
    private readonly string outputName;
    private readonly string? scalarName;
    private readonly TensorElementType scalarElementType;
    private readonly object runGate = new();

    public ImageModelSession(string modelPath)
    {
        var options = new SessionOptions
        {
            GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,
            ExecutionMode = ExecutionMode.ORT_SEQUENTIAL,
            InterOpNumThreads = 1,
            IntraOpNumThreads = Math.Clamp(Environment.ProcessorCount / 2, 1, 4)
        };

        session = new InferenceSession(modelPath, options);
        KeyValuePair<string, NodeMetadata> imageInput = session.InputMetadata
            .Single(pair => IsImageTensor(pair.Value));
        KeyValuePair<string, NodeMetadata> imageOutput = session.OutputMetadata
            .FirstOrDefault(pair => IsImageTensor(pair.Value));
        if (string.IsNullOrEmpty(imageOutput.Key))
        {
            throw new InvalidDataException("Model does not expose a 3-channel image output.");
        }

        inputName = imageInput.Key;
        outputName = imageOutput.Key;
        InputElementType = imageInput.Value.ElementDataType;
        OutputElementType = imageOutput.Value.ElementDataType;
        ValidateElementType(InputElementType, "input");
        ValidateElementType(OutputElementType, "output");

        KeyValuePair<string, NodeMetadata>? scalar = session.InputMetadata
            .Where(pair => pair.Key != inputName)
            .Select(pair => (KeyValuePair<string, NodeMetadata>?)pair)
            .FirstOrDefault();
        if (scalar is { } scalarValue)
        {
            if (!scalarValue.Value.IsTensor || scalarValue.Value.Dimensions.Length > 2)
            {
                throw new InvalidDataException("Unsupported auxiliary model input.");
            }

            scalarName = scalarValue.Key;
            scalarElementType = scalarValue.Value.ElementDataType;
            ValidateElementType(scalarElementType, "scalar input");
        }
    }

    public bool RequiresScalarControl => scalarName is not null;
    public TensorElementType InputElementType { get; }
    public TensorElementType OutputElementType { get; }
    public float[] Run(
        float[] input,
        int width,
        int height,
        float? scalarControl,
        Func<bool> cancelRequested)
    {
        if (input.Length != checked(3 * width * height))
        {
            throw new ArgumentException("Input buffer does not match the requested image shape.", nameof(input));
        }

        if (RequiresScalarControl && scalarControl is null)
        {
            throw new ArgumentException("This model requires a scalar control value.", nameof(scalarControl));
        }

        lock (runGate)
        {
            if (cancelRequested())
            {
                throw new OperationCanceledException();
            }

            using var runOptions = new RunOptions();
            using var completed = new ManualResetEventSlim(false);
            Task cancelWatcher = Task.Run(() => WatchCancellation(runOptions, completed, cancelRequested));

            try
            {
                List<NamedOnnxValue> inputs = CreateInputs(input, width, height, scalarControl);
                using IDisposableReadOnlyCollection<DisposableNamedOnnxValue> results =
                    session.Run(inputs, new[] { outputName }, runOptions);
                DisposableNamedOnnxValue result = results.Single(value => value.Name == outputName);
                return ReadImageOutput(result, width, height);
            }
            catch (OnnxRuntimeException) when (cancelRequested())
            {
                throw new OperationCanceledException();
            }
            finally
            {
                completed.Set();
                cancelWatcher.GetAwaiter().GetResult();
            }
        }
    }
    private List<NamedOnnxValue> CreateInputs(
        float[] input,
        int width,
        int height,
        float? scalarControl)
    {
        var inputs = new List<NamedOnnxValue>(RequiresScalarControl ? 2 : 1)
        {
            CreateTensorInput(inputName, InputElementType, input, new[] { 1, 3, height, width })
        };

        if (scalarName is not null)
        {
            inputs.Add(CreateTensorInput(
                scalarName,
                scalarElementType,
                new[] { scalarControl!.Value },
                new[] { 1, 1 }));
        }

        return inputs;
    }

    private static NamedOnnxValue CreateTensorInput(
        string name,
        TensorElementType elementType,
        float[] values,
        int[] dimensions)
    {
        return elementType switch
        {
            TensorElementType.Float => NamedOnnxValue.CreateFromTensor(
                name,
                new DenseTensor<float>(values, dimensions)),
            TensorElementType.Float16 => NamedOnnxValue.CreateFromTensor(
                name,
                new DenseTensor<Float16>(ToFloat16(values), dimensions)),
            _ => throw new InvalidDataException($"Unsupported tensor element type: {elementType}.")
        };
    }

    private float[] ReadImageOutput(DisposableNamedOnnxValue result, int width, int height)
    {
        return OutputElementType switch
        {
            TensorElementType.Float => ValidateAndCopy(result.AsTensor<float>(), width, height),
            TensorElementType.Float16 => ValidateAndCopy(result.AsTensor<Float16>(), width, height),
            _ => throw new InvalidDataException($"Unsupported output element type: {OutputElementType}.")
        };
    }
    private static float[] ValidateAndCopy(Tensor<float> output, int width, int height)
    {
        ValidateShape(output.Dimensions.ToArray(), width, height);
        return output.ToArray();
    }

    private static float[] ValidateAndCopy(Tensor<Float16> output, int width, int height)
    {
        ValidateShape(output.Dimensions.ToArray(), width, height);
        Float16[] values = output.ToArray();
        var result = new float[values.Length];
        for (int i = 0; i < values.Length; i++)
        {
            result[i] = (float)values[i];
        }

        return result;
    }

    private static void ValidateShape(int[] dimensions, int width, int height)
    {
        if (dimensions.Length != 4 || dimensions[0] != 1 || dimensions[1] != 3 ||
            dimensions[2] != height || dimensions[3] != width)
        {
            throw new InvalidDataException(
                $"Unexpected image model output shape: [{string.Join(", ", dimensions)}].");
        }
    }

    private static Float16[] ToFloat16(float[] values)
    {
        var result = new Float16[values.Length];
        for (int i = 0; i < values.Length; i++)
        {
            result[i] = (Float16)values[i];
        }

        return result;
    }
    private static bool IsImageTensor(NodeMetadata metadata)
    {
        if (!metadata.IsTensor || metadata.Dimensions.Length != 4)
        {
            return false;
        }

        int channels = metadata.Dimensions[1];
        return channels == 3;
    }

    private static void ValidateElementType(TensorElementType elementType, string label)
    {
        if (elementType is not TensorElementType.Float and not TensorElementType.Float16)
        {
            throw new InvalidDataException(
                $"Unsupported {label} tensor element type: {elementType}.");
        }
    }

    private static void WatchCancellation(
        RunOptions runOptions,
        ManualResetEventSlim completed,
        Func<bool> cancelRequested)
    {
        while (!completed.Wait(20))
        {
            if (cancelRequested())
            {
                runOptions.Terminate = true;
                return;
            }
        }
    }

    public void Dispose()
    {
        session.Dispose();
    }
}
