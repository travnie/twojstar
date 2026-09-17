using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Travny.PaintDotNet.AI;

internal sealed class RealEsrganSession
{
    public const int Scale = 4;

    private readonly InferenceSession session;
    private readonly string inputName;
    private readonly string outputName;
    private readonly object runGate = new();

    public RealEsrganSession(string modelPath)
    {
        using SessionOptions options = InferenceSessionOptions.Create();
        session = new InferenceSession(modelPath, options);
        inputName = session.InputMetadata.Keys.Single();
        outputName = session.OutputMetadata.Keys.Single();
    }

    public float[] Run(float[] input, int width, int height, Func<bool> cancelRequested)
    {
        var tensor = new DenseTensor<float>(input, new[] { 1, 3, height, width });

        // Paint.NET may request render regions in parallel. Keep the shared inference
        // session single-flight to avoid multiplying model working-set and device work.
        lock (runGate)
        {
            if (cancelRequested())
            {
                throw new OperationCanceledException();
            }

            using var runOptions = new RunOptions();
            using var completed = new ManualResetEventSlim(false);
            Task cancelWatcher = Task.Run(() =>
            {
                while (!completed.Wait(20))
                {
                    if (cancelRequested())
                    {
                        runOptions.Terminate = true;
                        return;
                    }
                }
            });

            try
            {
                using IDisposableReadOnlyCollection<DisposableNamedOnnxValue> results =
                    session.Run(
                        new[] { NamedOnnxValue.CreateFromTensor(inputName, tensor) },
                        new[] { outputName },
                        runOptions);

                Tensor<float> output = results.Single(value => value.Name == outputName).AsTensor<float>();
                int[] dimensions = output.Dimensions.ToArray();
                int expectedHeight = checked(height * Scale);
                int expectedWidth = checked(width * Scale);

                if (dimensions.Length != 4 || dimensions[0] != 1 || dimensions[1] != 3 ||
                    dimensions[2] != expectedHeight || dimensions[3] != expectedWidth)
                {
                    throw new InvalidDataException(
                        $"Unexpected Real-ESRGAN output shape: [{string.Join(", ", dimensions)}].");
                }

                return output.ToArray();
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
}
