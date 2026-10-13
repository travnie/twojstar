using System;
using System.IO;

namespace Travny.PaintDotNet.AI;

internal static class ModelPath
{
    public static string Resolve(Type anchorType, string modelFileName)
    {
        string? assemblyPath = anchorType.Assembly.Location;
        string directory = string.IsNullOrEmpty(assemblyPath)
            ? AppContext.BaseDirectory
            : Path.GetDirectoryName(assemblyPath) ?? AppContext.BaseDirectory;
        string modelPath = Path.Combine(directory, "model", modelFileName);

        if (!File.Exists(modelPath))
        {
            throw new FileNotFoundException(
                $"AI model '{modelFileName}' is missing. Install the complete Travny.PaintDotNet.AI plugin folder.",
                modelPath);
        }

        return modelPath;
    }
}
