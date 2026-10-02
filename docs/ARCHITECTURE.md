# Architecture and data model

React 19 + TypeScript + Vite on an Express 5 / Node 24 server. Zod validates import and API boundaries. Sharp validates and re-encodes actual image bytes. No user account or server inventory database is needed. The separate SQLite database stores only expiring guest sessions, quota counters and a random IP-hashing salt.

`SavedState` version 1 contains inventory and saved builds. Each inventory record has a stable ID, canonical material ID, user label, integer quantity, unit, condition, critical specifications, confirmation flag and notes (model/dimensions can also be recorded there). Each build records completed steps, notes, substitutions, measurements with units, and update time. Photos and keys never appear in backups. The catalogue and saved-state schema are separately versioned; there are no migrations yet. Unsupported backup versions are rejected without overwriting current data.

## Readiness

1. Requirements list acceptable material alternatives and critical values explicitly. Items with wrong units, damaged condition or contradictory specifications cannot satisfy them. Unconfirmed items, unknown condition or missing critical fields remain unknown.
2. Construct a flow network: inventory capacity equals quantity; requirement capacity equals required quantity; edges exist only for compatible confirmed items. Maximum flow allocates each unit at most once. This handles overlapping alternative groups without a greedy allocation failure.
3. Per requirement: full allocation = satisfied; insufficient valid allocation = short; no matching material = missing; conflicting items = incompatible; unresolved matching candidates = unknown. Unknown is never silently changed into a compatible value.
4. All essential requirements satisfied = ready. Otherwise unknown/incompatible produces verification state; remaining cases require additional items. Optional requirements do not gate readiness (the initial catalogue has none).
5. Filter by category, maximum difficulty/time, topic, required tools and no-additional-items preference before ranking. No-additional-items excludes missing/short requirements; existing uncertain parts may remain in the verification section.
6. Sort by ready → verification → missing; then most fully satisfied requirements, fewest missing/short requirements, shortest estimated duration, stable project ID. All current projects have equal documentation evidence rank, including the NASA paper craft. The denominator shown is the number of essential requirements, not an invented percentage score.

Across project suggestions the same item may be reused. Saved projects are not inventory reservations; the workspace warns about other unfinished builds. Previously completed steps are historical notes; current readiness is recalculated whenever inventory changes. A substitution note or AI answer never changes requirements or inventory.

## AI trust boundaries

The client never imports server code at runtime (only TypeScript types). One provider adapter uses the official OpenAI SDK, Responses API, structured Zod output, `store:false`, a 2,200-token output cap and zero automatic retries. The endpoint chooses provider destination and model server-side; users cannot select arbitrary URLs. Source/project context is looked up server-side from the reviewed catalogue. Live web retrieval is not enabled.

Session setup precedes expensive calls. Same-origin and CSRF checks run before JSON parsing. Bounded request schemas, decoded image validation, persistent atomic quotas, burst limits and two in-flight requests protect the only expensive route. Reservations include failed calls to keep retries bounded. AI proposals are always added unconfirmed and must be edited/confirmed by the user.

SQLite uses WAL, a busy timeout and `BEGIN IMMEDIATE` to reserve all quota scopes together. Daily counters roll over at 00:00 UTC (07:00 Asia/Bangkok). Default scope is one server instance with durable storage, not distributed/serverless infrastructure. A new machine with a fresh database resets counters, so persistence and provider billing limits remain deployment obligations.
