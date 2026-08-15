from PIL import Image
import colorsys
import shutil
from pathlib import Path

paths = [
    Path(r"C:\Users\PC_User\hyakumasu-calc\projectile-sim\physLabo_logo.png"),
    Path(r"C:\Users\PC_User\Desktop\hyakumasu-calc\projectile-sim\physLabo_logo.png"),
]

SOURCE = Path(r"C:\Users\PC_User\hyakumasu-calc\projectile-sim\physLabo_logo.png.bak")


def band(x: int, w: int) -> str:
    if x < int(w * 0.22):
        return "p"
    if x < int(w * 0.47):
        return "hs"
    return "other"


def brighten_phys(path: Path) -> None:
    src = SOURCE if SOURCE.exists() else path
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20 or r + g + b < 40:
                continue

            region = band(x, w)
            if region == "other":
                continue

            hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)

            if region == "p":
                val = min(1.0, val * 1.35 + 0.12)
                sat = min(1.0, sat * 1.08 + 0.03)
            else:
                # h / s — strongest lift + slightly cooler/brighter hue
                hue = hue * 0.72 + 0.58 * 0.28
                val = min(1.0, val * 1.85 + 0.28)
                sat = min(1.0, sat * 1.18 + 0.08)

            r2, g2, b2 = colorsys.hsv_to_rgb(hue, sat, val)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)

    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gp = glow.load()
    split = int(w * 0.47)
    for y in range(h):
        for x in range(split):
            r, g, b, a = px[x, y]
            if a < 24 or r + g + b < 50:
                continue
            alpha = 0.34 if x >= int(w * 0.22) else 0.22
            gp[x, y] = (
                min(255, r + 22),
                min(255, g + 16),
                min(255, b + 34),
                min(255, int(a * alpha)),
            )

    im = Image.alpha_composite(im, glow)
    im.save(path, optimize=True)
    print("updated", path)


for path in paths:
    if SOURCE.exists() or path.exists():
        brighten_phys(path)
