using Microsoft.ML.OnnxRuntime;
using Travny.PaintDotNet.AI;

if (InferenceSessionOptions.Policy != ExecutionProviderDevicePolicy.MAX_PERFORMANCE)
{
    throw new InvalidDataException("Windows ML policy must prefer maximum performance.");
}

using SessionOptions options = InferenceSessionOptions.Create();
string[] requiredFiles =
[
    "Microsoft.Windows.AI.MachineLearning.dll",
    "onnxruntime.dll",
    "DirectML.dll"
];

foreach (string fileName in requiredFiles)
{
    string path = Path.Combine(AppContext.BaseDirectory, fileName);
    if (!File.Exists(path))
    {
        throw new InvalidDataException($"Windows ML runtime file missing: {fileName}");
    }
}

Console.WriteLine("Windows ML DirectML payload smoke passed.");
