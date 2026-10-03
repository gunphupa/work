# Technical validation — 3 October 2026

Tested application revision: `5125774c103fb962aefb0c932b1088b37a9c41ab`. These are software checks, not human participants, physical builds, or measured learning outcomes.

| Check | Observed result |
| --- | --- |
| Vitest domain/API/SQL suite | **99 passed, 0 failed, 0 skipped**: 61 domain/catalogue, 10 AI/API fixtures, 17 community API/configuration, 5 community SQL, 6 posting-limit SQL tests |
| Production Playwright Chromium suite | **51 passed, 0 failed, 0 skipped**, desktop 1440px, tablet 768px and mobile 360px; fresh production server on port 3002 |
| Accessibility assertions within browser suite | Passed; 75 axe scans across the selected screens, no reported violations. Not a full accessibility certification |
| TypeScript/build and ESLint on this code | Passed during preparation of the quota fix; browser run uses that built output |
| Posting-limit durability | Actual migration tested in local PGlite, including close/reopen of an on-disk database; tenth allowance remains consumed |
| Daily bounds and permissions | User cap 10/global cap 100, UTC rollover/cleanup, repeatable migration without counter reset, rejected reservations don't consume global capacity, browser roles denied |
| Quota outage handling | API fixture confirms submission is rejected before insert/upload if durable quota storage fails; no local fallback |
| Hosted HTTP probe | Unverified: environment proxy rejected CONNECT to work-c3to.onrender.com with 403; this is not evidence that the website itself failed |

Runtime: Node 24.19.0, npm 11.9.0, system Chromium 151.0.7922.173. No dependencies changed for the quota update. A fresh `npm audit --json` reported 0 known vulnerabilities; its output is saved in `docs/evidence/dependency-audit-2026-10-03.json`. This is not proof that the application has no security defects. Build retains the non-fatal large-client-chunk warning.

## Evidence and reproducibility

Run `npm test -- --reporter=default --reporter=json --outputFile=docs/evidence/unit-api-results.json` and `REBUILD_E2E_PORT=3002 REBUILD_E2E_PRODUCTION=1 npm run test:e2e` after `npm run build`. Runner output lives in `docs/evidence/unit-api-results.json` and `browser-results.json`. Synthetic API identities and browser fixtures are not Google OAuth or email-delivery tests.

The SQL tests use PGlite with simulated Supabase-managed roles/schemas. Queued calls demonstrate bounded results in that engine; this is not a multi-process PostgreSQL stress test. The production SQL uses a row lock and one transaction for both quota counters. Test error cases and invalid submissions count toward allowed attempts by design.

## User-observed hosted checks (reported in chat, not automated here)

On 3 October the user supplied screenshots showing Render Live, the community migration succeeding, and the moderator page. The user reported Google sign-in, owner/external email sign-in, pending/approval and deletion working. The latest screenshot shows the posting-limit migration returning Success. These observations support those particular operations, not all providers, photo privacy, throughput or quota persistence across a live Render restart.

The quota change was pushed to GitHub main after that migration confirmation. Render's new deployment must be checked in its dashboard, followed by a posting/restart/counter check from `docs/ACCOUNTS_SETUP.md`. Saving a cloud environment network setting does not itself enable a probe or deploy the website.

## What remains outside these results

Human participants, satisfaction scores, physical projects, real learning gains, reduced waste, live AI accuracy and high-load performance are unmeasured. No participant data or reviews were fabricated. See `docs/research/STUDY_KIT_TH.md` for actual data-collection procedures. The supplied school DOCX informed the earlier five-chapter draft; this kit does not assert school approval or completed research.

Community photos remain private and moderated. The Google secret previously shown in a screenshot still requires owner-side replacement unless already rotated. Email success for two addresses does not establish sender limits or public delivery reliability.
