# v3.18.4 — widget sizing fixes

1. **Briefing widget resizable to 1 cell tall** — the provider declared a 2-cell minimum height, which is why the launcher refused to shrink it. Now min 40dp / 1 cell; bar (14dp segments) + verdict word + date recomposed for the compact height.
2. **Activity grid adapts to widget shape** — the 56 days now wrap into a grid whose row count matches the widget's aspect ratio (wide widget → 14 columns × 4 rows, tall widget → 8 columns × 7 rows), so cells fill the full width and height instead of letterboxing a small square. Day order runs down each column, today always last column, bottom.
3. Both activity skins tightened: less padding, more grid.

## Testers

- Remove and re-add both widgets (the briefing's new minimum size only applies to fresh instances).
- APK signed with the standard keystore, versionCode 34.
