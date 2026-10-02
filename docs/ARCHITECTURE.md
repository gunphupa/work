# Architecture and data model

React 19 + TypeScript + Vite on an Express 5 / Node 24 server. Zod validates import and API boundaries. Sharp validates and re-encodes actual image bytes. No user account or server inventory database is needed for browsing and local builds. Optional community accounts use Supabase. The separate SQLite database stores only expiring guest sessions, quota counters and a random IP-hashing salt.

`SavedState` version 1 contains inventory and saved builds. Each inventory record has a stable ID, canonical material ID, user label, integer quantity, unit, condition, critical specifications, confirmation flag and notes (model/dimensions can also be recorded there). Each build records completed steps, notes, substitutions, measurements with units, and update time. Photos and keys never appear in backups. The catalogue and saved-state schema are separately versioned; there are no migrations yet. Unsupported backup versions are rejected without overwriting current data.

## Readiness

1. Requirements list acceptable material alternatives and critical values explicitly. Items with wrong units, damaged condition or contradictory specifications cannot satisfy them. Unconfirmed items, unknown condition or missing critical fields remain unknown.
2. Construct a flow network: inventory capacity equals quantity; requirement capacity equals required quantity; edges exist only for compatible confirmed items. Maximum flow allocates each unit at most once. This handles overlapping alternative groups without a greedy allocation failure.
3. Per requirement: full allocation = satisfied; insufficient valid allocation = short; no matching material = missing; conflicting items = incompatible; unresolved matching candidates = unknown. Unknown is never silently changed into a compatible value.
4. All essential requirements satisfied = ready. Otherwise unknown/incompatible produces verification state; remaining cases require additional items. Optional requirements do not gate readiness (the initial catalogue has none).
5. Readiness is advisory. It never disables instructions, Next/Previous navigation, saving a build, or any progress checkbox. Checking a step records a user action, not evidence of a tested physical build.
6. The UI starts with the household catalogue’s editorial order, not readiness groups. Search covers both languages and canonical material aliases. Category and 20-minute filters are visible; an explicitly selected “all checked materials” filter can narrow results to `state === ready`. Results render 12 at a time. `recommend()` remains a domain utility for the original ranking/filter rules, but the UI uses `searchProjects()` and `matchProject()`.

Across projects the same item may appear in several suggestions. Saved builds do not reserve inventory. The guide states this beside saved progress. A substitution note or AI answer never changes requirements or inventory.

## Bilingual content and authoring

`projects.json` preserves the original 16 project IDs, requirement IDs and step ordering. `household-projects.json` adds 21 original guides. Matching `.en.json` records supply English instructional copy; `localizeProject()` preserves IDs, quantities, acceptable choices, code and ordering. Tests check every translation and full/alternative material allocation. Language selection lives separately in `rebuild.language`; version 1 backup data remains unchanged.

`App.tsx` owns local state and navigation. `components/Guide.tsx` separates learning, material checks and optional tracking. `components/Inventory.tsx` handles searchable entry and optional AI suggestions. Manual Save is the review action; unknown conditions/specifications remain unknown for matching. Parsed and AI suggestions are always saved unverified until the user edits and saves them. `Art.tsx` supplies original decorative household illustrations; circuit illustrations are conceptual, not wiring diagrams.

New low-risk household materials can include sets (for example sufficient soil for the stated container); the guide states physical quantities and fit checks. Availability counts do not automatically verify dimensions, structural strength or safety.

## AI trust boundaries

The client never imports server code at runtime (only TypeScript types). One provider adapter uses the official OpenAI SDK, Responses API, structured Zod output, `store:false`, a 2,200-token output cap and zero automatic retries. The endpoint chooses provider destination and model server-side; users cannot select arbitrary URLs. Source/project context is looked up server-side from the authored/referenced catalogue. Live web retrieval is not enabled.

Session setup precedes expensive calls. Same-origin and CSRF checks run before JSON parsing. Bounded request schemas, decoded image validation, persistent atomic quotas, burst limits and two in-flight requests protect the only expensive route. Reservations include failed calls to keep retries bounded. AI proposals are always added unconfirmed and need user review before satisfying material checks. The validated language field selects Thai or English provider responses.

SQLite uses WAL, a busy timeout and `BEGIN IMMEDIATE` to reserve all quota scopes together. Daily counters roll over at 00:00 UTC (07:00 Asia/Bangkok). Default scope is one server instance with durable storage, not distributed/serverless infrastructure. A new machine with a fresh database resets counters, so persistence and provider billing limits remain deployment obligations.


## Optional moderated community

`AccountProvider` retrieves only a validated Supabase project URL and publishable/anon key from `/api/community/config`. The elevated secret is server-only. Google OAuth and email magic links use the SDK PKCE flow. Browser routes remain readable without signing in, and browser inventory/backups stay version 1.

The Node `/api/community` router validates each bearer token with Supabase Auth, requiring a verified email. Same-origin mutation checks, bounded Zod schemas and persistent quotas precede writes. The server binds the verified user ID and forces `pending`; submitted role/status/owner fields are rejected. Public feeds select only approved entries. Private author feeds and moderator queues require verified identity. Reviews are unique per user and target, with separate `website` and project scopes; respectful negative ratings are allowed.

Supabase tables have RLS enabled and no anon/authenticated grants. A separate, server-managed moderator table controls approval; editable auth metadata never grants a role. The approval RPC verifies the moderator again and writes the status and audit decision in one PostgreSQL transaction. Service access is restricted to the Node server. The SQL is in `supabase/community.sql`.

Community images are limited to 2 MB and 20 megapixels, decoded by Sharp, rotated, resized to at most 1200 px and re-encoded to JPEG without metadata. Only a private bucket is used. Public image reads check the entry's current approval status; pending/rejected image reads require its author or a moderator. The API returns no storage path or public signed URL and marks responses no-store. Deleting an entry revokes visibility before deleting its storage object; failed storage cleanup is logged for administrative cleanup. Existing downloaded copies cannot be revoked.

The local PostgreSQL migration tests simulate Supabase's auth/storage schemas; they do not verify a real project, external OAuth, SMTP delivery or hosted configuration. See `docs/ACCOUNTS_SETUP.md` for activation, moderator appointment and live checks.
