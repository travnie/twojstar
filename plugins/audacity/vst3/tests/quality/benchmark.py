"""Host-independent Auto Declip quality benchmark."""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import wave
from pathlib import Path


PLATEAU_LENGTH = 2
CONTEXT_RADIUS = 8
TARGET_PEAK = 0.90


def _limits(width: int) -> tuple[int, int]:
    if width not in (2, 3, 4):
        raise ValueError("only 16/24/32-bit PCM WAV files are supported")
    maximum = (1 << (width * 8 - 1)) - 1
    return -maximum - 1, maximum


def read_wav(path: Path) -> tuple[int, int, int, list[list[int]]]:
    try:
        with wave.open(str(path), "rb") as wav:
            channels, width, rate, frames = (
                wav.getnchannels(),
                wav.getsampwidth(),
                wav.getframerate(),
                wav.getnframes(),
            )
            if wav.getcomptype() != "NONE":
                raise ValueError("compressed WAV is not supported")
            if channels not in (1, 2):
                raise ValueError("only mono or stereo WAV files are supported")
            low, high = _limits(width)
            raw = wav.readframes(frames)
    except (wave.Error, EOFError) as exc:
        raise ValueError(f"invalid PCM WAV: {path}") from exc

    stride = channels * width
    if len(raw) != frames * stride:
        raise ValueError(f"truncated WAV: {path}")
    samples = [[0] * channels for _ in range(frames)]
    for frame in range(frames):
        for channel in range(channels):
            offset = (frame * channels + channel) * width
            value = int.from_bytes(raw[offset : offset + width], "little", signed=False)
            if value & (1 << (width * 8 - 1)):
                value -= 1 << (width * 8)
            if not low <= value <= high:
                raise ValueError(f"sample out of range in {path}")
            samples[frame][channel] = value
    return rate, channels, width, samples


def write_wav(
    path: Path, rate: int, channels: int, width: int, samples: list[list[int]]
) -> None:
    low, high = _limits(width)
    raw = bytearray()
    for frame in samples:
        if len(frame) != channels:
            raise ValueError("frame/channel shape mismatch")
        for value in frame:
            if not low <= value <= high:
                raise ValueError("sample out of range")
            raw.extend(int(value).to_bytes(width, "little", signed=True))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(width)
        wav.setframerate(rate)
        wav.writeframes(raw)


def _peak_score(frame: list[int]) -> int:
    return max(abs(value) for value in frame)


def normalize_peak(samples: list[list[int]], width: int) -> list[list[int]]:
    _, maximum = _limits(width)
    peak = max((abs(value) for frame in samples for value in frame), default=0)
    if peak == 0:
        raise ValueError("input is silent")
    scale = (maximum * TARGET_PEAK) / peak
    low, high = _limits(width)
    return [
        [max(low, min(high, int(round(value * scale)))) for value in frame]
        for frame in samples
    ]

def choose_events(samples: list[list[int]], width: int) -> list[dict[str, int]]:
    if len(samples) < 2 * CONTEXT_RADIUS + PLATEAU_LENGTH + 2:
        raise ValueError("input is too short for quality events")
    _, maximum = _limits(width)
    spacing = max(32, len(samples) // 10)
    candidates = sorted(
        range(CONTEXT_RADIUS + 1, len(samples) - CONTEXT_RADIUS - PLATEAU_LENGTH),
        key=lambda index: (-_peak_score(samples[index]), index),
    )
    events: list[dict[str, int]] = []
    for peak_index in candidates:
        channel = max(range(len(samples[peak_index])), key=lambda c: abs(samples[peak_index][c]))
        start = peak_index - 1
        end = start + PLATEAU_LENGTH - 1
        left = samples[start - 1][channel]
        right = samples[end + 1][channel]
        if abs(samples[peak_index][channel]) >= maximum * 0.98:
            continue
        if (left >= 0) != (right >= 0) or abs(left) < maximum * 0.5 or abs(right) < maximum * 0.5:
            continue
        if any(abs(start - event["start"]) < spacing for event in events):
            continue
        events.append({
            "id": len(events),
            "start": start,
            "length": PLATEAU_LENGTH,
            "peak_index": peak_index,
            "channel": channel,
            "polarity": 1 if samples[peak_index][channel] >= 0 else -1,
        })
        if len(events) == 8:
            break
    events.sort(key=lambda event: event["start"])
    for event_id, event in enumerate(events):
        event["id"] = event_id
    if len(events) < 2:
        raise ValueError("input does not contain enough separated high-level same-polarity peaks")
    return events

def damage(
    clean: list[list[int]], width: int, events: list[dict[str, int]]
) -> list[list[int]]:
    damaged = [frame[:] for frame in clean]
    _, maximum = _limits(width)
    for event in events:
        channel = event["channel"]
        value = maximum if event["polarity"] > 0 else -maximum - 1
        for frame in range(event["start"], event["start"] + event["length"]):
            damaged[frame][channel] = value
    return damaged

def _interpolate(
    clean: list[list[int]], width: int, events: list[dict[str, int]], cubic: bool
) -> list[list[int]]:
    repaired = [frame[:] for frame in clean]
    low, high = _limits(width)
    for event in events:
        start = event["start"]
        end = start + event["length"] - 1
        channel = event["channel"]
        left_index = start - 1
        right_index = end + 1
        y0 = clean[left_index][channel]
        y1 = clean[right_index][channel]
        span = event["length"] + 1
        m0 = clean[left_index][channel] - clean[left_index - 1][channel]
        m1 = clean[right_index + 1][channel] - clean[right_index][channel]
        for offset, frame in enumerate(range(start, end + 1), 1):
            t = offset / span
            if cubic:
                h00 = 2 * t**3 - 3 * t**2 + 1
                h10 = t**3 - 2 * t**2 + t
                h01 = -2 * t**3 + 3 * t**2
                h11 = t**3 - t**2
                value = h00 * y0 + h10 * span * m0 + h01 * y1 + h11 * span * m1
            else:
                value = (1 - t) * y0 + t * y1
            repaired[frame][channel] = max(low, min(high, int(round(value))))
    return repaired

def prepare(input_path: Path, output_dir: Path) -> None:
    rate, channels, width, source = read_wav(input_path)
    clean = normalize_peak(source, width)
    events = choose_events(clean, width)
    damaged = damage(clean, width, events)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_wav(output_dir / "clean.wav", rate, channels, width, clean)
    write_wav(output_dir / "damaged.wav", rate, channels, width, damaged)
    write_wav(output_dir / "linear.wav", rate, channels, width, _interpolate(clean, width, events, False))
    write_wav(output_dir / "cubic.wav", rate, channels, width, _interpolate(clean, width, events, True))
    (output_dir / "events.json").write_text(
        json.dumps(
            {
                "sample_rate": rate,
                "channels": channels,
                "sample_width": width,
                "frames": len(clean),
                "context_radius": CONTEXT_RADIUS,
                "target_peak": TARGET_PEAK,
                "events": events,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def _validate_shape(
    expected: tuple[int, int, int, int], path: Path
) -> list[list[int]]:
    actual = read_wav(path)
    if actual[:3] != expected[:3] or len(actual[3]) != expected[3]:
        raise ValueError(f"{path} does not match the prepared WAV shape")
    return actual[3]


def _rmse(
    actual: list[list[int]], clean: list[list[int]], points: list[tuple[int, int]]
) -> float:
    errors = [(actual[frame][channel] - clean[frame][channel]) ** 2 for frame, channel in points]
    return math.sqrt(sum(errors) / len(errors)) if errors else 0.0

def score(prepared_dir: Path, outputs: dict[str, Path | None]) -> dict:
    rate, channels, width, clean = read_wav(prepared_dir / "clean.wav")
    damaged = _validate_shape((rate, channels, width, len(clean)), prepared_dir / "damaged.wav")
    metadata = json.loads((prepared_dir / "events.json").read_text(encoding="utf-8"))
    if (
        metadata.get("sample_rate", rate) != rate
        or metadata.get("channels", channels) != channels
        or metadata.get("sample_width", width) != width
        or metadata.get("frames", len(clean)) != len(clean)
    ):
        raise ValueError("events.json does not match the prepared WAV shape")
    events = metadata["events"]
    clipped = [
        (frame, event["channel"])
        for event in events
        for frame in range(event["start"], event["start"] + event["length"])
    ]
    context = {
        frame
        for event in events
        for frame in range(
            max(0, event["start"] - CONTEXT_RADIUS),
            min(len(clean), event["start"] + event["length"] + CONTEXT_RADIUS),
        )
    }
    evaluation = context
    outside = set(range(len(clean))) - evaluation
    context_points = [(frame, channel) for frame in context for channel in range(channels)]
    methods = {
        "damaged": damaged,
        "linear": _validate_shape((rate, channels, width, len(clean)), prepared_dir / "linear.wav"),
        "cubic_hermite": _validate_shape((rate, channels, width, len(clean)), prepared_dir / "cubic.wav"),
    }
    for name, path in outputs.items():
        if path is not None:
            methods[name] = _validate_shape((rate, channels, width, len(clean)), path)
    report = {"sample_rate": rate, "channels": channels, "frames": len(clean), "methods": {}}
    for name, values in methods.items():
        full_scale = _limits(width)[1]
        baseline = _rmse(values, clean, clipped) / full_scale
        context_error = _rmse(values, clean, context_points) / full_scale
        damaged_error = _rmse(damaged, clean, clipped) / full_scale
        improvement = 20 * math.log10(damaged_error / baseline) if baseline else None
        max_outside = 0.0 if name in {"damaged", "linear", "cubic_hermite"} else max(
            (abs(values[frame][channel] - clean[frame][channel])
             for frame in outside for channel in range(channels)),
            default=0,
        ) / full_scale
        report["methods"][name] = {
            "clipped_region_rmse": baseline,
            "context_window_rmse": context_error,
            "improvement_db_vs_damaged": improvement,
            "max_absolute_error_outside_evaluation_windows": max_outside,
        }
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument("input", type=Path)
    prepare_parser.add_argument("output_dir", type=Path)
    score_parser = subparsers.add_parser("score")
    score_parser.add_argument("prepared_dir", type=Path)
    score_parser.add_argument("--autodeclip-core", type=Path)
    score_parser.add_argument("--autodeclip-pipeline", type=Path)
    score_parser.add_argument("--clipfix", type=Path)
    score_parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "prepare":
            prepare(args.input, args.output_dir)
            return 0
        report = score(
            args.prepared_dir,
            {"autodeclip_core": args.autodeclip_core, "autodeclip_pipeline": args.autodeclip_pipeline, "clipfix": args.clipfix},
        )
        if args.json:
            print(json.dumps(report, indent=2, allow_nan=False))
        else:
            for name, metrics in report["methods"].items():
                improvement = metrics["improvement_db_vs_damaged"]
                improvement_text = "inf" if improvement is None else f"{improvement:.2f}"
                print(
                    f"{name}: clipped RMSE={metrics['clipped_region_rmse']:.6f}, "
                    f"context RMSE={metrics['context_window_rmse']:.6f}, "
                    f"improvement={improvement_text} dB, "
                    f"outside max={metrics['max_absolute_error_outside_evaluation_windows']:.6f}"
                )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
