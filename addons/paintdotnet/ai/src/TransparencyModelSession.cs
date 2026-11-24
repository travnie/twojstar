using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Travny.PaintDotNet.AI;

internal sealed class TransparencyModelSession : IDisposable
{
    private readonly InferenceSession session;
    private readonly string inputName;
    private readonly string outputName;
    private readonly object runGate = new();

    public TransparencyModelSession(string modelPath)
    {
        using SessionOptions options = InferenceSessionOptions.Create();
        session = new InferenceSession(modelPath, options);
        var input = session.InputMetadata.Single();
        // Pinned U2Net-p exports six auxiliary supervision heads. Only 1959
        // is the final foreground matte, regardless of metadata enumeration.
        var output = session.OutputMetadata.Single(entry => entry.Key == "1959");
        if (input.Value.ElementDataType != TensorElementType.Float ||
            output.Value.ElementDataType != TensorElementType.Float ||
            !input.Value.Dimensions.SequenceEqual(new[] { 1, 3, 320, 320 }) ||
            !output.Value.Dimensions.SequenceEqual(new[] { 1, 1, 320, 320 }))
        {
            throw new InvalidDataException("Unexpected U2Net-p input/output contract.");
        }
        inputName = input.Key;
        outputName = output.Key;
    }

    public float[] Run(float[] input, Func<bool> cancelRequested)
    {
        if (input.Length != 3 * TransparencyMath.ModelSize * TransparencyMath.ModelSize)
            throw new ArgumentException("Invalid matting input shape.", nameof(input));

        lock (runGate)
        {
            if (cancelRequested()) throw new OperationCanceledException();
            using var runOptions = new RunOptions();
            using var completed = new ManualResetEventSlim(false);
            Task watcher = Task.Run(() =>
            {
                while (!completed.Wait(20))
                {
                    if (cancelRequested())
                    {
                        runOptions.Terminate = true;
                        break;
                    }
                }
            });
            try
            {
                using var results = session.Run(
                    new[] { NamedOnnxValue.CreateFromTensor(inputName,
                        new DenseTensor<float>(input, new[] { 1, 3, 320, 320 })) },
                    new[] { outputName }, runOptions);
                float[] mask = results.Single().AsTensor<float>().ToArray();
                if (mask.Length != 320 * 320 ||
                    mask.Any(value => !float.IsFinite(value)))
                    throw new InvalidDataException("Invalid U2Net-p matte.");
                TransparencyMath.NormalizeMask(mask);
                return mask;
            }
            catch (OnnxRuntimeException) when (cancelRequested())
            {
                throw new OperationCanceledException();
            }
            finally
            {
                completed.Set();
                watcher.GetAwaiter().GetResult();
            }
        }
    }

    public void Dispose() => session.Dispose();
}
