# Reproducible measurement plan

## Software checks actually executable now

Lock dependency versions and record Git revision/Node/browser. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. The domain suite includes all 37 complete BOMs, translations, and supported alternatives and deliberately incomplete/unknown/incompatible cases. API tests use separate synthetic providers and pixels. Browser runs are automated software sessions, not human participants. Failed/skipped outcomes must remain distinguishable in stored reports. See the current technical report for actual counts.

## Future image evaluation — preregister before collecting results

Scoring unit: one independently labelled object instance per image, with separate critical-spec fields. Record supported category, image ID (not personal identity), readable label condition, lighting/occlusion, ground-truth source and reviewers. Select the fixed test set and count with the adviser before running. Include unsupported objects, multiple-object photos, duplicate views and genuinely unreadable labels. Keep training/development examples out of held-out evaluation.

Denominator for identity accuracy: all labelled target instances, including invalid output/timeouts as failures. Report “unknown” separately and as not-correct for identity accuracy; appropriate abstention on an unreadable critical spec is a separate measure. Critical-spec precision denominator: all non-unknown asserted specs. Record false confident claims distinctly. Never drop failed requests or report a calibrated confidence percentage from model wording.

## Matching / missing-parts assessment

Scoring unit: one project–inventory requirement and one aggregate readiness decision. Freeze inventory cases and project source revision. Two independent reviewers resolve expected answers before model/system evaluation. Report exact counts TP/FP/FN by missing/short/unknown/incompatible/satisfied, plus false-ready count. Whole-project completeness and per-requirement accuracy have different denominators.

## Tutorial relevance and availability

Scoring unit: one linked source/project pair. Predefine a rubric: same target board, parts and circuit; sufficiently complete steps; accessible language/summary; explicit differences. Inspect the actual content, not just HTTP success or a video title. Record inaccessible content separately. For HTTP availability, denominator is all attempted source links at the recorded time; blocked egress is not “source unavailable on the Internet.”

## Latency

Measure monotonic elapsed time from accepted submission to validated response, with model, input type/size, timeout cap and network context recorded. Include failure count and elapsed failures; report median and p95 only for an adequate predeclared sample, never from a single successful call. Provider inference latency has not been measured in this release.

## Physical build

Record actual board, component values, cable, power source, wiring photo (with consent), compiled sketch hash/toolchain, observer, procedure and measured outputs with units. Compilation alone does not establish physical operation. Stop and inspect unexpected heat or behaviour. No physical builds were performed by this software session.
