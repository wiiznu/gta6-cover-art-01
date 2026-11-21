"""Create original geometric image fixtures with Pillow, never real artwork."""
from argparse import ArgumentParser
from math import cos, sin, tau
from pathlib import Path

from PIL import Image, ImageDraw


def make_scene(width, height, variant):
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / max(1, height - 1)
        colour = tuple(round(a + (b - a) * t) for a, b in
                       zip((33, 45, 91), (247, 151 - variant * 30, 119 + variant * 35)))
        draw.line((0, y, width, y), fill=colour)
    sun_x, sun_y = width * .66, height * .32
    radius = min(width, height) * .19
    draw.ellipse((sun_x - radius, sun_y - radius, sun_x + radius, sun_y + radius),
                 fill=(255, 217, 155))
    ground = height * .76
    for index in range(20):
        x = width * index / 19
        top = height * (.42 + .18 * (1 + sin(index * 3.9 + variant)) / 2)
        draw.rectangle((x, top, x + width / 22, ground), fill=(30, 33, 61))
        for row in range(5):
            yy = top + 12 + row * height * .025
            if yy < ground:
                draw.rectangle((x + 8, yy, x + width / 45, yy + 5), fill=(248, 184, 142))
    draw.rectangle((0, ground, width, height), fill=(35, 30, 52))
    draw.polygon(((width * .48, ground), (width * .52, ground),
                  (width * .82, height), (width * .18, height)), fill=(19, 23, 42))
    draw.line((width * .5, ground, width * .5, height), fill=(253, 189, 151), width=4)
    for base in (.13, .88):
        crown = (width * (base + .025), height * .29)
        draw.line((width * base, height * .94, *crown), fill=(19, 25, 43), width=12)
        for index in range(11):
            angle = index / 11 * tau
            tip = (crown[0] + width * .12 * cos(angle),
                   crown[1] + height * (.07 * sin(angle) + .03))
            draw.line((*crown, *tip), fill=(19, 25, 43), width=7)
    # A geometric vehicle makes these distinct from the app's placeholder skyline.
    draw.rounded_rectangle((width * .31, height * .78, width * .7, height * .9),
                           radius=18, fill=(210, 73, 110))
    draw.polygon(((width * .39, height * .78), (width * .45, height * .7),
                  (width * .59, height * .7), (width * .65, height * .78)), fill=(43, 74, 102))
    for wheel in (.39, .63):
        draw.ellipse((width * wheel - 24, height * .87, width * wheel + 24,
                      height * .87 + 48), fill=(17, 21, 34))
    return image


def make_photos(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for variant, size in enumerate(((1440, 960), (1000, 1360))):
        path = directory / f"synthetic-scene-{variant + 1}.png"
        make_scene(*size, variant).save(path, optimize=True)
        paths.append(path)
    return paths


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    for result in make_photos(parser.parse_args().directory):
        print(result)
