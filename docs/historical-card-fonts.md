# Historical Chinese fonts on the whole card

The default **new text seal** uses CNS 說文解字. A new seal also opts into the
traditional Zhu-wen renderer. Existing saved seals and imported templates keep
their stored mode, face, text and geometry unchanged. New traditional seal preset
choices use CNS; the modern-calligraphy preset keeps Ma Shan Zheng.

The new fonts are **not stamp-only**. They appear in the ordinary card-wide
Typography font selector, applying to the poem title, body, author and source.
Each custom text box can inherit the card font or choose its own. Chinese
historical faces also appear among signature options. The stamp retains its
own independent font choice.

CNS, MOE Li, Chine-Culture Jinwen and Chongxi Seal load by `FontFace` only
when selected. They are never eagerly bundled into the JavaScript. The
`fonts:sync` script fetches pinned original binaries into `public/fonts` at
development/build time and validates size and SHA-256 before publishing them as
same-origin static assets. This increases build-time and deployment size:
Chongxi ~21 MB, CNS ~10 MB, MOE Li ~5 MB, Jinwen ~0.7 MB.

**The same card can include several fonts:** the renderer waits for the global
face, per-box overrides and selected signatures before high-resolution export.
Normal card text follows established CSS fallback rules for missing punctuation
and glyphs; a historical font selection does not rewrite user content. The
seal is different: new checked faces use their actual binary Unicode cmap.
Missing/ambiguous seal glyphs block copy/share/export until the user explicitly
changes the seal text or selects another face. Traditional variants are advisory;
there is no automatic simplified-to-traditional conversion. CNS simplified
宁 is excluded even if the binary maps it, because that glyph has a different
historical meaning. Existing Zhongshan and LXGW seal choices retain legacy
behavior; LXGW's published table still yields a warning.

**Font licensing:** original binaries remain unmodified. Licenses/attribution
files are installed in `public/fonts`. CNS is under the Taiwan government open
data license (v1); MOE Li and Chongxi are distributed as CC BY-ND 3.0 TW;
Chine-Culture Jinwen is SIL OFL 1.1. Verify the latest redistribution and
commercial-use requirements before offering fonts in a paid print product,
particularly the NoDerivatives families. No font subsets are created.

Local checks (without CI):
```bash
npm ci
npm run fonts:sync
npm run typecheck
npm run lint
npm run test:unit
npm run build
```
Then check vertical and horizontal poems in mobile Safari, independent
custom text, signatures, Zhu/Bai seals, mixed simplified/traditional names,
a missing glyph that blocks stamp export, and loading failure recovery.
