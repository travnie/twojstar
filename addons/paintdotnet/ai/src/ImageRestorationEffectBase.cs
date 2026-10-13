using PaintDotNet;
using PaintDotNet.Effects;
using PaintDotNet.Imaging;
using PaintDotNet.PropertySystem;
using PaintDotNet.Rendering;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;

namespace Travny.PaintDotNet.AI;

public abstract class ImageRestorationEffectBase : PropertyBasedBitmapEffect
{
    private const int MaxCachedTiles = 8;

    private readonly ConcurrentDictionary<TileKey, Lazy<RestoredTile>> tileCache = new();
    private readonly ConcurrentQueue<KeyValuePair<TileKey, Lazy<RestoredTile>>> tileOrder = new();
    private IBitmapSource<ColorBgra32>? sourceBitmap;
    private int strength;

    protected ImageRestorationEffectBase(string effectName, int defaultStrength)
        : base(effectName, "Travny Paint.NET AI", BitmapEffectOptions.Create() with { IsConfigurable = true })
    {
        DefaultStrength = defaultStrength;
    }

    private protected abstract ImageModelSession Session { get; }
    protected abstract int ContextRadius { get; }
    protected virtual bool StrengthAffectsInference => false;
    protected int DefaultStrength { get; }

    protected virtual float? GetScalarControl(int effectStrength) => null;
    protected virtual float GetBlendAmount(int effectStrength) => effectStrength / 100f;

    private enum PropertyNames
    {
        Strength
    }

    protected override PropertyCollection OnCreatePropertyCollection()
    {
        return new PropertyCollection(new List<Property>
        {
            new Int32Property(PropertyNames.Strength, DefaultStrength, 0, 100)
        });
    }

    protected override void OnInitializeRenderInfo(IBitmapEffectRenderInfo renderInfo)
    {
        renderInfo.OutputPixelFormat = PixelFormats.Bgra32;
        sourceBitmap = Environment.GetSourceBitmap<ColorBgra32>();
        ClearTileCache();
        base.OnInitializeRenderInfo(renderInfo);
    }

    protected override void OnSetToken(PropertyBasedEffectConfigToken? newToken)
    {
        strength = newToken!.GetProperty<Int32Property>(PropertyNames.Strength)!.Value;
        base.OnSetToken(newToken);
    }

    protected override void OnRender(IBitmapEffectOutput output)
    {
        int currentStrength = strength;
        if (currentStrength == 0)
        {
            using IBitmapLock<ColorBgra32> passthrough = output.Lock<ColorBgra32>();
            sourceBitmap!.CopyPixels(passthrough, output.Bounds.Location);
            return;
        }

        if (IsCancelRequested)
        {
            return;
        }

        using IBitmapLock<ColorBgra32> outputLock = output.Lock<ColorBgra32>();
        RegionPtr<ColorBgra32> outputRegion = outputLock.AsRegionPtr();
        using IBitmap<ColorBgra32> sourceTile = sourceBitmap!
            .CreateClipper(output.Bounds, BitmapExtendMode.Clamp)
            .ToBitmap();
        using IBitmapLock<ColorBgra32> sourceLock = sourceTile.Lock(BitmapLockOptions.Read);
        RegionPtr<ColorBgra32> sourceRegion = sourceLock.AsRegionPtr();
        float blendAmount = GetBlendAmount(currentStrength);

        int outputLeft = output.Bounds.X;
        int outputTop = output.Bounds.Y;
        int outputRight = checked(outputLeft + outputRegion.Width);
        int outputBottom = checked(outputTop + outputRegion.Height);
        int cacheStrength = StrengthAffectsInference ? currentStrength : 0;
        TileKey firstKey = TileKey.FromPixel(outputLeft, outputTop, cacheStrength);

        try
        {
            for (int tileY = firstKey.Y; tileY < outputBottom; tileY += RestorationMath.CoreTileSize)
            {
                for (int tileX = firstKey.X; tileX < outputRight; tileX += RestorationMath.CoreTileSize)
                {
                    if (IsCancelRequested)
                    {
                        return;
                    }

                    TileKey key = new(tileX, tileY, cacheStrength);
                    RestoredTile restored = GetRestoredTile(key);
                    int startX = Math.Max(outputLeft, tileX);
                    int endX = Math.Min(outputRight, checked(tileX + RestorationMath.CoreTileSize));
                    int startY = Math.Max(outputTop, tileY);
                    int endY = Math.Min(outputBottom, checked(tileY + RestorationMath.CoreTileSize));

                    RenderTileRegion(
                        sourceRegion, outputRegion, restored,
                        outputLeft, outputTop, tileX, tileY,
                        startX, endX, startY, endY, blendAmount);
                }
            }
        }
        catch (OperationCanceledException) when (IsCancelRequested)
        {
            return;
        }
    }

    private void RenderTileRegion(
        RegionPtr<ColorBgra32> source,
        RegionPtr<ColorBgra32> destination,
        RestoredTile restored,
        int outputLeft,
        int outputTop,
        int tileX,
        int tileY,
        int startX,
        int endX,
        int startY,
        int endY,
        float blendAmount)
    {
        for (int globalY = startY; globalY < endY; globalY++)
        {
            if (IsCancelRequested)
            {
                return;
            }

            int y = globalY - outputTop;
            int restoredY = globalY - tileY;
            for (int globalX = startX; globalX < endX; globalX++)
            {
                int x = globalX - outputLeft;
                int restoredX = globalX - tileX;
                ColorBgra32 original = source[x, y];

                destination[x, y] = ColorBgra32.FromBgra(
                    RestorationMath.Blend(original.B, restored.Get(restoredX, restoredY, 2), blendAmount),
                    RestorationMath.Blend(original.G, restored.Get(restoredX, restoredY, 1), blendAmount),
                    RestorationMath.Blend(original.R, restored.Get(restoredX, restoredY, 0), blendAmount),
                    original.A);
            }
        }
    }

    private RestoredTile GetRestoredTile(TileKey key)
    {
        Lazy<RestoredTile> actual;
        if (!tileCache.TryGetValue(key, out actual!))
        {
            var candidate = new Lazy<RestoredTile>(
                () => RestoreTile(key),
                LazyThreadSafetyMode.ExecutionAndPublication);
            actual = tileCache.GetOrAdd(key, candidate);

            if (ReferenceEquals(actual, candidate))
            {
                tileOrder.Enqueue(new KeyValuePair<TileKey, Lazy<RestoredTile>>(key, candidate));
                TrimTileCache();
            }
        }

        try
        {
            return actual.Value;
        }
        catch
        {
            RemoveCachedTile(key, actual);
            throw;
        }
    }

    private void TrimTileCache()
    {
        ICollection<KeyValuePair<TileKey, Lazy<RestoredTile>>> entries = tileCache;
        while (tileCache.Count > MaxCachedTiles &&
               tileOrder.TryDequeue(out KeyValuePair<TileKey, Lazy<RestoredTile>> oldest))
        {
            entries.Remove(oldest);
        }
    }

    private void RemoveCachedTile(TileKey key, Lazy<RestoredTile> value)
    {
        ICollection<KeyValuePair<TileKey, Lazy<RestoredTile>>> entries = tileCache;
        entries.Remove(new KeyValuePair<TileKey, Lazy<RestoredTile>>(key, value));
    }

    private RestoredTile RestoreTile(TileKey key)
    {
        RectInt32 coreRect = new(
            key.X,
            key.Y,
            RestorationMath.CoreTileSize,
            RestorationMath.CoreTileSize);
        RectInt32 sourceRect = RectInt32.Inflate(coreRect, ContextRadius, ContextRadius);
        using IBitmap<ColorBgra32> sourceTile = sourceBitmap!
            .CreateClipper(sourceRect, BitmapExtendMode.Clamp)
            .ToBitmap();
        using IBitmapLock<ColorBgra32> sourceLock = sourceTile.Lock(BitmapLockOptions.Read);
        RegionPtr<ColorBgra32> sourceRegion = sourceLock.AsRegionPtr();

        int inputWidth = sourceRegion.Width;
        int inputHeight = sourceRegion.Height;
        float[] input = new float[checked(inputWidth * inputHeight * 3)];
        FillInput(sourceRegion, input, inputWidth, inputHeight);

        if (IsCancelRequested)
        {
            throw new OperationCanceledException();
        }

        float[] modelOutput = Session.Run(
            input,
            inputWidth,
            inputHeight,
            GetScalarControl(key.ModelStrength),
            () => IsCancelRequested);

        if (IsCancelRequested)
        {
            throw new OperationCanceledException();
        }

        return CropCore(modelOutput, inputWidth, inputHeight);
    }

    private void FillInput(RegionPtr<ColorBgra32> source, float[] input, int width, int height)
    {
        int planeSize = checked(width * height);
        for (int y = 0; y < height; y++)
        {
            if (IsCancelRequested)
            {
                return;
            }

            for (int x = 0; x < width; x++)
            {
                ColorBgra32 pixel = source[x, y];
                if (pixel.A == 0)
                {
                    continue;
                }

                int offset = (y * width) + x;
                input[offset] = pixel.R / 255f;
                input[planeSize + offset] = pixel.G / 255f;
                input[(2 * planeSize) + offset] = pixel.B / 255f;
            }
        }
    }

    private RestoredTile CropCore(float[] restored, int inputWidth, int inputHeight)
    {
        int planeSize = checked(inputWidth * inputHeight);
        if (restored.Length != checked(planeSize * 3))
        {
            throw new InvalidOperationException("Restoration model returned an unexpected buffer size.");
        }

        int coreSize = RestorationMath.CoreTileSize;
        int corePlaneSize = checked(coreSize * coreSize);
        float[] core = new float[checked(corePlaneSize * 3)];

        for (int channel = 0; channel < 3; channel++)
        {
            int sourceChannel = channel * planeSize;
            int targetChannel = channel * corePlaneSize;
            for (int y = 0; y < coreSize; y++)
            {
                int sourceOffset = sourceChannel +
                    ((y + ContextRadius) * inputWidth) + ContextRadius;
                int targetOffset = targetChannel + (y * coreSize);
                Array.Copy(restored, sourceOffset, core, targetOffset, coreSize);
            }
        }

        return new RestoredTile(core);
    }

    private void ClearTileCache()
    {
        tileCache.Clear();
        while (tileOrder.TryDequeue(out _))
        {
        }
    }

    private readonly record struct TileKey(int X, int Y, int ModelStrength)
    {
        public static TileKey FromPixel(int x, int y, int modelStrength)
        {
            return new TileKey(
                RestorationMath.TileStart(x),
                RestorationMath.TileStart(y),
                modelStrength);
        }
    }

    private sealed class RestoredTile
    {
        private readonly float[] values;

        public RestoredTile(float[] values)
        {
            this.values = values;
        }

        public float Get(int x, int y, int channel)
        {
            int planeSize = RestorationMath.CoreTileSize * RestorationMath.CoreTileSize;
            return values[(channel * planeSize) + (y * RestorationMath.CoreTileSize) + x];
        }
    }
}
