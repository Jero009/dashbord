# v3.11.1 — fix: Sleep Stages widget failed to load

The Sleep Stages widget showed "can't load" on real launchers: the timeline was
built as a nested RemoteViews layout (LinearLayout of weighted cells added into
a FrameLayout host), which launchers fail to inflate. Replaced with the same
pre-rendered bitmap approach as the ring gauge — timeline segments are drawn
onto a canvas at sync time and pushed via setImageViewBitmap. No layout
plumbing left to break.

## Changes
- SleepStagesWidgetProvider: timeline now bitmap-drawn (rounded segments, 1dp gaps, fixed stage palette)
- Removed widget_stages_timeline.xml / widget_stage_cell.xml (dead layout approach)
- versionCode 15
