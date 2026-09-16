import argparse
import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 48_000
LONG_FRAMES = 512
SHORT_FRAMES = 48
LONG_CLIP_START = 254
SHORT_CLIP_START = 22
CLIP_LENGTH = 4


def write_pcm16(path: Path, samples):
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = b"".join(struct.pack("<h", max(-32768, min(32767, round(x * 32767)))) for x in samples)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(frames)


def read_pcm(path: Path):
    with wave.open(str(path), "rb") as wav:
        channels, width = wav.getnchannels(), wav.getsampwidth()
        if wav.getcomptype() != "NONE":
            raise RuntimeError(f"expected uncompressed PCM WAV, got compression={wav.getcomptype()}")
        if channels != 1 or width not in (2, 3, 4):
            raise RuntimeError(f"expected mono PCM WAV, got {channels}ch/{width * 8}-bit")
        rate = wav.getframerate()
        raw = wav.readframes(wav.getnframes())
    if width == 2:
        return rate, [v / 32768.0 for (v,) in struct.iter_unpack("<h", raw)]
    if width == 4:
        return rate, [v / 2147483648.0 for (v,) in struct.iter_unpack("<i", raw)]
    values = []
    for i in range(0, len(raw), 3):
        value = int.from_bytes(raw[i:i + 3], "little", signed=True)
        values.append(value / 8388608.0)
    return rate, values


def pseudo_random(frames, seed, amplitude=0.18):
    rng = random.Random(seed)
    return [amplitude * (2.0 * rng.random() - 1.0) for _ in range(frames)]


def make_fixture(kind):
    if kind == "short":
        samples = pseudo_random(SHORT_FRAMES, 0xA11D)
        clip_start = SHORT_CLIP_START
    else:
        samples = pseudo_random(LONG_FRAMES, 0xDEC1)
        clip_start = LONG_CLIP_START
    shape = [0.72, 0.86, 1.0, 1.0, 1.0, 1.0, 0.87, 0.73]
    start = clip_start - 2
    samples[start:start + len(shape)] = shape
    return samples


def cosine_at_lag(source, output, lag):
    if lag >= 0:
        xs = source[:len(source) - lag or None]
        ys = output[lag:lag + len(xs)]
    else:
        xs = source[-lag:]
        ys = output[:len(xs)]
    if len(xs) < max(16, len(source) // 2):
        return -1.0
    dot = sum(a * b for a, b in zip(xs, ys))
    ex = math.sqrt(sum(a * a for a in xs))
    ey = math.sqrt(sum(b * b for b in ys))
    return dot / (ex * ey) if ex and ey else -1.0


def verify(source_path: Path, output_path: Path, kind: str):
    source_rate, source = read_pcm(source_path)
    output_rate, output = read_pcm(output_path)
    if source_rate != output_rate or len(source) != len(output):
        raise RuntimeError(f"shape changed: {source_rate}/{len(source)} -> {output_rate}/{len(output)}")
    max_lag = min(80, len(source) // 2 - 1)
    scores = {lag: cosine_at_lag(source, output, lag) for lag in range(-max_lag, max_lag + 1)}
    best_lag = max(scores, key=scores.get)
    zero_score = scores[0]
    energy = sum(sample * sample for sample in output)
    if best_lag != 0 or zero_score < 0.90 or energy < 1e-5:
        raise RuntimeError(f"latency compensation failed: best_lag={best_lag}, corr0={zero_score:.6f}, energy={energy:.6g}")
    clip_start = LONG_CLIP_START if kind == "long" else SHORT_CLIP_START
    clip_end = clip_start + CLIP_LENGTH
    changed = any(abs(output[i] - source[i]) > 2 / 32768 for i in range(clip_start, clip_end))
    if not changed:
        raise RuntimeError("effect did not change the clipped plateau")
    print(f"PASS {kind}: frames={len(output)} rate={output_rate} max_lag={max_lag} best_lag={best_lag} corr0={zero_score:.6f} clip_changed={changed}")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="action", required=True)
    gen = sub.add_parser("generate")
    gen.add_argument("kind", choices=("long", "short"))
    gen.add_argument("path", type=Path)
    check = sub.add_parser("verify")
    check.add_argument("kind", choices=("long", "short"))
    check.add_argument("source", type=Path)
    check.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.action == "generate":
        write_pcm16(args.path, make_fixture(args.kind))
        print(f"generated {args.kind}: {args.path}")
    else:
        verify(args.source, args.output, args.kind)


if __name__ == "__main__":
    main()

