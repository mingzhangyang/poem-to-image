// Size budgets for template preview thumbnails, shared by
// scripts/verify-build.mjs and tests/frontend/template-preview-assets.test.ts.
//
// Previews are lazy-loaded in the gallery, so the whole set's total does not
// reflect what a visitor downloads and would only grow with every template.
// Instead, cap each file (catches a single unoptimized image) and the average
// size (catches the set drifting toward heavier encoding).
export const previewBudgets = {
  maxFileBytes: 100 * 1024,
  maxAverageBytes: 20 * 1024,
};
