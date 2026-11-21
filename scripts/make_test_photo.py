"""Generate geometric test scenes with code; these are not real photographs."""
from argparse import ArgumentParser
from math import cos, sin, tau
from pathlib import Path

from PIL import Image, ImageDraw


def scene(size, variant):
    """Draw an original imaginary city with sun, buildings and a palm."""
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    upper = (38, 34, 89) if variant == 0 else (24, 66, 104)
    lower = (249, 143, 121) if variant == 0 else (227, 100, 166)
    for y in range(height):
        amount = y / max(1, height - 1)
        colour = tuple(round(a + (b - a) * amount) for a, b in zip(upper, lower))
        draw.line((0, y, width, y), fill=colour)
    radius = min(width, height) * .18
    cx, cy = width * .64, height * .38
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(255, 211, 143))
    horizon = int(height * .74)
    for index in range(18):
        x = int(width * index / 18)
        top = int(height * (.39 + .2 * (sin(index * 5.7 + variant) + 1) / 2))
        span = int(width / 17)
        draw.rectangle((x, top, x + span, horizon), fill=(35, 31, 62))
        for wx in range(x + 9, x + span - 5, 18):
            for wy in range(top + 13, horizon - 7, 24):
                if (wx + wy + index) % 4:
                    draw.rectangle((wx, wy, wx + 4, wy + 7), fill=(255, 183, 155))
    draw.rectangle((0, horizon, width, height), fill=(51, 39, 72))
    draw.polygon(((width * .44, horizon), (width * .56, horizon),
                  (width, height), (0, height)), fill=(27, 27, 47))
    draw.line((width * .5, horizon, width * .5, height), fill=(250, 179, 153), width=5)
    for base, lean in ((.12, .05), (.9, -.04)):
        crown = (width * (base + lean), height * .3)
        draw.line((width * base, height * .9, *crown), fill=(20, 27, 43), width=max(5, width // 100))
        for leaf in range(10):
            angle = tau * leaf / 10
            tip = (crown[0] + width * .12 * cos(angle), crown[1] + height * .07 * sin(angle) + height * .025)
            draw.line((*crown, *tip), fill=(20, 27, 43), width=max(3, width // 160))
    return image


def make_photos(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for variant, size in enumerate(((1440, 960), (1000, 1360))):
        path = directory / f"generated-city-{variant + 1}.png"
        scene(size, variant).save(path, optimize=True)
        paths.append(path)
    return paths


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    for path in make_photos(parser.parse_args().directory):
        print(path)
