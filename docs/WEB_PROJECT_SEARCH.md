# External project search — 21 October 2026

## What changed

From **My materials → Find projects on the web**, select up to 30 items as a group, including custom names. Add a goal or additional materials and run a search. The same page is linked from Explore and material-to-catalogue suggestions. A text-only material description works with an empty inventory.

Results include external tutorial links, sourced material lists and method summaries, possible inventory matches, missing supplies, conditional substitutions, and related video/product links when the search actually finds them. Additional buttons explicitly open YouTube or Google search results for the project or missing supply; these are not claimed to be discovered/verified video or product listings. AI-only substitution suggestions are explicitly marked as unsupported by a source. A JSON download records the selected input, results, sources and retrieval time. Changing the selection invalidates displayed results; inventory is never mutated by search.

## Request path and grounding

- `src/components/WebProjects.tsx` implements selection, request, cancellation, citations, errors and results.
- `src/domain/web-projects.ts` defines bounded schemas, URL validation and the material-only payload. Saved photos and private inventory notes are excluded on both client and server.
- `server/web-projects.ts` first searches for written, step-by-step tutorials using OpenAI Responses with `web_search`, live external access enabled and required tool use. It requests search-source metadata and checks for a completed web search. A separate search finds related videos and product links for those projects; it cannot replace the primary tutorial. A final structured-output request formats the combined evidence.
- Source URLs come exclusively from provider citation annotations or web-tool source metadata. The formatting model selects source IDs; it cannot add arbitrary links. Materials and steps without resolvable source IDs cause that project to be discarded. Damaged/nonexistent inventory IDs are excluded from potential matches.
- `server/app.ts` exposes `POST /api/projects/search` using the existing same-origin session, CSRF, persistent daily/burst quotas and shared two-request concurrency bound. The health response has a separate `webSearchConfigured` flag; configured does not mean live-validated.

The app does not fetch arbitrary result URLs on its own server. It renders plain text and validated HTTP(S) links. Retrieved content and user text are treated as untrusted data. Source attribution is not proof every generated sentence is correct: users should compare with the original guide.

## Configuration and cost

No new account, dependency, database migration or paid hosting plan is needed. The existing server-side `REBUILD_AI_KEY` is reused. Optional `REBUILD_SEARCH_MODEL` defaults to `gpt-5-mini` with low reasoning effort for search and page inspection. Structured summaries use `gpt-4.1-mini`; the photo assistant is unchanged.

Each user search reserves one request from the **shared** AI quotas. It makes a primary web-enabled request (at most two tool calls and 5,000 output tokens), a supplemental resource search (at most one tool call and 1,800 output tokens), then a structured summary (at most 6,000 output tokens). A primary search without a written tutorial stops early. OpenAI search-tool and token usage are billable under the existing API account. The SDK's create type omits the documented `max_tool_calls` HTTP field, so its request type is explicitly extended; the field is still sent to the API. No background search or automatic retry is used. The server cancels at 120 seconds, the browser at 130 seconds; cancellation does not guarantee the provider has not already incurred usage. No hard currency cap or per-user identity guarantee is claimed by session/IP quotas.

Official reference consulted: https://developers.openai.com/api/docs/guides/tools-web-search and https://developers.openai.com/api/reference/resources/responses/methods/create .

## Limits and evaluation

Live search means a web tool runs for that request; a search engine can still return indexed or cached pages. The timestamp records this search, not the original article's publication date. Video and product results are optional and may be absent; the app does not invent them or guarantee stock, price, link longevity or that a video has been watched. Material matching and method summaries are AI interpretations, not physical build validation. Unknown electrical ratings and condition remain unknown.

Automated unit/API/browser fixtures verify request flow, attribution, validation, privacy, quotas and UI behavior; they are not participant data or live search accuracy results. Live smoke results, when run, are recorded separately under `docs/evidence/web-search/`.

Validation commands:

Local validation on 21 October 2026: lint, TypeScript and production build passed; 143 unit/API tests passed after the written-tutorial-first refinement. All 78 existing browser checks passed. The 12 new browser checks passed on desktop, tablet and mobile, including accessibility, downloads, selection changes, cancellation and honest error/empty states. An initial test expected `sheets` instead of the app's existing `sheet(s)` label; that assertion was corrected and the complete new browser suite rerun. These controlled-provider checks do not establish live search quality.

The initial live smoke request returned HTTP 200 in 33 seconds but used a compilation-video page as its sole source. This was judged insufficient as a written guide and triggered the separate written-tutorial and supplemental-resource searches above. The original response is retained in `docs/evidence/web-search/initial-live-smoke.json` as a developer observation requiring improvement, not participant data or a successful quality evaluation.

```sh
npm run lint
npm run typecheck
npm test
npm run build
REBUILD_E2E_PRODUCTION=1 REBUILD_E2E_PORT=3011 npx playwright test --reporter=list --output=/tmp/rebuild-web-tests
```

A second live request returned a written source but still matched A4 paper to a capillary-action activity and omitted requested resources. This was also treated as a quality failure (`second-live-smoke.json`). The search model was changed to `gpt-5-mini` with page inspection; primary tutorial IDs must now be actual citations in the primary report, not merely uncited search results. Material identities must be preserved. The app also constructs the result count from retained cards rather than trusting a generated count.
