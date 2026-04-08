## Plan: Per-test remediation insight cards

Redesign the student remediation experience into image-style, per-test insight cards with two sections: Achievements and Red Flags. The plan reuses existing metrics/weak-topic data first, then adds a dedicated per-test insights API so both on-screen view and PDF page 3 share the same structured output and visual language.

### Steps
1. Define insight taxonomy from image patterns in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js): `consistent_growth`, `score_jump`, `top_in_topic`, `efficient_scorer`, `near_complete`, `least_attempted`, `score_drop`, `rank_drop`, `high_effort_low_return`, `solo_solver`.
2. Add a new per-test insights endpoint in [backend/api/analysis.py](backend/api/analysis.py) near `get_student_weak_topics()` to return ordered tests with `achievements[]` and `red_flags[]`.
3. Derive initial insight rules from existing fields in `get_individual_analysis()` and `get_student_metrics()` at [backend/api/analysis.py](backend/api/analysis.py), including score deltas, class delta, attempts, weak units, and attendance flags (`A`/`a`/`ab`).
4. Replace current aggregated remediation rendering with per-test card columns in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js) for the marks tab and PDF page 3 (`reportExportRef` section).
5. Introduce compact card UI styles (green/red chips, icon+title+metric rows, horizontal test lanes) in [frontend/src/components/StudentProfile.css](frontend/src/components/StudentProfile.css), matching the screenshot’s typography scale and spacing.
6. Remove dead remediation-only table paths once per-test cards are live in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js), keeping one shared renderer for both web and PDF.

### Further Considerations and anwers
1. Draft for review: should insights be generated for both daily and mock tests together, or separate lanes? separate tabs 
2. Rank-based insights need explicit rank data not currently exposed in [backend/api/analysis.py](backend/api/analysis.py); should we defer `rank_drop` until rank computation is added? no
3. Card density for PDF page 3: Option A latest 6 tests full detail but compact, the report should not exceed 3 pages
