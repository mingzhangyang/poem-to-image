# Template gallery navigation

The gallery's broad navigation categories are configured in `src/templates/gallery.ts`. They are separate from the existing `seriesKey`: the original series still appears on the card and remains searchable. Template IDs, definitions and saved drafts do not change when a template is recategorized.

When adding a featured template:

1. Register it as usual in the template definitions and curated gallery list.
2. Add its ID to one category in `TEMPLATE_GALLERY_CATEGORIES`. Add a category only when the existing subjects are not a good fit; give the new category a translated label in every locale.
3. Run `tests/frontend/template-gallery-navigation.test.ts` to check that every featured ID is present exactly once.

Unclassified templates are still shown under “Other” at runtime, so an incomplete category update does not hide content. The test catches the missing assignment before release. Empty categories are omitted and all displayed counts are derived from the current catalog and search.

Search uses the current language's template name, description, original series and broad category; custom templates are searchable by name. Filtering never changes the underlying template or the user's saved custom templates.
