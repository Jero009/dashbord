# v3.18.2 — Life Events move + activity widget fix

1. **Life Events moved** — from Analytics → Gym to Analytics → Overview, together with the red Log event button. Gym page is now purely training analytics.
2. **Activity widget: current days now visible** — the grid bitmap was sized for 7 columns but draws 8; the newest (rightmost) column, which holds today, was clipped off the canvas. Bitmap is now sized for all 8 columns.
3. **Activity widget shape** — default size changed from 3×3 (square/tall) to 4×2 cells: wider and shorter, like the other widgets. Still resizable either way.

## Testers

- Remove and re-add the activity widget to pick up the new default size and the unclipped grid.
- APK signed with the standard keystore, versionCode 32.
