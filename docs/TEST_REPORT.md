# Technical validation — 2 October 2026

The recorded results concern software and documented sources. They do not establish live AI quality, human usability outcomes, learning gains, actual material reuse or safe physical hardware operation.

| Check | Actual outcome |
| --- | --- |
| `npm run lint` | Passed after fixing unused imports and script globals |
| `npm run typecheck` | Passed |
| `npm test -- --reporter=default --reporter=json --outputFile=docs/evidence/unit-api-results.json` | **71 passed, 0 failed, 0 skipped**: 61 domain/catalogue/data tests and 10 API/quota tests |
| `npm run build` | Passed; production browser payload approximately 171 KB gzip. Vite emits a non-failing warning for the approximately 711 KB uncompressed chunk |
| `REBUILD_E2E_PORT=3001 REBUILD_E2E_PRODUCTION=1 npm run test:e2e` | **36 passed, 0 failed, 0 skipped**, against the production Node server at 1440×1000, 768×1024 and 360×800 |
| Automated WCAG 2 A/AA checks | No violations in 11 selected screens/states × 2 languages × 3 widths (66 scans). This does not replace human assistive-technology testing |
| `NODE_USE_ENV_PROXY=1 node scripts/check-sources.mjs` | **16/16 HTTP 200** on official reference routes at the recorded timestamp; content review is separately recorded |
| Dependency audit from initial setup | Previously reported 0 known vulnerabilities; package manifests and lockfile are unchanged in this redesign. Audit was not rerun for this UI/content change |
| Client asset scan | No `REBUILD_AI_KEY`, `OPENAI_API_KEY` or `sk-proj-` strings found in production client assets. No real key was supplied |
| Reusable installation | Frozen `npm ci` was verified during initial setup; no dependency changes. The saved build/start commands were exercised again for this release |

The final browser run covers project-first navigation, category/material search, progressive catalogue display, every step with no inventory, ungated later-step tracking, refresh persistence, existing v1 backups, JSON export/import, custom materials, bulk parsing, bilingual forms/guides, correct tutorial destinations, Arduino code/wiring, unavailable AI, literal XSS text, corruption preservation, keyboard navigation and horizontal overflow. The provider-language API test verifies English, default Thai and rejection of unsupported values.

One photo test uses an explicitly synthetic provider fixture and generated pixels to verify consent, failed-request input preservation and unchecked suggestions. It is not evidence of real image recognition. API tests validate decoded pixels, reject spoofed content, and verify atomic quota persistence.

Intermediate checks identified small-text contrast failures, a quantity input accessible-name mismatch, and test expectations for the old confirmation interface. These were corrected. A legacy-backup browser test also navigated before its asynchronous import completed; it now waits for the imported item to appear before navigating, preserving all data assertions. Final reports contain the fully passing production run.

The production browser run uses a separate port and refuses to reuse an existing server, so it tests a newly started `npm start` process. A later development-log inspection found a duplicate React key in the decorative button illustration. Its key was corrected and the affected catalogue was checked again for browser console errors; a missing favicon was supplied, and the production build was refreshed. A measuring-tape alias was also corrected, with a regression test; the final domain/API count is 71.

## Tools

Node 24.19.0; npm 11.9.0; TypeScript 6.0.3 (selected to match the supported typescript-eslint peer range); React 19.3.0; Vite 8.3.2; Express 5.2.1; Vitest 5.0.3; Playwright 1.63.0; axe-core integration 4.13.0. Exact dependencies remain in the lockfile.

## Evidence

- `evidence/unit-api-results.json`: runner output for the current domain and API cases.
- `evidence/browser-results.json`: production-browser run, selected targets, counts and durations.
- `evidence/home-{desktop,tablet,mobile}.png`, `workspace-*`, `guide-*`, `ai-unavailable-*`: current screenshots, visually inspected representative desktop/mobile views.
- `evidence/tutorial-links.json`: observed NASA video references; explicit distinction between direct source link, search results and unviewed video content.
- `evidence/sources.json`: pinned Arduino source paths/hashes and NASA webpage inspection record.
- `evidence/source-http-checks.json`: timestamped endpoint availability; HTTP 200 does not by itself verify guide relevance.

## Not run / externally blocked

- Live text, photo and troubleshooting calls: `REBUILD_AI_KEY` absent. An unauthenticated `/v1/models` request returns HTTP 401, confirming connectivity but not access. The secret requirement is saved securely in environment settings.
- Arduino AVR compilation and physical builds (including all new household guides): no AVR toolchain or hardware attached. Original sketches include exact target assumptions; documentation review does not replace these checks.
- Public hosting/TLS operation: the user’s production URL and Render deployment status were not available here. GitHub publication and local production checks do not verify a hosted rollout.
- Real human studies, labelled-image accuracy/latency measurements and school-specific template validation: no observations or school PDFs were supplied.

## Container build limitation

The Docker engine and base-image pull work. Initial container requests timed out; a host-network request then identified the platform proxy certificate requirement. Mounting the environment's existing public CA as a trusted extra certificate restored a small registry request (HTTP 200) without disabling TLS verification. The Dockerfile supports that CA through an optional BuildKit secret mount, so it is never baked into image layers.

However, BuildKit's package downloads still fail with `EAI_AGAIN` DNS errors in this environment, including with host networking, forwarded proxy settings and the approved CA. A bounded diagnostic build confirmed the failure; it was stopped. The Docker recipe is supplied but its image is **not validated** here. This is separate from the successful native frozen installation, production build and all 36 production-server browser checks.

The frozen install script was executed successfully again (`npm ci`: 235 packages; production build passed), and documented development startup was exercised: `/api/health` and application HTML both returned HTTP 200. The dev server is a current-instance process, not a published endpoint.
