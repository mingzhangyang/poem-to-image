# Template gallery curation — 2026-11-04

## Featured gallery (9 templates based on main)

Temporarily exclude the following from the featured gallery, **not** from
the template registry:

- Bamboo Scroll — busy wood strips and additional border detract from poem ink.
- Cyan Magenta Blocks — overlaps with more distinctive vivid/editorial styles.
- Ink Pine Mist — currently has poor light-text contrast across pale clouds.

The visible list is curated, while the template definition lookup searches
all built-in definitions, including hidden/legacy ones. Users can restore
their previously selected template after reload; the sidebar shows the hidden
template rather than losing its selection. Old assets and IDs remain intact.

## Refined visible templates

- Wax-Sealed Letter: disable duplicate CSS frame and additional stamp, leaving
  the already embedded wax seal as the visual focal point.
- Illuminated Manuscript: disable redundant frame and stamp, allowing the
  ornate, image-baked borders to stand alone.
- Japanese Magazine: replace thick brush frame with a subtle solid stroke.

## Ink Pine Mist repair (hidden pending visual QA)

Switch from white to deep green ink, change shadow to warm off-white, and lift
background brightness from 78 to 88. The repair remains out of the featured
gallery until browser checks of different poem lengths and export parity
show adequate contrast.

## Gallery preview

The expanded library uses original short sample verses in each supported
language. Text follows the template writing mode, font choice, ink color and
configured shadow. Original template images are unchanged; compact thumbnails
remain lightweight.

## Verification still required

Run unit, typecheck, lint, Playwright and editor/export visual comparisons
before merging. Static reasoning alone cannot establish photographic text
readability. This branch is independent of open PRs #11 and #12; reconcile
their changes when merging them into main.
