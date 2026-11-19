# 三听雨 / Listening to Rain

Dedicated InkPoem 4:5 template for the Southern Song ci **蒋捷《虞美人·听雨》**.

## Artwork

Three life stages share one continuous rain motif: warm candlelit song tower,
blue-gray solitary riverboat, and a silent monastic hut in the rain. The right
side remains intentionally empty for the editable poem; title/author/body/notes
are never baked into the artwork.

The artwork was generated with ImageGen; a compressed WebP raster is packed in
a self-contained SVG image wrapper for repository delivery through a text-only
connector. This is **not** SVG-drawn artwork. Original higher-resolution
960 x 1200 WebP artwork and 360 x 450 WebP gallery thumbnail are retained
separately as an optional future replacement once direct binary uploading is
available. Do not silently replace these in saved drafts.

- Chinese/Japanese: vertical writing. Korean/Latin: horizontal writing.
- Same editing, draft restoration and export paths as existing templates.
- Chinese artwork gallery category; Poetic Scenes series.
- Public-domain simplified/traditional poem entries support the existing
  matching/autofill flow without automatically overwriting user text.
- 4:5 is the intended composition; `stretch` preserves all three scenes at
  different ratios, where minor geometric distortion is acceptable.
- No runtime image API, credits, new service or rendering engine.

## Local-only verification

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run verify:build
npx playwright test tests/e2e/listening-to-rain-template.spec.ts
```

Manually compare editor to PNG export at 4:5 with the complete eight-line ci,
and confirm no clipping in 9:16 and 16:9. No workflow is manually triggered.
