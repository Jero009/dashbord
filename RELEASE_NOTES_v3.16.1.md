# dashbord 3.16.1

## Fixed
- **Widgets: "Can't load widget" on Sleep Stages + Briefing widgets** — root cause found by reproducing on a live emulator with logcat: `widget_sleep_stages.xml` used `<Space>` (bedtime/waketime spacer) and both it and `widget_briefing.xml` used plain `<View>` elements (legend swatches, VU bar segments). **Neither `android.widget.Space` nor `android.widget.View` is on Android's RemoteViews inflation allow-list**, so every launcher fails to inflate the layout and shows the unrecoverable placeholder. All spacer/segment elements are now empty `TextView`s (allow-listed, visually identical). Verified on-emulator: both widgets render correctly (header, values, timeline bar, legend, VU bar).

## Notes
- Sleep score (3×1) and Sleep battery ring (4×2) widgets were unaffected — their layouts never used non-allowlisted views.
- After updating: if a previously-failed widget instance still shows the error, remove it from the home screen and add it again.
