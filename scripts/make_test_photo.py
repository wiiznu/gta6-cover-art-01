"""Generate original geometric test scenes; no photographs or borrowed artwork."""
from argparse import ArgumentParser
from math import sin
from pathlib import Path

from PIL import Image, ImageDraw


def gradient(size, upper, lower):
    width, height = size
    image = Image.new("RGB", size)
    pixels = image.load()
    for y in range(height):
        amount = y / max(1, height - 1)
        color = tuple(round(a + (b - a) * amount) for a, b in zip(upper, lower))
        for x in range(width):
            pixels[x, y] = color
    return image


def scene(size, variant=0):
    """Paint a stylized abstract skyline, sun, palms and a road with vector shapes."""
    width, height = size
    palettes = [
        ((48, 30, 90), (248, 135, 112), (255, 209, 124)),
        ((31, 47, 93), (209, 87, 139), (255, 170, 128)),
    ]
    sky, horizon, sun = palettes[variant % len(palettes)]
    image = gradient(size, sky, horizon)
    draw = ImageDraw.Draw(image)
    sun_x = int(width * (.67 if variant else .53))
    sun_y = int(height * .42)
    radius = int(min(width, height) * .19)
    draw.ellipse((sun_x - radius, sun_y - radius, sun_x + radius, sun_y + radius), fill=sun)
    for stripe in range(6):
        y = sun_y + radius * .25 + stripe * max(2, radius // 6)
        draw.rectangle((sun_x - radius, y, sun_x + radius, y + max(2, radius // 18)), fill=horizon)
    skyline = int(height * .69)
    buildings = [
        (.00, .55, .12), (.12, .42, .11), (.23, .50, .13), (.36, .37, .10),
        (.47, .48, .14), (.63, .39, .11), (.75, .51, .12), (.88, .43, .14),
    ]
    for index, (left, top, span) in enumerate(buildings):
        x0, x1 = int(width * left), int(width * min(1, left + span))
        y0 = int(height * top)
        draw.rectangle((x0, y0, x1, skyline), fill=(42 + index * 3, 34, 64 + index * 2))
        for wx in range(x0 + 8, x1 - 4, 17):
            for wy in range(y0 + 12, skyline - 5, 22):
                if (wx // 17 + wy // 22 + index) % 3:
                    draw.rectangle((wx, wy, wx + 5, wy + 8), fill=(255, 173, 137))
    draw.polygon([(0, skyline), (width, skyline - 12), (width, height), (0, height)], fill=(34, 27, 52))
    draw.polygon([(0, int(height * .87)), (int(width * .52), int(height * .73)),
                  (width, int(height * .88)), (width, height), (0, height)], fill=(61, 39, 66))
    draw.line((0, int(height * .87), int(width * .52), int(height * .73)), fill=(250, 143, 143), width=max(2, width // 300))
    for base_x, lean in ((.08, .04), (.94, -.035)):
        base_y = int(height * .88)
        crown_x = int(width * (base_x + lean))
        crown_y = int(height * .39)
        draw.line((int(width * base_x), base_y, crown_x, crown_y), fill=(25, 22, 42), width=max(5, width // 75))
        for leaf in range(9):
            angle = 6.283 * leaf / 9
            end_x = int(crown_x + width * .11 * sin(angle))
            end_y = int(crown_y - height * .08 * (1 - 2 * leaf / 9))
            draw.line((crown_x, crown_y, end_x, end_y), fill=(25, 22, 42), width=max(3, width // 130))
    return image


def make_photos(directory):
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, size, variant in (
        ("city-glow.png", (1440, 900), 0),
        ("rose-hour.png", (1000, 1360), 1),
    ):
        path = directory / name
        scene(size, variant).save(path, optimize=True)
        paths.append(path)
    return paths


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    for generated in make_photos(parser.parse_args().directory):
        print(f"{generated} {generated.stat().st_size} bytes")

