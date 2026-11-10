# InkPoem · Chinese seal-script font sources and compatibility

## Licensed authentic seal-script fonts

InkPoem uses two **opt-in**, licensed seal-script faces. Neither is a universal
Chinese font. The browser only downloads the faces when selected for a stamp.

1. **Jingfeng Zhongshan Wang Seal Script** (敬峰中山王篆, 战国中山王篆)
   - Author: **Jingfeng Liu (刘敬峰)**.
   - Source: https://github.com/SuperMate-Ai/JFZSKSealScript
   - License: **SIL Open Font License 1.1**, reserved font name;
     full text: [licenses/JFZSKSealScript-OFL.txt](licenses/JFZSKSealScript-OFL.txt)
   - Pinned revision: a12bf04c0413da28e46cba3d16184ac91ad1bc96
   - Served file: fonts/JFZSKSealScript_V2.0.woff2 (~818 KiB).
   - The author's v2.0 release describes about 2,300 seal-script glyphs,
     **not guaranteed** to cover all simplified/traditional/name/extended characters.
   - This is Warring States bronze seal script, NOT Qin Xiaozhuan or Miaozhuan.

2. **LXGW Seal** (霞鹜篆书)
   - Author: **LXGW**, with upstream acknowledgments for Klee One/Gungsuh.
   - Source: https://github.com/lxgw/LxgwSeal
   - License: **SIL Open Font License 1.1**, reserved font names;
     full text: [licenses/LXGWSeal-OFL.txt](licenses/LXGWSeal-OFL.txt)
   - Pinned revision: 2b1d01195168110b9a8f3a8abaff844ff22fa716
   - Served file: TTF/LXGWSeal-Regular.ttf (~223 KiB).
   - Genuine Xiaozhuan / small-seal script. The repository README still
     states about 75 entries, but documentation/table.md dated 2026-10-08
     lists 165 seal-script entries (365 documented seal/modern-codepoint aliases).
     Both are limited compared with general CJK coverage.
   - The UI flags characters absent from the documented table. This is
     a best-effort reference, NOT a binary-cmap audit or a guaranteed match.

Both are loaded from revision-pinned jsDelivr GitHub CDN addresses through
the browser FontFace API. The binary font files are **not** included in the
repository, because the available GitHub text connector does not transfer
binary font data. A first font load requires the font CDN to be available.
Export with an uncached seal face also requires that host. If the font
file fails to load, export rejects rather than claiming successful coverage.

**Known limitation:** FontFace and Canvas do not expose the selected font's
per-character cmap. Missing glyphs can silently fall back to Noto Serif
or another system font. The editor explicitly warns about limited coverage;
no complete glyph coverage is promised. A future phase can vendor the
licensed binaries and generate per-character coverage metadata after
verifying actual bytes, reserved-name rules and shipping size.

## Presets, compatibility and layout

- Old stamps without a mode field retain their original drawing path.
- Explicit modern mode uses the same legacy ink and placement instructions.
- Traditional Zhu Wen: red ink strokes and ink-colored characters.
- Traditional Bai Wen: filled red face, transparent carved characters.
- Reading order: top-to-bottom in each right-to-left column, with a
  single full-height left cell for three-character seals.
- Shared measured glyph fitting uses uniform scaling to preserve shape;
  the main preview/export path remains the Phase 1 Canvas compositor.
- Presets change style, mode, font, ink tone, weathering and rotation.
  They preserve text, size, position, opacity, and unrelated document layers.
- Texture generation and texture seeds are unchanged until Phase 3.

## Verification checklist (no CI dispatch)

With Node 24 and installed dependencies, run locally:
npm run typecheck; npm run lint; npm run test:unit;
npm run build; npm run test:worker; npm run verify:build;
npm run test:e2e.

Inspect 1-, 2-, 3-, 4-character stamps, simplified/traditional and extension
characters such as 𠮷; old document snapshots; initial font loading and
blocked/offline CDN; missing glyph fallback; 1x/2x/3x outputs; all
three seal outlines, opacity, rotation, shadows, Undo/Redo, template
application, draft recovery and export in desktop/mobile Chromium, then
Safari on an iPhone. No real-browser, glyph-coverage or load-time
verification is claimed in this document.
