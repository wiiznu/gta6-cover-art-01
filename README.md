# Sunset Circuit

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/wiiznu/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/wiiznu/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An original photo-to-poster studio. Owner: **wiiznu**. Repository: **gta6-cover-art-01**.
Competition: https://make.fun/bounty/gta6-cover-art-01

Build a night worth remembering: a dominant hero photo, two supporting frames,
an illustrated coastal skyline, and oversized CITY AFTERGLOW lettering.
Vice Sunset adds amber, rose and violet; Neon Night brings cyan and hot pink.
Every building, palm, sun and road is drawn in code. All typography uses system
fonts. No official game artwork, branding, font files or external assets are used.

## Open and create

Open `app/index.html` in desktop Chrome, including offline with a file URL.
There is no installation, build step, dependency or network request.

1. Choose up to eight local images, or drop them on the preview.
2. Select Hero, Detail or Street, then a thumbnail to assign its photograph.
3. Drag the selected frame to reposition; zoom and X/Y sliders offer keyboard
   control. Each frame keeps its own crop. Reset crop restores a centered fill.
4. Choose a preview format and colour treatment, then edit the caption.
5. Download a PNG: square 1080 × 1080, portrait 1080 × 1350, or wide 1920 × 1080.

Exports redraw the composition at their full dimensions. Photos remain in local
browser memory and are discarded on reset or reload. The initial city scene is
procedural illustration, so the studio needs no sample image to open.

## Delivery and optional helpers

Use Node 22.18+ with `node main.ts`. It copies `app/` and `screenshots/` when
present to `/output`, or the directory set by `MAKEFUN_OUTPUT_DIR`, and invokes
the unchanged kit `buildDossier`. Output must be outside the repository and must
not overlap it. A failed build removes stale dossier files rather than claiming
that an old dossier describes the current app.

`scripts/make_test_photo.py DIRECTORY` uses Pillow to generate geometric test
scenes. These are original synthetic fixtures, not photographs of real people.
`scripts/capture.py` is an optional manual helper for a machine with Pillow,
Playwright and Chromium; it captures the actual editor and exported covers.
Neither helper was run during this rewrite.

Screenshots are intentionally absent at the user's direction. The competition
requires 3–4 screenshots, and the kit refuses to build a dossier with zero.
This working tree therefore does not meet the screenshot/dossier requirements.
Only syntax checks are authorized here; browser appearance, interaction and PNG
downloads have not been tested. No submission or transcript-gate pass is claimed.

MIT licensed. See `LICENSE`.
