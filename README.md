# ReBuild — ของเดิม ประโยชน์ใหม่

A Thai/English, project-first app for useful household making and everyday learning. Browse a guide before adding materials; every instruction and progress checkbox stays open even when an inventory is incomplete.

## What you can use

- **37 complete guides** across home organization, cleaning, repairs, packaging crafts, gardening, school science and electronics: 21 original household guides, 15 Arduino UNO R3 examples and one NASA paper rocket.
- **94 material types**, Thai/English search and aliases, a custom-item option, editable bulk suggestions, relevant specifications and browser-local inventory.
- Large original project illustrations, three main navigation choices, a persistent language switch, category filters, search by project or material, and 12 cards at a time.
- Fuller project introductions, grouped supplies, 81 original household/science step diagrams and 60 electronics preparation/connection/upload/measurement panels. The reader keeps Next/Previous, all-steps viewing, checks, and optional build notes. Diagrams are not build photographs or to-scale templates.
- Optional Google and passwordless email accounts via Supabase, build photos/comments, separate project and website reviews, an author status page, and an admin approval queue. Every submission starts private and pending. **Live account activation is still required:** follow [Accounts setup](docs/ACCOUNTS_SETUP.md).
- Project-specific YouTube searches and the video linked from NASA’s written rocket guide. Search results are clearly labelled; they are not reviewed video recommendations.
- Existing version 1 inventory/build backups remain compatible. Export before clearing browser storage or changing devices.
- Optional server-side OpenAI text/photo/help integration, with user review, upload validation, same-origin/CSRF checks and persistent quotas. Live AI is not verified in this development environment because no service key is present.

The original household guides and illustrations are authored for ReBuild; they are not externally certified or physically build-tested. Arduino/NASA documentation review is also not physical testing. See [implementation status](docs/STATUS.md), [content provenance](docs/CONTENT.md) and [test results](docs/TEST_REPORT.md).

Screenshots are in [docs/evidence](docs/evidence). A public Render deployment must be checked at its actual service URL; local software checks do not establish that a hosted deployment has completed.

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

The Node server serves the UI and API together. React hash routing supports refresh/back navigation without additional route rules. Do not deploy only `dist/client` if you need AI or community accounts; the API requires the Node server.

## AI configuration — optional for manual use

Use your host's **secret settings**, not chat or source control, to set `REBUILD_AI_KEY`. In this Codex environment the requirement has been registered in environment settings with destination `api.openai.com`. A ChatGPT subscription does not supply API credit.

For local development only, copy `.env.example` to `.env`, then enter values locally. Never commit `.env`. Variables are read only by the server; none use a `VITE_` prefix.

| Variable | Meaning |
| --- | --- |
| `REBUILD_AI_KEY` | OpenAI service credential; empty means AI is unavailable |
| `REBUILD_AI_MODEL` | Default `gpt-4.1-mini`, a multimodal model listed by the official SDK; actual account availability needs verification |
| `APP_ORIGIN` | Exact public origin, including scheme, with no trailing slash |
| `QUOTA_DB` | SQLite path; `/tmp/rebuild-quota.sqlite` for community-only hosting, durable volume required for public AI |
| `AI_GLOBAL_DAILY` | Global request reservations per UTC day, default 50 |
| `AI_GUEST_DAILY` | Guest session daily reservations, default 10 |
| `AI_IP_DAILY` | Hashed client-IP daily reservations, default 15 |
| `TRUST_PROXY` | Leave blank unless your host's proxy addresses are known and cannot be bypassed |
| `PORT` | Default 3000 |

Production with AI requires explicit `APP_ORIGIN` and `QUOTA_DB`. A configured key is **not** proof of a successful provider call. Recheck `/api/health`, then run a small controlled text and photo request with consent after securely supplying a real credential. Validate candidate output, edit it, and confirm it in the inventory.

Provider settings can incur charges. The application creates no paid resources. A persistent volume is necessary for public AI quotas; do not enable live AI on ephemeral/serverless storage. Keep one Node process per database. See [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md).

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
REBUILD_E2E_PRODUCTION=1 REBUILD_E2E_PORT=3001 npm run test:e2e
```

Browser tests use system Chromium when present, or Playwright's installed Chromium otherwise. On a developer machine: `npx playwright install chromium`. Set `CHROMIUM_PATH` only to override the browser executable. Tests run at 360px, 768px and 1440px. They use separate synthetic fixtures, never real measurements or human participants.

See [test report](docs/TEST_REPORT.md) for actual outcomes and unrun checks. Tests of the provider adapter use fixtures; they do not establish real image recognition accuracy.

## Project structure

- `src/data/`: versioned materials, reviewed catalogue, source metadata.
- `src/domain/`: schemas, import/export, parsing, maximum-flow matching, image preparation.
- `src/components/`, `src/App.tsx`, `src/i18n.tsx`: bilingual interface and guest workflows.
- `server/`: Express API, OpenAI adapter, decoded upload validation, SQLite quota accounting.
- `tests/`, `e2e/`: domain, API, persistence, security, browser and accessibility checks.
- `docs/research/`: proposed school study, Thai task sheets and empty raw-data forms.

[Architecture and matching rules](docs/ARCHITECTURE.md) · [Adding projects and source maintenance](docs/CONTENT.md) · [Implementation status](docs/STATUS.md)

## Data and limitations

Guest inventory and builds stay in this browser's localStorage. Export JSON before clearing browser data or moving devices. A corrupt saved record is preserved rather than overwritten. Photos are transient and not saved server-side. AI requests send the chosen text/photos, inventory and project context to OpenAI; provider retention terms must be checked separately.

The catalogue includes original practical household guides as well as source-reviewed Arduino/NASA examples. Motor-driving, mains repairs and arbitrary salvaged-electronics projects are not included. A saved material type does not imply a matching guide exists; the materials page shows actual coverage. No school PDFs, human study observations or physical build evidence were provided.
