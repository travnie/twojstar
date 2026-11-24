using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using Travny.PaintDotNet.AI;

if (args.Length is < 2 or > 3 || args[0] is "--help" or "-h")
{
    Console.WriteLine("Usage: TravnyAIUpscale <input-image> <2|4> [output.png]");
    Console.WriteLine("Output defaults to <input-name>-ai-2x.png or -ai-4x.png.");
    return args.Length == 1 && args[0] is "--help" or "-h" ? 0 : 2;
}
if (args[1] is not ("2" or "4"))
{
    Console.Error.WriteLine("Scale must be 2 or 4.");
    return 2;
}
int scale = int.Parse(args[1]);
string inputPath = Path.GetFullPath(args[0]);
string outputPath = Path.GetFullPath(args.Length == 3
    ? args[2]
    : Path.Combine(Path.GetDirectoryName(inputPath)!,
        Path.GetFileNameWithoutExtension(inputPath) + $"-ai-{scale}x.png"));
if (!File.Exists(inputPath) || Path.GetExtension(outputPath).ToLowerInvariant() != ".png" ||
    string.Equals(inputPath, outputPath, StringComparison.OrdinalIgnoreCase))
{
    Console.Error.WriteLine("Existing input and distinct PNG output required.");
    return 2;
}
if (File.Exists(outputPath))
{
    Console.Error.WriteLine("Output already exists; refusing to overwrite: " + outputPath);
    return 2;
}

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cancellation.Cancel();
};
try
{
    using Bitmap original = new(inputPath);
    int width = original.Width;
    int height = original.Height;
    if (width < 1 || height < 1 || (long)width * height * scale * scale > 64_000_000)
        throw new ArgumentException("Output exceeds 64 megapixels. Use a smaller source.");
    int outputWidth = checked(width * scale);
    int outputHeight = checked(height * scale);
    string modelPath = Path.Combine(AppContext.BaseDirectory, "model",
        "realesr-general-x4v3.onnx");
    if (!File.Exists(modelPath))
        throw new FileNotFoundException("Bundled Real-ESRGAN model missing.", modelPath);

    using Bitmap image = new(width, height, PixelFormat.Format32bppArgb);
    using (Graphics graphics = Graphics.FromImage(image))
    {
        graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
        graphics.DrawImage(original, 0, 0, width, height);
    }
    byte[] source = ReadPixels(image);
    byte[] output = new byte[checked(outputWidth * outputHeight * 4)];
    var session = new RealEsrganSession(modelPath);

    const int core = 128;
    const int halo = 34;
    int tiles = ((width + core - 1) / core) * ((height + core - 1) / core);
    int finished = 0;
    for (int y0 = 0; y0 < height; y0 += core)
    {
        for (int x0 = 0; x0 < width; x0 += core)
        {
            cancellation.Token.ThrowIfCancellationRequested();
            int coreWidth = Math.Min(core, width - x0);
            int coreHeight = Math.Min(core, height - y0);
            int tileWidth = coreWidth + 2 * halo;
            int tileHeight = coreHeight + 2 * halo;
            int plane = checked(tileWidth * tileHeight);
            float[] tensor = new float[checked(plane * 3)];
            for (int y = 0; y < tileHeight; y++)
            {
                int sy = Math.Clamp(y0 + y - halo, 0, height - 1);
                for (int x = 0; x < tileWidth; x++)
                {
                    int sx = Math.Clamp(x0 + x - halo, 0, width - 1);
                    int offset = (sy * width + sx) * 4;
                    int i = y * tileWidth + x;
                    float a = source[offset + 3] / 255f;
                    tensor[i] = source[offset + 2] / 255f * a;
                    tensor[plane + i] = source[offset + 1] / 255f * a;
                    tensor[2 * plane + i] = source[offset] / 255f * a;
                }
            }

            float[] enhanced = session.Run(tensor, tileWidth, tileHeight,
                () => cancellation.IsCancellationRequested);
            int enhancedWidth = tileWidth * 4;
            int enhancedPlane = enhancedWidth * tileHeight * 4;
            for (int localY = 0; localY < coreHeight * scale; localY++)
            {
                if (cancellation.IsCancellationRequested) throw new OperationCanceledException();
                int dy = y0 * scale + localY;
                for (int localX = 0; localX < coreWidth * scale; localX++)
                {
                    int dx = x0 * scale + localX;
                    int dest = (dy * outputWidth + dx) * 4;
                    // x4 native model output; x2 uses area-average of each 2x2
                    // high-res model block, not a second upscale pass.
                    int modelStep = 4 / scale;
                    int modelX = (localX * modelStep) + halo * 4;
                    int modelY = (localY * modelStep) + halo * 4;
                    float srcX = ((dx + 0.5f) / scale) - 0.5f;
                    float srcY = ((dy + 0.5f) / scale) - 0.5f;
                    byte alphaByte = UpscaleMath.SampleAlpha(source,
                        width, height, srcX, srcY);
                    output[dest + 3] = alphaByte;
                    float inverseAlpha = alphaByte > 0 ? 255f / alphaByte : 0f;
                    for (int channel = 0; channel < 3; channel++)
                    {
                        int index = (2 - channel) * enhancedPlane;
                        float sum = 0f;
                        for (int yy = 0; yy < modelStep; yy++)
                            for (int xx = 0; xx < modelStep; xx++)
                                sum += enhanced[index + (modelY + yy) * enhancedWidth +
                                    modelX + xx];
                        output[dest + channel] = (byte)Math.Clamp(
                            (int)MathF.Round(sum * inverseAlpha * 255f / (modelStep * modelStep)), 0, 255);
                    }
                }
            }
            Console.WriteLine($"{++finished}/{tiles} tiles");
        }
    }
    cancellation.Token.ThrowIfCancellationRequested();
    using Bitmap destination = new(outputWidth, outputHeight, PixelFormat.Format32bppArgb);
    WritePixels(destination, output);
    // Write to a distinct temporary file, publish only after a complete PNG.
    string temporary = outputPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
    try
    {
        destination.Save(temporary, ImageFormat.Png);
        File.Move(temporary, outputPath, overwrite: false);
    }
    finally
    {
        if (File.Exists(temporary)) File.Delete(temporary);
    }
    Console.WriteLine("Saved: " + outputPath);
    return 0;
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("Upscale cancelled.");
    return 130;
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    return 1;
}

static byte[] ReadPixels(Bitmap bitmap)
{
    Rectangle area = new(0, 0, bitmap.Width, bitmap.Height);
    BitmapData bits = bitmap.LockBits(area, ImageLockMode.ReadOnly,
        PixelFormat.Format32bppArgb);
    try
    {
        byte[] values = new byte[checked(bitmap.Width * bitmap.Height * 4)];
        for (int y = 0; y < bitmap.Height; y++)
            Marshal.Copy(IntPtr.Add(bits.Scan0, y * bits.Stride),
                values, y * bitmap.Width * 4, bitmap.Width * 4);
        return values;
    }
    finally { bitmap.UnlockBits(bits); }
}

static void WritePixels(Bitmap bitmap, byte[] values)
{
    Rectangle area = new(0, 0, bitmap.Width, bitmap.Height);
    BitmapData bits = bitmap.LockBits(area, ImageLockMode.WriteOnly,
        PixelFormat.Format32bppArgb);
    try
    {
        for (int y = 0; y < bitmap.Height; y++)
            Marshal.Copy(values, y * bitmap.Width * 4,
                IntPtr.Add(bits.Scan0, y * bits.Stride), bitmap.Width * 4);
    }
    finally { bitmap.UnlockBits(bits); }
}
