# Implementation status

Updated 3 October 2026 for durable community posting limits and research preparation.

| Capability | Current behavior | Limits |
| --- | --- | --- |
| Project-first browsing | Home → useful categories → illustrated guides; 12 results at a time | Editorial catalogue, not open-ended generated instructions |
| Thai and English | Navigation, inventory forms, all 37 guides, material lists, notes UI, provider language preference | User-entered text is preserved as written; external sources/videos keep their original language |
| Household inventory | 94 types, searchable names/aliases, custom items, editing, bulk parsing, relevant specs | Some collected objects have no guide; shown explicitly |
| Practical projects | 21 new original guides: organization 5, cleaning 3, repair 3, crafts 3, gardening 4, science 3 | Not physically build-tested; use written fit/safety checks |
| Existing projects | 15 Arduino and 1 NASA guide retained with English versions | No AVR compilation or physical test |
| Reading and progress | Every step and checkbox is available with an empty, incomplete, uncertain or incompatible inventory | Checked steps are notes, not test certification |
| Matching | Quantities, condition, critical specs, explicit alternatives and allocation without double counting | No structural analysis, automatic dimension fitting or fractional-material optimization |
| Tutorials | NASA video observed in its official page; project-specific Thai/English YouTube searches | No reviewed YouTube library, transcript analysis, playback verification or live search provider |
| Shopping | Optional, labelled Shopee/Lazada searches under individual materials | No inspected listings, prices, stock or seller recommendation |
| Guest data | Browser-local inventory, progress, notes, substitutions, measurements, export/import; old v1 backups preserved | No cloud sync or stock reservation across builds; optional account identity does not migrate local data |
| Community and reviews | Account-bound comments/photos; separate project and website ratings; all submissions pending until moderator approval; author status/deletion and admin approve/reject/unpublish | User reported approval and deletion working. Photo privacy and restart persistence still require the live checklist; posting caps now use Supabase. |
| Accounts | Google and passwordless email link sign-in via Supabase PKCE; verified user checks on the server; moderator table independent of profile metadata | User reported Google and two email addresses working; larger email delivery limits remain unverified. Inventory remains browser-local. |
| Guide detail | Fuller bilingual introductions, grouped supplies, final tests/reflection; 81 household/science step diagrams and 60 electronics visual summaries | Original concept diagrams rather than photos; no new step video library or physical testing |
| AI | Server-side adapter and fixture-verified text/photo/help flows | Real credential absent here; live inference and accuracy unmeasured |
| Software verification | See TEST_REPORT.md and current machine-readable reports | Automated software results, not human or physical studies |
| Public hosting | Existing Node/Render deployment instructions still apply | User screenshots show work-c3to.onrender.com Live on the previous release. Quota fix pushed to main; hosted probe blocked by environment proxy. |

Readiness and environment configuration are separate from publication. The development workflow runs without an AI key. Live public AI still needs a valid host secret, exact APP_ORIGIN, durable QUOTA_DB and one Node instance.
