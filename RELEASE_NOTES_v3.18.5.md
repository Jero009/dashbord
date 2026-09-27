# v3.18.5 — briefing widget: narrower, not shorter

Fixes the wrong axis from v3.18.4: the request was to shrink the briefing widget **horizontally**, not vertically.

- **Minimum width 2 cells** (was 4): the launcher can now drag it down to a compact ~2/3-width square-ish widget, as sketched.
- Minimum height back to a normal 1-cell row (~57dp) — no vertical squish.
- Verdict word and date resized for the narrow footprint.

## Testers

- Remove and re-add the briefing widget (new minimums only apply to fresh instances), then size it freely.
- APK signed with the standard keystore, versionCode 35.
