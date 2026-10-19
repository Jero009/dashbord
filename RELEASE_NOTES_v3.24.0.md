# dashbord v3.24.0 — Plan import from Hermes

- Gym → Plan previews a proposed plan and every workout template before you choose **Import plan** or **Dismiss proposal**.
- Accepted plans create separate templates without changing existing workouts; repeated deliveries of the same plan UUID cannot create duplicates.
- Plans that overlap your existing plan are blocked rather than replacing it.
- The phone remains the source of truth. Hermes queues a proposal through the existing receiver; nothing is created on the phone before you approve it.
- This release does not add weekday scheduling. Plans contain templates, matching the app's current plan model.
