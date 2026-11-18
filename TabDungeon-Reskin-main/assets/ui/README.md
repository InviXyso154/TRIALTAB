# UI sprite pack (generated)

Built by `scripts/build_ui_assets.py` from the separated sheets in `art-src/ui/`.
Re-run: `python scripts/build_ui_assets.py --src art-src/ui --out assets/ui` (needs Pillow, NumPy, SciPy).

- `ui-names.json`: curated name -> file (+ width/height). The theme CSS should read sprites ONLY through these names.
- `_preview_core.png`, `_preview_icons.png`: visual index of every sprite (name under each one).
- Icons are 16x16 grid cells named `rRR_cCC` (row, column of the original sheet).

## Starting 9-slice values (source pixels; ESTIMATES, adjust after viewing dev/ui-kit.html)
- Wide buttons (30x14): slice top 5, right 6, bottom 6 (normal state has a thicker bottom shadow), left 6.
- Small buttons (14x14): slice 5 on every side.
- paper_s / paper_m / paper_l: slice about 8 / 10 / 12 on every side (ornate corners need larger values).
- bar_track: slice 2 on every side; fill = CSS div sized in %, color sampled from bar_fill_* sprites.
- Render at integer scale only (--px: 2), `image-rendering: pixelated`.

## Phase 1 preview

- `ui-theme.css` contains reusable panel, button, bar, toggle, icon, ribbon, and book
  primitives based on the curated aliases above.
- Open `../../dev/ui-kit.html` through a local static server to inspect the primitives and
  every entry in `ui-names.json`. The page fetches the manifest at runtime, so opening it
  directly as a `file://` URL may be blocked by browser fetch security.

## Notes
- Buttons with baked-in text (OPTIONS/PLAY/QUIT/SAVE) were NOT sliced.
- Toggle knob is not a separate sprite: use track_0 (on) / track_4 (off) plus a CSS knob, or compose from the sheet.
- Check the pack's license and credit requirements before distributing.
