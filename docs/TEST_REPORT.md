# Technical validation — 2 October 2026

These results cover software and documented sources. They do not establish physical build safety, human learning outcomes, live OAuth/email delivery or AI accuracy.

| Check | Actual outcome |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` / TypeScript in build | Passed |
| `npm test -- --reporter=default --reporter=json --outputFile=docs/evidence/unit-api-results.json` | **92 passed, 0 failed, 0 skipped**: 61 domain/catalogue tests, 10 existing API/quota tests, 16 community API/configuration tests and 5 local PostgreSQL migration/permission tests |
| Frozen `npm ci --no-fund` followed by `npm run build` | Passed with the updated lockfile; final client approximately 249 KB gzip / 1,001 KB uncompressed. Vite's large-chunk warning is non-fatal |
| `REBUILD_E2E_PORT=3001 REBUILD_E2E_PRODUCTION=1 npm run test:e2e` | **51 passed, 0 failed, 0 skipped**, against a fresh production Node server at desktop, tablet and mobile widths |
| Automated WCAG 2 A/AA | 66 existing Thai/English screen scans, plus 9 new English community/review/moderation scans: no violations. Automated checks do not replace assistive-technology testing |
| `npm audit --json` | 0 known vulnerabilities reported for the updated dependency tree |
| Production asset secret-name scan | No AI/service key variable names or real key material provided to the frontend |
| Development startup | Restarted the task-owned development server with the updated API; health and account-unavailable behavior checked |

## Scope and evidence

`docs/evidence/unit-api-results.json` and `browser-results.json` contain the runner results. The original browse, household search, missing-material reader, all-step progress, bilingual persistence, import/export, corrupt-data recovery, XSS text and AI-unavailable journeys remain covered.

New community API checks cover verified identity, same-origin mutations, forced pending status, forbidden role/status injection, private author and moderator feeds, one review per account/target, low ratings, approval/unpublishing, private photos, real Sharp image decoding and metadata removal, deletion ownership, quotas, malformed IDs and safe public configuration. The identity/storage adapters are test doubles: these checks do not claim a real Supabase connection.

The PostgreSQL checks run the actual migration twice in PGlite 0.5.8, with minimal simulated Supabase-managed auth/storage tables. They verify SQL syntax/repeatability, private storage configuration, browser-role permission denial, protection even with an unrelated permissive storage policy, the moderator RPC and atomic audit write, review uniqueness and photo ownership constraints. Actual Supabase deployment remains unrun.

Browser fixtures cover member submission and its private status, literal rendering of submitted HTML, separate project/site review scopes, moderator approval then unpublishing with an author note, ordinary-member denial, and honest unavailable behavior. They use synthetic identities and API responses; Google and SMTP are not live-tested.

The initial browser run found insufficient contrast on the new introduction's small-print note. The color was corrected and the complete 51-case production run passed. Visual review then clarified the drawer-width label and paper-bridge ridge direction; the final build and targeted visual/development smoke checks cover those diagram-only corrections. Current detailed-guide screenshots were refreshed after the correction. No behavioural test was disabled or relaxed.

## Guide/source limits

The user's Instructables screenshots and text informed page structure. New explanatory copy and diagrams are original ReBuild content. There are 81 household/science concept diagrams and 60 electronics visual summaries across 141 steps. They are not build photos, scale templates or physical test evidence. No new independently reviewed per-step videos were added. Existing YouTube destinations remain labelled search results; NASA's direct video URL was observed on its official written page but full playback was not reviewed.

Earlier pinned Arduino source review, NASA source observations and the 16/16 official-source HTTP checks remain recorded in `docs/evidence`. They were not all fetched again for the account/community work.

## Still unverified externally

- Real Supabase credentials and project migration, Google OAuth, external-user email/SMTP delivery, cloud photo storage and the production moderator account: no project or keys supplied. Follow `docs/ACCOUNTS_SETUP.md` and run its live checklist.
- Public Render deployment and its exact site URL: no production URL supplied. GitHub push and local production tests do not establish a live rollout.
- Live AI calls: no `REBUILD_AI_KEY` supplied; existing synthetic fixtures remain clearly distinguished.
- Arduino AVR compilation, household/electronics physical builds, human usability studies and school-specific research outcomes: not performed.

Exact runtime and development dependencies are pinned in the lockfile. PGlite is a development-only dependency for permission/migration checks. Supabase's client SDK is used for supported auth flows and the server adapter; elevated secrets are never returned by the public config endpoint.
