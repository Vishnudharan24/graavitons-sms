## Plan: Student report chart redesign + API performance

Restructure the current student progress PDF into a strict 3-page format: 5 charts across pages 1–2, and attendance/remediation on page 3. In parallel, refactor report data fetching to reduce latency by consolidating calls, parallelizing unavoidable requests, and optimizing backend query/index strategy for student, marks, attendance, and class-stat aggregates.

### Steps
1. Audit and map current report sections/charts in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js) to identify all chart blocks to remove.
2. Redefine report pagination/layout in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js) and [frontend/src/components/StudentProfile.css](frontend/src/components/StudentProfile.css) for exactly 3 pages and fixed chart placement.
3. Implement chart set for pages 1–2 in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js):  
   - Daily subject comparison (line)  
   - Mock total vs class high/avg/low (line)  
   - 3 subject-wise mock charts: student vs class high/avg/low.
4. Move test attendance and remediation-only content to page 3 in [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js), removing all extra visualizations.
5. Optimize frontend data strategy in [frontend/src/utils/api.js](frontend/src/utils/api.js) and [frontend/src/components/StudentProfile.js](frontend/src/components/StudentProfile.js): parallel requests, payload trimming, and single report-view model assembly.
6. Optimize backend report APIs in [backend/api/student.py](backend/api/student.py), [backend/db_pool.py](backend/db_pool.py), and schema scripts [database/create_tables.py](database/create_tables.py) / [database/db_schema.txt](database/db_schema.txt): remove N+1 query patterns, compute class high/avg/low in grouped SQL, and add indexes for marks/attendance/test filters.

### Further Considerations and answers
1. Draft for review: should mock “3 subjects” be fixed (Physics/Chemistry/Maths) or batch-config driven from backend? Option B batch-config
2. Should class “Low” be true aggregate from SQL only (recommended)? only be true aggregate from SQL only.
3. API speed strategy preference: Option B keep endpoints but parallelize + cache
