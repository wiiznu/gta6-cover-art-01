"""Capture the live editor and exported PNG covers when a browser is available."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

from PIL import Image
from playwright.sync_api import expect, sync_playwright

from make_test_photo import make_photos

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "screenshots"
VIEWPORT = {"width": 1280, "height": 960}
SIZES = {
    "square": (1080, 1080),
    "portrait": (1080, 1350),
    "landscape": (1920, 1080),
}


def prepare_editor(page, base, photos, editor_capture):
    """Load generated test scenes and show the editor with a crop selected."""
    page.goto(base, wait_until="load")
    page.locator("#photoInput").set_input_files([str(path) for path in photos])
    expect(page.locator("#photoCount")).to_have_text(f"{len(photos)} / 8")
    page.locator('[data-layout="landscape"]').click()
    page.locator("#panelPicker button").nth(1).click()
    page.locator("#zoomSlider").fill("1.3")
    page.screenshot(path=str(editor_capture), full_page=False)


def save_export(page, kind, expected_size, temporary):
    with page.expect_download() as download_info:
        page.locator(f'[data-size="{kind}"]').click()
    target = temporary / f"sunset-circuit-{kind}.png"
    download_info.value.save_as(target)
    with Image.open(target) as cover:
        if cover.format != "PNG" or cover.size != expected_size:
            raise RuntimeError(f"{target.name}: expected PNG {expected_size}, got {cover.format} {cover.size}")
        cover.verify()
    return target


def fit_screenshot(source, destination, size):
    """Resize a genuine app render into the dossier's presentation dimensions."""
    with Image.open(source) as original:
        image = original.convert("RGB").resize(size, Image.Resampling.LANCZOS)
        image.save(destination, format="JPEG", quality=82, optimize=True, progressive=True)


def capture(page, base, photos, temporary):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
    editor_capture = temporary / "editor.png"
    prepare_editor(page, base, photos, editor_capture)
    exported = {}
    for kind, dimensions in SIZES.items():
        exported[kind] = save_export(page, kind, dimensions, temporary)
    if errors:
        raise RuntimeError("Browser errors: " + "; ".join(errors))
    return exported, editor_capture


def main():
    OUTPUT.mkdir(exist_ok=True)
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT / "app"))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}/"
            with TemporaryDirectory(prefix="sunset-circuit-") as folder:
                temporary = Path(folder)
                photos = make_photos(temporary / "generated")
                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch()
                    try:
                        page = browser.new_page(viewport=VIEWPORT, accept_downloads=True)
                        exported, editor_capture = capture(page, base, photos, temporary)
                        fit_screenshot(exported["landscape"], OUTPUT / "1-cover.jpg", (1280, 720))
                        fit_screenshot(editor_capture, OUTPUT / "2-editor.jpg", (1280, 960))
                        fit_screenshot(exported["portrait"], OUTPUT / "4-cover.jpg", (1024, 1280))
                    finally:
                        browser.close()
        finally:
            server.shutdown()
            worker.join()


if __name__ == "__main__":
    main()

