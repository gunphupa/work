# Evidence register

| Claim | Evidence | Scope |
| --- | --- | --- |
| The 15 Arduino guides trace to official documentation | `../evidence/sources.json` (revision, path, SHA-256) | Documentation review, not physical builds or web-link uptime |
| Household guide authorship and video-link provenance | `../CONTENT.md`, `../evidence/tutorial-links.json`, bilingual guide data | 21 original guides; no physical validation; video URL observed, not full video review |
| Quantities, specs and alternatives affect readiness | `../../tests/matching.test.ts`, current unit report | Synthetic software cases only |
| Secrets stay server-side and API validates expensive inputs | `../../server/`, API tests, production asset scan in test report | Automated boundary checks; no penetration-test claim |
| Local data and progress survive refresh | `../../e2e/journeys.spec.ts`, browser report and workspace screenshots | Automated Chromium sessions, not human participants |
| Interface works at selected widths | Desktop/tablet/mobile screenshots and browser checks | 1440, 768, 360px; no claim about all devices |
| Accessible markup/contrast at selected screens | Axe results in browser test run | Automated WCAG checks do not replace assistive-technology user testing |
| Real AI identifies images correctly | Pending secure key and preregistered labelled set | Unmeasured |
| Hardware projects operate physically | Pending recorded AVR compilation and builds | Unmeasured |
| Users plan faster / learn more | Pending adviser-reviewed human protocol and real observations | Unmeasured; no findings stated |
| ReBuild reduces real waste | Pending physical reuse records and appropriate comparison | Unmeasured |
| School report draft | User-supplied five-chapter DOCX and earlier draft output | Draft prepared; no school approval or human results claimed |
| Durable daily community quotas | `../../tests/posting-limits.test.ts`, current unit report; user screenshot of migration success | Local disk reopen and limits tested; live Render restart test remains pending |
| Google/email and moderation on hosted app | User reports and screenshots, 3 October 2026 | Selected manual observations; not automated delivery/performance verification |
