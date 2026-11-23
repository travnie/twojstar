using System;
using System.Drawing;
using System.IO;
using System.Collections.Generic;
using System.Linq;

namespace Travny.PaintDotNetIco;

internal static class Program
{
    private static void Main()
    {
        using var source = new Bitmap(32, 20);
        using (Graphics graphics = Graphics.FromImage(source))
        {
            graphics.Clear(Color.Transparent);
            graphics.FillRectangle(Brushes.DodgerBlue, 4, 3, 20, 12);
        }

        using var encoded = new MemoryStream();
        double lastProgress = -1;
        IcoEncoder.Write(encoded, source, new[] { 16, 32, 256 }, preserveAspectRatio: true,
            progress => lastProgress = progress);
        Assert(lastProgress == 100, "Encoder did not report completion.");

        encoded.Position = 0;
        using IcoDocument document = IcoDecoder.Read(encoded);
        Assert(document.Frames.Count == 3, "Unexpected frame count.");
        int[] expectedSizes = { 16, 32, 256 };
        Assert(document.Frames.Select(frame => frame.Width).SequenceEqual(expectedSizes),
            "Encoded frame widths differ from requested sizes.");
        var decodableFrames = document.GetDecodableFrames();
        Assert(decodableFrames.Count == 3, "Not all encoded frames are decodable.");

        foreach (IcoFrame frame in decodableFrames)
        {
            Assert(document.CanDecode(frame), $"Frame {frame.Index} is not decodable.");
            using Bitmap decoded = document.Decode(frame);
            Assert(decoded.Width == frame.Width && decoded.Height == frame.Height,
                $"Frame {frame.Index} dimensions do not match its directory entry.");
        }

        VerifyMixedPngAndDibFrames();

        using var malformed = new MemoryStream(new byte[] { 1, 0, 1, 0, 1, 0 });
        try
        {
            using IcoDocument _ = IcoDecoder.Read(malformed);
            throw new InvalidOperationException("Malformed ICO header was accepted.");
        }
        catch (InvalidDataException)
        {
        }

        Console.WriteLine("Paint.NET ICO codec smoke test passed.");
    }
    private static void VerifyMixedPngAndDibFrames()
    {
        using var bitmap = new Bitmap(32, 32);
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            graphics.Clear(Color.Transparent);
            graphics.FillRectangle(Brushes.DodgerBlue, 4, 4, 24, 24);
        }

        using var png = new MemoryStream();
        bitmap.Save(png, System.Drawing.Imaging.ImageFormat.Png);
        byte[] pngBytes = png.ToArray();

        byte[] dibBytes = CreateLegacyDib();
        using var mixed = new MemoryStream();
        using (var writer = new BinaryWriter(mixed, System.Text.Encoding.UTF8, leaveOpen: true))
        {
            writer.Write((ushort)0);
            writer.Write((ushort)1);
            writer.Write((ushort)2);
            WriteEntry(writer, 16, dibBytes.Length, 38);
            WriteEntry(writer, 32, pngBytes.Length, 38 + dibBytes.Length);
            writer.Write(dibBytes);
            writer.Write(pngBytes);
        }

        mixed.Position = 0;
        using IcoDocument icon = IcoDecoder.Read(mixed);
        IReadOnlyList<IcoFrame> frames = icon.GetDecodableFrames();
        Assert(frames.Count == 2, "Mixed PNG/DIB frames were not both decoded.");
        Assert(!frames[0].IsPng && frames[1].IsPng, "Mixed frame formats were not recognized.");
        foreach (IcoFrame frame in frames)
        {
            using Bitmap decoded = icon.Decode(frame);
            Assert(decoded.Width == frame.Width && decoded.Height == frame.Height,
                "Mixed frame dimensions changed during decoding.");
        }

        using Bitmap dibFrame = icon.Decode(frames[0]);
        Color dibPixel = dibFrame.GetPixel(8, 8);
        Assert(dibPixel.A == 255 && dibPixel.G > 100,
            "Legacy DIB frame lost opaque image data.");

        using Bitmap pngFrame = icon.Decode(frames[1]);
        Assert(pngFrame.GetPixel(0, 0).A == 0, "PNG frame lost transparent pixels.");
        Color pngPixel = pngFrame.GetPixel(16, 16);
        Assert(pngPixel.A == 255 && pngPixel.B > 200,
            "PNG frame lost opaque image data.");
    }

    private static void WriteEntry(BinaryWriter writer, int size, int length, int offset)
    {
        writer.Write((byte)size);
        writer.Write((byte)size);
        writer.Write((byte)0);
        writer.Write((byte)0);
        writer.Write((ushort)1);
        writer.Write((ushort)32);
        writer.Write((uint)length);
        writer.Write((uint)offset);
    }

    private static byte[] CreateLegacyDib()
    {
        using var dib = new MemoryStream();
        using (var writer = new BinaryWriter(dib, System.Text.Encoding.UTF8, leaveOpen: true))
        {
            writer.Write(40); // BITMAPINFOHEADER
            writer.Write(16);
            writer.Write(32); // XOR + AND heights
            writer.Write((ushort)1);
            writer.Write((ushort)32);
            writer.Write(0);
            writer.Write(16 * 16 * 4);
            writer.Write(0);
            writer.Write(0);
            writer.Write(0);
            writer.Write(0);

            for (int pixel = 0; pixel < 16 * 16; pixel++)
            {
                writer.Write((byte)44);
                writer.Write((byte)155);
                writer.Write((byte)44);
                writer.Write((byte)255);
            }

            writer.Write(new byte[16 * 4]); // Opaque 1bpp AND mask
        }

        return dib.ToArray();
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
