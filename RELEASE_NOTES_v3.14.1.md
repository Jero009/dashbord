## v3.14.1 — debugging pass on the Hermes integration

Two real bugs found in v3.14.0 by end-to-end debugging against the live receiver:

### Critical: gym sync would have failed with 401
- The receiver requires the `HC_SECRET` key on POST — v3.14.0 sent no key, so every workout push would have been rejected and stuck in the retry queue.
- Fix: push now sends `X-Api-Key`; new **Settings → Receiver write key** field (paste your HC_SECRET once). Until the key is set, workouts stay safely queued.
- Get the key: `ssh docker-vm "grep ^HC_SECRET= ~/health-receiver/.env | cut -d= -f2-"`

### Widget snapshot merge
- The widget data blob was full-replace, so the new briefing push would have blanked the sleep widgets' data (and vice versa).
- Fix: snapshot fields now merge; each producer only touches its own fields.

### Tests
- 244 unit tests green (5 new merge-regression tests), lint clean, build clean.
