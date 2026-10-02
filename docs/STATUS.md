# Implementation status

Updated 2 October 2026. This release supports a complete manual Arduino planning/build-record workflow. The broader master brief is not fully complete.

| Capability | Status | Limits / next dependency |
| --- | --- | --- |
| Thai responsive UI, guest start, local inventory | Implemented and browser-verified | Browser-specific, no cloud sync |
| Manual/bulk entry, aliases, relevant specs, edits, deletion | Implemented and tested | Parser is deterministic; unknown text stays unknown |
| Quantity-aware compatibility, explicit alternatives, no double allocation | Implemented and domain-tested | Whole piece/unit counts; no fractional length/material optimisation |
| Filters and target-project search | Implemented and tested | Searches reviewed catalogue; no open-ended sourced discovery |
| Sixteen source-backed projects | Documentation-reviewed | 15 Arduino UNO R3 guides plus a NASA paper-rocket guide; no physical tests or AVR compilation |
| Further craft, motor, salvaged-part projects | Deferred content expansion | Sources and complete requirements need review; objects can be saved now |
| Text/photo AI adapter and confirmation UI | Implemented; real service blocked | Missing server credential; image recognition accuracy unmeasured |
| AI troubleshooting using project/current step | Implemented; real service blocked | No live credentials; never auto-approves substitutions |
| Live web/video/product retrieval | Deferred | Catalogue source fallback implemented; no search provider wired |
| Tutorial metadata, Thai summaries, wiring, original Arduino sketches | Implemented | Reference revision inspected through Git; no videos claimed |
| Thai missing-parts assistance | Implemented as labelled marketplace searches | No inspected products, prices, shipping or stock claims |
| Steps, notes, substitution records, measurements, export/import | Implemented and browser-tested | Result photos and automatic cross-project stock reservations deferred |
| Upload/server security, sessions and persistent quotas | Implemented and fixture-tested | Needs real deployment verification, provider billing limits and durable volume |
| Research plan, Thai worksheets, raw templates, evidence register | Prepared | School PDFs not supplied; human/physical/image studies pending |
| Production build and serving | Locally validated; see test report | No public host is connected; deployment not published |

Next work after secure AI configuration: perform controlled live text/photo/help tests; evaluate labelled photos with a preregistered dataset; inspect any real source-retrieval service before implementing it. Add craft/motor projects through the documented review process. Compile sketches for `arduino:avr:uno` and physically test with recorded parts before making stronger claims.
