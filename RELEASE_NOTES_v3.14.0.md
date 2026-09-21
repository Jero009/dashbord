## v3.14.0 — Hermes integration v2 (RowanTBK-inspired, local-first)

### Gym → Hermes mirror
- Finished workouts now sync to the receiver on the docker VM (offline-safe: queued and retried on next app start)
- Hermes can see every set — briefings and sleep→gym analysis work off real training data

### Grades in the app
- New grades from eAsistent flow into the app automatically
- Grades card in the Hermes tab (average + last 8), avg + new-count in the Home briefing card

### Daily briefing
- New Home card: Hermes' daily briefing (verdict PUSH/NORMAL/HOLD + the numbers behind it)
- New **Hermes Briefing widget** — briefing title + first lines on your home screen
- Hermes tab timeline now includes the briefing

### Analysis layer (runs on the VM, lands in the app)
- Illness early warning (RHR/HRV baseline rule; SpO2/RR confirmation)
- Sleep→gym performance report (starts once ~20 workouts are mirrored)
- Plateau detection, volume balance, consistency vs weekly goal
- Monthly report with RHR trend + broken-sync canary

### Notes
- Everything is local-first: phone SQLite stays the source of truth; the receiver is only a mirror
- Health data itself is unchanged — no new permissions
