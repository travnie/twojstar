using PaintDotNet;
using System;
using System.Threading;

namespace Travny.PaintDotNet.AI;

[PluginSupportInfo(typeof(PluginSupportInfo))]
public sealed class AiDenoiseEffect : ImageRestorationEffectBase
{
    private const string ModelFileName = "scunet_color_real_psnr_fp16.onnx";

    private static readonly Lazy<ImageModelSession> SharedSession = new(
        () => new ImageModelSession(ModelPath.Resolve(typeof(AiDenoiseEffect), ModelFileName)),
        LazyThreadSafetyMode.ExecutionAndPublication);

    public AiDenoiseEffect()
        : base("AI Denoise", 75)
    {
    }

    private protected override ImageModelSession Session => SharedSession.Value;

    // DeJPEG enforces at least 128 px overlap for SCUNet. Keep that seam-safe context here too.
    protected override int ContextRadius => 128;
}
