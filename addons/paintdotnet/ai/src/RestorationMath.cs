using System;

namespace Travny.PaintDotNet.AI;

internal static class RestorationMath
{
    public const int CoreTileSize = 128;

    public static int TileStart(int coordinate)
    {
        return (coordinate / CoreTileSize) * CoreTileSize;
    }

    public static int InputSize(int contextRadius)
    {
        return checked(CoreTileSize + (2 * contextRadius));
    }

    public static byte Blend(byte original, float restored, float amount)
    {
        float source = original / 255f;
        float mixed = source + ((Math.Clamp(restored, 0f, 1f) - source) * Math.Clamp(amount, 0f, 1f));
        return (byte)Math.Clamp((int)MathF.Round(mixed * 255f), 0, 255);
    }
}
