#!/usr/bin/env python3
"""Generate Nothing-OS style launcher icon assets for dashbord.

Draws the master 1024x1024 foreground + background source PNGs with Pillow
(no new npm deps), then derives every Android mipmap density. Foreground
artwork lives inside the 66dp safe zone (centered 66/108 of canvas) so
launchers don't clip it.

Design (classic skin): true-black background, a 2px white stroked rounded
square Nothing glyph, 9mm-style dot perforations along the top+left inner
edge, white "dashbord" wordmark in Space Grotesk (repo-resident font), and
the single Nothing-red accent as one filled dot.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "resources")
OUT_BG = os.path.join(RES, "icon_background.png")
OUT_FG = os.path.join(RES, "icon_foreground.png")
PREVIEW_DIR = os.path.join(RES, "icon-preview")

WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)
RED = (215, 26, 33, 255)  # --nt-accent Nothing red

M = 1024  # master canvas (foreground layer: full 108dp canvas)


def lerp_color(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def font(path, size):
    return ImageFont.truetype(path, size)


def find_font():
    cands = [
        os.path.join(ROOT, "android/app/src/main/res/font/space_grotesk.ttf"),
        os.path.join(ROOT, "android/app/src/main/res/font/doto.ttf"),
    ]
    for c in cands:
        if os.path.exists(c):
            return c
    raise SystemExit("no repo font found")


def draw_background(size):
    im = Image.new("RGBA", (size, size), BLACK)
    return im


def rounded_rect(dr, box, radius, outline=None, width=1, fill=None):
    dr.rounded_rectangle(box, radius=radius, outline=outline, width=width, fill=fill)


def draw_foreground(size):
    """Full-canvas foreground layer; artwork inside centered 66/108 safe zone.

    Glyph-only (Nothing icons carry no wordmark — text is illegible at
    launcher sizes): a hand-placed dot-matrix lowercase 'd' (5x7 grid),
    with the ascender's top dot in Nothing red as the single accent.
    """
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    safe = 66.0 / 108.0 * size  # safe-zone side length
    m = (size - safe) / 2.0     # safe-zone margin

    # --- tile: 2px-style white stroked rounded square ---
    tint = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tdr = ImageDraw.Draw(tint)
    inset = m + safe * 0.02
    box = (inset, inset, size - inset, size - inset)
    radius = safe * 0.18
    tdr.rounded_rectangle(box, radius=radius, fill=(255, 255, 255, 8))
    im = Image.alpha_composite(im, tint)
    dr = ImageDraw.Draw(im)
    stroke = round(46 * size / 1024.0)
    rounded_rect(dr, box, radius, outline=WHITE, width=stroke)

    # --- dot-matrix 'd': 5 cols x 7 rows ---
    glyph = [
        "..X..",
        "..X..",
        ".XXX.",
        "X..X.",
        "X..X.",
        "X..X.",
        ".XXX.",
    ]
    cols, rows = 5, 7
    pitch = safe * 0.122               # dot-center spacing
    dot_r = pitch * 0.40
    gw = (cols - 1) * pitch
    gh = (rows - 1) * pitch
    ox = (size - gw) / 2.0
    oy = (size - gh) / 2.0
    for r, row in enumerate(glyph):
        for c, ch in enumerate(row):
            if ch != "X":
                continue
            cx, cy = ox + c * pitch, oy + r * pitch
            col = RED if (r == 0 and c == 2) else WHITE  # red ascender cap
            dr.ellipse((cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r),
                       fill=col)
    return im


def masked_circle(im, size):
    """Circle-masked copy (for legacy round icon / previews)."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def compose_square(bg, fg, size):
    out = bg.resize((size, size), Image.Resampling.LANCZOS).copy()
    out.alpha_composite(fg.resize((size, size), Image.Resampling.LANCZOS))
    return out


def compose_round(bg, fg, size):
    return masked_circle(compose_square(bg, fg, size), size)


def main():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    bg = draw_background(M)
    fg = draw_foreground(M)
    bg.save(OUT_BG)
    fg.save(OUT_FG)

    res = os.path.join(ROOT, "android/app/src/main/res")
    dpis = {"ldpi": 0.75, "mdpi": 1, "hdpi": 1.5,
            "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for dpi, mult in dpis.items():
        d = os.path.join(res, "mipmap-%s" % dpi)
        os.makedirs(d, exist_ok=True)
        full = round(108 * mult)
        legacy = round(48 * mult)
        fg.resize((full, full), Image.Resampling.LANCZOS).save(
            os.path.join(d, "ic_launcher_foreground.png"))
        bg.resize((full, full), Image.Resampling.LANCZOS).save(
            os.path.join(d, "ic_launcher_background.png"))
        compose_square(bg, fg, legacy).save(os.path.join(d, "ic_launcher.png"))
        compose_round(bg, fg, legacy).save(
            os.path.join(d, "ic_launcher_round.png"))

    # resources/icon.png = composed square (Capacitor asset source convention)
    compose_square(bg, fg, M).save(os.path.join(RES, "icon.png"))

    # previews: launcher-context mockups
    wall = Image.new("RGBA", (1600, 1000), (8, 8, 10, 255))
    wd = ImageDraw.Draw(wall)
    for gx in range(0, 1600, 64):  # faint dot grid wallpaper
        for gy in range(0, 1000, 64):
            wd.ellipse((gx - 1, gy - 1, gx + 1, gy + 1), fill=(255, 255, 255, 14))

    def label_under(dr, cx, cy, text, f):
        bb = dr.textbbox((0, 0), text, font=f)
        dr.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy + 14), text,
                font=f, fill=(255, 255, 255, 230))

    try:
        lf = font(find_font(), 34)
    except SystemExit:
        lf = ImageFont.load_default()

    # panel 1: home screen with circle + squircle + legacy sizes
    p1 = wall.copy()
    d1 = ImageDraw.Draw(p1)
    sq = compose_square(bg, fg, 192)
    ci = compose_round(bg, fg, 192)
    p1.alpha_composite(sq, (180, 200)); label_under(d1, 276, 200, "dashbord", lf)
    p1.alpha_composite(ci, (420, 200)); label_under(d1, 516, 200, "round", lf)
    for i, sz in enumerate((96, 144, 72)):
        small = compose_square(bg, fg, sz).resize((sz, sz), Image.Resampling.LANCZOS)
        p1.alpha_composite(small, (700, 200 + i * 0))
        # lay smaller ones beside for scale comparison
    xs = 700
    for sz in (144, 96, 72, 48):
        small = compose_square(bg, fg, sz)
        p1.alpha_composite(small, (xs, 200 + (144 - sz) // 2))
        xs += sz + 48
    label_under(d1, xs // 2 + 300, 360, "sizes 144→48", lf)
    p1.convert("RGB").save(os.path.join(PREVIEW_DIR, "preview_homescreen.png"))

    # panel 2: big glyph render
    p2 = compose_square(bg, fg, 1024)
    p2.convert("RGB").save(os.path.join(PREVIEW_DIR, "preview_master_1024.png"))

    # panel 3: shade + dark wallpaper strip with a few sizes
    p3 = wall.copy()
    xs = 160
    for sz in (192, 128, 96, 64, 48):
        t = compose_square(bg, fg, sz)
        p3.alpha_composite(t, (xs, 420 - sz // 2))
        xs += sz + 72
    p3.convert("RGB").save(os.path.join(PREVIEW_DIR, "preview_sizes_dark.png"))

    print("assets written:")
    print(" ", OUT_BG)
    print(" ", OUT_FG)
    print(" ", os.path.join(RES, "icon.png"))
    print("  mipmaps for", ", ".join(dpis))
    print("  previews in", PREVIEW_DIR)


if __name__ == "__main__":
    main()
