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
