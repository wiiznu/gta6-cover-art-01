# Sunset Circuit

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/wiiznu/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/wiiznu/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An original offline poster studio by **wiiznu** in **gta6-cover-art-01**.
Competition: https://make.fun/bounty/gta6-cover-art-01

Sunset Circuit turns personal photos into bold, multi-panel city covers. A large
hero frame meets two supporting photo frames and a code-drawn skyline strip.
Orange, rose and violet sunsets or electric cyan and magenta neon set the mood;
heavy system lettering spells CITY AFTERGLOW above your editable caption.
All skyline buildings, sun, palms and road details are original canvas shapes.
There are no official game assets, logos, font files, libraries or network calls.
Your photos stay in memory on your own device.

## Use the studio

Open `app/index.html` directly in desktop Chrome. No build or server is needed.
Add up to eight photos with the file picker or drop them onto the preview.
Select Hero, Detail or Street, then click a photo thumbnail to assign it.
Drag within a photo panel to reposition it; use zoom and horizontal/vertical
sliders for precise or keyboard reframing. Reset crop returns the selected panel
to its centered fill. Choose a composition, colour grade and caption.
Export Square (1080 × 1080), Portrait (1080 × 1350), or Wide (1920 × 1080)
as a PNG. Each export composes at the actual requested dimensions.
The initial artwork is a generated city scene, ready to replace with your photos.

## Entrypoint and helpers

Node 22.18 or newer runs `node main.ts`. The entrypoint copies `app/` and any
`screenshots/` to `/output` (or `MAKEFUN_OUTPUT_DIR`) and calls the unchanged kit
`buildDossier` with the competition caps. It refuses an output path overlapping
the repository. The dossier library requires screenshots and will fail clearly
when none exist; no placeholder screenshots or substitute dossier are produced.

`scripts/make_test_photo.py DIRECTORY` generates original geometric test images
with Pillow. `scripts/capture.py` is an optional future capture helper requiring
Pillow, Playwright and an installed Chromium browser. It captures the editor and
actual downloaded covers and resizes them to dossier presentation limits.
Neither helper has been run in this rewrite. `screenshots/` is intentionally empty
at the user's direction, so the screenshot gate cannot pass in this state.

Validation for this rewrite is limited to JavaScript and entrypoint syntax checks;
browser behavior and exports have not been tested here. MIT licensed; see LICENSE.
