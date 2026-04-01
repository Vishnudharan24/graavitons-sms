## Plan: Student Marks Analytics Inventory

Create a complete, marks-focused analytics inventory by mapping database fields to feasible metrics and comparing them against already implemented APIs. This will produce a clear list of individual, subject, test, batch, trend, ranking, and statistical analyses, plus schema/data caveats that affect accuracy (for example non-numeric mark handling and schema drift), so you can prioritize what to build next.

### Steps
1. Extract marks-related entities from [database/db_schema.txt](database/db_schema.txt) and [database/create_tables.py](database/create_tables.py) using table/column mapping.
2. Cross-check casting and numeric safety logic in [database/migrate_marks_to_varchar.py](database/migrate_marks_to_varchar.py) and `safe_numeric`.
3. Map existing analytics implemented in [backend/api/analysis.py](backend/api/analysis.py), especially `get_individual_analysis()`, `get_batch_performance()`, `get_subjectwise_analysis()`, and `get_branchwise_analysis()`.
4. Classify feasible analytics into individual, subject, test, batch, time-series, comparative, and distribution categories with formulas and required fields.
5. Produce a gap report: implemented vs feasible, plus schema limitations and normalization risks affecting marks analytics quality.

### Further Considerations
1. Prioritize output format: product-facing metric catalog
2. Choose weighting policy for composite scores: equal tests, total-marks weighted.
3. Draft for review:focus only on daily/mock marks, 
