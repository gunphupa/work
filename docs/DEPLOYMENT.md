# Deployment preparation

No deployment account or public hosting capability is connected to this session. No paid resource, subscription or billing change has been created. The code is ready to deploy to an existing Node 24 host or Docker-capable server; the public endpoint and real AI calls remain unverified.

## Existing Node host

1. Check out the desired release commit; run `npm ci`, `npm run lint`, `npm test`, `npm run build`.
2. Configure `PORT`, exact HTTPS `APP_ORIGIN`, and a durable `QUOTA_DB` location. Run one Node instance. Keep that database out of public directories and version control.
3. Start `npm start` under the host's process supervisor. Put HTTPS in front. Configure trusted proxy ranges correctly; enforce body/connection limits at ingress.
4. Health check `/api/health`, fetch `/`, exercise a static JS asset, then confirm inventory save/refresh/import and a project workflow in the browser. No key is needed for these checks.
5. To enable AI, enter `REBUILD_AI_KEY` in the host's secret settings and verify the account/model can use the Responses API. Set a provider-side budget. Run one small text request, one consented photo request and one project-help request. Check quota accounting and failure behavior. Do not describe the provider as live until these succeed.

## Container recipe

A multi-stage `Dockerfile` is supplied. It binds port 3000 and runs as the non-root `node` user. Mount durable storage at `/app/.data`; ensure the runtime user can write it. Inject secrets through your host, not image layers or build arguments. Do not publish a container with AI and ephemeral quota storage.

The recipe is deployment preparation; a Docker image build/run is not part of the recorded validation unless the test report says so. The host's package/artifact network access must preserve TLS and signature verification.

## Update and rollback

Export guest data in the app before changing its storage schema. For server state, stop the process and take a consistent SQLite backup including WAL state (or use SQLite's online backup mechanism). Deploy an exact Git SHA with its lockfile, rerun checks, then restart. Keep the prior build/SHA and compatible quota database backup. Roll back by checking out that SHA, reinstalling from its lockfile, rebuilding and restarting. Do not roll back the quota database to evade consumed usage.

The current guest schema is v1; future migrations must preserve unknown fields/data via explicit export and migration tests. Server container files are not durable user inventory storage.

Current environment note: Docker can pull its base image, but registry access from build/run containers timed out even with the existing proxy forwarded. The prepared recipe has not completed an image build here. Native Node production startup and browser validation succeeded. Do not disable certificate verification to work around container connectivity.
