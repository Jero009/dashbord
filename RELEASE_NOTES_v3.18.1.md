# v3.18.1 — follow-up fixes

Three fixes to the v3.18.0 pass, from widget/icon feedback:

1. **Square Glyph-LED VU bar (app + widget)** — the verdict bar's three segments are now fixed 14dp **squares** in a centered 48dp column, uniform size with even 3dp gaps, in both widget skins (classic + OS5). They line up with each other and mirror the in-app bar exactly. Unlit segments are their own hue dimmed (never grey).
2. **Unified tile greys** — 88 drifting per-page tile greys (`rgba(var(--nt-ink), 0.04–0.09)`) replaced with one token, `--nt-tile`, defined once in `:root` so both skins share it. Every metric tile / cell / inset panel now uses the exact same grey.
3. **Minimal monochrome icon** — new launcher icon: pure black background, three concentric white rounded-square outlines, line-only. No red, no dot matrix, no wordmark.

## Testers

- Remove and re-add the briefing widget after updating (old instances keep the previous layout).
- APK signed with the standard keystore (SHA-256 d34d4a52…b04e), versionCode 31.
