# Graceful Whitespace template — phase two

A restrained classical-poetry preset made entirely from existing editor primitives.

- Palette: ivory paper (the existing 240px tiled texture), dark muted green ink,
  a small dusty-red outline seal, and no visible poem border.
- Layout: Chinese and Japanese use right-weighted vertical writing at x=63%.
  Alphabetic languages and Korean use a horizontal layout at x=50%.
- Type: existing Noto Serif SC/TC, Shippori Mincho, Gowun Batang and Latin serif
  families. This phase does **not** add a new font or web-font dependency.
- Preview: a ~1.5 KB local SVG thumbnail for discovery in the gallery only.
  Canvas preview/export render actual editable paper, text and stamp as before.
- All eight supported locales have independent titles and descriptions;
  stamp text and position are localized.

## Acceptance checks

1. Apply the template from Built-in Templates on desktop and mobile.
2. Confirm no frame, generous negative space, and a small vermilion seal.
3. Confirm editor background type is Paper, paper ID ivory, and no image fetch.
4. Verify English horizontal and Chinese/Japanese vertical layout. Test short and
   long poems for wrapping or clipping and adjust user settings if required.
5. Verify editor preview vs PNG/JPG export; reload and restore the active template.
6. Run unit, locale integrity, Playwright and production build locally before merge.

Tests are checked into the branch but must not be reported as passing unless run.
