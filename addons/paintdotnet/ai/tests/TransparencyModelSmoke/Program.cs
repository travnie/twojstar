using Travny.PaintDotNet.AI;
if (args.Length != 1) throw new ArgumentException("Usage: TransparencyModelSmoke <u2netp.onnx>");
static void Assert(bool valid, string message) {
    if (!valid) throw new InvalidDataException(message);
}
Assert(TransparencyMath.Alpha(0, 1f, 100, 70) == 0, "Transparent alpha increased");
Assert(TransparencyMath.Alpha(123, 1f, 100, 70) == 123, "Existing alpha increased");
Assert(TransparencyMath.Alpha(200, 0f, 100, 70) == 0, "Background retained");
Assert(TransparencyMath.Alpha(200, 0f, 0, 70) == 200, "Strength zero changed alpha");
float[] pixels = { 0f, 1f, 1f, 0f };
Assert(Math.Abs(TransparencyMath.Sample(pixels, 2, 2, 0.5f, 0.5f) - 0.5f) < 1e-6,
    "Bilinear sampling failed");
float[] input = new float[3 * 320 * 320];
for (int y = 0; y < 320; y++) for (int x = 0; x < 320; x++) {
    int i = y * 320 + x;
    float v = x >= 100 && x < 220 && y >= 90 && y < 230 ? 0.85f : 0.15f;
    input[i] = (v - 0.485f) / 0.229f;
    input[102400 + i] = (v - 0.456f) / 0.224f;
    input[204800 + i] = (v - 0.406f) / 0.225f;
}
using var model = new TransparencyModelSession(args[0]);
try {
    model.Run(input, () => true);
    throw new InvalidDataException("Pre-run cancellation ignored");
} catch (OperationCanceledException) { }
float[] output = model.Run(input, () => false);
Assert(output.Length == 102400 && output.All(v => float.IsFinite(v) && v >= 0 && v <= 1),
    "Invalid normalized mask");
Assert(output.Max() - output.Min() > 0.01f, "Flat matting output");
Console.WriteLine("Smart Transparency U2Net-p smoke passed");
