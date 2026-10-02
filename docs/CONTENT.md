# Catalogue maintenance

The first 15 projects were reviewed from Arduino's official `arduino/docs-content` Git repository at commit `9d1bc1aa4ca4d56c716242acaaee290b9ed513bb`. Reference web domains were blocked by the current egress policy; the permitted Git HTTPS route supplied the actual Markdown. Each project points to that exact official source revision. `docs/evidence/sources.json` records repository paths and content hashes. This is content review through Git, **not** a claim that every public webpage/video/listing was HTTP-tested.

All Thai summaries, instructional prose and sketches were newly written for this application. Do not copy third-party illustrations or video content without reviewing the applicable license. Original source examples and authors remain credited through the source record. No external videos were watched or transcripts retrieved; there are no fabricated YouTube citations.

## Add a project

1. Inspect a permitted, credible tutorial. Record author, language, URL, exact revision/date, what was inspected, requirements and known differences. A reachable URL alone is insufficient.
2. Add canonical materials/aliases and relevant spec fields in `src/data/materials.ts`. Distinguish incompatible boards, cable types and power arrangements.
3. Add a complete project in `src/data/projects.json`. Include quantities, small consumables, all tools/programming equipment, critical specifications, explicit alternatives, Thai steps/checkpoints, learning objectives, wiring, test procedure and limitations. Use unique requirement IDs.
4. Review BOM, wiring and code together. Source conflicts must be resolved explicitly. Example: the Calibration source mentions both A2 and A0; this implementation consistently selects A0 according to the circuit text and records the discrepancy.
5. Add a full-inventory fixture plus missing, insufficient and incompatible cases. Add any new simultaneous-allocation edge cases.
6. Run lint, typecheck, tests and build. Only label physical testing after an actual build record with configuration and evidence exists. A compile is not a physical test.

Known deliberate changes: onboard LED variant for Blink/BlinkWithoutDelay; passive piezo only for toneMelody, not a directly driven low-impedance speaker; original four-note melody without pitches.h; 330 Ω as a lower-current alternative to 220 Ω for discrete visible LEDs; calibration division-by-zero guard. USB data cable, computer, IDE, breadboard and wiring counts are explicit even where the source assumes them.

Time/difficulty values are editorial estimates, not measured human completion times. Recheck sources before expanding coverage. Marketplace links are searches only, with no price/stock/seller claims. Compatibility is determined by actual part specifications, not search text.

## Additional NASA craft guide

The 16th project, Make a Straw Rocket, was reviewed directly on the NASA JPL Education page on 2 October 2026 after the network update took effect. The source record stores the retrieved HTML SHA-256. Read the materials and written steps; no claim is made about viewing its video. This build assumes an already printed NASA template sheet (the user gets it from the source), a clean personal straw, pencil, tape, scissors, and a metric measuring tool. No pressure device or fuel is used. The guide includes a clear launch area and never aiming toward people.

Direct HTTP checks of the 15 Arduino documentation routes also succeeded after the network update. These supplement the pinned Git content review; they do not replace it. See `evidence/source-http-checks.json`.

## Household-first expansion (2 October 2026)

The 21 entries in `src/data/household-projects.json` and their English counterparts are original ReBuild instructions, inspired by the user-supplied household-materials list. They are **not attributed to uninspected outside tutorials**. Their source card identifies ReBuild authorship and links to the maintained data. The collection spans organization (5), cleaning (3), simple repairs (3), packaging crafts (3), gardening (4), and school science (3). Together with the 16 retained guides there are 37 projects and 94 canonical material types.

Each household guide includes tools, consumables, target objects where needed, quantities/size guidance, checkpoints, a learning task and practical limits. Bottles for the wick planter require a matching cap and stated capacity; reservoir openings require fine insect mesh and regular inspection/cleaning. Reusable cloths are not disinfectants; storage sleeves are for disconnected cables; phone stands and fabric bags have no rated loads. Source review and editorial checks do not establish safe physical operation.

English copies preserve requirement IDs, choices, quantities and step ordering. Add or edit both languages together. Tests cover every full inventory and declared alternative, translation coverage and legacy backup compatibility. Never reorder existing steps casually: completed-step indexes live in existing backups.

The NASA page contains `https://youtu.be/aTd2f59TSVo` and an embed of the same video. The app offers that direct link with a note that its full content was not viewed. `evidence/tutorial-links.json` records the observed page references and HTML hash. Other guides offer tailored Thai/English YouTube **searches**, not invented video URLs or purportedly reviewed recommendations. External video pages/playback could not be checked through this environment’s network access. No external video iframe loads automatically.

The material catalogue deliberately distinguishes the ability to save an item from having a matching guide. Unused motors, unknown salvaged parts and other objects can be recorded, but this does not approve a substitution or generate a new build guide.


## Detailed guide reference and step visuals

The user supplied screenshots and pasted text of “Build Your Own Automatic Watch Winder With Arduino Nano” by Mohammed Nihal on Instructables. They were inspected as a reference for presentation: introductory explanation, supplies, numbered illustrated actions, final tests, downloads and discussion. The watch-winder article's photographs, author profile, counts, code and files were not imported into ReBuild, and that watch-winder project was not added to the catalogue.

`guide-details.ts` supplies original bilingual explanatory copy for the 21 household projects and the NASA rocket. Electronics introductions connect each project's existing description and test to its UNO R3 workflow. `StepVisual.tsx` renders 81 step-specific household/science concept diagrams and 60 electronics visual summaries based on the existing material, wiring and test data. They are labelled diagrams, not photographs, scale drawings or evidence of physical validation. Existing step ordering and backups are preserved. Per-step video playback is not claimed; existing tutorial links retain their original source/search labels.
