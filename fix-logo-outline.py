from PIL import Image
import colorsys
import shutil
from pathlib import Path

ROOT = Path(r"C:\Users\PC_User\hyakumasu-calc\projectile-sim")
SOURCE = ROOT / "physLabo_logo.png.bak"
TARGETS = [
    ROOT / "physLabo_logo.png",
    Path(r"C:\Users\PC_User\Desktop\hyakumasu-calc\projectile-sim\physLabo_logo.png"),
]


def band(x: int, w: int) -> str:
    if x < int(w * 0.22):
        return "p"
    if x < int(w * 0.47):
        return "hs"
    return "labo"


def brighten_phys(px, w: int, h: int) -> None:
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20 or r + g + b < 40:
                continue

            region = band(x, w)
            if region == "labo":
                continue

            hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if region == "p":
                val = min(1.0, val * 1.35 + 0.12)
                sat = min(1.0, sat * 1.08 + 0.03)
            else:
                hue = hue * 0.72 + 0.58 * 0.28
                val = min(1.0, val * 1.85 + 0.28)
                sat = min(1.0, sat * 1.18 + 0.08)

            r2, g2, b2 = colorsys.hsv_to_rgb(hue, sat, val)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)


def add_phys_glow(im: Image.Image) -> Image.Image:
    px = im.load()
    w, h = im.size
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

    return Image.alpha_composite(im, glow)


def decontaminate_black(im: Image.Image) -> None:
    px = im.load()
    w, h = im.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue

            if a < 255:
                nr = min(255, int(r * 255 / max(a, 1)))
                ng = min(255, int(g * 255 / max(a, 1)))
                nb = min(255, int(b * 255 / max(a, 1)))
                px[x, y] = (nr, ng, nb, a)
                r, g, b = nr, ng, nb

            if max(r, g, b) >= 50:
                continue

            best = None
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nr, ng, nb, na = px[nx, ny]
                    if na < 40:
                        continue
                    score = max(nr, ng, nb)
                    if score < 70:
                        continue
                    if best is None or score > best[0]:
                        best = (score, nr, ng, nb, na)

            if best is None:
                if a < 120:
                    px[x, y] = (0, 0, 0, 0)
                continue

            _, nr, ng, nb, na = best
            mix = 0.82 if band(x, w) == "labo" else 0.7
            px[x, y] = (
                min(255, int(r * (1 - mix) + nr * mix)),
                min(255, int(g * (1 - mix) + ng * mix)),
                min(255, int(b * (1 - mix) + nb * mix)),
                max(a, int(na * 0.85)),
            )


def cleanup_labo_edges(im: Image.Image) -> None:
    px = im.load()
    w, h = im.size
    x0 = int(w * 0.38)

    for _ in range(2):
        for y in range(h):
            for x in range(x0, w):
                r, g, b, a = px[x, y]
                if a < 8:
                    continue

                lum = max(r, g, b)
                if lum >= 62:
                    continue

                bright_neighbors = []
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if nx < 0 or ny < 0 or nx >= w or ny >= h:
                            continue
                        nr, ng, nb, na = px[nx, ny]
                        if na < 30 or max(nr, ng, nb) < 80:
                            continue
                        bright_neighbors.append((nr, ng, nb, na))

                if not bright_neighbors:
                    if lum < 35 and a < 150:
                        px[x, y] = (0, 0, 0, 0)
                    continue

                nr = sum(c[0] for c in bright_neighbors) // len(bright_neighbors)
                ng = sum(c[1] for c in bright_neighbors) // len(bright_neighbors)
                nb = sum(c[2] for c in bright_neighbors) // len(bright_neighbors)
                na = max(a, max(c[3] for c in bright_neighbors) - 20)
                strength = 0.92 if lum < 40 else 0.75
                px[x, y] = (
                    min(255, int(r * (1 - strength) + nr * strength)),
                    min(255, int(g * (1 - strength) + ng * strength)),
                    min(255, int(b * (1 - strength) + nb * strength)),
                    na,
                )


def build_logo() -> Image.Image:
    im = Image.open(SOURCE).convert("RGBA")
    px = im.load()
    w, h = im.size
    brighten_phys(px, w, h)
    im = add_phys_glow(im)
    decontaminate_black(im)
    cleanup_labo_edges(im)
    decontaminate_black(im)
    return im


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing backup: {SOURCE}")

    logo = build_logo()
    for target in TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        logo.save(target, optimize=True)
        print("saved", target)


if __name__ == "__main__":
    main()
