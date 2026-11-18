# Game art contract

The browser uses plain PNG sprite sheets. Do not ship or parse `.aseprite` source files.
Keep source files in `art-src/`, outside the extension assets.

## Current grid sheets

The supplied sheets are 960x768 pixels with 10 columns and 8 rows of 96x96 cells.
The visible crop is `{ x: 24, y: 28, w: 56, h: 36 }`. Both sheets currently face left:

- `hero_soldier.png`: `idle` row 0 (6 frames), `walk` row 1 (8), `jump` row 2 (6),
  `block` row 3 (6), `attack1` row 4 (8), `attack2` row 5 (8), `hurt` row 6 (4),
  `death` row 7 (10)
- `monster_slime.png`: `idle` row 0 (6 frames), `move` row 1 (8), `jump` row 2 (6),
  `guard` row 3 (6), `attack` row 4 (8), `dash` row 5 (8), `hurt` row 6 (4),
  `death` row 7 (10)

Monster rows 3-5 are provisional names. Correct them only in
[asset-map.js](../../game/asset-map.js) if the sheet's intended tags differ.

The asset contract for future art is:

- Hero: 32x32 display frames with `idle`, `attack`, `cheer`, `stumble`
- T1/T2/T3 monsters: 32x32 display frames with `idle`, `hit`, `defeated`, `escape`
- Boss monster: 48x48 display frames with `idle`, `hit`, `defeated`, `escape`
- Arena backgrounds: `arena_bg_*`, 160x72 displayed at 2x
- Icons: 16x16, named `xp`, `streak`, `level`, and `door`

Missing art is allowed; the sprite engine shows a labeled placeholder.

## Registered themes

`game/asset-map.js` selects `tiny_swords` through `ACTIVE_THEME`. It uses the copied
Warrior, Torch, Dead, terrain, and rock assets under this directory. `pixel_duo` remains
available as a grid-sheet fallback for comparison and reduced-risk rollback.

Tiny Swords Aseprite JSON may include `meta.tabdungeon` metadata for facing, anchors,
body bounds, and timing limits. The sprite engine applies those values locally and falls
back to a labeled placeholder if a JSON or PNG asset cannot load.

## Exporting from Aseprite

In Aseprite, use **File > Export Sprite Sheet** and export:

- PNG image
- JSON Data in **Array** format
- Tags enabled

CLI example:

```text
aseprite -b in.aseprite --sheet out.png --data out.json --format json-array --list-tags
```

Verify the available flags with `aseprite --help` because CLI options can differ by
Aseprite version.

## Registering art

Add a definition to [asset-map.js](../../game/asset-map.js) with its sheet path, cell
size, crop, facing, FPS, and tag rows/frame counts. Register additional monster
definitions in the appropriate tier array. Artists only need to edit that map after
adding the PNG; no runtime code changes are required.
