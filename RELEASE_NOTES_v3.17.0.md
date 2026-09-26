# v3.17.0 — Nothing OS 5 style + theme switcher

## Nothing OS 5 skin (Settings → Preferences → Style)
- New **Nothing OS 5** style alongside the classic one — exactly how Nothing
  ships OS 5.0: an additional theme, not a replacement. Switch instantly
  between **Nothing OS** and **Nothing OS 5**; works in dark, light and
  system mode.
- OS 5 look: **Geist** + **Geist Mono** typefaces (dot-matrix demoted to the
  hero numeral only), **frosted translucent cards** with a hairline edge,
  rounder corners (12/20/28), calmer label tracking.
- Unchanged by design: the Nothing red accent, data colors (goal gold /
  positive green), motion, and the predominantly monochrome character.

## Home-screen widgets
- All four widgets (sleep score, sleep battery, sleep stages, Hermes
  briefing) re-skin with the chosen style — Geist numerals and labels,
  rounder translucent panel in OS 5. Switching style in Settings re-renders
  them immediately.

## Design documentation
- New `docs/DESIGN.md` — the dual-skin design reference with rendered
  comparisons of all four theme combinations, token tables, and extension
  rules for future work.

## Internal
- `useTheme` gains an orthogonal style axis (`classic` | `os5`), persisted
  independently of dark/light/system.
- Widget snapshot now carries `themeStyle`; Java providers pick the matching
  layout pair per render (old snapshots safely fall back to classic).
- New unit tests for theme-style persistence and the widget theme field.
