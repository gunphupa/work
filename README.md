# ReBuild — ของเดิม ไอเดียใหม่

Thai-first guest application for turning confirmed inventory into small engineering projects. Built in `gunphupa/work`. This is a working first release, **not a claim that every integration or physical build has been validated**.

## What you can use

- Thai/English inventory entry, bulk parsing, editing, relevant specification questions, tools, explicit duplicate merging, JSON backup/import and local persistence.
- Sixteen source-backed projects (15 Arduino UNO R3 and one NASA paper rocket), deterministic quantity/specification checks, filters, complete requirements, original sketches and wiring references.
- Missing-parts search links to Thai marketplaces, clearly distinguished from inspected listings. No invented prices.
- Saved build steps, notes, substitution records and measurements entered by the user.
- Accessible responsive interface, Thai fonts served locally, supported-materials catalogue and Thai privacy/usage guide.
- Server-side OpenAI adapter for text, photos and project questions, with validated outputs, upload validation, session/CSRF checks and persistent quotas. **Live AI has not been tested: a service key is not present.** The application never asks ordinary users for API keys.

No public deployment has been created. Screenshots and test evidence are in [`docs/evidence`](docs/evidence). See [`docs/STATUS.md`](docs/STATUS.md) for exact coverage and unfinished scope.

## Run it

Use Node.js 24 (tested with 24.19.0). Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

The application listens on port 3000. In a normal local development environment, open the address printed by your hosting/forwarding environment for that port. Codex onboarding itself does not expose a public website preview.

For a production build:

```sh
npm run build
npm start
```

The Node server serves the UI and API together. React hash routing supports refresh/back navigation without additional route rules. Do not deploy only `dist/client` if you need AI; the API requires the Node server.

## AI configuration — optional for manual use

Use your host's **secret settings**, not chat or source control, to set `REBUILD_AI_KEY`. In this Codex environment the requirement has been registered in environment settings with destination `api.openai.com`. A ChatGPT subscription does not supply API credit.

For local development only, copy `.env.example` to `.env`, then enter values locally. Never commit `.env`. Variables are read only by the server; none use a `VITE_` prefix.

| Variable | Meaning |
| --- | --- |
| `REBUILD_AI_KEY` | OpenAI service credential; empty means AI is unavailable |
| `REBUILD_AI_MODEL` | Default `gpt-4.1-mini`, a multimodal model listed by the official SDK; actual account availability needs verification |
| `APP_ORIGIN` | Exact public origin, including scheme, with no trailing slash |
| `QUOTA_DB` | SQLite path on a durable writable volume, e.g. `/app/.data/quota.sqlite` |
| `AI_GLOBAL_DAILY` | Global request reservations per UTC day, default 50 |
| `AI_GUEST_DAILY` | Guest session daily reservations, default 10 |
| `AI_IP_DAILY` | Hashed client-IP daily reservations, default 15 |
| `TRUST_PROXY` | Leave blank unless your host's proxy addresses are known and cannot be bypassed |
| `PORT` | Default 3000 |

Production with AI requires explicit `APP_ORIGIN` and `QUOTA_DB`. A configured key is **not** proof of a successful provider call. Recheck `/api/health`, then run a small controlled text and photo request with consent after securely supplying a real credential. Validate candidate output, edit it, and confirm it in the inventory.

Provider settings can incur charges. The application creates no paid resources. A persistent volume is necessary for public quotas; do not enable live AI on ephemeral/serverless storage. Keep one Node process per database. See [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md).

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use system Chromium when present, or Playwright's installed Chromium otherwise. On a developer machine: `npx playwright install chromium`. Set `CHROMIUM_PATH` only to override the browser executable. Tests run at 360px, 768px and 1440px. They use separate synthetic fixtures, never real measurements or human participants.

See [test report](docs/TEST_REPORT.md) for actual outcomes and unrun checks. Tests of the provider adapter use fixtures; they do not establish real image recognition accuracy.

## Project structure

- `src/data/`: versioned materials, reviewed catalogue, source metadata.
- `src/domain/`: schemas, import/export, parsing, maximum-flow matching, image preparation.
- `src/components/`, `src/App.tsx`: Thai interface and guest workflows.
- `server/`: Express API, OpenAI adapter, decoded upload validation, SQLite quota accounting.
- `tests/`, `e2e/`: domain, API, persistence, security, browser and accessibility checks.
- `docs/research/`: proposed school study, Thai task sheets and empty raw-data forms.

[Architecture and matching rules](docs/ARCHITECTURE.md) · [Adding projects and source maintenance](docs/CONTENT.md) · [Implementation status](docs/STATUS.md)

## Data and limitations

Guest inventory and builds stay in this browser's localStorage. Export JSON before clearing browser data or moving devices. A corrupt saved record is preserved rather than overwritten. Photos are transient and not saved server-side. AI requests send the chosen text/photos, inventory and project context to OpenAI; provider retention terms must be checked separately.

The reviewed project collection is currently **Arduino-focused**. A source-reviewed NASA paper-rocket guide is included. Containers and unknown objects can be recorded, but additional crafts, motors and salvaged-component guides are pending. Source review is not physical testing. No school PDFs, human study observations or hardware test evidence were provided.
