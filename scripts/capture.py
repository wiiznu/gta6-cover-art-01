"""Optional manual screenshot helper; requires Pillow, Playwright and Chromium.

Not run during the rewrite. Captures only actual browser and export output.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

from PIL import Image
from playwright.sync_api import expect, sync_playwright

from make_test_photo import make_photos

ROOT = Path(__file__).resolve().parents[1]
FORMATS = {"landscape": (1920, 1080), "portrait": (1080, 1350), "square": (1080, 1080)}


def present(source, destination):
    with Image.open(source) as raw:
        image = raw.convert("RGB")
        image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        if min(image.size) < 480:
            raise RuntimeError(f"Image too small: {image.size}")
        for quality in (90, 82, 74, 65, 55):
            image.save(destination, "JPEG", quality=quality, optimize=True)
            if destination.stat().st_size <= 262144:
                return
    raise RuntimeError(f"Cannot fit capture within 256 KiB: {destination}")


def take_captures(page, base, temporary, photos):
    failures = []
    page.on("pageerror", lambda error: failures.append(str(error)))
    page.goto(base, wait_until="load")
    page.locator("#photoInput").set_input_files([str(path) for path in photos])
    expect(page.locator("#photoCount")).to_have_text("2 / 8")
    page.locator('[data-layout="landscape"]').click()
    page.locator('[data-panel="0"]').click()
    page.locator("#zoomSlider").fill("1.25")
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    editor = temporary / "editor.png"
    page.screenshot(path=str(editor), full_page=False)
    captures = [(editor, "2-editor.jpg")]
    for index, (name, expected) in enumerate(FORMATS.items()):
        with page.expect_download() as download:
            page.locator(f'[data-size="{name}"]').click()
        target = temporary / f"{name}.png"
        download.value.save_as(target)
        with Image.open(target) as cover:
            if cover.format != "PNG" or cover.size != expected:
                raise RuntimeError(f"Unexpected export {name}: {cover.format} {cover.size}")
            cover.verify()
        captures.append((target, ("1-cover.jpg", "3-portrait.jpg", "4-square.jpg")[index]))
    if failures:
        raise RuntimeError("Browser errors: " + "; ".join(failures))
    return captures


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT / "app"))
    with TemporaryDirectory(prefix="sunset-capture-") as folder:
        temporary = Path(folder)
        photos = make_photos(temporary / "fixtures")
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                base = f"http://127.0.0.1:{server.server_port}/"
                with sync_playwright() as browser_tools:
                    browser = browser_tools.chromium.launch()
                    try:
                        page = browser.new_page(viewport={"width": 1280, "height": 960}, accept_downloads=True)
                        page.route("**/*", lambda route: route.continue_()
                                   if route.request.url.startswith(base) else route.abort())
                        captures = take_captures(page, base, temporary, photos)
                        output = ROOT / "screenshots"
                        output.mkdir(exist_ok=True)
                        for source, name in captures:
                            present(source, output / name)
                    finally:
                        browser.close()
            finally:
                server.shutdown()
                worker.join()


if __name__ == "__main__":
    main()
