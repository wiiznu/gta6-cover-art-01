"""Optional future capture helper. Requires Pillow, Playwright and Chromium.

Never run automatically: captures actual editor views and downloaded PNGs only.
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
SIZES = {"square": (1080, 1080), "portrait": (1080, 1350), "landscape": (1920, 1080)}


def fit_capture(source, target):
    """Scale a genuine capture without compositing or altering its content."""
    with Image.open(source) as original:
        image = original.convert("RGB")
        image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        if min(image.size) < 480:
            raise RuntimeError(f"Capture too small: {image.size}")
        for quality in (88, 82, 75, 65, 55):
            image.save(target, "JPEG", quality=quality, optimize=True)
            if target.stat().st_size <= 256 * 1024:
                return
        raise RuntimeError(f"Capture exceeds 256 KiB: {target}")


def capture_editor(page, base, photos, temporary):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base, wait_until="load")
    page.locator("#photoInput").set_input_files([str(path) for path in photos])
    expect(page.locator("#photoCount")).to_have_text(f"{len(photos)} / 8")
    page.locator('[data-layout="landscape"]').click()
    page.locator("#panelPicker button").nth(1).click()
    page.locator("#zoomSlider").fill("1.3")
    # Two animation frames ensure the scheduled canvas render has completed.
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    editor = temporary / "editor.png"
    page.screenshot(path=str(editor), full_page=False)
    exports = {}
    for kind, dimensions in SIZES.items():
        with page.expect_download() as pending:
            page.locator(f'[data-size="{kind}"]').click()
        target = temporary / f"cover-{kind}.png"
        pending.value.save_as(target)
        with Image.open(target) as image:
            if image.format != "PNG" or image.size != dimensions:
                raise RuntimeError(f"Incorrect export {kind}: {image.format}, {image.size}")
            image.verify()
        exports[kind] = target
    if errors:
        raise RuntimeError("Browser errors: " + "; ".join(errors))
    return editor, exports


def main():
    output = ROOT / "screenshots"
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT / "app"))
    with TemporaryDirectory(prefix="sunset-circuit-") as directory:
        temporary = Path(directory)
        photos = make_photos(temporary / "photos")
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                base = f"http://127.0.0.1:{server.server_port}/"
                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch()
                    try:
                        page = browser.new_page(viewport={"width": 1280, "height": 960}, accept_downloads=True)
                        page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
                        editor, exports = capture_editor(page, base, photos, temporary)
                        output.mkdir(exist_ok=True)
                        fit_capture(exports["landscape"], output / "1-cover.jpg")
                        fit_capture(editor, output / "2-editor.jpg")
                        fit_capture(exports["portrait"], output / "3-portrait.jpg")
                        fit_capture(exports["square"], output / "4-square.jpg")
                    finally:
                        browser.close()
            finally:
                server.shutdown()
                worker.join()


if __name__ == "__main__":
    main()
