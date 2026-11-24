namespace Travny.PaintDotNet.AI;

internal static class UpscaleMath
{
    public static byte SampleAlpha(byte[] source, int width, int height, float x, float y)
    {
        float fx = Math.Clamp(x, 0, width - 1);
        float fy = Math.Clamp(y, 0, height - 1);
        int left = (int)fx, top = (int)fy;
        int right = Math.Min(left + 1, width - 1);
        int bottom = Math.Min(top + 1, height - 1);
        float dx = fx - left, dy = fy - top;
        float upper = source[(top * width + left) * 4 + 3] * (1 - dx) +
            source[(top * width + right) * 4 + 3] * dx;
        float lower = source[(bottom * width + left) * 4 + 3] * (1 - dx) +
            source[(bottom * width + right) * 4 + 3] * dx;
        return (byte)Math.Clamp((int)MathF.Round(upper * (1 - dy) + lower * dy), 0, 255);
    }
}
