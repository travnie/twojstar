using Microsoft.ML.OnnxRuntime;
using Travny.PaintDotNet.AI;

IReadOnlyList<OrtEpDevice> devices = OrtEnv.Instance().GetEpDevices();
OrtEpDevice? selected = InferenceSessionOptions.FindDirectMlDiscreteGpu(devices);
if (selected is not null)
{
    IReadOnlyDictionary<string, string> metadata = selected.HardwareDevice.Metadata.Entries;
    if (selected.HardwareDevice.Type != OrtHardwareDeviceType.GPU ||
        !metadata.TryGetValue("Discrete", out string? discrete) || discrete != "1" ||
        (metadata.TryGetValue("is_virtual", out string? virtualDevice) && virtualDevice == "1"))
    {
        throw new InvalidDataException("DirectML selector returned a non-discrete or virtual device.");
    }
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
    if (!File.Exists(path)) throw new InvalidDataException($"Windows ML runtime file missing: {fileName}");
}

Console.WriteLine(selected is null
    ? "Windows ML payload smoke passed; no discrete DirectML GPU, CPU fallback selected."
    : $"Windows ML payload smoke passed; DirectML GPU selected: {selected.HardwareDevice.Vendor}.");
