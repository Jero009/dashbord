# Hermes → dashbord push channel

> **Removed in v3.27:** the app no longer polls `/latest?type=hermes`. The
> Hermes tab, push notifications, briefing inbox and grades mirror are gone;
> the training-signal verdict is computed fully on-device. What remains of the
> receiver link: the app POSTS finished gym workouts to `/webhook` (the silent
> mirror, `shared/sync/workoutMirror.ts`, gated by the "Hermes integration"
> toggle) and GETs `gym_plan_import` proposals on the Plan tab. Everything
> below documents the historical receive path — keep only if the receive side
> ever comes back.

Minimal contract for Hermes (the user's agent) to push notifications into the
dashbord Android app. **App-side only** — it reuses the existing health-receiver
service (`http://100.95.172.88:8901`) that already collects the phone's health
data, so no new server infrastructure exists.

## Server contract (already satisfied by the health receiver)

The receiver stores arbitrary `type` / `data` pairs via its webhook and serves
them back via `/latest`:

```
POST /webhook        (header X-Api-Key or ?key=…, as already used)
     body: JSON object keyed by type — values must be arrays:
     { "hermes": [{ "title": "Recovery briefing", "body": "ACWR is 1.6 — take it easy today." }] }

GET  /latest?type=hermes&limit=5
     → [{ "received_at": 1789476376, "data": [{ "title": …, "body": … }] }, …]
       (received_at: unix seconds; newest first)
```

**Gotcha:** the receiver ignores any `?type=` on POST — it keys rows off the
top-level JSON key. A bare array body (or `?type=hermes` with an array body)
gets stored as type `data` and silently never reaches the app.

The only convention on top of the receiver: **type `hermes`, rows shaped
`{ title: string, body: string }`.** Rows missing both fields are ignored.

## App side

`src/shared/hermes/hermesPush.ts`:

- `fetchHermesMessages(limit)` — GET `/latest?type=hermes`, normalises rows,
  newest first, never throws ([] on failure). Uses `CapacitorHttp` so native
  requests bypass WebView CORS (same pattern as `finance/prices.ts`).
- `pollAndDeliverHermes()` — one poll cycle: delivers messages newer than the
  last-seen stamp (`localStorage['hermesPush.seenAt']`) as OS notifications via
  the Capacitor Local Notifications pipeline (same infra as reminders and the
  rest-timer ding; notification IDs 100–999).
- `startHermesPolling(intervalMs = 10 min)` — called once from `App.vue` on
  native startup. No-op on web/dev.

The Hermes tab (`/hermes`, `src/features/hermes/`) shows the latest messages
plus the app-computed signals (recovery verdict, readiness, sleep, ACWR,
recovery z) Hermes reads when drafting briefings.

Base URL override for testing: `localStorage.setItem('hermesReceiverBase', …)`.
