using System;

namespace Travny.PaintDotNet.AI;

internal static class TransparencyMath
{
    public const int ModelSize = 320;

    public static float Normalize(float value, float min, float max)
    {
        if (!float.IsFinite(value) || !float.IsFinite(min) || !float.IsFinite(max) ||
            max - min < 1e-6f)
        {
            return 0f;
        }

        return Math.Clamp((value - min) / (max - min), 0f, 1f);
    }

    public static float Sample(float[] mask, int width, int height, float x, float y)
    {
        float fx = Math.Clamp(x, 0f, width - 1f);
        float fy = Math.Clamp(y, 0f, height - 1f);
        int left = (int)fx;
        int top = (int)fy;
        int right = Math.Min(left + 1, width - 1);
        int bottom = Math.Min(top + 1, height - 1);
        float dx = fx - left;
        float dy = fy - top;
        float topValue = mask[top * width + left] * (1 - dx) +
            mask[top * width + right] * dx;
        float bottomValue = mask[bottom * width + left] * (1 - dx) +
            mask[bottom * width + right] * dx;
        return Math.Clamp(topValue * (1 - dy) + bottomValue * dy, 0f, 1f);
    }

    public static byte Alpha(byte original, float mask, int strength, int softness)
    {
        if (strength <= 0) return original;
        float normalized = Math.Clamp(mask, 0f, 1f);
        float width = Math.Clamp(softness / 100f, 0.02f, 1f);
        float low = 0.5f - width * 0.5f;
        float t = Math.Clamp((normalized - low) / width, 0f, 1f);
        float smooth = t * t * (3f - 2f * t);
        float target = Math.Min(original / 255f, smooth);
        float mixed = original / 255f +
            (target - original / 255f) * Math.Clamp(strength / 100f, 0f, 1f);
        return (byte)Math.Clamp((int)MathF.Round(mixed * 255f), 0, original);
    }
}
