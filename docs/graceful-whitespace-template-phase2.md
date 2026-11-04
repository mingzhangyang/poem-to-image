# Graceful Whitespace template — phase two

A restrained classical-poetry preset made entirely from existing editor primitives.

- Palette: ivory paper (the existing 240px tiled texture), dark muted green ink,
  generous negative space and no visible poem border.
- Layout: Chinese and Japanese use right-weighted vertical writing at x=63%.
  Alphabetic languages and Korean use a horizontal layout at x=50%.
- Type: existing Noto Serif SC/TC, Shippori Mincho, Gowun Batang and Latin serif
  families. This phase does **not** add a new font or web-font dependency.
- Language-specific sign-off: Chinese, Japanese and Korean retain the subtle
  localized seal. English, Spanish, French and German suppress the seal and
  instead include an editable, muted cursive signature with localized text.
- Preview: CJK uses the lightweight SVG thumbnail; Latin variants use the
  editable paper/card rendering with signature preview so a Chinese seal never
  appears as a misleading thumbnail. The editor and Canvas export share the
  existing signature drawing implementation.
- The signature survives custom-template saves, drafts, reload and undo history.
  Switching built-in template languages syncs the default sign-off while
  preserving signatures that the user customized.

## Acceptance checks

1. Apply the template from Built-in Templates on desktop and mobile.
2. Confirm CJK variants show a small vermilion seal; Latin variants show one
   freehand cursive signature and no stamp. Ensure signature text is editable.
3. Confirm editor background type is Paper, paper ID ivory, and no image fetch.
4. Verify English horizontal and Chinese/Japanese vertical layout. Test short and
   long poems for wrapping or clipping and adjust user settings if required.
5. Verify editor preview vs PNG/JPG export; reload and restore the active template.
6. Run unit, locale integrity, Playwright and production build locally before merge.

Tests are checked into the branch but must not be reported as passing unless run.
