using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using Travny.PaintDotNet.AI;

if (args.Length != 2)
{
    throw new ArgumentException("Usage: ImageModelSmoke <dejpeg|denoise> <model.onnx>");
}

string kind = args[0];
string modelPath = args[1];

if (kind == "cpu-init")
{
    Console.WriteLine($"[cpu-init] creating plain CPU session: {modelPath}");
    Console.Out.Flush();
    using var cpuSession = new InferenceSession(modelPath);
    Console.WriteLine($"[cpu-init] session ready: inputs={cpuSession.InputMetadata.Count}, outputs={cpuSession.OutputMetadata.Count}");
    Console.Out.Flush();
    return;
}

bool expectsScalar = kind switch
{
    "dejpeg" => true,
    "denoise" => false,
    _ => throw new ArgumentException($"Unknown model kind: {kind}")
};

Console.WriteLine($"[{kind}] creating session: {modelPath}");
Console.Out.Flush();
using var session = new ImageModelSession(modelPath);
Console.WriteLine($"[{kind}] session ready: scalar={session.RequiresScalarControl}, input={session.InputElementType}, output={session.OutputElementType}");
Console.Out.Flush();
if (session.RequiresScalarControl != expectsScalar)
{
    throw new InvalidDataException(
        $"{kind} scalar-control metadata mismatch: {session.RequiresScalarControl}.");
}

const int width = 64;
const int height = 64;
float[] input = new float[3 * width * height];
Array.Fill(input, 0.5f);
Console.WriteLine($"[{kind}] checking pre-run cancellation");
Console.Out.Flush();
try
{
    session.Run(input, width, height, expectsScalar ? 0.5f : null, () => true);
    throw new InvalidDataException("Pre-run cancellation was ignored.");
}
catch (OperationCanceledException)
{
    Console.WriteLine($"[{kind}] cancellation passed");
    Console.Out.Flush();
}

Console.WriteLine($"[{kind}] starting inference");
Console.Out.Flush();
float[] output = session.Run(
    input,
    width,
    height,
    expectsScalar ? 0.5f : null,
    () => false);
Console.WriteLine($"[{kind}] inference returned {output.Length} values");
Console.Out.Flush();

if (output.Length != input.Length)
{
    throw new InvalidDataException(
        $"Unexpected {kind} output length: {output.Length}; expected {input.Length}.");
}

if (output.Any(value => !float.IsFinite(value)))
{
    throw new InvalidDataException($"{kind} output contains non-finite values.");
}

Console.WriteLine(
    $"{kind} smoke passed: {width}x{height}, scalar={session.RequiresScalarControl}, input={session.InputElementType}, output={session.OutputElementType}");
