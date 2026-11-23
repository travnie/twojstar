using PaintDotNet;
using PaintDotNet.Effects;
using PaintDotNet.Imaging;
using PaintDotNet.PropertySystem;
using PaintDotNet.Rendering;
using System;
using System.Collections.Generic;
using System.Threading;

namespace Travny.PaintDotNet.AI;

[PluginSupportInfo(typeof(PluginSupportInfo))]
public sealed class SmartTransparencyEffect : PropertyBasedBitmapEffect
{
    private const string ModelFileName = "u2netp.onnx";
    private static readonly Lazy<TransparencyModelSession> SharedSession = new(
        () => new TransparencyModelSession(
            ModelPath.Resolve(typeof(SmartTransparencyEffect), ModelFileName)),
        LazyThreadSafetyMode.ExecutionAndPublication);

    private IBitmapSource<ColorBgra32>? source;
    private Lazy<float[]>? matte;
    private int strength;
    private int softness;

    public SmartTransparencyEffect()
        : base("Smart Transparency", "Travny Paint.NET AI",
            BitmapEffectOptions.Create() with { IsConfigurable = true })
    {
    }

    private enum PropertyNames { Strength, EdgeSoftness }

    protected override PropertyCollection OnCreatePropertyCollection()
    {
        return new PropertyCollection(new List<Property>
        {
            new Int32Property(PropertyNames.Strength, 100, 0, 100),
            new Int32Property(PropertyNames.EdgeSoftness, 70, 0, 100)
        });
    }

    protected override void OnInitializeRenderInfo(IBitmapEffectRenderInfo renderInfo)
    {
        renderInfo.OutputPixelFormat = PixelFormats.Bgra32;
        source = Environment.GetSourceBitmap<ColorBgra32>();
        matte = new Lazy<float[]>(BuildMatte, LazyThreadSafetyMode.ExecutionAndPublication);
        base.OnInitializeRenderInfo(renderInfo);
    }

    protected override void OnSetToken(PropertyBasedEffectConfigToken? token)
    {
        strength = token!.GetProperty<Int32Property>(PropertyNames.Strength)!.Value;
        softness = token.GetProperty<Int32Property>(PropertyNames.EdgeSoftness)!.Value;
        base.OnSetToken(token);
    }

    private float[] BuildMatte()
    {
        const int size = TransparencyMath.ModelSize;
        int width = source!.Size.Width;
        int height = source.Size.Height;
        float[] input = new float[3 * size * size];
        int plane = size * size;
        for (int y = 0; y < size; y++)
        {
            if (IsCancelRequested) throw new OperationCanceledException();
            int sourceY = Math.Min(height - 1, (int)((y + 0.5) * height / size));
            using IBitmap<ColorBgra32> line = source.CreateClipper(
                new RectInt32(0, sourceY, width, 1), BitmapExtendMode.Clamp).ToBitmap();
            using IBitmapLock<ColorBgra32> lockLine = line.Lock(BitmapLockOptions.Read);
            RegionPtr<ColorBgra32> row = lockLine.AsRegionPtr();
            for (int x = 0; x < size; x++)
            {
                int sourceX = Math.Min(width - 1, (int)((x + 0.5) * width / size));
                ColorBgra32 pixel = row[sourceX, 0];
                float alpha = pixel.A / 255f;
                int i = y * size + x;
                input[i] = ((pixel.R / 255f) * alpha - 0.485f) / 0.229f;
                input[plane + i] = ((pixel.G / 255f) * alpha - 0.456f) / 0.224f;
                input[2 * plane + i] = ((pixel.B / 255f) * alpha - 0.406f) / 0.225f;
            }
        }
        return SharedSession.Value.Run(input, () => IsCancelRequested);
    }

    protected override void OnRender(IBitmapEffectOutput output)
    {
        using IBitmapLock<ColorBgra32> outputLock = output.Lock<ColorBgra32>();
        if (strength == 0)
        {
            source!.CopyPixels(outputLock, output.Bounds.Location);
            return;
        }
        if (IsCancelRequested) return;

        try
        {
            float[] mask = matte!.Value;
            RegionPtr<ColorBgra32> destination = outputLock.AsRegionPtr();
            using IBitmap<ColorBgra32> clip = source!.CreateClipper(
                output.Bounds, BitmapExtendMode.Clamp).ToBitmap();
            using IBitmapLock<ColorBgra32> sourceLock = clip.Lock(BitmapLockOptions.Read);
            RegionPtr<ColorBgra32> original = sourceLock.AsRegionPtr();
            int width = source.Size.Width;
            int height = source.Size.Height;
            int x0 = output.Bounds.X;
            int y0 = output.Bounds.Y;
            const int size = TransparencyMath.ModelSize;
            for (int y = 0; y < destination.Height; y++)
            {
                if (IsCancelRequested) return;
                float maskY = ((y0 + y + 0.5f) * size / height) - 0.5f;
                for (int x = 0; x < destination.Width; x++)
                {
                    float maskX = ((x0 + x + 0.5f) * size / width) - 0.5f;
                    ColorBgra32 color = original[x, y];
                    float alphaMask = TransparencyMath.Sample(mask, size, size, maskX, maskY);
                    byte alpha = TransparencyMath.Alpha(color.A, alphaMask, strength, softness);
                    destination[x, y] = ColorBgra32.FromBgra(color.B, color.G, color.R, alpha);
                }
            }
        }
        catch (OperationCanceledException) when (IsCancelRequested)
        {
            return;
        }
    }
}
