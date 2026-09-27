# v3.18.3 — widget redesigns

1. **Briefing widget: minimalist** — gone: "HERMES BRIEFING" label, truncated title, body text. Now just the square VU verdict bar (bigger, 20dp segments — the focal point), ONE word in dot-matrix type — GO / OK / REST / SICK / DELOAD — and the date.
2. **Activity widget: grid fills the widget** — the 8×7 grid is now rendered at the widget's actual allocated size (re-renders on resize), instead of a small fixed square centered with dead space. Cells scale up to fill; today's column is part of the full-width grid.
3. Both skins (classic + OS5) updated identically.

## Testers

- Remove and re-add both widgets after updating.
- APK signed with the standard keystore, versionCode 33.
