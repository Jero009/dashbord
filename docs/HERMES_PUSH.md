# Hermes → dashbord push channel

Minimal contract for Hermes (the user's agent) to push notifications into the
dashbord Android app. **App-side only** — it reuses the existing health-receiver
service (`http://100.95.172.88:8901`) that already collects the phone's health
data, so no new server infrastructure exists.

## Server contract (already satisfied by the health receiver)

The receiver stores arbitrary `type` / `data` pairs via its webhook and serves
them back via `/latest`:

```
POST /webhook?type=hermes        (or header X-Api-Key / ?key=…, as already used)
     body: JSON array (or object) of messages:
     [{ "title": "Recovery briefing", "body": "ACWR is 1.6 — take it easy today." }]

GET  /latest?type=hermes&limit=5
     → [{ "received_at": 1789476376, "data": [{ "title": …, "body": … }] }, …]
       (received_at: unix seconds; newest first)
```

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
