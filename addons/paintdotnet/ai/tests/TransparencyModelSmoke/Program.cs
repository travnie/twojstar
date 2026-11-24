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
float[] almostBlack = { 0.001f, 0.003f, 0.005f };
TransparencyMath.NormalizeMask(almostBlack);
Assert(almostBlack.All(v => v < 0.01f),
    "Near-constant background noise became false foreground");
float[] almostWhite = { 0.95f, 0.97f, 0.99f };
TransparencyMath.NormalizeMask(almostWhite);
Assert(almostWhite.All(v => v > 0.9f),
    "Near-constant foreground gained transparent holes");
float[] highContrast = { 0.1f, 0.5f, 0.9f };
TransparencyMath.NormalizeMask(highContrast);
Assert(highContrast[0] == 0f && highContrast[2] == 1f,
    "Reference min-max mask normalization changed");
float[] input = new float[3 * 320 * 320];
for (int y = 0; y < 320; y++) for (int x = 0; x < 320; x++) {
    int i = y * 320 + x;
    float v = x >= 100 && x < 220 && y >= 90 && y < 230 ? 0.85f : 0.15f;
    input[i] = (v - 0.485f) / 0.229f;
    input[102400 + i] = (v - 0.456f) / 0.224f;
    input[204800 + i] = (v - 0.406f) / 0.225f;
}
float[] dark = input.Select(v => v * 0.3f).ToArray();
TransparencyMath.NormalizeInput(input);
TransparencyMath.NormalizeInput(dark);
Assert(input.Zip(dark).All(pair => Math.Abs(pair.First - pair.Second) < 1e-5f),
    "Dark image normalization changed the subject tensor");
float[] black = new float[3 * 320 * 320];
TransparencyMath.NormalizeInput(black);
Assert(black.All(float.IsFinite), "Black image preprocessing produced nonfinite input");
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
