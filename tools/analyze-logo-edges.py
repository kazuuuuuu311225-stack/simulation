from PIL import Image
import colorsys
from pathlib import Path

path = Path(r"C:\Users\PC_User\hyakumasu-calc\projectile-sim\physLabo_logo.png")
im = Image.open(path).convert("RGBA")
px = im.load()
w, h = im.size

regions = {
    "L": (int(w * 0.40), int(w * 0.54)),
    "b": (int(w * 0.62), int(w * 0.78)),
}

for name, (x0, x1) in regions.items():
    dark = 0
    total = 0
    for y in range(h):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            total += 1
            if max(r, g, b) < 55 and a > 20:
                dark += 1
    print(name, "colored px", total, "dark fringe", dark)
