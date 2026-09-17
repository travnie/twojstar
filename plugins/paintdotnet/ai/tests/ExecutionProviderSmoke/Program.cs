using Microsoft.ML.OnnxRuntime;

using var options = new SessionOptions();
options.SetEpSelectionPolicy(ExecutionProviderDevicePolicy.MAX_PERFORMANCE);

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
