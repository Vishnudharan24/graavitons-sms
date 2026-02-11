from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2 import sql
from datetime import date
from config import DB_CONFIG, CORS_ORIGINS, APP_TITLE

app = FastAPI(title=APP_TITLE)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection failed: {str(e)}"
        )


# ==================== FILTER OPTIONS ENDPOINTS ====================

@app.get("/api/analysis/filter-options")
async def get_filter_options():
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

        # Get distinct subjects from daily_test
        cursor.execute("SELECT DISTINCT subject FROM daily_test WHERE subject IS NOT NULL ORDER BY subject")
        subjects = [row[0] for row in cursor.fetchall()]

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
    to_date: Optional[str] = None
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
            query += " AND dt.subject = %s"
            params.append(subject)

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
            subj = row[4]
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
            student_daily[sid]["subjects"][subj]["total_marks"] += (row[6] or 0)
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
                    "physics_total": 0,
                    "chemistry_total": 0,
                    "biology_total": 0,
                    "count": 0
                }
            student_mock[sid]["maths_total"] += (row[4] or 0)
            student_mock[sid]["physics_total"] += (row[5] or 0)
            student_mock[sid]["chemistry_total"] += (row[6] or 0)
            student_mock[sid]["biology_total"] += (row[7] or 0)
            student_mock[sid]["count"] += 1

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
            if mock and mock["count"] > 0:
                cnt = mock["count"]
                student_result["mock_averages"] = {
                    "maths": round(mock["maths_total"] / cnt, 1),
                    "physics": round(mock["physics_total"] / cnt, 1),
                    "chemistry": round(mock["chemistry_total"] / cnt, 1),
                    "biology": round(mock["biology_total"] / cnt, 1),
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
                avg_score = subj_data["total_marks"] / subj_data["count"] if subj_data["count"] > 0 else 0
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
    to_date: Optional[str] = None
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
                AVG(dt.total_marks) as avg_marks,
                MAX(dt.total_marks) as max_marks,
                MIN(dt.total_marks) as min_marks,
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
            daily_query += " AND dt.subject = %s"
            params.append(subject)

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
        mock_query = """
            SELECT
                s.branch,
                AVG(mt.maths_marks) as avg_maths,
                AVG(mt.physics_marks) as avg_physics,
                AVG(mt.chemistry_marks) as avg_chemistry,
                AVG(mt.biology_marks) as avg_biology,
                AVG(mt.total_marks) as avg_total,
                MAX(mt.total_marks) as max_total,
                MIN(mt.total_marks) as min_total,
                COUNT(*) as test_count,
                COUNT(DISTINCT s.student_id) as student_count
            FROM mock_test mt
            JOIN student s ON mt.student_id = s.student_id
            JOIN batch b ON s.batch_id = b.batch_id
            WHERE s.branch IS NOT NULL
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

        mock_query += " GROUP BY s.branch ORDER BY s.branch"

        cursor.execute(mock_query, mock_params)
        mock_rows = cursor.fetchall()

        # Build branch-wise data from daily tests
        branches_daily = {}
        for row in daily_rows:
            branch = row[0]
            if branch not in branches_daily:
                branches_daily[branch] = {"subjects": {}, "student_count": 0}
            branches_daily[branch]["subjects"][row[1]] = {
                "average": round(float(row[2]), 1) if row[2] else 0,
                "top_score": row[3] or 0,
                "lowest": row[4] or 0,
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
                "maths": round(float(row[1]), 1) if row[1] else 0,
                "physics": round(float(row[2]), 1) if row[2] else 0,
                "chemistry": round(float(row[3]), 1) if row[3] else 0,
                "biology": round(float(row[4]), 1) if row[4] else 0,
                "avg_total": round(float(row[5]), 1) if row[5] else 0,
                "top_total": row[6] or 0,
                "lowest_total": row[7] or 0,
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
                AVG(dt.total_marks) as avg_marks
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
            student_query += " AND dt.subject = %s"
            student_params.append(subject)

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
    branch: Optional[str] = None
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
async def get_individual_analysis(student_id: str):
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
                b.batch_name, b.batch_id
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
            "batch_id": student_row[10]
        }

        batch_id = student_row[10]

        # 2. Get daily test performance with class stats
        cursor.execute("""
            SELECT
                dt.test_id, dt.subject, dt.unit_name, dt.total_marks, dt.test_date,
                dt.grade, dt.branch
            FROM daily_test dt
            WHERE dt.student_id = %s
            ORDER BY dt.test_date DESC, dt.subject
        """, (student_id,))

        daily_tests_raw = cursor.fetchall()
        daily_tests = []

        for test in daily_tests_raw:
            test_date = test[4]
            test_subject = test[1]
            test_unit = test[2]

            # Get class average and top score for the same test
            cursor.execute("""
                SELECT
                    AVG(dt2.total_marks) as class_avg,
                    MAX(dt2.total_marks) as top_score,
                    COUNT(DISTINCT dt2.student_id) as student_count
                FROM daily_test dt2
                JOIN student s2 ON dt2.student_id = s2.student_id
                WHERE s2.batch_id = %s
                    AND dt2.subject = %s
                    AND dt2.unit_name = %s
                    AND dt2.test_date = %s
            """, (batch_id, test_subject, test_unit, test_date))

            stats_row = cursor.fetchone()
            class_avg = round(float(stats_row[0]), 1) if stats_row and stats_row[0] else 0
            top_score = stats_row[1] if stats_row else 0

            daily_tests.append({
                "test_id": test[0],
                "subject": test[1],
                "unit_name": test[2],
                "marks": test[3],
                "test_date": test[4].isoformat() if test[4] else None,
                "grade": test[5],
                "branch": test[6],
                "class_avg": class_avg,
                "top_score": top_score
            })

        # 3. Get mock test performance with class stats
        cursor.execute("""
            SELECT
                mt.test_id, mt.test_date, mt.maths_marks, mt.physics_marks,
                mt.chemistry_marks, mt.biology_marks, mt.total_marks,
                mt.maths_unit_names, mt.physics_unit_names,
                mt.chemistry_unit_names, mt.biology_unit_names,
                mt.grade, mt.branch
            FROM mock_test mt
            WHERE mt.student_id = %s
            ORDER BY mt.test_date DESC
        """, (student_id,))

        mock_tests_raw = cursor.fetchall()
        mock_tests = []

        for test in mock_tests_raw:
            test_date = test[1]

            # Get class average and top score for mock tests on same date
            cursor.execute("""
                SELECT
                    AVG(mt2.total_marks) as class_avg,
                    MAX(mt2.total_marks) as top_score,
                    AVG(mt2.maths_marks) as avg_maths,
                    AVG(mt2.physics_marks) as avg_physics,
                    AVG(mt2.chemistry_marks) as avg_chemistry,
                    AVG(mt2.biology_marks) as avg_biology
                FROM mock_test mt2
                JOIN student s2 ON mt2.student_id = s2.student_id
                WHERE s2.batch_id = %s AND mt2.test_date = %s
            """, (batch_id, test_date))

            mock_stats = cursor.fetchone()

            mock_tests.append({
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
                "class_avg_total": round(float(mock_stats[0]), 1) if mock_stats and mock_stats[0] else 0,
                "top_score_total": mock_stats[1] if mock_stats else 0,
                "class_avg_maths": round(float(mock_stats[2]), 1) if mock_stats and mock_stats[2] else 0,
                "class_avg_physics": round(float(mock_stats[3]), 1) if mock_stats and mock_stats[3] else 0,
                "class_avg_chemistry": round(float(mock_stats[4]), 1) if mock_stats and mock_stats[4] else 0,
                "class_avg_biology": round(float(mock_stats[5]), 1) if mock_stats and mock_stats[5] else 0
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
async def create_feedback(feedback: FeedbackCreate):
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
async def get_student_feedback(student_id: str):
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
    subject: Optional[str] = None
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
            daily_subject_filter = " AND dt.subject = %s"
            daily_subject_params.append(subject)

        # ==================== DAILY TEST STATS ====================
        daily_stats = {
            "avg_score": 0, "top_score": 0, "lowest_score": 0,
            "total_tests": 0, "students_tested": 0
        }
        daily_trend = []
        daily_subject_breakdown = []
        daily_student_avgs = []

        if test_type in ("daily", "both"):
            # Overall daily stats
            cursor.execute(f"""
                SELECT
                    COALESCE(ROUND(AVG(dt.total_marks)::numeric, 1), 0),
                    COALESCE(MAX(dt.total_marks), 0),
                    COALESCE(MIN(dt.total_marks), 0),
                    COUNT(DISTINCT (dt.test_date, dt.subject, dt.unit_name)),
                    COUNT(DISTINCT dt.student_id)
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
            """, [batch_id] + daily_date_params + daily_subject_params)
            row = cursor.fetchone()
            daily_stats = {
                "avg_score": float(row[0]),
                "top_score": row[1],
                "lowest_score": row[2],
                "total_tests": row[3],
                "students_tested": row[4]
            }

            # Daily trend (avg score per date)
            cursor.execute(f"""
                SELECT
                    dt.test_date,
                    ROUND(AVG(dt.total_marks)::numeric, 1) as avg_marks,
                    MAX(dt.total_marks) as top_marks,
                    MIN(dt.total_marks) as low_marks,
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
                    "avg": float(r[1]) if r[1] else 0,
                    "top": r[2] or 0,
                    "low": r[3] or 0,
                    "students": r[4]
                })

            # Subject breakdown
            cursor.execute(f"""
                SELECT
                    dt.subject,
                    ROUND(AVG(dt.total_marks)::numeric, 1),
                    MAX(dt.total_marks),
                    MIN(dt.total_marks),
                    COUNT(*),
                    COUNT(DISTINCT dt.student_id)
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter}
                GROUP BY dt.subject
                ORDER BY dt.subject
            """, [batch_id] + daily_date_params)
            for r in cursor.fetchall():
                daily_subject_breakdown.append({
                    "subject": r[0],
                    "avg": float(r[1]) if r[1] else 0,
                    "top": r[2] or 0,
                    "low": r[3] or 0,
                    "tests": r[4],
                    "students": r[5]
                })

            # Per-student average (for ranking + distribution)
            cursor.execute(f"""
                SELECT
                    s.student_id,
                    s.student_name,
                    ROUND(AVG(dt.total_marks)::numeric, 1) as avg_marks,
                    COUNT(*) as test_count
                FROM daily_test dt
                JOIN student s ON dt.student_id = s.student_id
                WHERE s.batch_id = %s {daily_date_filter} {daily_subject_filter}
                GROUP BY s.student_id, s.student_name
                ORDER BY avg_marks DESC
            """, [batch_id] + daily_date_params + daily_subject_params)
            daily_student_avgs = [
                {"student_id": r[0], "student_name": r[1], "avg": float(r[2]), "tests": r[3]}
                for r in cursor.fetchall()
            ]

        # ==================== MOCK TEST STATS ====================
        mock_stats = {
            "avg_score": 0, "top_score": 0, "lowest_score": 0,
            "total_tests": 0, "students_tested": 0
        }
        mock_trend = []
        mock_subject_breakdown = []
        mock_student_avgs = []

        if test_type in ("mock", "both"):
            # Overall mock stats
            cursor.execute(f"""
                SELECT
                    COALESCE(ROUND(AVG(mt.total_marks)::numeric, 1), 0),
                    COALESCE(MAX(mt.total_marks), 0),
                    COALESCE(MIN(mt.total_marks), 0),
                    COUNT(DISTINCT mt.test_date),
                    COUNT(DISTINCT mt.student_id)
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
            """, [batch_id] + mock_date_params)
            row = cursor.fetchone()
            mock_stats = {
                "avg_score": float(row[0]),
                "top_score": row[1],
                "lowest_score": row[2],
                "total_tests": row[3],
                "students_tested": row[4]
            }

            # Mock trend (avg total per date)
            cursor.execute(f"""
                SELECT
                    mt.test_date,
                    ROUND(AVG(mt.total_marks)::numeric, 1),
                    MAX(mt.total_marks),
                    MIN(mt.total_marks),
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
                    "avg": float(r[1]) if r[1] else 0,
                    "top": r[2] or 0,
                    "low": r[3] or 0,
                    "students": r[4]
                })

            # Mock subject breakdown (per-subject averages)
            cursor.execute(f"""
                SELECT
                    ROUND(AVG(mt.maths_marks)::numeric, 1),
                    ROUND(AVG(mt.physics_marks)::numeric, 1),
                    ROUND(AVG(mt.chemistry_marks)::numeric, 1),
                    ROUND(AVG(mt.biology_marks)::numeric, 1),
                    MAX(mt.maths_marks), MAX(mt.physics_marks),
                    MAX(mt.chemistry_marks), MAX(mt.biology_marks)
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
            """, [batch_id] + mock_date_params)
            r = cursor.fetchone()
            if r and r[0] is not None:
                for i, subj in enumerate(["Maths", "Physics", "Chemistry", "Biology"]):
                    mock_subject_breakdown.append({
                        "subject": subj,
                        "avg": float(r[i]) if r[i] else 0,
                        "top": r[i + 4] or 0
                    })

            # Per-student mock average
            cursor.execute(f"""
                SELECT
                    s.student_id,
                    s.student_name,
                    ROUND(AVG(mt.total_marks)::numeric, 1) as avg_marks,
                    COUNT(*) as test_count
                FROM mock_test mt
                JOIN student s ON mt.student_id = s.student_id
                WHERE s.batch_id = %s {mock_date_filter}
                GROUP BY s.student_id, s.student_name
                ORDER BY avg_marks DESC
            """, [batch_id] + mock_date_params)
            mock_student_avgs = [
                {"student_id": r[0], "student_name": r[1], "avg": float(r[2]), "tests": r[3]}
                for r in cursor.fetchall()
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
                "mock_avg": 0,
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
                    "daily_avg": 0,
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
            data["overall_avg"] = round(total / count, 1) if count > 0 else 0

        ranked = sorted(student_scores.values(), key=lambda x: x["overall_avg"], reverse=True)
        top_students = ranked[:5]
        bottom_students = list(reversed(ranked[-5:])) if len(ranked) >= 5 else list(reversed(ranked))

        # ==================== SCORE DISTRIBUTION ====================
        # Buckets: 0-25, 26-50, 51-75, 76-100
        def build_distribution(student_avgs):
            buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
            for s in student_avgs:
                avg = s["avg"]
                if avg <= 25:
                    buckets["0-25"] += 1
                elif avg <= 50:
                    buckets["26-50"] += 1
                elif avg <= 75:
                    buckets["51-75"] += 1
                else:
                    buckets["76-100"] += 1
            return [{"range": k, "count": v} for k, v in buckets.items()]

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


@app.get("/api/analysis/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "analysis-api"}
