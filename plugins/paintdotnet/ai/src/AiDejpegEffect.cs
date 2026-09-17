using PaintDotNet;
using System;
using System.Threading;

namespace Travny.PaintDotNet.AI;

[PluginSupportInfo(typeof(PluginSupportInfo))]
public sealed class AiDejpegEffect : ImageRestorationEffectBase
{
    private const string ModelFileName = "fbcnn_color_fp16.onnx";

    private static readonly Lazy<ImageModelSession> SharedSession = new(
        () => new ImageModelSession(ModelPath.Resolve(typeof(AiDejpegEffect), ModelFileName)),
        LazyThreadSafetyMode.ExecutionAndPublication);

    public AiDejpegEffect()
        : base("AI DeJPEG", 50)
    {
    }

    private protected override ImageModelSession Session => SharedSession.Value;
    protected override int ContextRadius => 16;
    protected override bool StrengthAffectsInference => true;
    protected override float? GetScalarControl(int effectStrength) => effectStrength / 100f;

    // FBCNN's control input already changes restoration strength. Do not attenuate it twice.
    protected override float GetBlendAmount(int effectStrength) => 1f;
}
