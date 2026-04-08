from fastapi import FastAPI, HTTPException, status, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2 import sql
from datetime import date, datetime
from collections import defaultdict
import math
from config import CORS_ORIGINS, APP_TITLE
from api.middleware import get_current_user
from db_pool import get_db_connection

app = FastAPI(title=APP_TITLE)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Helper: SQL expression to safely cast VARCHAR marks to numeric, returning NULL for non-numeric values
# Use this in AVG/MAX/MIN/SUM aggregations on mark columns
def safe_numeric_cast(column):
    """Return a SQL CASE expression that casts a VARCHAR mark column to NUMERIC, or NULL if non-numeric."""
    return f"CASE WHEN {column} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN {column}::NUMERIC ELSE NULL END"


# Helper: Python function to safely parse a mark value
def safe_parse_mark(value):
    """Parse a mark value to a number, returning None for non-numeric values like 'A', '-'."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    val = str(value).strip()
    if val == '':
        return None
    try:
        return int(val)
    except ValueError:
        try:
            return float(val)
        except ValueError:
            return None


def is_absent_mark(value) -> bool:
    """Treat A/a/ab as absent marks."""
    if value is None:
        return False
    normalized = str(value).strip().lower()
    return normalized in {"a", "ab"}


def to_pct_or_raw(mark_value, total_value):
    """Convert mark to percentage when total is available, else return raw numeric mark."""
    mark_num = safe_parse_mark(mark_value)
    total_num = safe_parse_mark(total_value)
    if mark_num is None:
        return None
    if total_num is not None and total_num > 0:
        return round((float(mark_num) * 100.0) / float(total_num), 2)
    return float(mark_num)


def compute_slope(points: List[dict]) -> float:
    """Compute simple linear-regression slope from ordered points [{'date': ..., 'score': ...}]."""
    if not points:
        return 0.0
    valid = [p for p in points if p.get("score") is not None]
    if len(valid) < 2:
        return 0.0
    # Order by date if parsable, else keep insertion order
    def _d(v):
        try:
            return datetime.fromisoformat(v["date"]) if isinstance(v.get("date"), str) else datetime.min
        except Exception:
            return datetime.min
    valid = sorted(valid, key=_d)
    xs = list(range(len(valid)))
    ys = [float(v["score"]) for v in valid]
    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    return round(numerator / denominator, 3)


def compute_stddev(values: List[float]) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return round(math.sqrt(variance), 2)


def percentile(sorted_values: List[float], p: float) -> float:
    """Inclusive percentile with linear interpolation; p in [0, 100]."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    k = (len(sorted_values) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(sorted_values[int(k)])
    d0 = sorted_values[f] * (c - k)
    d1 = sorted_values[c] * (k - f)
    return float(d0 + d1)


def compute_risk_score(avg_score: float, slope: float, participation_rate: float, non_numeric_rate: float):
    score = 0
    reasons = []

    if avg_score < 40:
        score += 40
        reasons.append("Low average score")
    elif avg_score < 50:
        score += 25
        reasons.append("Average score below expected")
    elif avg_score < 60:
        score += 10

    if slope <= -4:
        score += 30
        reasons.append("Strong downward trend")
    elif slope <= -2:
        score += 20
        reasons.append("Declining performance trend")
    elif slope < 0:
        score += 10

    if participation_rate < 50:
        score += 20
        reasons.append("Low test participation")
    elif participation_rate < 70:
        score += 10

    if non_numeric_rate >= 30:
        score += 15
        reasons.append("High absent/non-numeric marks")
    elif non_numeric_rate >= 15:
        score += 8

    score = min(100, round(score, 1))
    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"

    recommended_action = {
        "high": "Immediate intervention: meet student/parent and set weekly remediation plan.",
        "medium": "Track weekly and assign targeted subject practice.",
        "low": "Continue regular monitoring and periodic feedback."
    }[level]

    return score, level, reasons, recommended_action


SUBJECT_CANONICAL = {
    "maths": "Mathematics",
    "mathematics": "Mathematics",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
}

MOCK_SUBJECT_CONFIG = {
    "maths": {"aliases": {"maths", "mathematics"}},
    "physics": {"aliases": {"physics"}},
    "chemistry": {"aliases": {"chemistry"}},
    "biology": {"aliases": {"biology"}},
}


def get_batch_mock_subjects(batch_subjects):
    if not batch_subjects:
        return ["maths", "physics", "chemistry", "biology"]

    selected = []
    lowered = {str(s).strip().lower() for s in batch_subjects if str(s).strip()}
    for key in ["maths", "physics", "chemistry", "biology"]:
        aliases = MOCK_SUBJECT_CONFIG[key]["aliases"]
        if lowered.intersection(aliases):
            selected.append(key)

    return selected if selected else ["maths", "physics", "chemistry", "biology"]


def normalize_subject_label(value: str) -> str:
    key = str(value or "").strip().lower()
    if not key:
        return ""
    if key in SUBJECT_CANONICAL:
        return SUBJECT_CANONICAL[key]
    return " ".join(part.capitalize() for part in key.split())


def normalize_subject_key(value: str) -> str:
    label = normalize_subject_label(value)
    return label.strip().lower()


def normalized_subject_sql(column: str) -> str:
    return f"CASE WHEN LOWER(TRIM({column})) IN ('maths', 'mathematics') THEN 'mathematics' ELSE LOWER(TRIM({column})) END"



# ==================== FILTER OPTIONS ENDPOINTS ====================

@app.get("/api/analysis/filter-options")
async def get_filter_options(current_user: dict = Depends(get_current_user)):
    """
    Get all available filter options (grades, batches, subjects, branches, courses)
    from actual database data
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get distinct grades
        cursor.execute("SELECT DISTINCT grade FROM student WHERE grade IS NOT NULL ORDER BY grade")
        grades = [row[0] for row in cursor.fetchall()]

        # Get batches with details
        cursor.execute("""
            SELECT batch_id, batch_name, start_year, end_year, type, subjects
            FROM batch ORDER BY created_at DESC
        """)
        batches = []
        for row in cursor.fetchall():
            batches.append({
                "batch_id": row[0],
                "batch_name": row[1],
                "start_year": row[2],
                "end_year": row[3],
                "type": row[4],
                "subjects": row[5] if row[5] else []
            })

        # Get distinct subjects from daily_test (normalized to canonical labels)
        cursor.execute("SELECT DISTINCT subject FROM daily_test WHERE subject IS NOT NULL ORDER BY subject")
        subject_labels = [normalize_subject_label(row[0]) for row in cursor.fetchall() if row[0]]
        subjects = sorted(list({s for s in subject_labels if s}))

        # Get distinct branches
        cursor.execute("SELECT DISTINCT branch FROM student WHERE branch IS NOT NULL ORDER BY branch")
        branches = [row[0] for row in cursor.fetchall()]

        # Get distinct courses
        cursor.execute("SELECT DISTINCT course FROM student WHERE course IS NOT NULL ORDER BY course")
        courses = [row[0] for row in cursor.fetchall()]

        return {
            "grades": grades,
            "batches": batches,
            "subjects": subjects,
            "branches": branches,
            "courses": courses
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch filter options: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ==================== SUBJECTWISE ANALYSIS ====================

@app.get("/api/analysis/subjectwise")
async def get_subjectwise_analysis(
    grade: Optional[str] = None,
    admission_number: Optional[str] = None,
    batch_id: Optional[int] = None,
    subject: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get subjectwise analysis data with filters.
    Returns daily test performance grouped by subject for each student.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Build the query for daily test data with student info
        query = """
            SELECT
                s.student_id,
                s.student_name,
                s.grade,
                b.batch_name,
                dt.subject,
                dt.unit_name,
                dt.total_marks,
                dt.test_date
            FROM daily_test dt
            JOIN student s ON dt.student_id = s.student_id
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE 1=1
        """
        params = []

        if grade:
            query += " AND s.grade = %s"
            params.append(grade)

        if admission_number:
            query += " AND s.student_id ILIKE %s"
            params.append(f"%{admission_number}%")

        if batch_id:
            query += " AND s.batch_id = %s"
            params.append(batch_id)

        if subject:
            query += f" AND {normalized_subject_sql('dt.subject')} = %s"
            params.append(normalize_subject_key(subject))

        if from_date:
            query += " AND dt.test_date >= %s"
            params.append(from_date)

        if to_date:
            query += " AND dt.test_date <= %s"
            params.append(to_date)

        query += " ORDER BY s.student_name, dt.subject, dt.test_date"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Also get mock test data for subject-level marks
        mock_query = """
            SELECT
                s.student_id,
                s.student_name,
                s.grade,
                b.batch_name,
                mt.maths_marks,
                mt.physics_marks,
                mt.chemistry_marks,
                mt.biology_marks,
                mt.total_marks,
                mt.maths_total_marks,
                mt.physics_total_marks,
                mt.chemistry_total_marks,
                mt.biology_total_marks,
                mt.test_total_marks,
                mt.test_date
            FROM mock_test mt
            JOIN student s ON mt.student_id = s.student_id
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE 1=1
        """
        mock_params = []

        if grade:
            mock_query += " AND s.grade = %s"
            mock_params.append(grade)

        if admission_number:
            mock_query += " AND s.student_id ILIKE %s"
            mock_params.append(f"%{admission_number}%")

        if batch_id:
            mock_query += " AND s.batch_id = %s"
            mock_params.append(batch_id)

        if from_date:
            mock_query += " AND mt.test_date >= %s"
            mock_params.append(from_date)

        if to_date:
            mock_query += " AND mt.test_date <= %s"
            mock_params.append(to_date)

        mock_query += " ORDER BY s.student_name, mt.test_date"
        cursor.execute(mock_query, mock_params)
        mock_rows = cursor.fetchall()

        # Aggregate daily test data per student per subject
        student_daily = {}
        for row in rows:
            sid = row[0]
            if sid not in student_daily:
                student_daily[sid] = {
                    "student_id": row[0],
                    "student_name": row[1],
                    "grade": row[2],
                    "batch": row[3],
                    "subjects": {}
                }
            subj = normalize_subject_label(row[4]) if row[4] else row[4]
            if subj not in student_daily[sid]["subjects"]:
                student_daily[sid]["subjects"][subj] = {
                    "tests": [],
                    "total_marks": 0,
                    "count": 0
                }
            student_daily[sid]["subjects"][subj]["tests"].append({
                "unit_name": row[5],
                "marks": row[6],
                "date": row[7].isoformat() if row[7] else None
            })
            numeric_mark = safe_parse_mark(row[6])
            if numeric_mark is not None:
                student_daily[sid]["subjects"][subj]["total_marks"] += numeric_mark
                student_daily[sid]["subjects"][subj]["count"] += 1

        # Aggregate mock test data per student
        student_mock = {}
        for row in mock_rows:
            sid = row[0]
            if sid not in student_mock:
                student_mock[sid] = {
                    "student_id": row[0],
                    "student_name": row[1],
                    "maths_total": 0,
                    "maths_count": 0,
                    "physics_total": 0,
                    "physics_count": 0,
                    "chemistry_total": 0,
                    "chemistry_count": 0,
                    "biology_total": 0,
                    "biology_count": 0
                }

            m_maths = safe_parse_mark(row[4])
            m_physics = safe_parse_mark(row[5])
            m_chemistry = safe_parse_mark(row[6])
            m_biology = safe_parse_mark(row[7])

            t_maths = safe_parse_mark(row[9])
            t_physics = safe_parse_mark(row[10])
            t_chemistry = safe_parse_mark(row[11])
            t_biology = safe_parse_mark(row[12])

            maths_score = (m_maths * 100 / t_maths) if (m_maths is not None and t_maths and t_maths > 0) else m_maths
            physics_score = (m_physics * 100 / t_physics) if (m_physics is not None and t_physics and t_physics > 0) else m_physics
            chemistry_score = (m_chemistry * 100 / t_chemistry) if (m_chemistry is not None and t_chemistry and t_chemistry > 0) else m_chemistry
            biology_score = (m_biology * 100 / t_biology) if (m_biology is not None and t_biology and t_biology > 0) else m_biology

            if m_maths is not None:
                student_mock[sid]["maths_total"] += maths_score
                student_mock[sid]["maths_count"] += 1
            if m_physics is not None:
                student_mock[sid]["physics_total"] += physics_score
                student_mock[sid]["physics_count"] += 1
            if m_chemistry is not None:
                student_mock[sid]["chemistry_total"] += chemistry_score
                student_mock[sid]["chemistry_count"] += 1
            if m_biology is not None:
                student_mock[sid]["biology_total"] += biology_score
                student_mock[sid]["biology_count"] += 1

        # Build combined student-level results
        all_student_ids = set(list(student_daily.keys()) + list(student_mock.keys()))
        results = []

        for sid in all_student_ids:
            daily = student_daily.get(sid, {})
            mock = student_mock.get(sid, {})

            student_result = {
                "student_id": sid,
                "student_name": daily.get("student_name") or mock.get("student_name", ""),
                "grade": daily.get("grade", ""),
                "batch": daily.get("batch", ""),
                "daily_tests": daily.get("subjects", {}),
            }

            # Add mock test averages
            if mock:
                student_result["mock_averages"] = {
                    "maths": round(mock["maths_total"] / mock["maths_count"], 1) if mock.get("maths_count", 0) > 0 else None,
                    "physics": round(mock["physics_total"] / mock["physics_count"], 1) if mock.get("physics_count", 0) > 0 else None,
                    "chemistry": round(mock["chemistry_total"] / mock["chemistry_count"], 1) if mock.get("chemistry_count", 0) > 0 else None,
                    "biology": round(mock["biology_total"] / mock["biology_count"], 1) if mock.get("biology_count", 0) > 0 else None,
                }
            else:
                student_result["mock_averages"] = None

            results.append(student_result)

        # Calculate overall subject statistics
        subject_stats = {}
        for sid, data in student_daily.items():
            for subj, subj_data in data["subjects"].items():
                if subj not in subject_stats:
                    subject_stats[subj] = {"scores": [], "count": 0}
                avg_score = subj_data["total_marks"] / subj_data["count"] if subj_data["count"] > 0 else None
                if avg_score is not None:
                    subject_stats[subj]["scores"].append(avg_score)
                subject_stats[subj]["count"] += subj_data["count"]

        stats_summary = {}
        for subj, data in subject_stats.items():
            scores = data["scores"]
            if scores:
                stats_summary[subj] = {
                    "average": round(sum(scores) / len(scores), 1),
                    "top_score": round(max(scores), 1),
                    "lowest": round(min(scores), 1),
                    "total_tests": data["count"],
                    "total_students": len(scores)
                }

        return {
            "students": results,
            "subject_stats": stats_summary,
            "total_students": len(results)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch subjectwise analysis: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ==================== BRANCHWISE ANALYSIS ====================

@app.get("/api/analysis/branchwise")
async def get_branchwise_analysis(
    grade: Optional[str] = None,
    admission_number: Optional[str] = None,
    batch_id: Optional[int] = None,
    subject: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get branchwise analysis data with filters.
    Aggregates performance by branch across subjects.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get daily test data grouped by branch
        daily_query = """
            SELECT
                s.branch,
                dt.subject,
                AVG(safe_numeric(dt.total_marks)) as avg_marks,
                MAX(safe_numeric(dt.total_marks)) as max_marks,
                MIN(safe_numeric(dt.total_marks)) as min_marks,
                COUNT(*) as test_count,
                COUNT(DISTINCT s.student_id) as student_count
            FROM daily_test dt
            JOIN student s ON dt.student_id = s.student_id
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE s.branch IS NOT NULL
        """
        params = []

        if grade:
            daily_query += " AND s.grade = %s"
            params.append(grade)

        if admission_number:
            daily_query += " AND s.student_id ILIKE %s"
            params.append(f"%{admission_number}%")

        if batch_id:
            daily_query += " AND s.batch_id = %s"
            params.append(batch_id)

        if subject:
            daily_query += f" AND {normalized_subject_sql('dt.subject')} = %s"
            params.append(normalize_subject_key(subject))

        if from_date:
            daily_query += " AND dt.test_date >= %s"
            params.append(from_date)

        if to_date:
            daily_query += " AND dt.test_date <= %s"
            params.append(to_date)

        daily_query += " GROUP BY s.branch, dt.subject ORDER BY s.branch, dt.subject"

        cursor.execute(daily_query, params)
        daily_rows = cursor.fetchall()

        # Get mock test data grouped by branch
        mock_maths_expr = """
            CASE
                WHEN mt.maths_total_marks IS NOT NULL AND mt.maths_total_marks > 0 AND safe_numeric(mt.maths_marks) IS NOT NULL
                    THEN (safe_numeric(mt.maths_marks) * 100.0 / mt.maths_total_marks)
                ELSE safe_numeric(mt.maths_marks)
            END
        """
        mock_physics_expr = """
            CASE
                WHEN mt.physics_total_marks IS NOT NULL AND mt.physics_total_marks > 0 AND safe_numeric(mt.physics_marks) IS NOT NULL
                    THEN (safe_numeric(mt.physics_marks) * 100.0 / mt.physics_total_marks)
                ELSE safe_numeric(mt.physics_marks)
            END
        """
        mock_chemistry_expr = """
            CASE
                WHEN mt.chemistry_total_marks IS NOT NULL AND mt.chemistry_total_marks > 0 AND safe_numeric(mt.chemistry_marks) IS NOT NULL
                    THEN (safe_numeric(mt.chemistry_marks) * 100.0 / mt.chemistry_total_marks)
                ELSE safe_numeric(mt.chemistry_marks)
            END
        """
        mock_biology_expr = """
            CASE
                WHEN mt.biology_total_marks IS NOT NULL AND mt.biology_total_marks > 0 AND safe_numeric(mt.biology_marks) IS NOT NULL
                    THEN (safe_numeric(mt.biology_marks) * 100.0 / mt.biology_total_marks)
                ELSE safe_numeric(mt.biology_marks)
            END
        """
        mock_total_expr = """
            CASE
                WHEN mt.test_total_marks IS NOT NULL AND mt.test_total_marks > 0 AND safe_numeric(mt.total_marks) IS NOT NULL
                    THEN (safe_numeric(mt.total_marks) * 100.0 / mt.test_total_marks)
                ELSE safe_numeric(mt.total_marks)
            END
        """

        mock_query = """
            SELECT
                s.branch,
                AVG({mock_maths_expr}) as avg_maths,
                AVG({mock_physics_expr}) as avg_physics,
                AVG({mock_chemistry_expr}) as avg_chemistry,
                AVG({mock_biology_expr}) as avg_biology,
                AVG({mock_total_expr}) as avg_total,
                MAX({mock_total_expr}) as max_total,
                MIN({mock_total_expr}) as min_total,
                COUNT(*) as test_count,
                COUNT(DISTINCT s.student_id) as student_count
            FROM mock_test mt
            JOIN student s ON mt.student_id = s.student_id
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE s.branch IS NOT NULL
        """.format(
            mock_maths_expr=mock_maths_expr,
            mock_physics_expr=mock_physics_expr,
            mock_chemistry_expr=mock_chemistry_expr,
            mock_biology_expr=mock_biology_expr,
            mock_total_expr=mock_total_expr,
        )
        mock_params = []

        if grade:
            mock_query += " AND s.grade = %s"
            mock_params.append(grade)

        if admission_number:
            mock_query += " AND s.student_id ILIKE %s"
            mock_params.append(f"%{admission_number}%")

        if batch_id:
            mock_query += " AND s.batch_id = %s"
            mock_params.append(batch_id)

        if from_date:
            mock_query += " AND mt.test_date >= %s"
            mock_params.append(from_date)

        if to_date:
            mock_query += " AND mt.test_date <= %s"
            mock_params.append(to_date)

        mock_query += " GROUP BY s.branch ORDER BY s.branch"

        cursor.execute(mock_query, mock_params)
        mock_rows = cursor.fetchall()

        # Build branch-wise data from daily tests
        branches_daily = {}
        for row in daily_rows:
            branch = row[0]
            if branch not in branches_daily:
                branches_daily[branch] = {"subjects": {}, "student_count": 0}
            subject_label = normalize_subject_label(row[1]) if row[1] else row[1]
            branches_daily[branch]["subjects"][subject_label] = {
                "average": round(float(row[2]), 1) if row[2] is not None else None,
                "top_score": row[3] if row[3] is not None else None,
                "lowest": row[4] if row[4] is not None else None,
                "test_count": row[5]
            }
            branches_daily[branch]["student_count"] = max(
                branches_daily[branch]["student_count"], row[6]
            )

        # Build branch-wise data from mock tests
        branches_mock = {}
        for row in mock_rows:
            branch = row[0]
            branches_mock[branch] = {
                "maths": round(float(row[1]), 1) if row[1] is not None else None,
                "physics": round(float(row[2]), 1) if row[2] is not None else None,
                "chemistry": round(float(row[3]), 1) if row[3] is not None else None,
                "biology": round(float(row[4]), 1) if row[4] is not None else None,
                "avg_total": round(float(row[5]), 1) if row[5] is not None else None,
                "top_total": row[6] if row[6] is not None else None,
                "lowest_total": row[7] if row[7] is not None else None,
                "test_count": row[8],
                "student_count": row[9]
            }

        # Combine into results
        all_branches = set(list(branches_daily.keys()) + list(branches_mock.keys()))
        branch_results = []

        for branch in sorted(all_branches):
            daily = branches_daily.get(branch, {"subjects": {}, "student_count": 0})
            mock = branches_mock.get(branch, {})

            branch_result = {
                "branch": branch,
                "daily_test_data": daily["subjects"],
                "mock_test_data": mock if mock else None,
                "student_count": max(
                    daily["student_count"],
                    mock.get("student_count", 0)
                )
            }
            branch_results.append(branch_result)

        # Get individual student data per branch for detailed view
        student_query = """
            SELECT
                s.student_id,
                s.student_name,
                s.branch,
                s.grade,
                b.batch_name,
                dt.subject,
                AVG(safe_numeric(dt.total_marks)) as avg_marks
            FROM daily_test dt
            JOIN student s ON dt.student_id = s.student_id
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE s.branch IS NOT NULL
        """
        student_params = []

        if grade:
            student_query += " AND s.grade = %s"
            student_params.append(grade)

        if batch_id:
            student_query += " AND s.batch_id = %s"
            student_params.append(batch_id)

        if subject:
            student_query += f" AND {normalized_subject_sql('dt.subject')} = %s"
            student_params.append(normalize_subject_key(subject))

        if from_date:
            student_query += " AND dt.test_date >= %s"
            student_params.append(from_date)

        if to_date:
            student_query += " AND dt.test_date <= %s"
            student_params.append(to_date)

        student_query += " GROUP BY s.student_id, s.student_name, s.branch, s.grade, b.batch_name, dt.subject"
        student_query += " ORDER BY s.branch, s.student_name"

        cursor.execute(student_query, student_params)
        student_rows = cursor.fetchall()

        students_by_branch = {}
        for row in student_rows:
            branch = row[2]
            sid = row[0]
            if branch not in students_by_branch:
                students_by_branch[branch] = {}
            if sid not in students_by_branch[branch]:
                students_by_branch[branch][sid] = {
                    "student_id": row[0],
                    "student_name": row[1],
                    "grade": row[3],
                    "batch": row[4],
                    "subjects": {}
                }
            students_by_branch[branch][sid]["subjects"][row[5]] = round(float(row[6]), 1)

        return {
            "branches": branch_results,
            "students_by_branch": {
                branch: list(students.values())
                for branch, students in students_by_branch.items()
            },
            "total_branches": len(branch_results)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch branchwise analysis: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ==================== INDIVIDUAL ANALYSIS ====================

@app.get("/api/analysis/individual/students")
async def get_students_for_analysis(
    name: Optional[str] = None,
    batch_id: Optional[int] = None,
    course: Optional[str] = None,
    branch: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of students for the individual analysis dropdown,
    with optional filters.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                s.student_id,
                s.student_name,
                s.course,
                s.branch,
                s.grade,
                s.photo_url,
                b.batch_name,
                b.batch_id
            FROM student s
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE 1=1
        """
        params = []

        if name:
            query += " AND s.student_name ILIKE %s"
            params.append(f"%{name}%")

        if batch_id:
            query += " AND s.batch_id = %s"
            params.append(batch_id)

        if course:
            query += " AND s.course = %s"
            params.append(course)

        if branch:
            query += " AND s.branch = %s"
            params.append(branch)

        query += " ORDER BY s.student_name"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        students = []
        for row in rows:
            students.append({
                "student_id": row[0],
                "student_name": row[1],
                "course": row[2],
                "branch": row[3],
                "grade": row[4],
                "photo_url": row[5],
                "batch_name": row[6],
                "batch_id": row[7]
            })

        return {"students": students, "count": len(students)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch students: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/individual/{student_id}")
async def get_individual_analysis(student_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get complete individual analysis for a student:
    - Student info (name, photo, course, branch, batch)
    - Daily test performance
    - Mock test performance
    - Class averages & top scores for comparison
    - Feedback history
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Get student info
        cursor.execute("""
            SELECT
                s.student_id, s.student_name, s.course, s.branch, s.grade,
                s.photo_url, s.gender, s.email, s.student_mobile,
                b.batch_name, b.batch_id, b.subjects
            FROM student s
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE s.student_id = %s
        """, (student_id,))

        student_row = cursor.fetchone()
        if not student_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student {student_id} not found"
            )

        student_info = {
            "student_id": student_row[0],
            "student_name": student_row[1],
            "course": student_row[2],
            "branch": student_row[3],
            "grade": student_row[4],
            "photo_url": student_row[5],
            "gender": student_row[6],
            "email": student_row[7],
            "student_mobile": student_row[8],
            "batch_name": student_row[9],
            "batch_id": student_row[10],
            "batch_subjects": student_row[11] if student_row[11] else []
        }

        batch_id = student_row[10]
        report_subject_keys = get_batch_mock_subjects(student_info["batch_subjects"])
        if len(report_subject_keys) < 3:
            for key in ["maths", "physics", "chemistry", "biology"]:
                if key not in report_subject_keys:
                    report_subject_keys.append(key)
                if len(report_subject_keys) >= 3:
                    break
        report_subject_keys = report_subject_keys[:3]

        # 2. Get daily test performance
        cursor.execute("""
            SELECT
                dt.test_id, dt.subject, dt.unit_name, dt.total_marks, dt.test_date,
                dt.grade, dt.branch, dt.subject_total_marks, dt.test_total_marks
            FROM daily_test dt
            WHERE dt.student_id = %s
            ORDER BY dt.test_date DESC, dt.subject
        """, (student_id,))

        daily_tests_raw = cursor.fetchall()
        daily_tests = []

        # Fetch all required daily class stats in one query (avoids N+1)
        cursor.execute(f"""
            WITH student_tests AS (
                SELECT DISTINCT
                    dt.test_date,
                    COALESCE(NULLIF(TRIM(dt.unit_name), ''), 'Unknown') AS unit_name,
                    {normalized_subject_sql('dt.subject')} AS normalized_subject
                FROM daily_test dt
                WHERE dt.student_id = %s
            )
            SELECT
                st.test_date,
                st.normalized_subject,
                st.unit_name,
                ROUND(AVG(safe_numeric(dt2.total_marks))::numeric, 1) AS class_avg,
                MAX(safe_numeric(dt2.total_marks)) AS class_high,
                MIN(safe_numeric(dt2.total_marks)) AS class_low
            FROM student_tests st
            JOIN daily_test dt2
                ON dt2.test_date = st.test_date
                AND COALESCE(NULLIF(TRIM(dt2.unit_name), ''), 'Unknown') = st.unit_name
                AND {normalized_subject_sql('dt2.subject')} = st.normalized_subject
            JOIN student s2 ON s2.student_id = dt2.student_id
            WHERE s2.batch_id = %s
            GROUP BY st.test_date, st.normalized_subject, st.unit_name
        """, (student_id, batch_id))

        daily_stats_map = {}
        for row in cursor.fetchall():
            daily_key = (
                row[0],
                row[1],
                row[2]
            )
            daily_stats_map[daily_key] = {
                "class_avg": float(row[3]) if row[3] is not None else None,
                "class_high": row[4] if row[4] is not None else None,
                "class_low": row[5] if row[5] is not None else None,
            }

        for test in daily_tests_raw:
            test_date = test[4]
            test_subject_key = normalize_subject_key(test[1])
            test_unit_key = (test[2] or '').strip() or 'Unknown'
            stats_row = daily_stats_map.get((test_date, test_subject_key, test_unit_key), {
                "class_avg": None,
                "class_high": None,
                "class_low": None,
            })

            daily_tests.append({
                "test_id": test[0],
                "subject": test[1],
                "unit_name": test[2],
                "marks": test[3],
                "test_date": test[4].isoformat() if test[4] else None,
                "grade": test[5],
                "branch": test[6],
                "subject_total_marks": test[7],
                "test_total_marks": test[8],
                "class_avg": round(float(stats_row["class_avg"]), 1) if stats_row["class_avg"] is not None else None,
                "top_score": stats_row["class_high"],
                "class_low": stats_row["class_low"]
            })

        # 3. Get mock test performance
        cursor.execute("""
            SELECT
                mt.test_id, mt.test_date, mt.maths_marks, mt.physics_marks,
                mt.chemistry_marks, mt.biology_marks, mt.total_marks,
                mt.maths_unit_names, mt.physics_unit_names,
                mt.chemistry_unit_names, mt.biology_unit_names,
                mt.grade, mt.branch,
                mt.maths_total_marks, mt.physics_total_marks,
                mt.chemistry_total_marks, mt.biology_total_marks,
                mt.test_total_marks
            FROM mock_test mt
            WHERE mt.student_id = %s
            ORDER BY mt.test_date DESC
        """, (student_id,))

        mock_tests_raw = cursor.fetchall()
        mock_tests = []

        mock_mark_index = {
            "maths": 2,
            "physics": 3,
            "chemistry": 4,
            "biology": 5,
        }

        def sum_selected_subject_marks(mark_getter, subject_keys, require_all=True):
            values = []
            for key in subject_keys:
                parsed = safe_parse_mark(mark_getter(key))
                if parsed is None:
                    if require_all:
                        return None
                    continue
                values.append(float(parsed))

            if not values:
                return None
            return sum(values)

        # Fetch all required mock class stats in one query (avoids N+1)
        cursor.execute("""
            WITH student_mock_dates AS (
                SELECT DISTINCT mt.test_date
                FROM mock_test mt
                WHERE mt.student_id = %s
            )
            SELECT
                d.test_date,
                ROUND(AVG(safe_numeric(mt2.total_marks))::numeric, 1) AS class_avg_total,
                MAX(safe_numeric(mt2.total_marks)) AS class_high_total,
                MIN(safe_numeric(mt2.total_marks)) AS class_low_total,
                ROUND(AVG(safe_numeric(mt2.maths_marks))::numeric, 1) AS class_avg_maths,
                MAX(safe_numeric(mt2.maths_marks)) AS class_high_maths,
                MIN(safe_numeric(mt2.maths_marks)) AS class_low_maths,
                ROUND(AVG(safe_numeric(mt2.physics_marks))::numeric, 1) AS class_avg_physics,
                MAX(safe_numeric(mt2.physics_marks)) AS class_high_physics,
                MIN(safe_numeric(mt2.physics_marks)) AS class_low_physics,
                ROUND(AVG(safe_numeric(mt2.chemistry_marks))::numeric, 1) AS class_avg_chemistry,
                MAX(safe_numeric(mt2.chemistry_marks)) AS class_high_chemistry,
                MIN(safe_numeric(mt2.chemistry_marks)) AS class_low_chemistry,
                ROUND(AVG(safe_numeric(mt2.biology_marks))::numeric, 1) AS class_avg_biology,
                MAX(safe_numeric(mt2.biology_marks)) AS class_high_biology,
                MIN(safe_numeric(mt2.biology_marks)) AS class_low_biology
            FROM student_mock_dates d
            JOIN mock_test mt2 ON mt2.test_date = d.test_date
            JOIN student s2 ON s2.student_id = mt2.student_id
            WHERE s2.batch_id = %s
            GROUP BY d.test_date
        """, (student_id, batch_id))

        mock_stats_map = {}
        for row in cursor.fetchall():
            mock_stats_map[row[0]] = {
                "class_avg_total": float(row[1]) if row[1] is not None else None,
                "class_high_total": row[2] if row[2] is not None else None,
                "class_low_total": row[3] if row[3] is not None else None,
                "class_avg_maths": float(row[4]) if row[4] is not None else None,
                "class_high_maths": row[5] if row[5] is not None else None,
                "class_low_maths": row[6] if row[6] is not None else None,
                "class_avg_physics": float(row[7]) if row[7] is not None else None,
                "class_high_physics": row[8] if row[8] is not None else None,
                "class_low_physics": row[9] if row[9] is not None else None,
                "class_avg_chemistry": float(row[10]) if row[10] is not None else None,
                "class_high_chemistry": row[11] if row[11] is not None else None,
                "class_low_chemistry": row[12] if row[12] is not None else None,
                "class_avg_biology": float(row[13]) if row[13] is not None else None,
                "class_high_biology": row[14] if row[14] is not None else None,
                "class_low_biology": row[15] if row[15] is not None else None,
            }

        # Class band for report chart: sum of selected three subject marks per student per test date
        cursor.execute("""
            WITH student_mock_dates AS (
                SELECT DISTINCT mt.test_date
                FROM mock_test mt
                WHERE mt.student_id = %s
            )
            SELECT
                d.test_date,
                mt2.student_id,
                safe_numeric(mt2.maths_marks) AS maths_marks,
                safe_numeric(mt2.physics_marks) AS physics_marks,
                safe_numeric(mt2.chemistry_marks) AS chemistry_marks,
                safe_numeric(mt2.biology_marks) AS biology_marks
            FROM student_mock_dates d
            JOIN mock_test mt2 ON mt2.test_date = d.test_date
            JOIN student s2 ON s2.student_id = mt2.student_id
            WHERE s2.batch_id = %s
        """, (student_id, batch_id))

        report_total_class_stats_map = {}
        for row in cursor.fetchall():
            test_date = row[0]
            subject_values = {
                "maths": row[2],
                "physics": row[3],
                "chemistry": row[4],
                "biology": row[5],
            }

            total_sum = sum_selected_subject_marks(lambda key: subject_values.get(key), report_subject_keys, True)
            if total_sum is None:
                continue

            report_total_class_stats_map.setdefault(test_date, []).append(total_sum)

        report_total_class_stats_map = {
            test_date: {
                "report_class_avg_total": round(sum(totals) / len(totals), 1) if totals else None,
                "report_class_high_total": max(totals) if totals else None,
                "report_class_low_total": min(totals) if totals else None,
            }
            for test_date, totals in report_total_class_stats_map.items()
        }

        for test in mock_tests_raw:
            test_date = test[1]
            mock_stats = mock_stats_map.get(test_date, {
                "class_avg_total": None,
                "class_high_total": None,
                "class_low_total": None,
                "class_avg_maths": None,
                "class_high_maths": None,
                "class_low_maths": None,
                "class_avg_physics": None,
                "class_high_physics": None,
                "class_low_physics": None,
                "class_avg_chemistry": None,
                "class_high_chemistry": None,
                "class_low_chemistry": None,
                "class_avg_biology": None,
                "class_high_biology": None,
                "class_low_biology": None,
            })

            mock_tests.append({
                "report_subject_keys": report_subject_keys,
                "test_id": test[0],
                "test_date": test[1].isoformat() if test[1] else None,
                "maths_marks": test[2],
                "physics_marks": test[3],
                "chemistry_marks": test[4],
                "biology_marks": test[5],
                "total_marks": test[6],
                "maths_unit_names": test[7],
                "physics_unit_names": test[8],
                "chemistry_unit_names": test[9],
                "biology_unit_names": test[10],
                "grade": test[11],
                "branch": test[12],
                "maths_total_marks": test[13],
                "physics_total_marks": test[14],
                "chemistry_total_marks": test[15],
                "biology_total_marks": test[16],
                "test_total_marks": test[17],
                "class_avg_total": round(float(mock_stats["class_avg_total"]), 1) if mock_stats["class_avg_total"] is not None else None,
                "top_score_total": mock_stats["class_high_total"],
                "class_low_total": mock_stats["class_low_total"],
                "class_avg_maths": round(float(mock_stats["class_avg_maths"]), 1) if mock_stats["class_avg_maths"] is not None else None,
                "class_high_maths": mock_stats["class_high_maths"],
                "class_low_maths": mock_stats["class_low_maths"],
                "class_avg_physics": round(float(mock_stats["class_avg_physics"]), 1) if mock_stats["class_avg_physics"] is not None else None,
                "class_high_physics": mock_stats["class_high_physics"],
                "class_low_physics": mock_stats["class_low_physics"],
                "class_avg_chemistry": round(float(mock_stats["class_avg_chemistry"]), 1) if mock_stats["class_avg_chemistry"] is not None else None,
                "class_high_chemistry": mock_stats["class_high_chemistry"],
                "class_low_chemistry": mock_stats["class_low_chemistry"],
                "class_avg_biology": round(float(mock_stats["class_avg_biology"]), 1) if mock_stats["class_avg_biology"] is not None else None,
                "class_high_biology": mock_stats["class_high_biology"],
                "class_low_biology": mock_stats["class_low_biology"],
                "report_student_total": sum_selected_subject_marks(lambda key: test[mock_mark_index[key]], report_subject_keys, True),
                "report_class_avg_total": report_total_class_stats_map.get(test_date, {}).get("report_class_avg_total"),
                "report_class_high_total": report_total_class_stats_map.get(test_date, {}).get("report_class_high_total"),
                "report_class_low_total": report_total_class_stats_map.get(test_date, {}).get("report_class_low_total"),
            })

        # 4. Get feedback history
        cursor.execute("""
            SELECT
                feedback_id, feedback_date, teacher_feedback, suggestions,
                academic_director_signature, student_signature, parent_signature,
                created_at
            FROM feedback
            WHERE student_id = %s
            ORDER BY feedback_date DESC
        """, (student_id,))

        feedback_rows = cursor.fetchall()
        feedback_list = []
        for fb in feedback_rows:
            feedback_list.append({
                "feedback_id": fb[0],
                "feedback_date": fb[1].isoformat() if fb[1] else None,
                "teacher_feedback": fb[2],
                "suggestions": fb[3],
                "academic_director_signature": fb[4],
                "student_signature": fb[5],
                "parent_signature": fb[6],
                "created_at": fb[7].isoformat() if fb[7] else None
            })

        return {
            "student": student_info,
            "daily_tests": daily_tests,
            "mock_tests": mock_tests,
            "feedback": feedback_list
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch individual analysis: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ==================== FEEDBACK ENDPOINTS ====================

class FeedbackCreate(BaseModel):
    student_id: str
    feedback_date: Optional[str] = None
    teacher_feedback: Optional[str] = None
    suggestions: Optional[str] = None
    academic_director_signature: Optional[str] = None
    student_signature: Optional[str] = None
    parent_signature: Optional[str] = None


@app.post("/api/analysis/feedback", status_code=status.HTTP_201_CREATED)
async def create_feedback(feedback: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a feedback entry for a student
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify student exists
        cursor.execute("SELECT student_id FROM student WHERE student_id = %s", (feedback.student_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student {feedback.student_id} not found"
            )

        cursor.execute("""
            INSERT INTO feedback (
                student_id, feedback_date, teacher_feedback, suggestions,
                academic_director_signature, student_signature, parent_signature
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING feedback_id, feedback_date, created_at
        """, (
            feedback.student_id,
            feedback.feedback_date or date.today().isoformat(),
            feedback.teacher_feedback,
            feedback.suggestions,
            feedback.academic_director_signature,
            feedback.student_signature,
            feedback.parent_signature
        ))

        result = cursor.fetchone()
        conn.commit()

        return {
            "message": "Feedback saved successfully",
            "feedback_id": result[0],
            "feedback_date": result[1].isoformat() if result[1] else None,
            "created_at": result[2].isoformat() if result[2] else None
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save feedback: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/feedback/{student_id}")
async def get_student_feedback(student_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get all feedback entries for a student
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                feedback_id, feedback_date, teacher_feedback, suggestions,
                academic_director_signature, student_signature, parent_signature,
                created_at
            FROM feedback
            WHERE student_id = %s
            ORDER BY feedback_date DESC
        """, (student_id,))

        rows = cursor.fetchall()
        feedback_list = []
        for fb in rows:
            feedback_list.append({
                "feedback_id": fb[0],
                "feedback_date": fb[1].isoformat() if fb[1] else None,
                "teacher_feedback": fb[2],
                "suggestions": fb[3],
                "academic_director_signature": fb[4],
                "student_signature": fb[5],
                "parent_signature": fb[6],
                "created_at": fb[7].isoformat() if fb[7] else None
            })

        return {
            "student_id": student_id,
            "feedback": feedback_list,
            "count": len(feedback_list)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch feedback: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/batch-performance/{batch_id}")
async def get_batch_performance(
    batch_id: int,
    test_type: Optional[str] = Query("both", description="daily, mock, or both"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    subject: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive batch performance analytics:
    - Overall stats (avg, top, lowest, total tests, participation)
    - Daily test score trend over time
    - Mock test score trend over time
    - Subject-wise breakdown (daily + mock)
    - Top 5 and bottom 5 students
    - Score distribution histogram
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify batch exists and get info
        cursor.execute("""
            SELECT batch_id, batch_name, start_year, end_year, type, subjects
            FROM batch WHERE batch_id = %s
        """, (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch {batch_id} not found"
            )

        batch_info = {
            "batch_id": batch_row[0],
            "batch_name": batch_row[1],
            "start_year": batch_row[2],
            "end_year": batch_row[3],
            "type": batch_row[4],
            "subjects": batch_row[5] if batch_row[5] else []
        }

        # Total students in batch
        cursor.execute("SELECT COUNT(*) FROM student WHERE batch_id = %s", (batch_id,))
        total_students = cursor.fetchone()[0]

        # ── Date filter fragments ──
        daily_date_filter = ""
        mock_date_filter = ""
        daily_date_params = []
        mock_date_params = []

        if date_from:
            daily_date_filter += " AND dt.test_date >= %s"
            daily_date_params.append(date_from)
            mock_date_filter += " AND mt.test_date >= %s"
            mock_date_params.append(date_from)
        if date_to:
            daily_date_filter += " AND dt.test_date <= %s"
            daily_date_params.append(date_to)
            mock_date_filter += " AND mt.test_date <= %s"
            mock_date_params.append(date_to)

        daily_subject_filter = ""
        daily_subject_params = []
        if subject:
            daily_subject_filter = f" AND {normalized_subject_sql('dt.subject')} = %s"
            daily_subject_params.append(normalize_subject_key(subject))

        # Score normalization expressions (percentage-based when total columns are present)
        daily_score_expr = """
            CASE
                WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                ELSE safe_numeric(dt.total_marks)
            END
        """

        mock_total_score_expr = """
            CASE
                WHEN mt.test_total_marks IS NOT NULL AND mt.test_total_marks > 0 AND safe_numeric(mt.total_marks) IS NOT NULL
                    THEN (safe_numeric(mt.total_marks) * 100.0 / mt.test_total_marks)
                ELSE safe_numeric(mt.total_marks)
            END
        """

        mock_maths_score_expr = """
            CASE
                WHEN mt.maths_total_marks IS NOT NULL AND mt.maths_total_marks > 0 AND safe_numeric(mt.maths_marks) IS NOT NULL
                    THEN (safe_numeric(mt.maths_marks) * 100.0 / mt.maths_total_marks)
                ELSE safe_numeric(mt.maths_marks)
            END
        """

        mock_physics_score_expr = """
            CASE
                WHEN mt.physics_total_marks IS NOT NULL AND mt.physics_total_marks > 0 AND safe_numeric(mt.physics_marks) IS NOT NULL
                    THEN (safe_numeric(mt.physics_marks) * 100.0 / mt.physics_total_marks)
                ELSE safe_numeric(mt.physics_marks)
            END
        """

        mock_chemistry_score_expr = """
            CASE
                WHEN mt.chemistry_total_marks IS NOT NULL AND mt.chemistry_total_marks > 0 AND safe_numeric(mt.chemistry_marks) IS NOT NULL
                    THEN (safe_numeric(mt.chemistry_marks) * 100.0 / mt.chemistry_total_marks)
                ELSE safe_numeric(mt.chemistry_marks)
            END
        """

        mock_biology_score_expr = """
            CASE
                WHEN mt.biology_total_marks IS NOT NULL AND mt.biology_total_marks > 0 AND safe_numeric(mt.biology_marks) IS NOT NULL
                    THEN (safe_numeric(mt.biology_marks) * 100.0 / mt.biology_total_marks)
                ELSE safe_numeric(mt.biology_marks)
            END
        """

        # ==================== DAILY TEST STATS ====================
        daily_stats = {
            "avg_score": None, "top_score": None, "lowest_score": None,
            "total_tests": 0, "students_tested": 0
        }
        daily_trend = []
        daily_subject_breakdown = []
        daily_student_avgs = []

        if test_type in ("daily", "both"):
            # Overall daily stats
            cursor.execute(f"""
                SELECT
                    ROUND(AVG({daily_score_expr})::numeric, 1),
                    MAX({daily_score_expr}),
                    MIN({daily_score_expr}),
                    COUNT(DISTINCT (dt.test_date, dt.subject, dt.unit_name)),
                    COUNT(DISTINCT dt.student_id)
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
            """, [batch_id] + daily_date_params + daily_subject_params)
            row = cursor.fetchone()
            daily_stats = {
                "avg_score": float(row[0]) if row[0] is not None else None,
                "top_score": float(row[1]) if row[1] is not None else None,
                "lowest_score": float(row[2]) if row[2] is not None else None,
                "total_tests": row[3],
                "students_tested": row[4]
            }

            # Daily trend (avg score per date)
            cursor.execute(f"""
                SELECT
                    dt.test_date,
                    ROUND(AVG({daily_score_expr})::numeric, 1) as avg_marks,
                    MAX({daily_score_expr}) as top_marks,
                    MIN({daily_score_expr}) as low_marks,
                    COUNT(DISTINCT dt.student_id) as students
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
                GROUP BY dt.test_date
                ORDER BY dt.test_date
            """, [batch_id] + daily_date_params + daily_subject_params)
            for r in cursor.fetchall():
                daily_trend.append({
                    "date": r[0].isoformat() if r[0] else None,
                    "avg": float(r[1]) if r[1] is not None else None,
                    "top": float(r[2]) if r[2] is not None else None,
                    "low": float(r[3]) if r[3] is not None else None,
                    "students": r[4]
                })

            # Subject breakdown
            cursor.execute(f"""
                SELECT
                    dt.subject,
                    ROUND(AVG({daily_score_expr})::numeric, 1),
                    MAX({daily_score_expr}),
                    MIN({daily_score_expr}),
                    COUNT(*),
                    COUNT(DISTINCT dt.student_id)
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
                GROUP BY dt.subject
                ORDER BY dt.subject
            """, [batch_id] + daily_date_params + daily_subject_params)
            for r in cursor.fetchall():
                daily_subject_breakdown.append({
                    "subject": normalize_subject_label(r[0]) if r[0] else r[0],
                    "avg": float(r[1]) if r[1] is not None else None,
                    "top": float(r[2]) if r[2] is not None else None,
                    "low": float(r[3]) if r[3] is not None else None,
                    "tests": r[4],
                    "students": r[5]
                })

            # Per-student average (for ranking + distribution)
            cursor.execute(f"""
                SELECT
                    s.student_id,
                    s.student_name,
                    ROUND(AVG({daily_score_expr})::numeric, 1) as avg_marks,
                    COUNT(*) as test_count
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
                GROUP BY s.student_id, s.student_name
                ORDER BY avg_marks DESC NULLS LAST
            """, [batch_id] + daily_date_params + daily_subject_params)
            daily_student_avgs = [
                {"student_id": r[0], "student_name": r[1], "avg": float(r[2]), "tests": r[3]}
                for r in cursor.fetchall()
                if r[2] is not None
            ]

        # ==================== MOCK TEST STATS ====================
        mock_stats = {
            "avg_score": None, "top_score": None, "lowest_score": None,
            "total_tests": 0, "students_tested": 0
        }
        mock_trend = []
        mock_subject_breakdown = []
        mock_student_avgs = []

        if test_type in ("mock", "both"):
            # Overall mock stats
            cursor.execute(f"""
                SELECT
                    ROUND(AVG({mock_total_score_expr})::numeric, 1),
                    MAX({mock_total_score_expr}),
                    MIN({mock_total_score_expr}),
                    COUNT(DISTINCT mt.test_date),
                    COUNT(DISTINCT mt.student_id)
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
            """, [batch_id] + mock_date_params)
            row = cursor.fetchone()
            mock_stats = {
                "avg_score": float(row[0]) if row[0] is not None else None,
                "top_score": float(row[1]) if row[1] is not None else None,
                "lowest_score": float(row[2]) if row[2] is not None else None,
                "total_tests": row[3],
                "students_tested": row[4]
            }

            # Mock trend (avg total per date)
            cursor.execute(f"""
                SELECT
                    mt.test_date,
                    ROUND(AVG({mock_total_score_expr})::numeric, 1),
                    MAX({mock_total_score_expr}),
                    MIN({mock_total_score_expr}),
                    COUNT(DISTINCT mt.student_id)
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
                GROUP BY mt.test_date
                ORDER BY mt.test_date
            """, [batch_id] + mock_date_params)
            for r in cursor.fetchall():
                mock_trend.append({
                    "date": r[0].isoformat() if r[0] else None,
                    "avg": float(r[1]) if r[1] is not None else None,
                    "top": float(r[2]) if r[2] is not None else None,
                    "low": float(r[3]) if r[3] is not None else None,
                    "students": r[4]
                })

            # Mock subject breakdown (per-subject averages)
            cursor.execute(f"""
                SELECT
                    ROUND(AVG({mock_maths_score_expr})::numeric, 1),
                    ROUND(AVG({mock_physics_score_expr})::numeric, 1),
                    ROUND(AVG({mock_chemistry_score_expr})::numeric, 1),
                    ROUND(AVG({mock_biology_score_expr})::numeric, 1),
                    MAX({mock_maths_score_expr}), MAX({mock_physics_score_expr}),
                    MAX({mock_chemistry_score_expr}), MAX({mock_biology_score_expr})
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
            """, [batch_id] + mock_date_params)
            r = cursor.fetchone()
            if r:
                for i, subj in enumerate(["Maths", "Physics", "Chemistry", "Biology"]):
                    avg_val = float(r[i]) if r[i] is not None else None
                    top_val = float(r[i + 4]) if r[i + 4] is not None else None
                    if avg_val is None and top_val is None:
                        continue
                    mock_subject_breakdown.append({
                        "subject": subj,
                        "avg": avg_val,
                        "top": top_val
                    })

            # Per-student mock average
            cursor.execute(f"""
                SELECT
                    s.student_id,
                    s.student_name,
                    ROUND(AVG({mock_total_score_expr})::numeric, 1) as avg_marks,
                    COUNT(*) as test_count
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
                GROUP BY s.student_id, s.student_name
                ORDER BY avg_marks DESC NULLS LAST
            """, [batch_id] + mock_date_params)
            mock_student_avgs = [
                {"student_id": r[0], "student_name": r[1], "avg": float(r[2]), "tests": r[3]}
                for r in cursor.fetchall()
                if r[2] is not None
            ]

        # ==================== COMBINED RANKINGS ====================
        # Merge daily + mock student averages for overall ranking
        student_scores = {}
        for s in daily_student_avgs:
            sid = s["student_id"]
            student_scores[sid] = {
                "student_id": sid,
                "student_name": s["student_name"],
                "daily_avg": s["avg"],
                "daily_tests": s["tests"],
                "mock_avg": None,
                "mock_tests": 0
            }
        for s in mock_student_avgs:
            sid = s["student_id"]
            if sid in student_scores:
                student_scores[sid]["mock_avg"] = s["avg"]
                student_scores[sid]["mock_tests"] = s["tests"]
            else:
                student_scores[sid] = {
                    "student_id": sid,
                    "student_name": s["student_name"],
                    "daily_avg": None,
                    "daily_tests": 0,
                    "mock_avg": s["avg"],
                    "mock_tests": s["tests"]
                }

        # Calculate overall average
        for sid, data in student_scores.items():
            total = 0
            count = 0
            if data["daily_tests"] > 0:
                total += data["daily_avg"]
                count += 1
            if data["mock_tests"] > 0:
                total += data["mock_avg"]
                count += 1
            data["overall_avg"] = round(total / count, 1) if count > 0 else None

        ranked = [s for s in student_scores.values() if s["overall_avg"] is not None]
        ranked = sorted(ranked, key=lambda x: x["overall_avg"], reverse=True)
        top_students = ranked[:5]
        bottom_students = list(reversed(ranked[-5:])) if len(ranked) >= 5 else list(reversed(ranked))

        # ==================== SCORE DISTRIBUTION ====================
        # Dynamic buckets based on actual min/max scores
        import math

        def build_distribution(student_avgs, num_buckets=5):
            if not student_avgs:
                return []

            scores = []
            for s in student_avgs:
                val = s.get("avg")
                if val is None:
                    continue
                try:
                    fval = float(val)
                except (TypeError, ValueError):
                    continue
                if math.isfinite(fval):
                    scores.append(fval)

            if not scores:
                return []

            min_score = min(scores)
            max_score = max(scores)

            # Common case: percentage scores (0-100) => fixed stable buckets
            if min_score >= 0 and max_score <= 100.0:
                buckets = [
                    {"range": "0-20", "count": 0},
                    {"range": "20-40", "count": 0},
                    {"range": "40-60", "count": 0},
                    {"range": "60-80", "count": 0},
                    {"range": "80-100", "count": 0},
                ]
                for score in scores:
                    clamped = max(0.0, min(100.0, score))
                    idx = 4 if clamped == 100.0 else int(clamped // 20)
                    buckets[idx]["count"] += 1
                return buckets

            # Fallback for non-percentage scales
            if min_score == max_score:
                return [{"range": f"{round(min_score, 1)}", "count": len(scores)}]

            bucket_size = max((max_score - min_score) / float(num_buckets), 1.0)
            start = math.floor(min_score / bucket_size) * bucket_size
            buckets = []

            for i in range(num_buckets):
                low = start + (i * bucket_size)
                high = low + bucket_size
                buckets.append({
                    "range": f"{round(low, 1)}-{round(high, 1)}",
                    "low": low,
                    "high": high,
                    "count": 0,
                })

            for score in scores:
                idx = int((score - start) // bucket_size)
                if idx < 0:
                    idx = 0
                if idx >= num_buckets:
                    idx = num_buckets - 1
                buckets[idx]["count"] += 1

            return [{"range": b["range"], "count": b["count"]} for b in buckets]

        daily_distribution = build_distribution(daily_student_avgs) if daily_student_avgs else []
        mock_distribution = build_distribution(mock_student_avgs) if mock_student_avgs else []

        # ==================== PARTICIPATION ====================
        participation = {
            "total_students": total_students,
            "daily_tested": daily_stats["students_tested"],
            "mock_tested": mock_stats["students_tested"],
            "daily_rate": round(daily_stats["students_tested"] / total_students * 100, 1) if total_students > 0 else 0,
            "mock_rate": round(mock_stats["students_tested"] / total_students * 100, 1) if total_students > 0 else 0
        }

        return {
            "batch": batch_info,
            "daily_stats": daily_stats,
            "mock_stats": mock_stats,
            "daily_trend": daily_trend,
            "mock_trend": mock_trend,
            "daily_subject_breakdown": daily_subject_breakdown,
            "mock_subject_breakdown": mock_subject_breakdown,
            "top_students": top_students,
            "bottom_students": bottom_students,
            "daily_distribution": daily_distribution,
            "mock_distribution": mock_distribution,
            "participation": participation
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch batch performance: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/student-metrics/{student_id}")
async def get_student_metrics(
    student_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Advanced individual metrics: trend, consistency, participation, percentile, risk score."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT student_id, student_name, batch_id FROM student WHERE student_id = %s", (student_id,))
        student_row = cursor.fetchone()
        if not student_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student {student_id} not found")

        batch_id = student_row[2]

        daily_date_filter = ""
        mock_date_filter = ""
        daily_params = []
        mock_params = []
        if date_from:
            daily_date_filter += " AND dt.test_date >= %s"
            mock_date_filter += " AND mt.test_date >= %s"
            daily_params.append(date_from)
            mock_params.append(date_from)
        if date_to:
            daily_date_filter += " AND dt.test_date <= %s"
            mock_date_filter += " AND mt.test_date <= %s"
            daily_params.append(date_to)
            mock_params.append(date_to)

        daily_score_expr = """
            CASE
                WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                ELSE safe_numeric(dt.total_marks)
            END
        """

        mock_total_score_expr = """
            CASE
                WHEN mt.test_total_marks IS NOT NULL AND mt.test_total_marks > 0 AND safe_numeric(mt.total_marks) IS NOT NULL
                    THEN (safe_numeric(mt.total_marks) * 100.0 / mt.test_total_marks)
                ELSE safe_numeric(mt.total_marks)
            END
        """

        cursor.execute(f"""
            SELECT dt.test_date, {daily_score_expr} AS score, dt.subject
            FROM daily_test dt
            WHERE dt.student_id = %s {daily_date_filter}
            ORDER BY dt.test_date
        """, [student_id] + daily_params)
        daily_rows = cursor.fetchall()

        cursor.execute(f"""
            SELECT mt.test_date, {mock_total_score_expr} AS score
            FROM mock_test mt
            WHERE mt.student_id = %s {mock_date_filter}
            ORDER BY mt.test_date
        """, [student_id] + mock_params)
        mock_rows = cursor.fetchall()

        score_points = []
        score_values = []
        subject_scores = defaultdict(list)

        for r in daily_rows:
            d = r[0].isoformat() if r[0] else None
            score = float(r[1]) if r[1] is not None else None
            subject = r[2]
            score_points.append({"date": d, "score": score})
            if score is not None:
                score_values.append(score)
                if subject:
                    subject_scores[subject].append({"date": d, "score": score})

        for r in mock_rows:
            d = r[0].isoformat() if r[0] else None
            score = float(r[1]) if r[1] is not None else None
            score_points.append({"date": d, "score": score})
            if score is not None:
                score_values.append(score)

        overall_avg = round(sum(score_values) / len(score_values), 1) if score_values else None
        trend_slope = compute_slope(score_points)
        consistency_stddev = compute_stddev(score_values)

        # Participation (tests attempted vs tests conducted in batch)
        cursor.execute(f"""
            SELECT COUNT(DISTINCT (dt.test_date, dt.subject, dt.unit_name))
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {daily_date_filter}
        """, [batch_id] + daily_params)
        total_daily_conducted = cursor.fetchone()[0] or 0

        cursor.execute(f"""
            SELECT COUNT(DISTINCT (dt.test_date, dt.subject, dt.unit_name))
            FROM daily_test dt
            WHERE dt.student_id = %s {daily_date_filter}
              AND dt.total_marks IS NOT NULL
              AND trim(dt.total_marks) <> ''
              AND LOWER(TRIM(dt.total_marks)) NOT IN ('a', 'ab')
        """, [student_id] + daily_params)
        student_daily_attempted = cursor.fetchone()[0] or 0

        cursor.execute(f"""
            SELECT COUNT(DISTINCT mt.test_date)
            FROM mock_test mt
            JOIN student s ON s.student_id = mt.student_id
            WHERE s.batch_id = %s {mock_date_filter}
        """, [batch_id] + mock_params)
        total_mock_conducted = cursor.fetchone()[0] or 0

        cursor.execute(f"""
            SELECT COUNT(DISTINCT mt.test_date)
            FROM mock_test mt
            WHERE mt.student_id = %s {mock_date_filter}
                  AND NOT (
                          LOWER(TRIM(COALESCE(mt.total_marks, ''))) IN ('a', 'ab')
                      OR LOWER(TRIM(COALESCE(mt.maths_marks, ''))) IN ('a', 'ab')
                      OR LOWER(TRIM(COALESCE(mt.physics_marks, ''))) IN ('a', 'ab')
                      OR LOWER(TRIM(COALESCE(mt.chemistry_marks, ''))) IN ('a', 'ab')
                      OR LOWER(TRIM(COALESCE(mt.biology_marks, ''))) IN ('a', 'ab')
                  )
                  AND (
                          trim(COALESCE(mt.total_marks, '')) <> ''
                      OR trim(COALESCE(mt.maths_marks, '')) <> ''
                      OR trim(COALESCE(mt.physics_marks, '')) <> ''
                      OR trim(COALESCE(mt.chemistry_marks, '')) <> ''
                      OR trim(COALESCE(mt.biology_marks, '')) <> ''
                  )
        """, [student_id] + mock_params)
        student_mock_attempted = cursor.fetchone()[0] or 0

        total_conducted = total_daily_conducted + total_mock_conducted
        total_attempted = student_daily_attempted + student_mock_attempted
        participation_rate = round((total_attempted / total_conducted) * 100, 1) if total_conducted > 0 else 0

        # Non-numeric rate on student marks rows
        cursor.execute(f"""
            SELECT
                COUNT(*) FILTER (WHERE dt.total_marks IS NOT NULL AND trim(dt.total_marks) <> ''),
                COUNT(*) FILTER (WHERE dt.total_marks IS NOT NULL AND trim(dt.total_marks) <> '' AND safe_numeric(dt.total_marks) IS NULL)
            FROM daily_test dt
            WHERE dt.student_id = %s {daily_date_filter}
        """, [student_id] + daily_params)
        d_total, d_non_numeric = cursor.fetchone()
        d_total = d_total or 0
        d_non_numeric = d_non_numeric or 0

        cursor.execute(f"""
            SELECT
                COUNT(*) FILTER (WHERE mt.total_marks IS NOT NULL AND trim(mt.total_marks) <> ''),
                COUNT(*) FILTER (WHERE mt.total_marks IS NOT NULL AND trim(mt.total_marks) <> '' AND safe_numeric(mt.total_marks) IS NULL)
            FROM mock_test mt
            WHERE mt.student_id = %s {mock_date_filter}
        """, [student_id] + mock_params)
        m_total, m_non_numeric = cursor.fetchone()
        m_total = m_total or 0
        m_non_numeric = m_non_numeric or 0

        non_numeric_rate = round(((d_non_numeric + m_non_numeric) / (d_total + m_total)) * 100, 1) if (d_total + m_total) > 0 else 0

        # Subject metrics (student avg vs batch avg + slope)
        subject_metrics = []
        for subj, points in subject_scores.items():
            subj_scores = [p["score"] for p in points if p.get("score") is not None]
            if not subj_scores:
                continue
            student_subj_avg = round(sum(subj_scores) / len(subj_scores), 1)
            cursor.execute(f"""
                SELECT ROUND(AVG({daily_score_expr})::numeric, 1)
                FROM daily_test dt
                JOIN student s ON s.student_id = dt.student_id
                WHERE s.batch_id = %s AND {normalized_subject_sql('dt.subject')} = %s {daily_date_filter}
            """, [batch_id, normalize_subject_key(subj)] + daily_params)
            batch_subj_avg_row = cursor.fetchone()
            batch_subj_avg = float(batch_subj_avg_row[0]) if batch_subj_avg_row and batch_subj_avg_row[0] is not None else 0
            subject_metrics.append({
                "subject": subj,
                "avg_pct": student_subj_avg,
                "delta_vs_batch": round(student_subj_avg - batch_subj_avg, 1),
                "trend_slope": compute_slope(points)
            })

        # Percentile among batch students
        cursor.execute(f"""
            WITH all_scores AS (
                SELECT s.student_id,
                    CASE
                        WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                            THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                        WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                            THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                        ELSE safe_numeric(dt.total_marks)
                    END AS score
                FROM daily_test dt
                JOIN student s ON s.student_id = dt.student_id
                WHERE s.batch_id = %s {daily_date_filter}
                UNION ALL
                SELECT s.student_id,
                    CASE
                        WHEN mt.test_total_marks IS NOT NULL AND mt.test_total_marks > 0 AND safe_numeric(mt.total_marks) IS NOT NULL
                            THEN (safe_numeric(mt.total_marks) * 100.0 / mt.test_total_marks)
                        ELSE safe_numeric(mt.total_marks)
                    END AS score
                FROM mock_test mt
                JOIN student s ON s.student_id = mt.student_id
                WHERE s.batch_id = %s {mock_date_filter}
            ),
            student_avg AS (
                SELECT student_id, AVG(score) AS avg_score
                FROM all_scores
                WHERE score IS NOT NULL
                GROUP BY student_id
            ),
            ranked AS (
                SELECT student_id, avg_score, PERCENT_RANK() OVER (ORDER BY avg_score) AS pr
                FROM student_avg
            )
            SELECT pr FROM ranked WHERE student_id = %s
        """, [batch_id] + daily_params + [batch_id] + mock_params + [student_id])
        pr_row = cursor.fetchone()
        percentile_overall = round(float(pr_row[0]) * 100, 1) if pr_row and pr_row[0] is not None else 0

        risk_score, risk_level, reasons, recommended_action = compute_risk_score(
            overall_avg,
            trend_slope,
            participation_rate,
            non_numeric_rate
        )

        return {
            "student_id": student_id,
            "student_name": student_row[1],
            "overall_avg_pct": overall_avg,
            "trend_slope": trend_slope,
            "consistency_stddev": consistency_stddev,
            "participation_rate": participation_rate,
            "daily_tests_conducted": total_daily_conducted,
            "daily_tests_attended": student_daily_attempted,
            "mock_tests_conducted": total_mock_conducted,
            "mock_tests_attended": student_mock_attempted,
            "percentile_overall": percentile_overall,
            "non_numeric_rate": non_numeric_rate,
            "subject_metrics": sorted(subject_metrics, key=lambda x: x["avg_pct"]),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "reasons": reasons,
            "recommended_action": recommended_action
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch student metrics: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/student-weak-topics/{student_id}")
async def get_student_weak_topics(
    student_id: str,
    limit: int = 5,
    test_type: str = Query("daily", description="daily or mock"),
    subject: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Top weak unit-level topics for a student with remediation suggestions."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT student_id, student_name, batch_id FROM student WHERE student_id = %s", (student_id,))
        student_row = cursor.fetchone()
        if not student_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student {student_id} not found")

        batch_id = student_row[2]

        cursor.execute("SELECT subjects FROM batch WHERE batch_id = %s", (batch_id,))
        batch_row = cursor.fetchone()
        active_mock_subjects = set(get_batch_mock_subjects(batch_row[0] if batch_row else None))

        normalized_limit = max(1, min(limit, 100))

        selected_type = str(test_type or "daily").strip().lower()
        if selected_type not in ("daily", "mock"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="test_type must be 'daily' or 'mock'"
            )

        weak_units = []

        if selected_type == "daily":
            score_expr = """
                CASE
                    WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                        THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                    WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                        THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                    ELSE safe_numeric(dt.total_marks)
                END
            """

            filters = ""
            params = [student_id]
            if subject:
                filters += f" AND {normalized_subject_sql('dt.subject')} = %s"
                params.append(normalize_subject_key(subject))
            if date_from:
                filters += " AND dt.test_date >= %s"
                params.append(date_from)
            if date_to:
                filters += " AND dt.test_date <= %s"
                params.append(date_to)

            cursor.execute(f"""
                SELECT
                    dt.subject,
                    COALESCE(NULLIF(TRIM(dt.unit_name), ''), 'Unknown') AS unit_name,
                    ROUND(AVG({score_expr})::numeric, 2) AS avg_pct,
                    COUNT(*) AS attempts,
                    MAX(dt.test_date) AS latest_test_date,
                    COUNT(*) FILTER (
                        WHERE dt.total_marks IS NOT NULL
                          AND TRIM(dt.total_marks) <> ''
                          AND safe_numeric(dt.total_marks) IS NULL
                    ) AS non_numeric_attempts
                FROM daily_test dt
                WHERE dt.student_id = %s {filters}
                GROUP BY dt.subject, COALESCE(NULLIF(TRIM(dt.unit_name), ''), 'Unknown')
                HAVING COUNT(*) > 0
                ORDER BY avg_pct ASC NULLS LAST, attempts DESC
                LIMIT %s
            """, params + [normalized_limit])

            for row in cursor.fetchall():
                avg_pct = float(row[2]) if row[2] is not None else 0.0

                if avg_pct < 35:
                    action = "High-priority remediation: rebuild concepts, revise formulas."
                elif avg_pct < 50:
                    action = "Focused remediation: teacher-led recap."
                elif avg_pct < 65:
                    action = "Stabilize topic: mixed timed practice plus error-log revision."
                else:
                    action = "Maintain and polish: short revision and periodic practice to retain strength."

                weak_units.append({
                    "subject": normalize_subject_label(row[0] or "Unknown"),
                    "unit_name": row[1],
                    "avg_pct": round(avg_pct, 2),
                    "difficulty_index": round(max(0, 100 - avg_pct), 2),
                    "attempts": row[3],
                    "latest_test_date": row[4].isoformat() if row[4] else None,
                    "non_numeric_attempts": row[5] or 0,
                    "remediation_action": action
                })
        else:
            filters = ""
            params = [student_id]
            if date_from:
                filters += " AND mt.test_date >= %s"
                params.append(date_from)
            if date_to:
                filters += " AND mt.test_date <= %s"
                params.append(date_to)

            cursor.execute(f"""
                SELECT
                    mt.test_date,
                    mt.maths_marks,
                    mt.physics_marks,
                    mt.chemistry_marks,
                    mt.biology_marks,
                    mt.maths_unit_names,
                    mt.physics_unit_names,
                    mt.chemistry_unit_names,
                    mt.biology_unit_names,
                    mt.maths_total_marks,
                    mt.physics_total_marks,
                    mt.chemistry_total_marks,
                    mt.biology_total_marks
                FROM mock_test mt
                WHERE mt.student_id = %s {filters}
                ORDER BY mt.test_date DESC
            """, params)

            subject_filter_key = normalize_subject_key(subject) if subject else None
            if subject_filter_key == "mathematics":
                subject_filter_key = "maths"

            subject_meta = {
                "maths": {"label": "Mathematics", "marks_idx": 1, "units_idx": 5, "total_idx": 9},
                "physics": {"label": "Physics", "marks_idx": 2, "units_idx": 6, "total_idx": 10},
                "chemistry": {"label": "Chemistry", "marks_idx": 3, "units_idx": 7, "total_idx": 11},
                "biology": {"label": "Biology", "marks_idx": 4, "units_idx": 8, "total_idx": 12},
            }

            aggregated = {}
            for row in cursor.fetchall():
                test_date = row[0]
                for subject_key, meta in subject_meta.items():
                    if subject_key not in active_mock_subjects:
                        continue
                    if subject_filter_key and subject_filter_key != subject_key:
                        continue

                    raw_mark = row[meta["marks_idx"]]
                    mark_value = safe_parse_mark(raw_mark)
                    total_value = safe_parse_mark(row[meta["total_idx"]])

                    mark_text = str(raw_mark).strip() if raw_mark is not None else ''
                    has_attempt = mark_text != ''
                    if not has_attempt:
                        continue

                    units = row[meta["units_idx"]] or []
                    if not isinstance(units, list):
                        units = [units]
                    clean_units = [str(u).strip() for u in units if str(u).strip()]
                    if not clean_units:
                        clean_units = ["Unknown"]

                    score_pct = None
                    if mark_value is not None and total_value is not None and total_value > 0:
                        score_pct = (float(mark_value) * 100.0) / float(total_value)

                    is_non_numeric = (
                        raw_mark is not None and mark_text != '' and mark_value is None
                    )

                    for unit_name in clean_units:
                        key = (meta["label"], unit_name)
                        if key not in aggregated:
                            aggregated[key] = {
                                "score_sum": 0.0,
                                "score_count": 0,
                                "attempts": 0,
                                "non_numeric_attempts": 0,
                                "latest_test_date": None,
                            }

                        aggregated[key]["attempts"] += 1
                        if score_pct is not None:
                            aggregated[key]["score_sum"] += score_pct
                            aggregated[key]["score_count"] += 1
                        if is_non_numeric:
                            aggregated[key]["non_numeric_attempts"] += 1

                        if test_date and (
                            aggregated[key]["latest_test_date"] is None
                            or test_date > aggregated[key]["latest_test_date"]
                        ):
                            aggregated[key]["latest_test_date"] = test_date

            ordered_units = []
            for (subject_label, unit_name), agg in aggregated.items():
                if agg["score_count"] > 0:
                    avg_pct = round(agg["score_sum"] / agg["score_count"], 2)
                else:
                    avg_pct = 0.0
                ordered_units.append((subject_label, unit_name, avg_pct, agg))

            ordered_units.sort(key=lambda x: (x[2], -x[3]["attempts"]))
            ordered_units = ordered_units[:normalized_limit]

            for subject_label, unit_name, avg_pct, agg in ordered_units:
                if avg_pct < 35:
                    action = "High-priority remediation: rebuild concepts, revise formulas."
                elif avg_pct < 50:
                    action = "Focused remediation: teacher-led recap."
                elif avg_pct < 65:
                    action = "Stabilize topic: mixed timed practice plus error-log revision."
                else:
                    action = "Maintain and polish: short revision and periodic practice to retain strength."

                weak_units.append({
                    "subject": subject_label,
                    "unit_name": unit_name,
                    "avg_pct": round(avg_pct, 2),
                    "difficulty_index": round(max(0, 100 - avg_pct), 2),
                    "attempts": agg["attempts"],
                    "latest_test_date": agg["latest_test_date"].isoformat() if agg["latest_test_date"] else None,
                    "non_numeric_attempts": agg["non_numeric_attempts"],
                    "remediation_action": action
                })

        return {
            "student_id": student_id,
            "student_name": student_row[1],
            "test_type": selected_type,
            "weak_units": weak_units,
            "total_weak_units": len(weak_units)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch student weak topics: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/student-test-insights/{student_id}")
async def get_student_test_insights(
    student_id: str,
    test_type: str = Query("both", description="daily, mock, or both"),
    limit: int = Query(12, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Per-test insight cards for remediation UI (achievements + red flags)."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.student_id, s.student_name, s.batch_id, b.subjects
            FROM student s
            JOIN batch b ON b.batch_id = s.batch_id
            WHERE s.student_id = %s
        """, (student_id,))
        student_row = cursor.fetchone()
        if not student_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student {student_id} not found")

        student_name = student_row[1]
        batch_id = student_row[2]

        selected_type = str(test_type or "both").strip().lower()
        if selected_type not in ("daily", "mock", "both"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="test_type must be 'daily', 'mock', or 'both'")

        daily_insights = []
        mock_insights = []

        if selected_type in ("daily", "both"):
            cursor.execute("""
                SELECT
                    dt.test_id,
                    dt.test_date,
                    dt.subject,
                    dt.unit_name,
                    dt.total_marks,
                    dt.subject_total_marks,
                    dt.test_total_marks
                FROM daily_test dt
                WHERE dt.student_id = %s
                ORDER BY dt.test_date ASC, dt.test_id ASC
            """, (student_id,))
            student_daily_rows = cursor.fetchall()

            cursor.execute(f"""
                SELECT
                    dt.test_date,
                    {normalized_subject_sql('dt.subject')} AS subject_key,
                    COALESCE(NULLIF(TRIM(dt.unit_name), ''), 'Unknown') AS unit_name,
                    dt.student_id,
                    dt.total_marks,
                    dt.subject_total_marks,
                    dt.test_total_marks
                FROM daily_test dt
                JOIN student s ON s.student_id = dt.student_id
                WHERE s.batch_id = %s
                ORDER BY dt.test_date ASC
            """, (batch_id,))
            batch_daily_rows = cursor.fetchall()

            daily_group = defaultdict(list)
            for row in batch_daily_rows:
                date_key, subject_key, unit_name, sid, marks, subject_total, test_total = row
                score = None if is_absent_mark(marks) else safe_parse_mark(marks)
                daily_group[(date_key, subject_key, unit_name)].append({"sid": sid, "score": score})

            prev_score_by_subject = {}
            prev_rank_by_subject = {}

            for idx, row in enumerate(student_daily_rows):
                test_id, test_date, subject, unit_name, marks, subject_total, test_total = row
                subject_key = normalize_subject_key(subject)
                unit_key = (unit_name or '').strip() or 'Unknown'
                test_key = (test_date, subject_key, unit_key)

                group_scores = [r for r in daily_group.get(test_key, []) if r["score"] is not None]
                group_scores.sort(key=lambda x: x["score"], reverse=True)

                rank = None
                rank_total = len(group_scores)
                rank_map = {}
                for pos, item in enumerate(group_scores, start=1):
                    rank_map.setdefault(item["sid"], pos)
                if student_id in rank_map:
                    rank = rank_map[student_id]

                class_avg = round(sum(r["score"] for r in group_scores) / rank_total, 2) if rank_total > 0 else None
                class_high = group_scores[0]["score"] if rank_total > 0 else None
                class_low = group_scores[-1]["score"] if rank_total > 0 else None

                score = None if is_absent_mark(marks) else safe_parse_mark(marks)
                achievements = []
                red_flags = []

                if score is None:
                    red_flags.append({
                        "type": "least_attempted",
                        "title": "Missed This Test",
                        "detail": "Marked as A/AB in this test.",
                        "metric": {"mark": str(marks) if marks is not None else "A"},
                        "remediation_action": "Re-attempt this unit test in the next practice cycle."
                    })
                else:
                    prev_score = prev_score_by_subject.get(subject_key)
                    prev_rank = prev_rank_by_subject.get(subject_key)
                    if prev_score is not None:
                        delta = round(score - prev_score, 2)
                        if delta >= 8:
                            achievements.append({
                                "type": "score_jump",
                                "title": "Big Improvement",
                                "detail": f"{normalize_subject_label(subject)} improved strongly from previous test.",
                                "metric": {"delta": delta, "previous": prev_score, "current": score},
                                "remediation_action": "Sustain momentum with one revision drill on this unit."
                            })
                        elif delta <= -8:
                            red_flags.append({
                                "type": "score_drop",
                                "title": "Score Went Down",
                                "detail": f"{normalize_subject_label(subject)} dropped vs previous test.",
                                "metric": {"delta": delta, "previous": prev_score, "current": score},
                                "remediation_action": "Review error log and redo the last two worksheets for this unit."
                            })

                    if class_avg is not None and score - class_avg >= 10:
                        achievements.append({
                            "type": "efficient_scorer",
                            "title": "Scored Above Average",
                            "detail": "Scored well above class average.",
                            "metric": {"student": score, "class_avg": class_avg, "delta": round(score - class_avg, 2)},
                            "remediation_action": "Promote to advanced mixed-problem set for this subject."
                        })

                    if rank is not None and rank <= 3:
                        achievements.append({
                            "type": "top_in_topic",
                            "title": "Among the Best in Class",
                            "detail": f"Rank {rank} in class for this topic test.",
                            "metric": {"rank": rank, "total": rank_total},
                            "remediation_action": "Maintain accuracy with spaced recall mini-tests."
                        })

                    if prev_rank is not None and rank is not None and rank - prev_rank >= 5:
                        red_flags.append({
                            "type": "rank_drop",
                            "title": "Rank Went Down",
                            "detail": "Class rank dropped noticeably from previous test.",
                            "metric": {"previous_rank": prev_rank, "current_rank": rank, "delta": rank - prev_rank},
                            "remediation_action": "Run a targeted remediation session before the next test."
                        })

                    prev_score_by_subject[subject_key] = score
                    if rank is not None:
                        prev_rank_by_subject[subject_key] = rank

                daily_insights.append({
                    "test_type": "daily",
                    "test_id": test_id,
                    "test_date": test_date.isoformat() if test_date else None,
                    "test_label": f"DT-{idx + 1}",
                    "subject": normalize_subject_label(subject),
                    "unit_name": unit_key,
                    "score": score,
                    "class_avg": class_avg,
                    "class_high": class_high,
                    "class_low": class_low,
                    "rank": rank,
                    "rank_total": rank_total,
                    "achievements": achievements,
                    "red_flags": red_flags
                })

        if selected_type in ("mock", "both"):
            cursor.execute("""
                SELECT
                    mt.test_id,
                    mt.test_date,
                    mt.total_marks,
                    mt.test_total_marks,
                    mt.maths_marks,
                    mt.physics_marks,
                    mt.chemistry_marks,
                    mt.biology_marks,
                    mt.maths_total_marks,
                    mt.physics_total_marks,
                    mt.chemistry_total_marks,
                    mt.biology_total_marks
                FROM mock_test mt
                WHERE mt.student_id = %s
                ORDER BY mt.test_date ASC, mt.test_id ASC
            """, (student_id,))
            student_mock_rows = cursor.fetchall()

            cursor.execute("""
                SELECT
                    mt.test_date,
                    mt.student_id,
                    mt.total_marks,
                    mt.test_total_marks,
                    mt.maths_marks,
                    mt.physics_marks,
                    mt.chemistry_marks,
                    mt.biology_marks,
                    mt.maths_total_marks,
                    mt.physics_total_marks,
                    mt.chemistry_total_marks,
                    mt.biology_total_marks
                FROM mock_test mt
                JOIN student s ON s.student_id = mt.student_id
                WHERE s.batch_id = %s
                ORDER BY mt.test_date ASC
            """, (batch_id,))
            batch_mock_rows = cursor.fetchall()

            mock_group = defaultdict(list)
            for row in batch_mock_rows:
                (
                    test_date, sid, total_marks, test_total_marks,
                    maths_marks, physics_marks, chemistry_marks, biology_marks,
                    maths_total, physics_total, chemistry_total, biology_total
                ) = row
                mock_group[test_date].append({
                    "sid": sid,
                    "overall": None if is_absent_mark(total_marks) else safe_parse_mark(total_marks),
                    "maths": None if is_absent_mark(maths_marks) else safe_parse_mark(maths_marks),
                    "physics": None if is_absent_mark(physics_marks) else safe_parse_mark(physics_marks),
                    "chemistry": None if is_absent_mark(chemistry_marks) else safe_parse_mark(chemistry_marks),
                    "biology": None if is_absent_mark(biology_marks) else safe_parse_mark(biology_marks),
                })

            prev_total_score = None
            prev_rank = None

            for idx, row in enumerate(student_mock_rows):
                (
                    test_id, test_date, total_marks, test_total_marks,
                    maths_marks, physics_marks, chemistry_marks, biology_marks,
                    maths_total, physics_total, chemistry_total, biology_total
                ) = row

                student_total = None if is_absent_mark(total_marks) else safe_parse_mark(total_marks)
                student_subjects = {
                    "maths": None if is_absent_mark(maths_marks) else safe_parse_mark(maths_marks),
                    "physics": None if is_absent_mark(physics_marks) else safe_parse_mark(physics_marks),
                    "chemistry": None if is_absent_mark(chemistry_marks) else safe_parse_mark(chemistry_marks),
                    "biology": None if is_absent_mark(biology_marks) else safe_parse_mark(biology_marks),
                }

                batch_rows = mock_group.get(test_date, [])
                overall_rows = [r for r in batch_rows if r["overall"] is not None]
                overall_rows.sort(key=lambda x: x["overall"], reverse=True)
                rank_total = len(overall_rows)
                rank_map = {}
                for pos, item in enumerate(overall_rows, start=1):
                    rank_map.setdefault(item["sid"], pos)
                rank = rank_map.get(student_id)

                class_avg = round(sum(r["overall"] for r in overall_rows) / rank_total, 2) if rank_total > 0 else None
                class_high = overall_rows[0]["overall"] if rank_total > 0 else None
                class_low = overall_rows[-1]["overall"] if rank_total > 0 else None

                subject_ranks = {}
                for subject_key in ["maths", "physics", "chemistry", "biology"]:
                    rows = [r for r in batch_rows if r[subject_key] is not None]
                    rows.sort(key=lambda x: x[subject_key], reverse=True)
                    rank_map_sub = {}
                    for pos, item in enumerate(rows, start=1):
                        rank_map_sub.setdefault(item["sid"], pos)
                    subject_ranks[subject_key] = {
                        "rank": rank_map_sub.get(student_id),
                        "total": len(rows),
                        "class_avg": round(sum(r[subject_key] for r in rows) / len(rows), 2) if rows else None
                    }

                achievements = []
                red_flags = []

                if student_total is None:
                    red_flags.append({
                        "type": "least_attempted",
                        "title": "Missed This Mock Test",
                        "detail": "Mock test marked absent (A/AB).",
                        "metric": {"mark": str(total_marks) if total_marks is not None else "A"},
                        "remediation_action": "Schedule full mock re-attempt under timed conditions."
                    })
                else:
                    if prev_total_score is not None:
                        delta = round(student_total - prev_total_score, 2)
                        if delta >= 5:
                            achievements.append({
                                "type": "score_jump",
                                "title": "Big Improvement",
                                "detail": "Overall mock score improved from previous test.",
                                "metric": {"delta": delta, "previous": prev_total_score, "current": student_total},
                                "remediation_action": "Continue current study plan with mixed revision."
                            })
                        elif delta <= -5:
                            red_flags.append({
                                "type": "score_drop",
                                "title": "Score Went Down",
                                "detail": "Overall mock score dropped from previous test.",
                                "metric": {"delta": delta, "previous": prev_total_score, "current": student_total},
                                "remediation_action": "Prioritize weak chapters and run one targeted mock this week."
                            })

                    if class_avg is not None and student_total - class_avg >= 8:
                        achievements.append({
                            "type": "efficient_scorer",
                            "title": "Scored Above Average",
                            "detail": "Overall score is well above class average.",
                            "metric": {"student": student_total, "class_avg": class_avg, "delta": round(student_total - class_avg, 2)},
                            "remediation_action": "Attempt higher-difficulty question sets for edge gains."
                        })

                    if rank is not None and rank <= 3:
                        achievements.append({
                            "type": "consistent_growth",
                            "title": "Among Top Performers",
                            "detail": f"Overall rank {rank} in this mock.",
                            "metric": {"rank": rank, "total": rank_total},
                            "remediation_action": "Maintain consistency with spaced mock practice."
                        })

                    if prev_rank is not None and rank is not None and rank - prev_rank >= 5:
                        red_flags.append({
                            "type": "rank_drop",
                            "title": "Rank Went Down",
                            "detail": "Overall rank dropped noticeably vs previous mock.",
                            "metric": {"previous_rank": prev_rank, "current_rank": rank, "delta": rank - prev_rank},
                            "remediation_action": "Run exam-strategy review and time-management correction."
                        })

                    best_subject = None
                    best_delta = None
                    for subject_key, score in student_subjects.items():
                        if score is None:
                            continue
                        cls_avg = subject_ranks[subject_key]["class_avg"]
                        if cls_avg is None:
                            continue
                        delta = round(score - cls_avg, 2)
                        if best_delta is None or delta > best_delta:
                            best_delta = delta
                            best_subject = subject_key
                    if best_subject and best_delta is not None and best_delta >= 10:
                        achievements.append({
                            "type": "top_in_topic",
                            "title": "Strong in This Subject",
                            "detail": f"{normalize_subject_label(best_subject)} is a strong positive differentiator.",
                            "metric": {
                                "subject": normalize_subject_label(best_subject),
                                "delta_vs_avg": best_delta,
                                "rank": subject_ranks[best_subject]["rank"],
                                "total": subject_ranks[best_subject]["total"]
                            },
                            "remediation_action": "Leverage this subject strength to improve aggregate score."
                        })

                    low_subjects = [
                        subject_key for subject_key, score in student_subjects.items()
                        if score is not None and subject_ranks[subject_key]["class_avg"] is not None and score - subject_ranks[subject_key]["class_avg"] <= -12
                    ]
                    if low_subjects:
                        red_flags.append({
                            "type": "high_effort_low_return",
                            "title": "Worked Hard, Score Still Low",
                            "detail": "One or more subjects are significantly below class average.",
                            "metric": {"subjects": [normalize_subject_label(s) for s in low_subjects]},
                            "remediation_action": "Allocate two focused remediation blocks for these subjects before next mock."
                        })

                    prev_total_score = student_total
                    if rank is not None:
                        prev_rank = rank

                mock_insights.append({
                    "test_type": "mock",
                    "test_id": test_id,
                    "test_date": test_date.isoformat() if test_date else None,
                    "test_label": f"MT-{idx + 1}",
                    "score": student_total,
                    "class_avg": class_avg,
                    "class_high": class_high,
                    "class_low": class_low,
                    "rank": rank,
                    "rank_total": rank_total,
                    "achievements": achievements,
                    "red_flags": red_flags
                })

        daily_payload = list(reversed(daily_insights))
        mock_payload = list(reversed(mock_insights))
        combined = sorted(daily_payload + mock_payload, key=lambda x: x.get("test_date") or "", reverse=True)

        return {
            "student_id": student_id,
            "student_name": student_name,
            "insights": {
                "daily": daily_payload,
                "mock": mock_payload,
                "combined_latest": combined[:limit]
            },
            "count": {
                "daily": len(daily_payload),
                "mock": len(mock_payload),
                "combined_latest": min(limit, len(combined))
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch student test insights: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/batch-advanced/{batch_id}")
async def get_batch_advanced_stats(
    batch_id: int,
    test_type: Optional[str] = Query("both", description="daily, mock, or both"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    subject: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Batch advanced metrics: median/quartiles/IQR/stddev/percentile-bands/outliers/difficulty."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT batch_id FROM batch WHERE batch_id = %s", (batch_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch {batch_id} not found")

        daily_date_filter = ""
        mock_date_filter = ""
        daily_subject_filter = ""
        daily_params = []
        mock_params = []
        daily_subject_params = []

        if date_from:
            daily_date_filter += " AND dt.test_date >= %s"
            mock_date_filter += " AND mt.test_date >= %s"
            daily_params.append(date_from)
            mock_params.append(date_from)
        if date_to:
            daily_date_filter += " AND dt.test_date <= %s"
            mock_date_filter += " AND mt.test_date <= %s"
            daily_params.append(date_to)
            mock_params.append(date_to)
        if subject:
            daily_subject_filter = f" AND {normalized_subject_sql('dt.subject')} = %s"
            daily_subject_params.append(normalize_subject_key(subject))

        daily_score_expr = """
            CASE
                WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                ELSE safe_numeric(dt.total_marks)
            END
        """
        mock_total_score_expr = """
            CASE
                WHEN mt.test_total_marks IS NOT NULL AND mt.test_total_marks > 0 AND safe_numeric(mt.total_marks) IS NOT NULL
                    THEN (safe_numeric(mt.total_marks) * 100.0 / mt.test_total_marks)
                ELSE safe_numeric(mt.total_marks)
            END
        """

        daily_student_avgs = {}
        mock_student_avgs = {}

        if test_type in ("daily", "both"):
            cursor.execute(f"""
                SELECT s.student_id, s.student_name, ROUND(AVG({daily_score_expr})::numeric, 2)
                FROM daily_test dt
                JOIN student s ON s.student_id = dt.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
                GROUP BY s.student_id, s.student_name
            """, [batch_id] + daily_params + daily_subject_params)
            for sid, sname, avg_score in cursor.fetchall():
                daily_student_avgs[sid] = {"student_id": sid, "student_name": sname, "avg": float(avg_score) if avg_score is not None else None}

        if test_type in ("mock", "both"):
            cursor.execute(f"""
                SELECT s.student_id, s.student_name, ROUND(AVG({mock_total_score_expr})::numeric, 2)
                FROM mock_test mt
                JOIN student s ON s.student_id = mt.student_id
                WHERE s.batch_id = %s {mock_date_filter}
                GROUP BY s.student_id, s.student_name
            """, [batch_id] + mock_params)
            for sid, sname, avg_score in cursor.fetchall():
                mock_student_avgs[sid] = {"student_id": sid, "student_name": sname, "avg": float(avg_score) if avg_score is not None else None}

        # combine as existing strategy (equal weight of available daily/mock averages)
        combined = {}
        for sid, rec in daily_student_avgs.items():
            combined[sid] = {
                "student_id": sid,
                "student_name": rec["student_name"],
                "daily_avg": rec["avg"],
                "mock_avg": None,
                "overall_avg": rec["avg"] if rec["avg"] is not None else None
            }
        for sid, rec in mock_student_avgs.items():
            if sid not in combined:
                combined[sid] = {
                    "student_id": sid,
                    "student_name": rec["student_name"],
                    "daily_avg": None,
                    "mock_avg": rec["avg"],
                    "overall_avg": rec["avg"] if rec["avg"] is not None else None
                }
            else:
                combined[sid]["mock_avg"] = rec["avg"]
                vals = [v for v in [combined[sid]["daily_avg"], combined[sid]["mock_avg"]] if v is not None]
                combined[sid]["overall_avg"] = round(sum(vals) / len(vals), 2) if vals else None

        overall_scores = sorted([float(v["overall_avg"]) for v in combined.values() if v["overall_avg"] is not None])
        q1 = percentile(overall_scores, 25)
        median_val = percentile(overall_scores, 50)
        q3 = percentile(overall_scores, 75)
        iqr = q3 - q1
        lower_fence = q1 - (1.5 * iqr)
        upper_fence = q3 + (1.5 * iqr)

        outliers_low = []
        outliers_high = []
        for rec in combined.values():
            score = float(rec["overall_avg"]) if rec["overall_avg"] is not None else None
            if score is None:
                continue
            if score < lower_fence:
                outliers_low.append({"student_id": rec["student_id"], "student_name": rec["student_name"], "score": round(score, 2)})
            elif score > upper_fence:
                outliers_high.append({"student_id": rec["student_id"], "student_name": rec["student_name"], "score": round(score, 2)})

        # difficulty by test
        difficulty_by_test = []
        if test_type in ("daily", "both"):
            cursor.execute(f"""
                SELECT
                    dt.test_date,
                    dt.subject,
                    dt.unit_name,
                    ROUND(AVG({daily_score_expr})::numeric, 2) AS avg_score,
                    COUNT(DISTINCT dt.student_id)
                FROM daily_test dt
                JOIN student s ON s.student_id = dt.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
                GROUP BY dt.test_date, dt.subject, dt.unit_name
            """, [batch_id] + daily_params + daily_subject_params)
            for r in cursor.fetchall():
                avg_score = float(r[3]) if r[3] is not None else None
                difficulty_by_test.append({
                    "test_type": "daily",
                    "test_key": f"{r[0].isoformat() if r[0] else 'NA'} | {r[1] or '-'} | {r[2] or '-'}",
                    "avg_score": avg_score,
                    "difficulty_index": round(max(0, 100 - avg_score), 2) if avg_score is not None else None,
                    "students": r[4]
                })

        if test_type in ("mock", "both"):
            cursor.execute(f"""
                SELECT
                    mt.test_date,
                    ROUND(AVG({mock_total_score_expr})::numeric, 2) AS avg_score,
                    COUNT(DISTINCT mt.student_id)
                FROM mock_test mt
                JOIN student s ON s.student_id = mt.student_id
                WHERE s.batch_id = %s {mock_date_filter}
                GROUP BY mt.test_date
            """, [batch_id] + mock_params)
            for r in cursor.fetchall():
                avg_score = float(r[1]) if r[1] is not None else None
                difficulty_by_test.append({
                    "test_type": "mock",
                    "test_key": f"{r[0].isoformat() if r[0] else 'NA'}",
                    "avg_score": avg_score,
                    "difficulty_index": round(max(0, 100 - avg_score), 2) if avg_score is not None else None,
                    "students": r[2]
                })

        difficulty_by_test = sorted(
            difficulty_by_test,
            key=lambda x: (x["difficulty_index"] is None, -(x["difficulty_index"] or 0))
        )

        return {
            "student_count": len(overall_scores),
            "median_pct": round(median_val, 2),
            "q1_pct": round(q1, 2),
            "q3_pct": round(q3, 2),
            "iqr_pct": round(iqr, 2),
            "stddev_pct": compute_stddev(overall_scores),
            "percentile_bands": {
                "p10": round(percentile(overall_scores, 10), 2),
                "p25": round(q1, 2),
                "p50": round(median_val, 2),
                "p75": round(q3, 2),
                "p90": round(percentile(overall_scores, 90), 2)
            },
            "outliers_low": outliers_low,
            "outliers_high": outliers_high,
            "difficulty_by_test": difficulty_by_test[:30]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch batch advanced stats: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/risk-dashboard/{batch_id}")
async def get_risk_dashboard(
    batch_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Batch-level risk ranking using average, trend, participation, and non-numeric rates."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT batch_id FROM batch WHERE batch_id = %s", (batch_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch {batch_id} not found")

        daily_date_filter = ""
        mock_date_filter = ""
        daily_params = []
        mock_params = []
        if date_from:
            daily_date_filter += " AND dt.test_date >= %s"
            mock_date_filter += " AND mt.test_date >= %s"
            daily_params.append(date_from)
            mock_params.append(date_from)
        if date_to:
            daily_date_filter += " AND dt.test_date <= %s"
            mock_date_filter += " AND mt.test_date <= %s"
            daily_params.append(date_to)
            mock_params.append(date_to)

        # students in batch
        cursor.execute("SELECT student_id, student_name FROM student WHERE batch_id = %s", (batch_id,))
        student_rows = cursor.fetchall()
        students = {r[0]: r[1] for r in student_rows}

        # tests conducted in batch
        cursor.execute(f"""
            SELECT COUNT(DISTINCT (dt.test_date, dt.subject, dt.unit_name))
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {daily_date_filter}
        """, [batch_id] + daily_params)
        total_daily_conducted = cursor.fetchone()[0] or 0

        cursor.execute(f"""
            SELECT COUNT(DISTINCT mt.test_date)
            FROM mock_test mt
            JOIN student s ON s.student_id = mt.student_id
            WHERE s.batch_id = %s {mock_date_filter}
        """, [batch_id] + mock_params)
        total_mock_conducted = cursor.fetchone()[0] or 0

        # fetch all scored rows for batch in one pass
        cursor.execute(f"""
            SELECT
                dt.student_id,
                dt.test_date,
                CASE
                    WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                        THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                    WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                        THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                    ELSE safe_numeric(dt.total_marks)
                END AS score,
                dt.total_marks,
                dt.subject,
                dt.unit_name
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {daily_date_filter}
        """, [batch_id] + daily_params)
        daily_scores_rows = cursor.fetchall()

        cursor.execute(f"""
            SELECT
                mt.student_id,
                mt.test_date,
                CASE
                    WHEN mt.test_total_marks IS NOT NULL AND mt.test_total_marks > 0 AND safe_numeric(mt.total_marks) IS NOT NULL
                        THEN (safe_numeric(mt.total_marks) * 100.0 / mt.test_total_marks)
                    ELSE safe_numeric(mt.total_marks)
                END AS score,
                mt.total_marks
            FROM mock_test mt
            JOIN student s ON s.student_id = mt.student_id
            WHERE s.batch_id = %s {mock_date_filter}
        """, [batch_id] + mock_params)
        mock_scores_rows = cursor.fetchall()

        by_student_points = defaultdict(list)
        by_student_values = defaultdict(list)
        by_student_non_numeric = defaultdict(lambda: {"total": 0, "bad": 0})
        by_student_daily_tests = defaultdict(set)
        by_student_mock_tests = defaultdict(set)

        for sid, test_date, score, raw_mark, subject, unit_name in daily_scores_rows:
            d = test_date.isoformat() if test_date else None
            score_f = float(score) if score is not None else None
            by_student_points[sid].append({"date": d, "score": score_f})
            if score_f is not None:
                by_student_values[sid].append(score_f)
            by_student_daily_tests[sid].add((d, subject, unit_name))
            if raw_mark is not None and str(raw_mark).strip() != '':
                by_student_non_numeric[sid]["total"] += 1
                if safe_parse_mark(raw_mark) is None:
                    by_student_non_numeric[sid]["bad"] += 1

        for sid, test_date, score, raw_mark in mock_scores_rows:
            d = test_date.isoformat() if test_date else None
            score_f = float(score) if score is not None else None
            by_student_points[sid].append({"date": d, "score": score_f})
            if score_f is not None:
                by_student_values[sid].append(score_f)
            by_student_mock_tests[sid].add(d)
            if raw_mark is not None and str(raw_mark).strip() != '':
                by_student_non_numeric[sid]["total"] += 1
                if safe_parse_mark(raw_mark) is None:
                    by_student_non_numeric[sid]["bad"] += 1

        rows = []
        high_count = 0
        medium_count = 0

        total_conducted = total_daily_conducted + total_mock_conducted
        for sid, sname in students.items():
            vals = by_student_values[sid]
            avg_score = round(sum(vals) / len(vals), 1) if vals else 0
            slope = compute_slope(by_student_points[sid])
            attempted = len(by_student_daily_tests[sid]) + len(by_student_mock_tests[sid])
            participation = round((attempted / total_conducted) * 100, 1) if total_conducted > 0 else 0
            nn_total = by_student_non_numeric[sid]["total"]
            nn_bad = by_student_non_numeric[sid]["bad"]
            non_numeric_rate = round((nn_bad / nn_total) * 100, 1) if nn_total > 0 else 0
            risk_score, risk_level, reasons, recommended_action = compute_risk_score(
                avg_score,
                slope,
                participation,
                non_numeric_rate
            )
            if risk_level == "high":
                high_count += 1
            elif risk_level == "medium":
                medium_count += 1

            rows.append({
                "student_id": sid,
                "student_name": sname,
                "avg_score": avg_score,
                "trend_slope": slope,
                "participation_rate": participation,
                "non_numeric_rate": non_numeric_rate,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "reasons": reasons,
                "recommended_action": recommended_action
            })

        rows = sorted(rows, key=lambda x: x["risk_score"], reverse=True)

        return {
            "high_risk_count": high_count,
            "medium_risk_count": medium_count,
            "low_risk_count": max(0, len(rows) - high_count - medium_count),
            "students": rows[:limit]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch risk dashboard: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/subject-diagnostics/{batch_id}")
async def get_subject_diagnostics(
    batch_id: int,
    subject: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Subject diagnostics: avg, unit breakdown, weak students, improving students."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT batch_id FROM batch WHERE batch_id = %s", (batch_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch {batch_id} not found")

        date_filter = ""
        params = [batch_id]
        if date_from:
            date_filter += " AND dt.test_date >= %s"
            params.append(date_from)
        if date_to:
            date_filter += " AND dt.test_date <= %s"
            params.append(date_to)
        if subject:
            date_filter += f" AND {normalized_subject_sql('dt.subject')} = %s"
            params.append(normalize_subject_key(subject))

        daily_score_expr = """
            CASE
                WHEN dt.subject_total_marks IS NOT NULL AND dt.subject_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.subject_total_marks)
                WHEN dt.test_total_marks IS NOT NULL AND dt.test_total_marks > 0 AND safe_numeric(dt.total_marks) IS NOT NULL
                    THEN (safe_numeric(dt.total_marks) * 100.0 / dt.test_total_marks)
                ELSE safe_numeric(dt.total_marks)
            END
        """

        cursor.execute(f"""
            SELECT ROUND(AVG({daily_score_expr})::numeric, 2)
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {date_filter}
        """, params)
        batch_avg_row = cursor.fetchone()
        subject_avg = float(batch_avg_row[0]) if batch_avg_row and batch_avg_row[0] is not None else None

        # unit breakdown
        cursor.execute(f"""
            SELECT
                COALESCE(dt.unit_name, 'Unknown') AS unit_name,
                ROUND(AVG({daily_score_expr})::numeric, 2) AS avg_score,
                COUNT(*) AS attempts,
                COUNT(DISTINCT dt.student_id) AS students
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {date_filter}
            GROUP BY COALESCE(dt.unit_name, 'Unknown')
            ORDER BY avg_score ASC NULLS LAST
        """, params)
        unit_breakdown = []
        for row in cursor.fetchall():
            avg_score = float(row[1]) if row[1] is not None else None
            unit_breakdown.append({
                "unit_name": row[0],
                "avg_pct": avg_score,
                "difficulty_index": round(max(0, 100 - avg_score), 2) if avg_score is not None else None,
                "attempts": row[2],
                "students": row[3]
            })

        # student averages for the selected subject context
        cursor.execute(f"""
            SELECT
                s.student_id,
                s.student_name,
                ROUND(AVG({daily_score_expr})::numeric, 2) AS avg_score
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {date_filter}
            GROUP BY s.student_id, s.student_name
            ORDER BY avg_score ASC NULLS LAST
        """, params)
        student_avg_rows = cursor.fetchall()

        weak_students = []
        for sid, sname, avg_score in student_avg_rows:
            if avg_score is None or subject_avg is None:
                continue
            avg_val = float(avg_score)
            delta = round(avg_val - subject_avg, 2)
            if delta <= -10:
                weak_students.append({
                    "student_id": sid,
                    "student_name": sname,
                    "avg_pct": avg_val,
                    "delta_vs_subject": delta
                })

        # improving students by slope for the same subject context
        cursor.execute(f"""
            SELECT s.student_id, s.student_name, dt.test_date, {daily_score_expr} AS score
            FROM daily_test dt
            JOIN student s ON s.student_id = dt.student_id
            WHERE s.batch_id = %s {date_filter}
            ORDER BY s.student_id, dt.test_date
        """, params)
        points_by_student = defaultdict(list)
        names = {}
        for sid, sname, d, score in cursor.fetchall():
            names[sid] = sname
            points_by_student[sid].append({
                "date": d.isoformat() if d else None,
                "score": float(score) if score is not None else None
            })

        improving_students = []
        for sid, points in points_by_student.items():
            slope = compute_slope(points)
            vals = [p["score"] for p in points if p["score"] is not None]
            if len(vals) < 2:
                continue
            avg_val = round(sum(vals) / len(vals), 2)
            if slope > 0:
                improving_students.append({
                    "student_id": sid,
                    "student_name": names.get(sid, sid),
                    "avg_pct": avg_val,
                    "trend_slope": slope
                })
        improving_students = sorted(improving_students, key=lambda x: x["trend_slope"], reverse=True)

        return {
            "subject": subject or "All Subjects",
            "subject_avg_pct": subject_avg,
            "unit_breakdown": unit_breakdown,
            "weak_students": weak_students[:10],
            "improving_students": improving_students[:10]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch subject diagnostics: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/analysis/health")
async def health_check(current_user: dict = Depends(get_current_user)):
    """Health check endpoint"""
    return {"status": "healthy", "service": "analysis-api"}
