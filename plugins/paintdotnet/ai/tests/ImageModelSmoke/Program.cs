using Microsoft.ML.OnnxRuntime.Tensors;
using Travny.PaintDotNet.AI;

if (args.Length != 2)
{
    throw new ArgumentException("Usage: ImageModelSmoke <dejpeg|denoise> <model.onnx>");
}

string kind = args[0];
string modelPath = args[1];
bool expectsScalar = kind switch
{
    "dejpeg" => true,
    "denoise" => false,
    _ => throw new ArgumentException($"Unknown model kind: {kind}")
};

using var session = new ImageModelSession(modelPath);
if (session.RequiresScalarControl != expectsScalar)
{
    throw new InvalidDataException(
        $"{kind} scalar-control metadata mismatch: {session.RequiresScalarControl}.");
}

const int width = 64;
const int height = 64;
float[] input = new float[3 * width * height];
Array.Fill(input, 0.5f);
try
{
    session.Run(input, width, height, expectsScalar ? 0.5f : null, () => true);
    throw new InvalidDataException("Pre-run cancellation was ignored.");
}
catch (OperationCanceledException)
{
}

float[] output = session.Run(
    input,
    width,
    height,
    expectsScalar ? 0.5f : null,
    () => false);

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
