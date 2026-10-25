from __future__ import annotations

import json
import math
import os
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PET_DIR = ROOT / "pet"
GALLERY_DIR = ROOT / "gallery"
PREVIEW_DIR = GALLERY_DIR / "previews"
CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 11
SCALE = 3

ROWSPEC = [
    ("idle", 6),
    ("running-right", 8),
    ("running-left", 8),
    ("waving", 4),
    ("jumping", 5),
    ("failed", 8),
    ("waiting", 6),
    ("running", 6),
    ("review", 6),
]

GRAPHITE = (37, 42, 46, 255)
GRAPHITE_2 = (56, 62, 67, 255)
MINT = (116, 238, 190, 255)
MINT_DIM = (76, 184, 145, 220)
WHITE = (248, 250, 249, 255)
INK = (18, 22, 24, 255)
SHADOW = (12, 16, 18, 42)


def s(v: float) -> int:
    return round(v * SCALE)


def point(cx: float, cy: float, radius: float, degrees: float) -> tuple[float, float]:
    rad = math.radians(degrees)
    return cx + math.sin(rad) * radius, cy - math.cos(rad) * radius


def petal(size: tuple[int, int], angle: float, fill: tuple[int, int, int, int]) -> Image.Image:
    w, h = size
    layer = Image.new("RGBA", (s(w + 18), s(h + 18)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = (s(9), s(9), s(w + 9), s(h + 9))
    d.rounded_rectangle(box, radius=s(h / 2), fill=fill, outline=GRAPHITE_2, width=s(2))
    return layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

def draw_loop_body(canvas: Image.Image, cx: float, cy: float, rotation: float = 0.0, squash: float = 1.0) -> None:
    radius = 29
    for i in range(6):
        ang = rotation + i * 60
        px, py = point(cx, cy, radius, ang)
        p = petal((50, 24 * squash), -ang, GRAPHITE)
        canvas.alpha_composite(p, (s(px) - p.width // 2, s(py) - p.height // 2))

    d = ImageDraw.Draw(canvas)
    d.ellipse((s(cx - 27), s(cy - 25), s(cx + 27), s(cy + 29)), fill=GRAPHITE, outline=GRAPHITE_2, width=s(2))
    d.ellipse((s(cx - 15), s(cy - 11), s(cx + 15), s(cy + 19)), fill=MINT_DIM)


def draw_face(d: ImageDraw.ImageDraw, cx: float, cy: float, gaze_deg: float | None, blink: bool = False) -> None:
    gx = gy = 0.0
    if gaze_deg is not None:
        gx, gy = point(0, 0, 3.2, gaze_deg)
    for ex in (-9, 9):
        if blink:
            d.line((s(cx + ex - 5), s(cy), s(cx + ex + 5), s(cy)), fill=WHITE, width=s(2))
        else:
            d.ellipse((s(cx + ex - 5), s(cy - 6), s(cx + ex + 5), s(cy + 5)), fill=WHITE)
            d.ellipse((s(cx + ex + gx - 2), s(cy - 1 + gy - 2), s(cx + ex + gx + 2), s(cy - 1 + gy + 2)), fill=INK)
    d.arc((s(cx - 9), s(cy + 5), s(cx + 9), s(cy + 18)), 18, 162, fill=WHITE, width=s(2))

def draw_frame(state: str, frame: int, count: int, gaze_deg: float | None = None) -> Image.Image:
    img = Image.new("RGBA", (CELL_W * SCALE, CELL_H * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    t = frame / max(count - 1, 1)
    cx, cy = 96.0, 119.0
    rotation = 0.0
    blink = state == "idle" and frame in {2, 3}
    arm_l = arm_r = 0.0
    leg = math.sin(t * math.tau)

    if state == "idle":
        cy += math.sin(t * math.tau) * 1.8
        rotation = math.sin(t * math.tau) * 2.5
    elif state == "running-right":
        cx += 5
        rotation = -10 + leg * 2
    elif state == "running-left":
        cx -= 5
        rotation = 10 - leg * 2
    elif state == "waving":
        arm_r = (-55, -86, -38, 0)[frame]
        rotation = (-1, 2, -2, 0)[frame]
    elif state == "jumping":
        jumps = (6, -10, -27, -11, 0)
        cy += jumps[frame]
        rotation = (0, -3, 0, 3, 0)[frame]
    elif state == "failed":
        cy += min(frame, 4) * 2.2
        rotation = min(frame, 4) * 4.0
        blink = frame >= 4
    elif state == "waiting":
        rotation = math.sin(t * math.tau) * 4
        cy -= 2
    elif state == "running":
        rotation = frame * 9
        cy += math.sin(t * math.tau) * 2
    elif state == "review":
        rotation = (-2, 0, 2, 3, 1, -1)[frame]
        cx += (0, 1, 2, 2, 1, 0)[frame]

    d.ellipse((s(cx - 47), s(170), s(cx + 47), s(184)), fill=SHADOW)
    draw_loop_body(img, cx, cy, rotation)
    d = ImageDraw.Draw(img)

    if state == "failed":
        draw_face(d, cx, cy + 1, 180, blink=True)
    else:
        draw_face(d, cx, cy, gaze_deg, blink=blink)

    foot_y = cy + 54
    stride = leg * 9 if state.startswith("running-") else 0
    d.line((s(cx - 18), s(cy + 40), s(cx - 22 - stride), s(foot_y)), fill=GRAPHITE_2, width=s(5))
    d.line((s(cx + 18), s(cy + 40), s(cx + 22 + stride), s(foot_y)), fill=GRAPHITE_2, width=s(5))
    d.ellipse((s(cx - 31 - stride), s(foot_y - 2), s(cx - 17 - stride), s(foot_y + 5)), fill=GRAPHITE)
    d.ellipse((s(cx + 17 + stride), s(foot_y - 2), s(cx + 31 + stride), s(foot_y + 5)), fill=GRAPHITE)
    left_hand = (cx - 48, cy + 10)
    right_hand = (cx + 48, cy + 10)
    d.line((s(cx - 36), s(cy + 8), s(left_hand[0]), s(left_hand[1] + arm_l)), fill=GRAPHITE_2, width=s(5))
    d.line((s(cx + 36), s(cy + 8), s(right_hand[0]), s(right_hand[1] + arm_r)), fill=GRAPHITE_2, width=s(5))
    d.ellipse((s(left_hand[0] - 4), s(left_hand[1] + arm_l - 4), s(left_hand[0] + 4), s(left_hand[1] + arm_l + 4)), fill=MINT)
    d.ellipse((s(right_hand[0] - 4), s(right_hand[1] + arm_r - 4), s(right_hand[0] + 4), s(right_hand[1] + arm_r + 4)), fill=MINT)

    if state == "waiting":
        for i in range(3):
            a = frame * 24 + i * 120
            px, py = point(cx, cy - 2, 58, a)
            r = 3 + (i == frame % 3)
            d.ellipse((s(px - r), s(py - r), s(px + r), s(py + r)), fill=MINT)
    elif state == "running":
        for i in range(3):
            a = frame * 55 + i * 120
            px, py = point(cx, cy, 61, a)
            d.rounded_rectangle((s(px - 4), s(py - 2), s(px + 4), s(py + 2)), radius=s(2), fill=MINT)
    elif state == "review":
        card_x, card_y = cx + 40, cy + 28
        d.rounded_rectangle((s(card_x - 13), s(card_y - 17), s(card_x + 13), s(card_y + 16)), radius=s(3), fill=WHITE, outline=GRAPHITE_2, width=s(2))
        for yy in (-8, -1, 6):
            d.line((s(card_x - 7), s(card_y + yy), s(card_x + 7), s(card_y + yy)), fill=MINT_DIM, width=s(2))

    return img.resize((CELL_W, CELL_H), Image.Resampling.LANCZOS)

def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    bg = Image.new("RGB", size, (236, 238, 240))
    d = ImageDraw.Draw(bg)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                d.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(214, 218, 221))
    return bg


def make_preview(name: str, frames: list[Image.Image]) -> None:
    bg_frames = []
    for frame in frames:
        bg = checkerboard((CELL_W, CELL_H))
        bg.paste(frame, mask=frame.getchannel("A"))
        bg_frames.append(bg)
    bg_frames[0].save(
        PREVIEW_DIR / f"{name}.gif",
        save_all=True,
        append_images=bg_frames[1:],
        duration=150,
        loop=0,
        disposal=2,
    )

def main() -> None:
    PET_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))
    row_frames: dict[str, list[Image.Image]] = {}

    for row, (state, count) in enumerate(ROWSPEC):
        frames = [draw_frame(state, i, count) for i in range(count)]
        row_frames[state] = frames
        for col, frame in enumerate(frames):
            atlas.alpha_composite(frame, (col * CELL_W, row * CELL_H))
        make_preview(state, frames)

    look_frames = []
    for index in range(16):
        deg = index * 22.5
        frame = draw_frame("idle", 0, 1, gaze_deg=deg)
        look_frames.append(frame)
        row = 9 + index // 8
        col = index % 8
        atlas.alpha_composite(frame, (col * CELL_W, row * CELL_H))

    with tempfile.NamedTemporaryFile(
        prefix=".loopling-atlas-", suffix=".webp", dir=PET_DIR, delete=False
    ) as temporary:
        atlas_path = Path(temporary.name)
    try:
        atlas.save(atlas_path, "WEBP", lossless=True, method=6)
        with Image.open(atlas_path) as saved_atlas:
            saved_atlas.verify()
        os.replace(atlas_path, PET_DIR / "spritesheet.webp")
    finally:
        atlas_path.unlink(missing_ok=True)
    contact = checkerboard(atlas.size, cell=24)
    contact.paste(atlas, mask=atlas.getchannel("A"))
    contact.save(GALLERY_DIR / "contact-sheet.png", optimize=True)

    manifest = {
        "id": "loopling",
        "displayName": "Loopling",
        "description": "A tiny living loop-knot companion made for ChatGPT and Codex.",
        "spritesheetPath": "spritesheet.webp",
        "spriteVersionNumber": 2,
        "version": "1.0.0",
        "author": "trvny",
        "license": "MIT",
        "tags": ["chatgpt", "codex", "loop", "original", "animated"],
    }
    (PET_DIR / "pet.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    rgba = atlas.load()
    hidden_rgb = sum(1 for y in range(atlas.height) for x in range(atlas.width) if rgba[x, y][3] == 0 and rgba[x, y][:3] != (0, 0, 0))
    used = sum(count for _, count in ROWSPEC)
    validation = {
        "ok": atlas.size == (1536, 2288) and used == 57 and len(look_frames) == 16 and hidden_rgb == 0,
        "atlasSize": list(atlas.size),
        "grid": [8, 11],
        "cellSize": [192, 208],
        "stateFrames": used,
        "lookFrames": len(look_frames),
        "transparentPixelsWithRgb": hidden_rgb,
    }
    (GALLERY_DIR / "validation.json").write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    if not validation["ok"]:
        raise SystemExit(f"validation failed: {validation}")
    print(json.dumps(validation, indent=2))


if __name__ == "__main__":
    main()
