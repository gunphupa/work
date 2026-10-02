# Evidence register

| Claim | Evidence | Scope |
| --- | --- | --- |
| Catalogue requirements trace to official Arduino documentation | `../evidence/sources.json` (revision, path, SHA-256) | Documentation review, not physical builds or web-link uptime |
| Quantities, specs and alternatives affect readiness | `../../tests/matching.test.ts`, current unit report | Synthetic software cases only |
| Secrets stay server-side and API validates expensive inputs | `../../server/`, API tests, production asset scan in test report | Automated boundary checks; no penetration-test claim |
| Local data and progress survive refresh | `../../e2e/journeys.spec.ts`, browser report and workspace screenshots | Automated Chromium sessions, not human participants |
| Interface works at selected widths | Desktop/tablet/mobile screenshots and browser checks | 1440, 768, 360px; no claim about all devices |
| Accessible markup/contrast at selected screens | Axe results in browser test run | Automated WCAG checks do not replace assistive-technology user testing |
| Real AI identifies images correctly | Pending secure key and preregistered labelled set | Unmeasured |
| Hardware projects operate physically | Pending recorded AVR compilation and builds | Unmeasured |
| Users plan faster / learn more | Pending adviser-reviewed human protocol and real observations | Unmeasured; no findings stated |
| ReBuild reduces real waste | Pending physical reuse records and appropriate comparison | Unmeasured |
| School report meets exact supplied templates | School PDFs not supplied | General outline only |
