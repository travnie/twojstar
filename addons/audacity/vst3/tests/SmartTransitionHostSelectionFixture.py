"""Audacity 4 Smart Transition host selection-edge regression; stdlib only."""

import argparse
import math
import struct
import wave
from pathlib import Path

RATE = 48_000
SECONDS = 12
SEAM = 6 * RATE
SELECTION_START = 5.57
SELECTION_END = 6.50
CHANNELS = 2
# PCM16 tolerates re-export/dither up to a few LSB, not a new audio transient.
EXTERNAL_TOLERANCE = 100
SEAM_CHANGE_THRESHOLD = 100


def make_audio(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        frames = bytearray()
        for index in range(SECONDS * RATE):
            value = 0.2 * math.sin(2.0 * math.pi * 440.0 * index / RATE)
            if index >= SEAM:
                value += 0.45
            for gain in (1.0, 0.8):
                frames.extend(struct.pack("<h", round(value * gain * 32767)))
        wav.writeframes(frames)


def read_wav(path: Path) -> list[tuple[int, int]]:
    with wave.open(str(path), "rb") as wav:
        shape = (wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getnframes())
        expected = (RATE, CHANNELS, 2, RATE * SECONDS)
        if shape != expected or wav.getcomptype() != "NONE":
            raise ValueError(f"{path.name}: unexpected WAV shape {shape}, expected {expected}")
        return list(struct.iter_unpack("<hh", wav.readframes(wav.getnframes())))


def verify(source: Path, output: Path) -> None:
    before = read_wav(source)
    after = read_wav(output)
    start = round(SELECTION_START * RATE)
    end = round(SELECTION_END * RATE)
    changed = [max(abs(a - b) for a, b in zip(x, y))
               for x, y in zip(before, after)]
    outside = [(i, delta) for i, delta in enumerate(changed)
               if (i < start or i >= end) and delta > EXTERNAL_TOLERANCE]
    seam_span = changed[SEAM - 192:SEAM + 192]
    join_changed = max(seam_span)
    largest = max(range(len(changed)), key=changed.__getitem__)
    print(
        f"frames={len(after)}, selection={SELECTION_START:.2f}-{SELECTION_END:.2f}s, "
        f"max_delta={changed[largest]} at {largest / RATE:.6f}s, "
        f"out_of_selection={len(outside)}, max_join_delta={join_changed}"
    )
    if outside:
        i, delta = max(outside, key=lambda row: row[1])
        raise AssertionError(
            f"FAIL: selection boundary leaked ({delta} PCM16 LSB at {i / RATE:.6f}s)"
        )
    if join_changed <= SEAM_CHANGE_THRESHOLD:
        raise AssertionError(
            "FAIL: 6.000s hard join effectively unchanged; inspect host latency/selection"
        )
    print("PASS: no external damage, target join affected, frame count stable")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    make = sub.add_parser("generate")
    make.add_argument("path", type=Path)
    check = sub.add_parser("verify")
    check.add_argument("source", type=Path)
    check.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.command == "generate":
        make_audio(args.path)
    else:
        verify(args.source, args.output)


if __name__ == "__main__":
    main()
