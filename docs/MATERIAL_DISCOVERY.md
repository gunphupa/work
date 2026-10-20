# Material discovery — 20 October 2026

This update implements the four agreed improvements against main `5fca215`. It does not add live internet project search or claim that photo recognition has been measured with real participants.

## User flows

1. **Search materials:** My materials now has its own Thai/English name/alias search, including custom names, notes and specification values. The existing add-item picker remains searchable. Nails, glue sticks and double-sided tape are explicit types; unlisted materials can still be saved.
2. **Substitutes:** Open a guide's Materials section and expand “Missing this? See possible substitutes.” Owned candidates appear first with usage conditions. The paper-bonding helper in My materials and household guides covers glue stick, craft glue, tape and double-sided tape for dry, lightweight paper work. Rules are authored contextual guidance, not live AI research or universal substitution approval. Electrical alternatives are limited to choices already present in the guide.
3. **Identify and discover:** Use a photo or the device camera; consent before submitting to AI. Review/edit the name, quantity and matching type. Existing catalogue projects appear with missing items and named specification checks, even if nothing is ready. Guide links open in another tab, retaining unsaved candidates. Unknown or uncovered objects get an honest “no catalogue guide” result. Saved inventory items also have “Find projects for this item.”
4. **Custom items:** “Add a custom item” needs only a name and positive whole-number quantity. Condition starts unknown for custom items; specifications/notes/dimensions/photo are optional. A local attachment is resized to a small WebP, kept only in the browser/backup and excluded from AI payloads on both client and server.

## Data and regression protection

- Version 1 backups remain supported. The optional photo field does not affect older records.
- Storage bounds and exported backups use the same UTF-8 JSON byte measurement (2 MB). Failed saves are displayed inside the active editor.
- Open tabs listen for saved inventory/build changes. This handles the guide-popup workflow; browser-local storage is not a multi-device cloud database or transactional concurrent editor.
- Starting analysis clears prior results and disables changes to the submitted inputs until it completes/cancels, avoiding mismatched photo/results.
- AI candidates remain unverified. Catalogue labels never establish cleanliness, model, condition, ratings or quantity across duplicate photos.
- UI requests and server validation both exclude stored item photos; only explicitly consented analysis images are sent to OpenAI.

## Validation

Commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
REBUILD_E2E_PRODUCTION=1 REBUILD_E2E_PORT=3011 npx playwright test --reporter=list
```

Unit/API tests cover alias search, custom backup round-trips and limits, provider-output sanitization, image payload consent, catalogue matching with missing/spec-unknown supplies, and owned-first conditional substitutions. Browser tests cover desktop (1440 px), tablet (768 px), and mobile (360 px), including unchanged account/moderation flows, new material workflows, popup-tab persistence, and automated accessibility.

Photo tests use synthetic images and controlled provider responses. They establish request handling and UI behavior, **not real model identification accuracy**. No live key is available in this development environment. The user previously confirmed one live text-to-inventory request on the earlier deployed version; that is separate evidence.

Final validation on 20 October 2026: lint and TypeScript/build passed; **125 unit/API tests passed** across eight files; **78 production-browser checks passed** across three viewports, including automated accessibility. The original 99 unit tests were also run successfully before editing. An intermediate browser run caught a manual-item default regression, which was fixed before the final full run.

Screenshots below use synthetic inventory/photo-response fixtures and are UI evidence, not research participant outcomes:

- [Owned inventory search](evidence/material-discovery/owned-search-desktop.png)
- [Custom item editor on mobile](evidence/material-discovery/custom-editor-mobile.png)
- [Photo-to-project suggestions on mobile](evidence/material-discovery/photo-projects-mobile.png)
- [Owned-first paper substitutions](evidence/material-discovery/substitutions-desktop.png)

## Release and research pilot

No new dependencies, database migration, paid service or environment variables are required. Retain the existing Render AI key, origin, daily limits and persistent `QUOTA_DB`.

After deploying this branch, use one known object photo and one genuinely unknown object photo with consent. Check the returned identity against the actual object/label, edit a wrong type, inspect missing supplies and open a guide. Record these as pilot observations with actual outcomes and timestamps. Do not count browser fixtures as participant data or live accuracy results.

Development environment installation/start instructions were saved as an environment configuration draft. To retain that setup for later sessions, review/save it in Environment settings and publish the environment. This is separate from deploying ReBuild on Render.
