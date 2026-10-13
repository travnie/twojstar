using Travny.PaintDotNet.AI;

if (RestorationMath.CoreTileSize != 128)
{
    throw new InvalidDataException("Unexpected restoration core tile size.");
}

(int coordinate, int expected)[] tileCases =
{
    (0, 0),
    (127, 0),
    (128, 128),
    (255, 128),
    (256, 256)
};

foreach ((int coordinate, int expected) in tileCases)
{
    if (RestorationMath.TileStart(coordinate) != expected)
    {
        throw new InvalidDataException($"Unexpected tile start for {coordinate}.");
    }
}

if (RestorationMath.InputSize(16) != 160 || RestorationMath.InputSize(128) != 384)
{
    throw new InvalidDataException("Restoration context sizing is wrong.");
}
if (RestorationMath.Blend(40, 0.8f, 0f) != 40)
{
    throw new InvalidDataException("Zero-strength blend must preserve the source.");
}

if (RestorationMath.Blend(0, 1f, 1f) != 255)
{
    throw new InvalidDataException("Full-strength blend must use the restored value.");
}

byte midpoint = RestorationMath.Blend(0, 1f, 0.5f);
if (midpoint is < 127 or > 128)
{
    throw new InvalidDataException($"Unexpected midpoint blend: {midpoint}.");
}

Console.WriteLine("Restoration math smoke passed.");
