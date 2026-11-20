# Sunset Circuit

Make a photo feel like the opening frame of a neon-soaked night. Sunset Circuit turns your own images and words into a layered, multi-panel city poster, right in your browser. Drop in one photo or a small set, reframe every panel, choose a color treatment, then export a square, portrait, or landscape PNG. Your photos stay on your device.

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/wiiznu/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/wiiznu/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Entry for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01) — "Make a GTA 6 cover art", $250 in USDC.

## Run it

Open `app/index.html` in a desktop browser. The editor uses only local files and browser canvas APIs; there is no install, account, upload, or network request. Add a photo, select a collage panel, drag to reframe it, edit the cover line, and save one of the three ready-to-post PNG sizes.

`node main.ts` is the make.fun Node 22 entrypoint. It copies the static app and screenshots to `MAKEFUN_OUTPUT_DIR` (or `/output`) and creates the judge dossier.

## Design notes

The original art direction pairs a hard-edged editorial grid with warm dusk light, cool shadow washes, compact panel stamps, and a high-contrast title lockup. The canvas renderer shares one composition path between the live preview and the full-resolution PNG export. Photos are read from local file inputs and held only in browser memory.

## Credits

Written for the Make GTA 6 Cover Art competition by @wiiznu-bondet. The artwork, layout, interface, and renderer are original; the project uses no game assets or fonts. The required make.fun dossier helper is included unchanged under `vendor/`.

MIT License. See [LICENSE](LICENSE).
