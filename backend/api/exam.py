from fastapi import FastAPI, HTTPException, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator, Field
from typing import List, Optional
import psycopg2
from psycopg2 import sql
from datetime import datetime, date
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from io import BytesIO
from config import CORS_ORIGINS, APP_TITLE
from api.middleware import get_current_user
from db_pool import get_db_connection

app = FastAPI(title=APP_TITLE)

MOCK_SUBJECT_CONFIG = {
    "maths": {"aliases": {"maths", "mathematics", "math"}, "unit_field": "mathsUnitNames"},
    "physics": {"aliases": {"physics"}, "unit_field": "physicsUnitNames"},
    "chemistry": {"aliases": {"chemistry"}, "unit_field": "chemistryUnitNames"},
    "biology": {"aliases": {"biology"}, "unit_field": "biologyUnitNames"},
}

SUBJECT_CANONICAL = {
    "maths": "Mathematics",
    "math": "Mathematics",
    "mathematics": "Mathematics",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
}


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


def split_units(unit_text: str):
    if not unit_text:
        return []
    return [u.strip() for u in unit_text.split(',') if u.strip()]


def extract_grade_from_batch_name(batch_name: Optional[str]) -> Optional[int]:
    if not batch_name:
        return None
    import re
    grade_match = re.search(r'\d+', str(batch_name))
    if grade_match:
        return int(grade_match.group())
    return None


def normalized_subject_sql(column_name: str) -> str:
    return f"LOWER(TRIM({column_name}))"

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for Daily Test
class DailyTestStudentMark(BaseModel):
    id: str  # student_id
    marks: Optional[str] = None


class DailyTestCreate(BaseModel):
    batch_id: int
    examName: str
    examDate: date
    subject: str
    unitName: str
    totalMarks: int
    subjectTotalMarks: Optional[int] = None
    testTotalMarks: Optional[int] = None
    examType: str
    studentMarks: List[DailyTestStudentMark]


# Pydantic models for Mock Test
class MockTestStudentMark(BaseModel):
    id: str  # student_id
    mathsMarks: Optional[str] = None
    physicsMarks: Optional[str] = None
    chemistryMarks: Optional[str] = None
    biologyMarks: Optional[str] = None


class MockTestCreate(BaseModel):
    batch_id: int
    examName: str
    examDate: date
    examType: str
    mathsUnitNames: str
    physicsUnitNames: str
    chemistryUnitNames: str
    biologyUnitNames: str
    mathsTotalMarks: Optional[int] = None
    physicsTotalMarks: Optional[int] = None
    chemistryTotalMarks: Optional[int] = None
    biologyTotalMarks: Optional[int] = None
    testTotalMarks: Optional[int] = None
    studentMarks: List[MockTestStudentMark]


class DailyTestBulkItem(BaseModel):
    examName: str
    examDate: date
    subject: str
    unitName: str
    totalMarks: int
    subjectTotalMarks: Optional[int] = None
    testTotalMarks: Optional[int] = None
    examType: Optional[str] = "daily test"
    studentMarks: List[DailyTestStudentMark]


class DailyTestBulkCreate(BaseModel):
    batch_id: int
    exams: List[DailyTestBulkItem]

    @validator('exams')
    def validate_daily_exams_not_empty(cls, value):
        if not value:
            raise ValueError("At least one daily test is required")
        return value


class MockTestBulkItem(BaseModel):
    examName: str
    examDate: date
    examType: Optional[str] = "mock test"
    mathsUnitNames: str = ""
    physicsUnitNames: str = ""
    chemistryUnitNames: str = ""
    biologyUnitNames: str = ""
    mathsTotalMarks: Optional[int] = None
    physicsTotalMarks: Optional[int] = None
    chemistryTotalMarks: Optional[int] = None
    biologyTotalMarks: Optional[int] = None
    testTotalMarks: Optional[int] = None
    studentMarks: List[MockTestStudentMark]


class MockTestBulkCreate(BaseModel):
    batch_id: int
    exams: List[MockTestBulkItem]

    @validator('exams')
    def validate_mock_exams_not_empty(cls, value):
        if not value:
            raise ValueError("At least one mock test is required")
        return value


class DailyTestGroupRef(BaseModel):
    test_date: date
    subject: str
    unit_name: str
    subject_total_marks: Optional[int] = None
    test_total_marks: Optional[int] = None


class DailyTestMarkUpdate(BaseModel):
    student_id: str
    marks: Optional[str] = None


class DailyTestGroupUpdate(BaseModel):
    test_date: date
    subject: str
    unit_name: str
    subject_total_marks: Optional[int] = None
    test_total_marks: Optional[int] = None
    studentMarks: List[DailyTestMarkUpdate]


class MockTestGroupRef(BaseModel):
    test_date: date
    maths_unit_names: List[str] = Field(default_factory=list)
    physics_unit_names: List[str] = Field(default_factory=list)
    chemistry_unit_names: List[str] = Field(default_factory=list)
    biology_unit_names: List[str] = Field(default_factory=list)
    maths_total_marks: Optional[int] = None
    physics_total_marks: Optional[int] = None
    chemistry_total_marks: Optional[int] = None
    biology_total_marks: Optional[int] = None
    test_total_marks: Optional[int] = None


class MockTestMarkUpdate(BaseModel):
    student_id: str
    maths_marks: Optional[str] = None
    physics_marks: Optional[str] = None
    chemistry_marks: Optional[str] = None
    biology_marks: Optional[str] = None


class MockTestGroupUpdate(BaseModel):
    test_date: date
    maths_unit_names: List[str] = Field(default_factory=list)
    physics_unit_names: List[str] = Field(default_factory=list)
    chemistry_unit_names: List[str] = Field(default_factory=list)
    biology_unit_names: List[str] = Field(default_factory=list)
    maths_total_marks: Optional[int] = None
    physics_total_marks: Optional[int] = None
    chemistry_total_marks: Optional[int] = None
    biology_total_marks: Optional[int] = None
    test_total_marks: Optional[int] = None
    original_maths_total_marks: Optional[int] = None
    original_physics_total_marks: Optional[int] = None
    original_chemistry_total_marks: Optional[int] = None
    original_biology_total_marks: Optional[int] = None
    original_test_total_marks: Optional[int] = None
    studentMarks: List[MockTestMarkUpdate]


@app.post("/api/exam/daily-test", status_code=status.HTTP_201_CREATED)
async def create_daily_test(exam_data: DailyTestCreate, current_user: dict = Depends(get_current_user)):
    """
    Create daily test marks for students
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get batch details to extract grade and branch
        cursor.execute("""
            SELECT batch_name, type, subjects FROM batch WHERE batch_id = %s
        """, (exam_data.batch_id,))
        
        batch_result = cursor.fetchone()
        if not batch_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {exam_data.batch_id} not found"
            )
        
        batch_name, batch_type, batch_subjects = batch_result
        normalized_subject = normalize_subject_label(exam_data.subject)
        if not normalized_subject:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subject is required"
            )

        # If batch has configured subjects, enforce subject membership (case-insensitive, alias-safe)
        normalized_batch_subject_keys = {
            normalize_subject_key(s) for s in (batch_subjects or []) if str(s).strip()
        }
        if normalized_batch_subject_keys and normalize_subject_key(normalized_subject) not in normalized_batch_subject_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subject '{exam_data.subject}' is not configured for this batch"
            )
        
        # Extract grade from batch (assuming format like "Grade 11", "12th Grade", etc.)
        grade = None
        if batch_name:
            # Try to extract numeric grade
            import re
            grade_match = re.search(r'\d+', batch_name)
            if grade_match:
                grade = int(grade_match.group())
        
        # Get branch from student (we'll fetch it for each student)
        inserted_count = 0
        failed_students = []
        subject_total_marks = exam_data.subjectTotalMarks if exam_data.subjectTotalMarks is not None else exam_data.totalMarks
        test_total_marks = exam_data.testTotalMarks if exam_data.testTotalMarks is not None else subject_total_marks
        
        for student_mark in exam_data.studentMarks:
            try:
                # Get student's branch
                cursor.execute("""
                    SELECT student_no, branch
                    FROM student
                    WHERE student_id = %s AND batch_id = %s
                    ORDER BY created_at DESC, student_no DESC
                    LIMIT 1
                """, (student_mark.id, exam_data.batch_id))
                
                student_result = cursor.fetchone()
                if not student_result:
                    failed_students.append({
                        "student_id": student_mark.id,
                        "reason": "Student not found"
                    })
                    continue
                
                student_no = student_result[0]
                branch = student_result[1]
                
                # Store marks as-is (supports integers, 'A' for absent, '-' for N/A, negative marks)
                marks = student_mark.marks.strip() if student_mark.marks and student_mark.marks.strip() else None
                
                # Insert daily test record
                cursor.execute("""
                    INSERT INTO daily_test (
                        student_no, grade, branch, test_date, 
                        subject, unit_name, total_marks, subject_total_marks, test_total_marks
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    student_no,
                    grade,
                    branch,
                    exam_data.examDate,
                    normalized_subject,
                    exam_data.unitName,
                    marks,
                    subject_total_marks,
                    test_total_marks
                ))
                
                inserted_count += 1
                
            except psycopg2.Error as db_error:
                failed_students.append({
                    "student_id": student_mark.id,
                    "reason": f"Database error: {str(db_error)}"
                })
        
        conn.commit()
        
        response = {
            "message": "Daily test marks added successfully",
            "exam_name": exam_data.examName,
            "exam_date": str(exam_data.examDate),
            "subject": normalized_subject,
            "unit_name": exam_data.unitName,
            "total_marks": exam_data.totalMarks,
            "subject_total_marks": subject_total_marks,
            "test_total_marks": test_total_marks,
            "inserted_count": inserted_count,
            "total_students": len(exam_data.studentMarks)
        }
        
        if failed_students:
            response["failed_students"] = failed_students
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create daily test: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.post("/api/exam/mock-test", status_code=status.HTTP_201_CREATED)
async def create_mock_test(exam_data: MockTestCreate, current_user: dict = Depends(get_current_user)):
    """
    Create mock test marks for students
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get batch details to extract grade and configured subjects
        cursor.execute("""
            SELECT batch_name, type, subjects FROM batch WHERE batch_id = %s
        """, (exam_data.batch_id,))
        
        batch_result = cursor.fetchone()
        if not batch_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {exam_data.batch_id} not found"
            )
        
        batch_name, batch_type, batch_subjects = batch_result
        active_subjects = set(get_batch_mock_subjects(batch_subjects))
        
        # Extract grade from batch
        grade = None
        if batch_name:
            import re
            grade_match = re.search(r'\d+', batch_name)
            if grade_match:
                grade = int(grade_match.group())
        
        # Parse unit names only for subjects configured in the batch
        maths_units = split_units(exam_data.mathsUnitNames) if "maths" in active_subjects else []
        physics_units = split_units(exam_data.physicsUnitNames) if "physics" in active_subjects else []
        chemistry_units = split_units(exam_data.chemistryUnitNames) if "chemistry" in active_subjects else []
        biology_units = split_units(exam_data.biologyUnitNames) if "biology" in active_subjects else []

        maths_total_marks = exam_data.mathsTotalMarks if "maths" in active_subjects else None
        physics_total_marks = exam_data.physicsTotalMarks if "physics" in active_subjects else None
        chemistry_total_marks = exam_data.chemistryTotalMarks if "chemistry" in active_subjects else None
        biology_total_marks = exam_data.biologyTotalMarks if "biology" in active_subjects else None
        test_total_marks = exam_data.testTotalMarks
        if test_total_marks is None:
            total_parts = [v for v in [maths_total_marks, physics_total_marks, chemistry_total_marks, biology_total_marks] if isinstance(v, int)]
            test_total_marks = sum(total_parts) if total_parts else None
        
        inserted_count = 0
        failed_students = []
        
        for student_mark in exam_data.studentMarks:
            try:
                # Get student's branch
                cursor.execute("""
                    SELECT student_no, branch
                    FROM student
                    WHERE student_id = %s AND batch_id = %s
                    ORDER BY created_at DESC, student_no DESC
                    LIMIT 1
                """, (student_mark.id, exam_data.batch_id))
                
                student_result = cursor.fetchone()
                if not student_result:
                    failed_students.append({
                        "student_id": student_mark.id,
                        "reason": "Student not found"
                    })
                    continue
                
                student_no = student_result[0]
                branch = student_result[1]
                
                # Store marks as-is (supports integers, 'A' for absent, '-' for N/A, negative marks)
                maths_marks = student_mark.mathsMarks.strip() if "maths" in active_subjects and student_mark.mathsMarks and student_mark.mathsMarks.strip() else None
                physics_marks = student_mark.physicsMarks.strip() if "physics" in active_subjects and student_mark.physicsMarks and student_mark.physicsMarks.strip() else None
                chemistry_marks = student_mark.chemistryMarks.strip() if "chemistry" in active_subjects and student_mark.chemistryMarks and student_mark.chemistryMarks.strip() else None
                biology_marks = student_mark.biologyMarks.strip() if "biology" in active_subjects and student_mark.biologyMarks and student_mark.biologyMarks.strip() else None
                
                # Calculate total marks only from numeric values
                def safe_int(val):
                    try:
                        return int(val)
                    except (ValueError, TypeError):
                        return None
                
                numeric_marks = [safe_int(m) for m in [maths_marks, physics_marks, chemistry_marks, biology_marks]]
                valid_marks = [m for m in numeric_marks if m is not None]
                total_marks = str(sum(valid_marks)) if valid_marks else None
                
                # Insert mock test record
                cursor.execute("""
                    INSERT INTO mock_test (
                        student_no, grade, branch, test_date,
                        maths_marks, physics_marks, chemistry_marks, biology_marks,
                        maths_unit_names, physics_unit_names, chemistry_unit_names, biology_unit_names,
                        total_marks,
                        maths_total_marks, physics_total_marks, chemistry_total_marks, biology_total_marks,
                        test_total_marks
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    student_no,
                    grade,
                    branch,
                    exam_data.examDate,
                    maths_marks,
                    physics_marks,
                    chemistry_marks,
                    biology_marks,
                    maths_units,
                    physics_units,
                    chemistry_units,
                    biology_units,
                    total_marks,
                    maths_total_marks,
                    physics_total_marks,
                    chemistry_total_marks,
                    biology_total_marks,
                    test_total_marks
                ))
                
                inserted_count += 1
                
            except ValueError as ve:
                failed_students.append({
                    "student_id": student_mark.id,
                    "reason": f"Invalid marks value"
                })
            except psycopg2.Error as db_error:
                failed_students.append({
                    "student_id": student_mark.id,
                    "reason": f"Database error: {str(db_error)}"
                })
        
        conn.commit()
        
        response = {
            "message": "Mock test marks added successfully",
            "exam_name": exam_data.examName,
            "exam_date": str(exam_data.examDate),
            "active_subjects": list(active_subjects),
            "units": {
                "maths": maths_units,
                "physics": physics_units,
                "chemistry": chemistry_units,
                "biology": biology_units
            },
            "subject_total_marks": {
                "maths": maths_total_marks,
                "physics": physics_total_marks,
                "chemistry": chemistry_total_marks,
                "biology": biology_total_marks
            },
            "test_total_marks": test_total_marks,
            "inserted_count": inserted_count,
            "total_students": len(exam_data.studentMarks)
        }
        
        if failed_students:
            response["failed_students"] = failed_students
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create mock test: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.post("/api/exam/daily-test/bulk", status_code=status.HTTP_201_CREATED)
async def create_daily_test_bulk(exam_data: DailyTestBulkCreate, current_user: dict = Depends(get_current_user)):
    """
    Upload multiple daily tests in a single request for one batch.
    """
    results = []
    failed_exams = []
    total_inserted = 0

    for index, exam in enumerate(exam_data.exams, start=1):
        single_payload = DailyTestCreate(
            batch_id=exam_data.batch_id,
            examName=exam.examName,
            examDate=exam.examDate,
            subject=exam.subject,
            unitName=exam.unitName,
            totalMarks=exam.totalMarks,
            subjectTotalMarks=exam.subjectTotalMarks,
            testTotalMarks=exam.testTotalMarks,
            examType=exam.examType or "daily test",
            studentMarks=exam.studentMarks
        )

        try:
            result = await create_daily_test(single_payload, current_user)
            inserted_count = result.get("inserted_count", 0)
            total_inserted += inserted_count
            results.append({
                "index": index,
                "exam_name": exam.examName,
                "exam_date": str(exam.examDate),
                "status": "success",
                "inserted_count": inserted_count,
                "total_students": result.get("total_students", len(exam.studentMarks)),
                "failed_students": result.get("failed_students", [])
            })
        except HTTPException as e:
            failed_exams.append({
                "index": index,
                "exam_name": exam.examName,
                "exam_date": str(exam.examDate),
                "status": "failed",
                "reason": e.detail
            })

    return {
        "message": "Bulk daily test upload completed",
        "batch_id": exam_data.batch_id,
        "total_exams": len(exam_data.exams),
        "successful_exams": len(results),
        "failed_exams_count": len(failed_exams),
        "total_inserted_records": total_inserted,
        "results": results,
        "failed_exams": failed_exams
    }


@app.post("/api/exam/mock-test/bulk", status_code=status.HTTP_201_CREATED)
async def create_mock_test_bulk(exam_data: MockTestBulkCreate, current_user: dict = Depends(get_current_user)):
    """
    Upload multiple mock tests in a single request for one batch.
    """
    results = []
    failed_exams = []
    total_inserted = 0

    for index, exam in enumerate(exam_data.exams, start=1):
        single_payload = MockTestCreate(
            batch_id=exam_data.batch_id,
            examName=exam.examName,
            examDate=exam.examDate,
            examType=exam.examType or "mock test",
            mathsUnitNames=exam.mathsUnitNames,
            physicsUnitNames=exam.physicsUnitNames,
            chemistryUnitNames=exam.chemistryUnitNames,
            biologyUnitNames=exam.biologyUnitNames,
            mathsTotalMarks=exam.mathsTotalMarks,
            physicsTotalMarks=exam.physicsTotalMarks,
            chemistryTotalMarks=exam.chemistryTotalMarks,
            biologyTotalMarks=exam.biologyTotalMarks,
            testTotalMarks=exam.testTotalMarks,
            studentMarks=exam.studentMarks
        )

        try:
            result = await create_mock_test(single_payload, current_user)
            inserted_count = result.get("inserted_count", 0)
            total_inserted += inserted_count
            results.append({
                "index": index,
                "exam_name": exam.examName,
                "exam_date": str(exam.examDate),
                "status": "success",
                "inserted_count": inserted_count,
                "total_students": result.get("total_students", len(exam.studentMarks)),
                "failed_students": result.get("failed_students", [])
            })
        except HTTPException as e:
            failed_exams.append({
                "index": index,
                "exam_name": exam.examName,
                "exam_date": str(exam.examDate),
                "status": "failed",
                "reason": e.detail
            })

    return {
        "message": "Bulk mock test upload completed",
        "batch_id": exam_data.batch_id,
        "total_exams": len(exam_data.exams),
        "successful_exams": len(results),
        "failed_exams_count": len(failed_exams),
        "total_inserted_records": total_inserted,
        "results": results,
        "failed_exams": failed_exams
    }


@app.get("/api/exam/daily-test/batch/{batch_id}/groups")
async def get_daily_test_groups(batch_id: int, current_user: dict = Depends(get_current_user)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT batch_id FROM batch WHERE batch_id = %s", (batch_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch with ID {batch_id} not found")

        cursor.execute("""
            SELECT
                dt.test_date,
                dt.subject,
                dt.unit_name,
                dt.subject_total_marks,
                dt.test_total_marks,
                COUNT(*) AS entries_count,
                COUNT(DISTINCT dt.student_no) AS student_count,
                MIN(dt.created_at) AS created_at
            FROM daily_test dt
            JOIN student s ON s.student_no = dt.student_no
            WHERE s.batch_id = %s
            GROUP BY dt.test_date, dt.subject, dt.unit_name, dt.subject_total_marks, dt.test_total_marks
            ORDER BY dt.test_date DESC, dt.subject, dt.unit_name
        """, (batch_id,))

        groups = []
        for row in cursor.fetchall():
            groups.append({
                "test_date": row[0].isoformat() if row[0] else None,
                "subject": row[1],
                "unit_name": row[2],
                "subject_total_marks": row[3],
                "test_total_marks": row[4],
                "entries_count": row[5],
                "student_count": row[6],
                "created_at": row[7].isoformat() if row[7] else None,
            })

        return {"groups": groups, "total_groups": len(groups)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch daily test groups: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.post("/api/exam/daily-test/batch/{batch_id}/records")
async def get_daily_test_group_records(
    batch_id: int,
    group_ref: DailyTestGroupRef,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        normalized_subject = normalize_subject_key(group_ref.subject)
        cursor.execute(f"""
            SELECT
                s.student_id,
                s.student_name,
                COALESCE(dt.total_marks, '') AS marks
            FROM student s
            LEFT JOIN daily_test dt
                ON dt.student_no = s.student_no
                AND dt.test_date = %s
                AND COALESCE(dt.unit_name, '') = COALESCE(%s, '')
                AND {normalized_subject_sql('dt.subject')} = %s
            WHERE s.batch_id = %s
            ORDER BY
                CASE WHEN s.student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                CASE WHEN s.student_id ~ '^[0-9]+$' THEN s.student_id::BIGINT END,
                s.student_id ASC,
                s.student_name ASC
        """, (group_ref.test_date, group_ref.unit_name, normalized_subject, batch_id))

        rows = cursor.fetchall()
        return {
            "records": [
                {
                    "student_id": r[0],
                    "student_name": r[1],
                    "marks": r[2]
                }
                for r in rows
            ],
            "total_records": len(rows)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch daily test records: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.put("/api/exam/daily-test/batch/{batch_id}")
async def update_daily_test_group(
    batch_id: int,
    payload: DailyTestGroupUpdate,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT batch_name FROM batch WHERE batch_id = %s", (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch with ID {batch_id} not found")

        batch_grade = extract_grade_from_batch_name(batch_row[0])
        normalized_subject_label = normalize_subject_label(payload.subject)
        normalized_subject = normalize_subject_key(payload.subject)

        cursor.execute("""
            SELECT student_id, student_no, branch, grade
            FROM student
            WHERE batch_id = %s
        """, (batch_id,))
        student_map = {r[0]: {"student_no": r[1], "branch": r[2], "grade": r[3]} for r in cursor.fetchall()}

        updated_count = 0
        inserted_count = 0
        deleted_count = 0
        skipped_count = 0

        for student_mark in payload.studentMarks:
            sid = student_mark.student_id
            if sid not in student_map:
                skipped_count += 1
                continue

            marks = (student_mark.marks or '').strip()
            marks_value = marks if marks else None

            cursor.execute(f"""
                SELECT test_id
                FROM daily_test
                                WHERE student_no = %s
                  AND test_date = %s
                  AND COALESCE(unit_name, '') = COALESCE(%s, '')
                  AND {normalized_subject_sql('subject')} = %s
                LIMIT 1
                        """, (student_map[sid]["student_no"], payload.test_date, payload.unit_name, normalized_subject))
            existing = cursor.fetchone()

            if existing:
                cursor.execute("""
                    UPDATE daily_test
                    SET
                        total_marks = %s,
                        subject_total_marks = %s,
                        test_total_marks = %s
                    WHERE test_id = %s
                """, (marks_value, payload.subject_total_marks, payload.test_total_marks, existing[0]))
                updated_count += 1
            else:
                student_meta = student_map[sid]
                cursor.execute("""
                    INSERT INTO daily_test (
                        student_no, grade, branch, test_date,
                        subject, unit_name, total_marks, subject_total_marks, test_total_marks
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    student_meta["student_no"],
                    student_meta["grade"] if student_meta["grade"] is not None else batch_grade,
                    student_meta["branch"],
                    payload.test_date,
                    normalized_subject_label,
                    payload.unit_name,
                    marks_value,
                    payload.subject_total_marks,
                    payload.test_total_marks
                ))
                inserted_count += 1

        conn.commit()

        return {
            "message": "Daily test marks updated successfully",
            "updated_count": updated_count,
            "inserted_count": inserted_count,
            "deleted_count": deleted_count,
            "skipped_count": skipped_count
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update daily test marks: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.delete("/api/exam/daily-test/batch/{batch_id}")
async def delete_daily_test_group(
    batch_id: int,
    payload: DailyTestGroupRef,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        normalized_subject = normalize_subject_key(payload.subject)
        cursor.execute(f"""
            DELETE FROM daily_test dt
            USING student s
                        WHERE dt.student_no = s.student_no
              AND s.batch_id = %s
              AND dt.test_date = %s
              AND COALESCE(dt.unit_name, '') = COALESCE(%s, '')
              AND {normalized_subject_sql('dt.subject')} = %s
        """, (batch_id, payload.test_date, payload.unit_name, normalized_subject))
        deleted_count = cursor.rowcount

        conn.commit()
        return {
            "message": "Daily test deleted successfully",
            "deleted_count": deleted_count
        }
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete daily test group: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/exam/mock-test/batch/{batch_id}/groups")
async def get_mock_test_groups(batch_id: int, current_user: dict = Depends(get_current_user)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT subjects FROM batch WHERE batch_id = %s", (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch with ID {batch_id} not found")

        active_subjects = get_batch_mock_subjects(batch_row[0])

        cursor.execute("""
            SELECT
                mt.test_date,
                COALESCE(mt.maths_unit_names, ARRAY[]::text[]) AS maths_unit_names,
                COALESCE(mt.physics_unit_names, ARRAY[]::text[]) AS physics_unit_names,
                COALESCE(mt.chemistry_unit_names, ARRAY[]::text[]) AS chemistry_unit_names,
                COALESCE(mt.biology_unit_names, ARRAY[]::text[]) AS biology_unit_names,
                mt.maths_total_marks,
                mt.physics_total_marks,
                mt.chemistry_total_marks,
                mt.biology_total_marks,
                mt.test_total_marks,
                COUNT(*) AS entries_count,
                COUNT(DISTINCT mt.student_no) AS student_count,
                MIN(mt.created_at) AS created_at
            FROM mock_test mt
            JOIN student s ON s.student_no = mt.student_no
            WHERE s.batch_id = %s
            GROUP BY
                mt.test_date,
                mt.maths_unit_names,
                mt.physics_unit_names,
                mt.chemistry_unit_names,
                mt.biology_unit_names,
                mt.maths_total_marks,
                mt.physics_total_marks,
                mt.chemistry_total_marks,
                mt.biology_total_marks,
                mt.test_total_marks
            ORDER BY mt.test_date DESC
        """, (batch_id,))

        groups = []
        for row in cursor.fetchall():
            groups.append({
                "test_date": row[0].isoformat() if row[0] else None,
                "maths_unit_names": row[1] or [],
                "physics_unit_names": row[2] or [],
                "chemistry_unit_names": row[3] or [],
                "biology_unit_names": row[4] or [],
                "maths_total_marks": row[5],
                "physics_total_marks": row[6],
                "chemistry_total_marks": row[7],
                "biology_total_marks": row[8],
                "test_total_marks": row[9],
                "entries_count": row[10],
                "student_count": row[11],
                "created_at": row[12].isoformat() if row[12] else None,
            })

        return {"groups": groups, "active_subjects": active_subjects, "total_groups": len(groups)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch mock test groups: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.post("/api/exam/mock-test/batch/{batch_id}/records")
async def get_mock_test_group_records(
    batch_id: int,
    group_ref: MockTestGroupRef,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                s.student_id,
                s.student_name,
                COALESCE(mt.maths_marks, '') AS maths_marks,
                COALESCE(mt.physics_marks, '') AS physics_marks,
                COALESCE(mt.chemistry_marks, '') AS chemistry_marks,
                COALESCE(mt.biology_marks, '') AS biology_marks
            FROM student s
            LEFT JOIN mock_test mt
                ON mt.student_no = s.student_no
                AND mt.test_date = %s
                AND COALESCE(mt.maths_unit_names, ARRAY[]::text[]) = %s
                AND COALESCE(mt.physics_unit_names, ARRAY[]::text[]) = %s
                AND COALESCE(mt.chemistry_unit_names, ARRAY[]::text[]) = %s
                AND COALESCE(mt.biology_unit_names, ARRAY[]::text[]) = %s
                AND mt.maths_total_marks IS NOT DISTINCT FROM %s
                AND mt.physics_total_marks IS NOT DISTINCT FROM %s
                AND mt.chemistry_total_marks IS NOT DISTINCT FROM %s
                AND mt.biology_total_marks IS NOT DISTINCT FROM %s
                AND mt.test_total_marks IS NOT DISTINCT FROM %s
            WHERE s.batch_id = %s
            ORDER BY
                CASE WHEN s.student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                CASE WHEN s.student_id ~ '^[0-9]+$' THEN s.student_id::BIGINT END,
                s.student_id ASC,
                s.student_name ASC
        """, (
            group_ref.test_date,
            group_ref.maths_unit_names,
            group_ref.physics_unit_names,
            group_ref.chemistry_unit_names,
            group_ref.biology_unit_names,
            group_ref.maths_total_marks,
            group_ref.physics_total_marks,
            group_ref.chemistry_total_marks,
            group_ref.biology_total_marks,
            group_ref.test_total_marks,
            batch_id
        ))

        rows = cursor.fetchall()
        return {
            "records": [
                {
                    "student_id": r[0],
                    "student_name": r[1],
                    "maths_marks": r[2],
                    "physics_marks": r[3],
                    "chemistry_marks": r[4],
                    "biology_marks": r[5],
                }
                for r in rows
            ],
            "total_records": len(rows)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch mock test records: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.put("/api/exam/mock-test/batch/{batch_id}")
async def update_mock_test_group(
    batch_id: int,
    payload: MockTestGroupUpdate,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT batch_name, subjects FROM batch WHERE batch_id = %s", (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch with ID {batch_id} not found")

        batch_grade = extract_grade_from_batch_name(batch_row[0])
        active_subjects = set(get_batch_mock_subjects(batch_row[1]))

        cursor.execute("""
            SELECT student_id, student_no, branch, grade
            FROM student
            WHERE batch_id = %s
        """, (batch_id,))
        student_map = {r[0]: {"student_no": r[1], "branch": r[2], "grade": r[3]} for r in cursor.fetchall()}

        def safe_int(val):
            try:
                return int(val)
            except (TypeError, ValueError):
                return None

        updated_count = 0
        inserted_count = 0
        deleted_count = 0
        skipped_count = 0

        match_maths_total = payload.original_maths_total_marks if payload.original_maths_total_marks is not None else payload.maths_total_marks
        match_physics_total = payload.original_physics_total_marks if payload.original_physics_total_marks is not None else payload.physics_total_marks
        match_chemistry_total = payload.original_chemistry_total_marks if payload.original_chemistry_total_marks is not None else payload.chemistry_total_marks
        match_biology_total = payload.original_biology_total_marks if payload.original_biology_total_marks is not None else payload.biology_total_marks
        match_test_total = payload.original_test_total_marks if payload.original_test_total_marks is not None else payload.test_total_marks

        for student_mark in payload.studentMarks:
            sid = student_mark.student_id
            if sid not in student_map:
                skipped_count += 1
                continue

            maths_raw = (student_mark.maths_marks or '').strip() if 'maths' in active_subjects else ''
            physics_raw = (student_mark.physics_marks or '').strip() if 'physics' in active_subjects else ''
            chemistry_raw = (student_mark.chemistry_marks or '').strip() if 'chemistry' in active_subjects else ''
            biology_raw = (student_mark.biology_marks or '').strip() if 'biology' in active_subjects else ''

            maths_marks = maths_raw if maths_raw else None
            physics_marks = physics_raw if physics_raw else None
            chemistry_marks = chemistry_raw if chemistry_raw else None
            biology_marks = biology_raw if biology_raw else None

            cursor.execute("""
                SELECT test_id
                FROM mock_test
                                WHERE student_no = %s
                  AND test_date = %s
                  AND COALESCE(maths_unit_names, ARRAY[]::text[]) = %s
                  AND COALESCE(physics_unit_names, ARRAY[]::text[]) = %s
                  AND COALESCE(chemistry_unit_names, ARRAY[]::text[]) = %s
                  AND COALESCE(biology_unit_names, ARRAY[]::text[]) = %s
                  AND maths_total_marks IS NOT DISTINCT FROM %s
                  AND physics_total_marks IS NOT DISTINCT FROM %s
                  AND chemistry_total_marks IS NOT DISTINCT FROM %s
                  AND biology_total_marks IS NOT DISTINCT FROM %s
                  AND test_total_marks IS NOT DISTINCT FROM %s
                LIMIT 1
            """, (
                student_map[sid]["student_no"],
                payload.test_date,
                payload.maths_unit_names,
                payload.physics_unit_names,
                payload.chemistry_unit_names,
                payload.biology_unit_names,
                                match_maths_total,
                                match_physics_total,
                                match_chemistry_total,
                                match_biology_total,
                                match_test_total,
            ))
            existing = cursor.fetchone()

            numeric_marks = [safe_int(v) for v in [maths_marks, physics_marks, chemistry_marks, biology_marks]]
            valid_marks = [m for m in numeric_marks if m is not None]
            total_marks = str(sum(valid_marks)) if valid_marks else None

            if existing:
                cursor.execute("""
                    UPDATE mock_test
                    SET
                        maths_marks = %s,
                        physics_marks = %s,
                        chemistry_marks = %s,
                        biology_marks = %s,
                        total_marks = %s,
                        maths_total_marks = %s,
                        physics_total_marks = %s,
                        chemistry_total_marks = %s,
                        biology_total_marks = %s,
                        test_total_marks = %s
                    WHERE test_id = %s
                """, (
                    maths_marks,
                    physics_marks,
                    chemistry_marks,
                    biology_marks,
                    total_marks,
                    payload.maths_total_marks,
                    payload.physics_total_marks,
                    payload.chemistry_total_marks,
                    payload.biology_total_marks,
                    payload.test_total_marks,
                    existing[0]
                ))
                updated_count += 1
            else:
                student_meta = student_map[sid]
                cursor.execute("""
                    INSERT INTO mock_test (
                        student_no, grade, branch, test_date,
                        maths_marks, physics_marks, chemistry_marks, biology_marks,
                        maths_unit_names, physics_unit_names, chemistry_unit_names, biology_unit_names,
                        total_marks,
                        maths_total_marks, physics_total_marks, chemistry_total_marks, biology_total_marks,
                        test_total_marks
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    student_meta["student_no"],
                    student_meta["grade"] if student_meta["grade"] is not None else batch_grade,
                    student_meta["branch"],
                    payload.test_date,
                    maths_marks,
                    physics_marks,
                    chemistry_marks,
                    biology_marks,
                    payload.maths_unit_names,
                    payload.physics_unit_names,
                    payload.chemistry_unit_names,
                    payload.biology_unit_names,
                    total_marks,
                    payload.maths_total_marks,
                    payload.physics_total_marks,
                    payload.chemistry_total_marks,
                    payload.biology_total_marks,
                    payload.test_total_marks,
                ))
                inserted_count += 1

        conn.commit()
        return {
            "message": "Mock test marks updated successfully",
            "updated_count": updated_count,
            "inserted_count": inserted_count,
            "deleted_count": deleted_count,
            "skipped_count": skipped_count
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update mock test marks: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.delete("/api/exam/mock-test/batch/{batch_id}")
async def delete_mock_test_group(
    batch_id: int,
    payload: MockTestGroupRef,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM mock_test mt
            USING student s
                        WHERE mt.student_no = s.student_no
              AND s.batch_id = %s
              AND mt.test_date = %s
              AND COALESCE(mt.maths_unit_names, ARRAY[]::text[]) = %s
              AND COALESCE(mt.physics_unit_names, ARRAY[]::text[]) = %s
              AND COALESCE(mt.chemistry_unit_names, ARRAY[]::text[]) = %s
              AND COALESCE(mt.biology_unit_names, ARRAY[]::text[]) = %s
              AND mt.maths_total_marks IS NOT DISTINCT FROM %s
              AND mt.physics_total_marks IS NOT DISTINCT FROM %s
              AND mt.chemistry_total_marks IS NOT DISTINCT FROM %s
              AND mt.biology_total_marks IS NOT DISTINCT FROM %s
              AND mt.test_total_marks IS NOT DISTINCT FROM %s
        """, (
            batch_id,
            payload.test_date,
            payload.maths_unit_names,
            payload.physics_unit_names,
            payload.chemistry_unit_names,
            payload.biology_unit_names,
            payload.maths_total_marks,
            payload.physics_total_marks,
            payload.chemistry_total_marks,
            payload.biology_total_marks,
            payload.test_total_marks,
        ))
        deleted_count = cursor.rowcount

        conn.commit()
        return {
            "message": "Mock test deleted successfully",
            "deleted_count": deleted_count
        }
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete mock test group: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/exam/health")
async def health_check(current_user: dict = Depends(get_current_user)):
    """Health check endpoint"""
    return {"status": "healthy", "service": "exam-api"}


@app.get("/api/exam/template/daily-test/{batch_id}")
async def get_daily_test_template(
    batch_id: int,
    total_marks: int = 100,
    multi_template: bool = Query(False),
    test_count: int = Query(1, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and download Excel template for daily test marks entry
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get students from the batch
        cursor.execute("""
            SELECT student_id, student_name 
            FROM student 
            WHERE batch_id = %s 
            ORDER BY
                CASE WHEN student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                CASE WHEN student_id ~ '^[0-9]+$' THEN student_id::BIGINT END,
                student_id ASC,
                student_name ASC
        """, (batch_id,))
        
        students = cursor.fetchall()
        
        if not students:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No students found for batch ID {batch_id}"
            )
        
        # Create Excel workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Daily Test Marks"
        
        # Styling
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=12)
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers
        if multi_template:
            headers = [
                'Test No',
                'Admission Number',
                'Student Name',
                'Exam Date (YYYY-MM-DD)',
                'Subject',
                'Topic / Unit Name',
                'Marks',
                'Subject Total Marks',
                'Test Total Marks'
            ]
        else:
            headers = [
                'Admission Number',
                'Student Name',
                'Marks'
            ]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border
        
        # Add student data
        if multi_template:
            row = 2
            for test_no in range(1, test_count + 1):
                for student_id, student_name in students:
                    ws.cell(row=row, column=1, value=test_no).border = border
                    ws.cell(row=row, column=2, value=student_id).border = border
                    ws.cell(row=row, column=3, value=student_name).border = border
                    ws.cell(row=row, column=4, value="").border = border
                    ws.cell(row=row, column=5, value="").border = border
                    ws.cell(row=row, column=6, value="").border = border
                    ws.cell(row=row, column=7, value="").border = border
                    ws.cell(row=row, column=8, value=total_marks).border = border
                    ws.cell(row=row, column=9, value=total_marks).border = border
                    row += 1
                if test_no < test_count:
                    row += 1
        else:
            for row, (student_id, student_name) in enumerate(students, 2):
                ws.cell(row=row, column=1, value=student_id).border = border
                ws.cell(row=row, column=2, value=student_name).border = border
                ws.cell(row=row, column=3, value="").border = border
        
        # Adjust column widths
        if multi_template:
            ws.column_dimensions['A'].width = 12
            ws.column_dimensions['B'].width = 20
            ws.column_dimensions['C'].width = 35
            ws.column_dimensions['D'].width = 20
            ws.column_dimensions['E'].width = 20
            ws.column_dimensions['F'].width = 28
            ws.column_dimensions['G'].width = 16
            ws.column_dimensions['H'].width = 20
            ws.column_dimensions['I'].width = 18
        else:
            ws.column_dimensions['A'].width = 20
            ws.column_dimensions['B'].width = 35
            ws.column_dimensions['C'].width = 16
        
        # Add instructions in a separate sheet
        instructions_ws = wb.create_sheet("Instructions")
        instructions = [
            ["Daily Test Marks Template - Instructions"],
            [""],
            ["1. Fill 'Exam Date', 'Subject', and 'Topic / Unit Name' directly in the sheet." if multi_template else "1. Fill only the Marks column."],
            [f"2. This file was generated for {test_count} test set(s). Use 'Test No' to separate tests." if multi_template else "2. Do not modify the Student Name column."],
            ["3. Do not modify the Admission Number or Student Name columns." if multi_template else "3. Do not modify the Admission Number or Student Name columns."],
            ["4. Fill Marks only for students who attended; empty marks are skipped." if multi_template else "4. Save the file and upload it back to the system."],
            ["5. Subject/Test totals are optional; defaults are used if left empty." if multi_template else ""],
            ["6. Save the file and upload it back to the system." if multi_template else ""],
            [""],
            ["Note: This template is specifically generated for your batch."]
        ]
        
        for row, instruction in enumerate(instructions, 1):
            cell = instructions_ws.cell(row=row, column=1, value=instruction[0])
            if row == 1:
                cell.font = Font(bold=True, size=14)
        
        instructions_ws.column_dimensions['A'].width = 70
        
        # Save to BytesIO
        excel_file = BytesIO()
        wb.save(excel_file)
        excel_file.seek(0)
        
        # Return as downloadable file
        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={'daily_test_multi_template' if multi_template else 'daily_test_template'}_batch_{batch_id}.xlsx"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate template: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/exam/template/mock-test/{batch_id}")
async def get_mock_test_template(
    batch_id: int,
    multi_template: bool = Query(False),
    test_count: int = Query(1, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and download Excel template for mock test marks entry
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get students from the batch
        cursor.execute("""
            SELECT student_id, student_name 
            FROM student 
            WHERE batch_id = %s 
            ORDER BY
                CASE WHEN student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                CASE WHEN student_id ~ '^[0-9]+$' THEN student_id::BIGINT END,
                student_id ASC,
                student_name ASC
        """, (batch_id,))
        
        students = cursor.fetchall()
        
        if not students:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No students found for batch ID {batch_id}"
            )

        # Determine which mock-test subjects are enabled for this batch
        cursor.execute("SELECT subjects FROM batch WHERE batch_id = %s", (batch_id,))
        batch_row = cursor.fetchone()
        batch_subjects = batch_row[0] if batch_row else None
        active_subjects = get_batch_mock_subjects(batch_subjects)
        subject_headers = {
            "maths": "Maths Marks",
            "physics": "Physics Marks",
            "chemistry": "Chemistry Marks",
            "biology": "Biology Marks",
        }
        
        # Create Excel workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Mock Test Marks"
        
        # Styling
        header_fill = PatternFill(start_color="70AD47", end_color="70AD47", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=12)
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers
        if multi_template:
            headers = ['Test No', 'Admission Number', 'Student Name', 'Exam Date (YYYY-MM-DD)']
            for subject_key in active_subjects:
                subject_name = subject_headers[subject_key].replace(' Marks', '')
                headers.extend([
                    f'{subject_name} Unit Names',
                    f'{subject_name} Total Marks',
                    f'{subject_name} Marks'
                ])
            headers.append('Test Total Marks')
        else:
            headers = ['Admission Number', 'Student Name'] + [subject_headers[s] for s in active_subjects]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border
        
        # Add student data
        if multi_template:
            row = 2
            for test_no in range(1, test_count + 1):
                for student_id, student_name in students:
                    ws.cell(row=row, column=1, value=test_no).border = border
                    ws.cell(row=row, column=2, value=student_id).border = border
                    ws.cell(row=row, column=3, value=student_name).border = border
                    ws.cell(row=row, column=4, value="").border = border
                    col = 5
                    for _ in active_subjects:
                        ws.cell(row=row, column=col, value="").border = border
                        ws.cell(row=row, column=col + 1, value="").border = border
                        ws.cell(row=row, column=col + 2, value="").border = border
                        col += 3
                    ws.cell(row=row, column=col, value="").border = border
                    row += 1
                if test_no < test_count:
                    row += 1
        else:
            for row, (student_id, student_name) in enumerate(students, 2):
                ws.cell(row=row, column=1, value=student_id).border = border
                ws.cell(row=row, column=2, value=student_name).border = border
                for index, _ in enumerate(active_subjects, 3):
                    ws.cell(row=row, column=index, value="").border = border
        
        # Adjust column widths
        if multi_template:
            ws.column_dimensions['A'].width = 12
            ws.column_dimensions['B'].width = 20
            ws.column_dimensions['C'].width = 35
            ws.column_dimensions['D'].width = 20
            for index in range(5, len(headers) + 1):
                ws.column_dimensions[openpyxl.utils.get_column_letter(index)].width = 20
        else:
            ws.column_dimensions['A'].width = 20
            ws.column_dimensions['B'].width = 35
            for index in range(3, len(headers) + 1):
                ws.column_dimensions[openpyxl.utils.get_column_letter(index)].width = 18
        
        # Add instructions in a separate sheet
        instructions_ws = wb.create_sheet("Instructions")
        instructions = [
            ["Mock Test Marks Template - Instructions"],
            [""],
            ["1. Fill Exam Date directly in the sheet." if multi_template else "1. Fill marks in subject columns generated from this batch configuration."],
            [f"2. This file was generated for {test_count} test set(s). Use 'Test No' to separate tests." if multi_template else "2. Do not modify the Student Name column."],
            ["3. You can enter multiple mock tests in one file by using different dates." if multi_template else "3. Do not modify the Admission Number or Student Name columns."],
            ["4. Do not modify the Admission Number or Student Name columns." if multi_template else "4. Save the file and upload it back to the system."],
            ["5. Subject marks can be left empty if not available." if multi_template else f"5. Subject columns included: {', '.join([s.title() for s in active_subjects])}"],
            ["6. For multi template, fill unit names and subject totals in sheet columns." if multi_template else ""],
            ["7. Empty marks are skipped during upload." if multi_template else ""],
            [""],
            ["Note: This template is specifically generated for your batch."]
        ]
        
        for row, instruction in enumerate(instructions, 1):
            cell = instructions_ws.cell(row=row, column=1, value=instruction[0])
            if row == 1:
                cell.font = Font(bold=True, size=14)
        
        instructions_ws.column_dimensions['A'].width = 70
        
        # Save to BytesIO
        excel_file = BytesIO()
        wb.save(excel_file)
        excel_file.seek(0)
        
        # Return as downloadable file
        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={'mock_test_multi_template' if multi_template else 'mock_test_template'}_batch_{batch_id}.xlsx"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate template: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/exam/daily-test/student/{student_no}")
async def get_student_daily_tests(student_no: int, current_user: dict = Depends(get_current_user)):
    """
    Get all daily test marks for a specific student
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch all daily tests for the student
        cursor.execute("""
            SELECT 
                test_id,
                grade,
                branch,
                test_date,
                subject,
                unit_name,
                total_marks,
                subject_total_marks,
                test_total_marks,
                created_at
            FROM daily_test
            WHERE student_no = %s
            ORDER BY test_date DESC, subject, unit_name
        """, (student_no,))
        
        tests = cursor.fetchall()
        
        # Format results
        daily_tests = []
        for test in tests:
            daily_tests.append({
                "test_id": test[0],
                "grade": test[1],
                "branch": test[2],
                "test_date": test[3].isoformat() if test[3] else None,
                "subject": test[4],
                "unit_name": test[5],
                "total_marks": test[6],
                "subject_total_marks": test[7],
                "test_total_marks": test[8],
                "created_at": test[9].isoformat() if test[9] else None
            })
        
        return {
            "student_no": student_no,
            "daily_tests": daily_tests,
            "total_tests": len(daily_tests)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch daily tests: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/exam/mock-test/student/{student_no}")
async def get_student_mock_tests(student_no: int, current_user: dict = Depends(get_current_user)):
    """
    Get all mock test marks for a specific student
    """
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch all mock tests for the student
        cursor.execute("""
            SELECT 
                test_id,
                grade,
                branch,
                test_date,
                maths_marks,
                physics_marks,
                chemistry_marks,
                biology_marks,
                maths_unit_names,
                physics_unit_names,
                chemistry_unit_names,
                biology_unit_names,
                total_marks,
                maths_total_marks,
                physics_total_marks,
                chemistry_total_marks,
                biology_total_marks,
                test_total_marks,
                created_at
            FROM mock_test
            WHERE student_no = %s
            ORDER BY test_date DESC
        """, (student_no,))
        
        tests = cursor.fetchall()
        
        # Format results
        mock_tests = []
        for test in tests:
            mock_tests.append({
                "test_id": test[0],
                "grade": test[1],
                "branch": test[2],
                "test_date": test[3].isoformat() if test[3] else None,
                "maths_marks": test[4],
                "physics_marks": test[5],
                "chemistry_marks": test[6],
                "biology_marks": test[7],
                "maths_unit_names": test[8],
                "physics_unit_names": test[9],
                "chemistry_unit_names": test[10],
                "biology_unit_names": test[11],
                "total_marks": test[12],
                "maths_total_marks": test[13],
                "physics_total_marks": test[14],
                "chemistry_total_marks": test[15],
                "biology_total_marks": test[16],
                "test_total_marks": test[17],
                "created_at": test[18].isoformat() if test[18] else None
            })
        
        return {
            "student_no": student_no,
            "mock_tests": mock_tests,
            "total_tests": len(mock_tests)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch mock tests: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/exam/batch-report/{batch_id}")
async def get_batch_report(batch_id: int, current_user: dict = Depends(get_current_user)):
    """
    Get batch report data: all students with basic details,
    per-student daily/mock test counts, and batch-level totals.
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Fetch batch info
        cursor.execute("""
            SELECT batch_id, batch_name, start_year, end_year, type
            FROM batch WHERE batch_id = %s
        """, (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {batch_id} not found"
            )

        batch_info = {
            "batch_id": batch_row[0],
            "batch_name": batch_row[1],
            "start_year": batch_row[2],
            "end_year": batch_row[3],
            "type": batch_row[4],
        }

        # 2. Fetch all students in the batch with basic details
        cursor.execute("""
            SELECT
                s.student_no,
                s.student_id,
                s.student_name,
                s.gender,
                s.dob,
                s.community,
                s.grade,
                s.enrollment_year,
                s.course,
                s.branch,
                s.student_mobile,
                s.email
            FROM student s
            WHERE s.batch_id = %s
            ORDER BY
                CASE WHEN s.student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                CASE WHEN s.student_id ~ '^[0-9]+$' THEN s.student_id::BIGINT END,
                s.student_id ASC,
                s.student_name ASC
        """, (batch_id,))
        student_rows = cursor.fetchall()

        student_nos = [r[0] for r in student_rows]

        # 3. Per-student daily test counts
        daily_counts = {}
        if student_nos:
            cursor.execute(f"""
                SELECT
                    dt.student_no,
                    COUNT(DISTINCT (
                        dt.test_date,
                        {normalized_subject_sql('dt.subject')},
                        COALESCE(NULLIF(TRIM(dt.unit_name), ''), 'Unknown')
                    )) as cnt
                FROM daily_test dt
                WHERE dt.student_no = ANY(%s)
                GROUP BY dt.student_no
            """, (student_nos,))
            for row in cursor.fetchall():
                daily_counts[row[0]] = row[1]

        # 4. Per-student mock test counts
        mock_counts = {}
        if student_nos:
            cursor.execute("""
                SELECT
                    mt.student_no,
                    COUNT(DISTINCT (
                        mt.test_date,
                        COALESCE(mt.maths_unit_names, ARRAY[]::text[]),
                        COALESCE(mt.physics_unit_names, ARRAY[]::text[]),
                        COALESCE(mt.chemistry_unit_names, ARRAY[]::text[]),
                        COALESCE(mt.biology_unit_names, ARRAY[]::text[]),
                        mt.maths_total_marks,
                        mt.physics_total_marks,
                        mt.chemistry_total_marks,
                        mt.biology_total_marks,
                        mt.test_total_marks
                    )) as cnt
                FROM mock_test mt
                WHERE mt.student_no = ANY(%s)
                GROUP BY mt.student_no
            """, (student_nos,))
            for row in cursor.fetchall():
                mock_counts[row[0]] = row[1]

        # 5. Total distinct daily tests conducted for this batch
        total_daily_tests = 0
        if student_nos:
            cursor.execute(f"""
                SELECT COUNT(DISTINCT (
                    dt.test_date,
                    {normalized_subject_sql('dt.subject')},
                    COALESCE(NULLIF(TRIM(dt.unit_name), ''), 'Unknown')
                ))
                FROM daily_test dt
                WHERE dt.student_no = ANY(%s)
            """, (student_nos,))
            total_daily_tests = cursor.fetchone()[0] or 0

        # 6. Total distinct mock tests conducted for this batch
        total_mock_tests = 0
        if student_nos:
            cursor.execute("""
                SELECT COUNT(DISTINCT (
                    mt.test_date,
                    COALESCE(mt.maths_unit_names, ARRAY[]::text[]),
                    COALESCE(mt.physics_unit_names, ARRAY[]::text[]),
                    COALESCE(mt.chemistry_unit_names, ARRAY[]::text[]),
                    COALESCE(mt.biology_unit_names, ARRAY[]::text[]),
                    mt.maths_total_marks,
                    mt.physics_total_marks,
                    mt.chemistry_total_marks,
                    mt.biology_total_marks,
                    mt.test_total_marks
                ))
                FROM mock_test mt
                WHERE mt.student_no = ANY(%s)
            """, (student_nos,))
            total_mock_tests = cursor.fetchone()[0] or 0

        # 7. Fetch all daily test records for batch students
        daily_tests = []
        if student_nos:
            cursor.execute("""
                SELECT s.student_id, s.student_name, dt.test_date,
                      dt.subject, dt.unit_name, dt.total_marks, dt.subject_total_marks, dt.test_total_marks
                FROM daily_test dt
                JOIN student s ON s.student_no = dt.student_no
                WHERE dt.student_no = ANY(%s)
                ORDER BY
                    CASE WHEN s.student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                    CASE WHEN s.student_id ~ '^[0-9]+$' THEN s.student_id::BIGINT END,
                    s.student_id ASC,
                    s.student_name ASC,
                    dt.test_date,
                    dt.subject,
                    dt.unit_name
            """, (student_nos,))
            for r in cursor.fetchall():
                daily_tests.append({
                    "student_id": r[0],
                    "student_name": r[1],
                    "test_date": r[2].isoformat() if r[2] else None,
                    "subject": r[3],
                    "unit_name": r[4],
                    "total_marks": r[5],
                    "subject_total_marks": r[6],
                    "test_total_marks": r[7],
                })

        # 8. Fetch all mock test records for batch students
        mock_tests = []
        if student_nos:
            cursor.execute("""
                SELECT s.student_id, s.student_name, mt.test_date,
                       mt.maths_marks, mt.physics_marks,
                      mt.chemistry_marks, mt.biology_marks, mt.total_marks,
                      mt.maths_total_marks, mt.physics_total_marks,
                      mt.chemistry_total_marks, mt.biology_total_marks, mt.test_total_marks
                FROM mock_test mt
                JOIN student s ON s.student_no = mt.student_no
                WHERE mt.student_no = ANY(%s)
                ORDER BY
                    CASE WHEN s.student_id ~ '^[0-9]+$' THEN 0 ELSE 1 END,
                    CASE WHEN s.student_id ~ '^[0-9]+$' THEN s.student_id::BIGINT END,
                    s.student_id ASC,
                    s.student_name ASC,
                    mt.test_date
            """, (student_nos,))
            for r in cursor.fetchall():
                mock_tests.append({
                    "student_id": r[0],
                    "student_name": r[1],
                    "test_date": r[2].isoformat() if r[2] else None,
                    "maths_marks": r[3],
                    "physics_marks": r[4],
                    "chemistry_marks": r[5],
                    "biology_marks": r[6],
                    "total_marks": r[7],
                    "maths_total_marks": r[8],
                    "physics_total_marks": r[9],
                    "chemistry_total_marks": r[10],
                    "biology_total_marks": r[11],
                    "test_total_marks": r[12],
                })

        # Build student list
        students = []
        for row in student_rows:
            sno = row[0]
            sid = row[1]
            students.append({
                "student_id": sid,
                "student_no": sno,
                "student_name": row[2],
                "gender": row[3],
                "dob": row[4].isoformat() if row[4] else None,
                "community": row[5],
                "grade": row[6],
                "enrollment_year": row[7],
                "course": row[8],
                "branch": row[9],
                "student_mobile": row[10],
                "email": row[11],
                "daily_test_count": daily_counts.get(sno, 0),
                "mock_test_count": mock_counts.get(sno, 0),
            })

        return {
            "batch": batch_info,
            "total_students": len(students),
            "total_daily_tests_conducted": total_daily_tests,
            "total_mock_tests_conducted": total_mock_tests,
            "students": students,
            "daily_tests": daily_tests,
            "mock_tests": mock_tests,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate batch report: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
