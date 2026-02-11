from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
import psycopg2
from psycopg2 import sql
from datetime import datetime, date
import pandas as pd
import io
from config import CORS_ORIGINS, APP_TITLE
import numpy as np
from api.middleware import get_current_user
from db_pool import get_db_connection

app = FastAPI(title=APP_TITLE)


def safe_int(value):
    """Safely convert any value (including numpy floats) to Python int"""
    if value is None:
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


def safe_str(value):
    """Safely convert any value to a clean Python string"""
    if value is None:
        return None
    s = str(value)
    # Remove trailing .0 from numeric strings (e.g. "9876543210.0" -> "9876543210")
    if s.endswith('.0') and s[:-2].replace('-', '', 1).isdigit():
        s = s[:-2]
    return s

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class EntranceExam(BaseModel):
    exam_name: str
    physics_marks: Optional[int] = None
    chemistry_marks: Optional[int] = None
    maths_marks: Optional[int] = None
    biology_marks: Optional[int] = None
    total_marks: Optional[int] = None
    community_rank: Optional[int] = None
    overall_rank: Optional[int] = None


class StudentCreate(BaseModel):
    # Student table fields
    student_id: str
    batch_id: int
    student_name: str
    dob: Optional[date] = None
    grade: Optional[str] = None
    community: Optional[str] = None
    enrollment_year: Optional[int] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    gender: Optional[str] = None
    student_mobile: Optional[str] = None
    aadhar_no: Optional[str] = None
    apaar_id: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    school_name: Optional[str] = None
    
    # Parent info fields
    guardian_name: Optional[str] = None
    guardian_occupation: Optional[str] = None
    guardian_mobile: Optional[str] = None
    guardian_email: Optional[str] = None
    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    father_mobile: Optional[str] = None
    father_email: Optional[str] = None
    mother_name: Optional[str] = None
    mother_occupation: Optional[str] = None
    mother_mobile: Optional[str] = None
    mother_email: Optional[str] = None
    sibling_name: Optional[str] = None
    sibling_grade: Optional[str] = None
    sibling_school: Optional[str] = None
    sibling_college: Optional[str] = None
    
    # 10th marks
    tenth_school_name: Optional[str] = None
    tenth_year_of_passing: Optional[int] = None
    tenth_board_of_study: Optional[str] = None
    tenth_english: Optional[int] = None
    tenth_tamil: Optional[int] = None
    tenth_hindi: Optional[int] = None
    tenth_maths: Optional[int] = None
    tenth_science: Optional[int] = None
    tenth_social_science: Optional[int] = None
    tenth_total_marks: Optional[int] = None
    
    # 12th marks
    twelfth_school_name: Optional[str] = None
    twelfth_year_of_passing: Optional[int] = None
    twelfth_board_of_study: Optional[str] = None
    twelfth_english: Optional[int] = None
    twelfth_tamil: Optional[int] = None
    twelfth_physics: Optional[int] = None
    twelfth_chemistry: Optional[int] = None
    twelfth_maths: Optional[int] = None
    twelfth_biology: Optional[int] = None
    twelfth_computer_science: Optional[int] = None
    twelfth_total_marks: Optional[int] = None
    
    # Entrance exams (array)
    entrance_exams: Optional[List[EntranceExam]] = []
    
    # Counselling details
    counselling_forum: Optional[str] = None
    counselling_round: Optional[int] = None
    counselling_college_alloted: Optional[str] = None
    counselling_year_of_completion: Optional[int] = None


class StudentResponse(BaseModel):
    student_id: str
    student_name: str
    batch_id: int
    grade: Optional[str]
    gender: Optional[str]
    email: Optional[str]
    created_at: Optional[datetime]


class StudentUpdate(BaseModel):
    """Model for updating student - all fields optional for partial updates"""
    # Student table fields
    student_name: Optional[str] = None
    dob: Optional[date] = None
    grade: Optional[str] = None
    community: Optional[str] = None
    enrollment_year: Optional[int] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    gender: Optional[str] = None
    student_mobile: Optional[str] = None
    aadhar_no: Optional[str] = None
    apaar_id: Optional[str] = None
    email: Optional[str] = None
    school_name: Optional[str] = None
    
    # Parent info
    guardian_name: Optional[str] = None
    guardian_occupation: Optional[str] = None
    guardian_mobile: Optional[str] = None
    guardian_email: Optional[str] = None
    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    father_mobile: Optional[str] = None
    father_email: Optional[str] = None
    mother_name: Optional[str] = None
    mother_occupation: Optional[str] = None
    mother_mobile: Optional[str] = None
    mother_email: Optional[str] = None
    sibling_name: Optional[str] = None
    sibling_grade: Optional[str] = None
    sibling_school: Optional[str] = None
    sibling_college: Optional[str] = None
    
    # 10th marks
    tenth_school_name: Optional[str] = None
    tenth_year_of_passing: Optional[int] = None
    tenth_board_of_study: Optional[str] = None
    tenth_english: Optional[int] = None
    tenth_tamil: Optional[int] = None
    tenth_hindi: Optional[int] = None
    tenth_maths: Optional[int] = None
    tenth_science: Optional[int] = None
    tenth_social_science: Optional[int] = None
    tenth_total_marks: Optional[int] = None
    
    # 12th marks
    twelfth_school_name: Optional[str] = None
    twelfth_year_of_passing: Optional[int] = None
    twelfth_board_of_study: Optional[str] = None
    twelfth_english: Optional[int] = None
    twelfth_tamil: Optional[int] = None
    twelfth_physics: Optional[int] = None
    twelfth_chemistry: Optional[int] = None
    twelfth_maths: Optional[int] = None
    twelfth_biology: Optional[int] = None
    twelfth_computer_science: Optional[int] = None
    twelfth_total_marks: Optional[int] = None
    
    # Counselling details
    counselling_forum: Optional[str] = None
    counselling_round: Optional[int] = None
    counselling_college_alloted: Optional[str] = None
    counselling_year_of_completion: Optional[int] = None
    email: Optional[str]
    created_at: Optional[datetime]


class MessageResponse(BaseModel):
    message: str
    student: StudentResponse


def insert_student_data(student_data: StudentCreate, conn):
    """Insert student data into all related tables"""
    cursor = conn.cursor()
    
    try:
        # 1. Insert into student table
        cursor.execute("""
            INSERT INTO student (
                student_id, batch_id, student_name, dob, grade, community,
                enrollment_year, course, branch, gender, student_mobile,
                aadhar_no, apaar_id, email, photo_url, school_name
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING student_id, student_name, batch_id, grade, gender, email, created_at;
        """, (
            student_data.student_id, student_data.batch_id, student_data.student_name,
            student_data.dob, student_data.grade, student_data.community,
            student_data.enrollment_year, student_data.course, student_data.branch,
            student_data.gender, student_data.student_mobile, student_data.aadhar_no,
            student_data.apaar_id, student_data.email, student_data.photo_url,
            student_data.school_name
        ))
        
        student_result = cursor.fetchone()
        
        # 2. Insert into parent_info table
        cursor.execute("""
            INSERT INTO parent_info (
                student_id, guardian_name, father_name, mother_name, sibling_name,
                guardian_occupation, father_occupation, mother_occupation, sibling_grade,
                guardian_mobile, mother_mobile, father_mobile,
                sibling_school, sibling_college,
                guardian_email, mother_email, father_email
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            student_data.student_id, student_data.guardian_name, student_data.father_name,
            student_data.mother_name, student_data.sibling_name,
            student_data.guardian_occupation, student_data.father_occupation,
            student_data.mother_occupation, student_data.sibling_grade,
            student_data.guardian_mobile, student_data.mother_mobile,
            student_data.father_mobile, student_data.sibling_school,
            student_data.sibling_college, student_data.guardian_email,
            student_data.mother_email, student_data.father_email
        ))
        
        # 3. Insert into tenth_mark table (if data provided)
        if student_data.tenth_school_name or student_data.tenth_year_of_passing:
            cursor.execute("""
                INSERT INTO tenth_mark (
                    student_id, school_name, year_of_passing, board_of_study,
                    english, tamil, hindi, maths, science, social_science, total_marks
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                student_data.student_id, student_data.tenth_school_name,
                student_data.tenth_year_of_passing, student_data.tenth_board_of_study,
                student_data.tenth_english, student_data.tenth_tamil,
                student_data.tenth_hindi, student_data.tenth_maths,
                student_data.tenth_science, student_data.tenth_social_science,
                student_data.tenth_total_marks
            ))
        
        # 4. Insert into twelfth_mark table (if data provided)
        if student_data.twelfth_school_name or student_data.twelfth_year_of_passing:
            cursor.execute("""
                INSERT INTO twelfth_mark (
                    student_id, school_name, year_of_passing, board_of_study,
                    english, physics, maths, chemistry, biology, computer_science, tamil, total_marks
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                student_data.student_id, student_data.twelfth_school_name,
                student_data.twelfth_year_of_passing, student_data.twelfth_board_of_study,
                student_data.twelfth_english, student_data.twelfth_physics,
                student_data.twelfth_maths, student_data.twelfth_chemistry,
                student_data.twelfth_biology, student_data.twelfth_computer_science,
                student_data.twelfth_tamil, student_data.twelfth_total_marks
            ))
        
        # 5. Insert entrance exams (if provided)
        if student_data.entrance_exams:
            for exam in student_data.entrance_exams:
                cursor.execute("""
                    INSERT INTO entrance_exams (
                        student_id, exam_name, physics_marks, chemistry_marks,
                        maths_marks, biology_marks, total_marks, community_rank, overall_rank
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    student_data.student_id, exam.exam_name, exam.physics_marks,
                    exam.chemistry_marks, exam.maths_marks, exam.biology_marks,
                    exam.total_marks, exam.community_rank, exam.overall_rank
                ))
        
        # 6. Insert counselling details (if provided)
        if student_data.counselling_forum or student_data.counselling_college_alloted:
            cursor.execute("""
                INSERT INTO counselling_detail (
                    student_id, forum, round, college_alloted, year_of_completion
                ) VALUES (%s, %s, %s, %s, %s);
            """, (
                student_data.student_id, student_data.counselling_forum,
                student_data.counselling_round, student_data.counselling_college_alloted,
                student_data.counselling_year_of_completion
            ))
        
        return student_result
        
    except Exception as e:
        raise e


@app.post("/api/student", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_student(student: StudentCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a new student with all related information
    """
    conn = None
    try:
        # Connect to database
        conn = get_db_connection()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection failed"
            )
        
        # Check if batch exists
        cursor = conn.cursor()
        cursor.execute("SELECT batch_id FROM batch WHERE batch_id = %s", (student.batch_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {student.batch_id} not found"
            )
        
        # Insert student data
        result = insert_student_data(student, conn)
        
        # Commit the transaction
        conn.commit()
        
        # Prepare response
        student_response = StudentResponse(
            student_id=result[0],
            student_name=result[1],
            batch_id=result[2],
            grade=result[3],
            gender=result[4],
            email=result[5],
            created_at=result[6]
        )
        
        cursor.close()
        conn.close()
        
        return MessageResponse(
            message="Student added successfully",
            student=student_response
        )
        
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
            conn.close()
        if "student_pkey" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Student with ID {student.student_id} already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Database integrity error: {str(e)}"
        )
    
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server error: {str(e)}"
        )


@app.post("/api/student/upload", status_code=status.HTTP_201_CREATED)
async def upload_students_excel(
    file: UploadFile = File(...),
    batch_id: int = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload students from Excel file (.xlsx)
    
    The Excel file should have the following columns:
    - Required: student_id, student_name
    - All other fields are optional
    """
    conn = None
    try:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an Excel file (.xlsx or .xls)"
            )
        
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Replace NaN with None
        df = df.where(pd.notna(df), None)
        
        # Validate required columns
        if 'student_id' not in df.columns or 'student_name' not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Excel file must contain 'student_id' and 'student_name' columns"
            )
        
        # Connect to database
        conn = get_db_connection()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection failed"
            )
        
        # Check if batch exists
        cursor = conn.cursor()
        cursor.execute("SELECT batch_id FROM batch WHERE batch_id = %s", (batch_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {batch_id} not found"
            )
        
        success_count = 0
        error_count = 0
        errors = []
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Create SAVEPOINT at the start so it exists for rollback on ANY error
                cursor.execute("SAVEPOINT student_row")
                
                # Helper to safely get a value from the row
                def get_val(col):
                    """Return value if column exists and is not NaN/None, else None"""
                    if col in row and pd.notna(row[col]):
                        return row[col]
                    return None
                
                # Convert date string to date object if present
                dob_value = None
                if get_val('dob') is not None:
                    try:
                        dob_value = pd.to_datetime(row['dob']).date()
                    except:
                        dob_value = None
                
                # Prepare entrance exams if columns exist
                entrance_exams = []
                if get_val('entrance_exam_name') is not None:
                    entrance_exams.append(EntranceExam(
                        exam_name=safe_str(get_val('entrance_exam_name')),
                        physics_marks=safe_int(get_val('entrance_physics_marks')),
                        chemistry_marks=safe_int(get_val('entrance_chemistry_marks')),
                        maths_marks=safe_int(get_val('entrance_maths_marks')),
                        biology_marks=safe_int(get_val('entrance_biology_marks')),
                        total_marks=safe_int(get_val('entrance_total_marks')),
                        overall_rank=safe_int(get_val('entrance_overall_rank')),
                        community_rank=safe_int(get_val('entrance_community_rank'))
                    ))
                
                # Create student object with safe type conversions
                student_data = StudentCreate(
                    student_id=safe_str(row['student_id']),
                    batch_id=batch_id,
                    student_name=safe_str(row['student_name']),
                    dob=dob_value,
                    grade=safe_str(get_val('grade')),
                    community=safe_str(get_val('community')),
                    enrollment_year=safe_int(get_val('enrollment_year')),
                    course=safe_str(get_val('course')),
                    branch=safe_str(get_val('branch')),
                    gender=safe_str(get_val('gender')),
                    student_mobile=safe_str(get_val('student_mobile')),
                    aadhar_no=safe_str(get_val('aadhar_no')),
                    apaar_id=safe_str(get_val('apaar_id')),
                    email=safe_str(get_val('email')),
                    school_name=safe_str(get_val('school_name')),
                    
                    # Parent info
                    guardian_name=safe_str(get_val('guardian_name')),
                    guardian_occupation=safe_str(get_val('guardian_occupation')),
                    guardian_mobile=safe_str(get_val('guardian_mobile')),
                    guardian_email=safe_str(get_val('guardian_email')),
                    father_name=safe_str(get_val('father_name')),
                    father_occupation=safe_str(get_val('father_occupation')),
                    father_mobile=safe_str(get_val('father_mobile')),
                    father_email=safe_str(get_val('father_email')),
                    mother_name=safe_str(get_val('mother_name')),
                    mother_occupation=safe_str(get_val('mother_occupation')),
                    mother_mobile=safe_str(get_val('mother_mobile')),
                    mother_email=safe_str(get_val('mother_email')),
                    sibling_name=safe_str(get_val('sibling_name')),
                    sibling_grade=safe_str(get_val('sibling_grade')),
                    sibling_school=safe_str(get_val('sibling_school')),
                    sibling_college=safe_str(get_val('sibling_college')),
                    
                    # 10th marks
                    tenth_school_name=safe_str(get_val('tenth_school_name')),
                    tenth_year_of_passing=safe_int(get_val('tenth_year_of_passing')),
                    tenth_board_of_study=safe_str(get_val('tenth_board_of_study')),
                    tenth_english=safe_int(get_val('tenth_english')),
                    tenth_tamil=safe_int(get_val('tenth_tamil')),
                    tenth_hindi=safe_int(get_val('tenth_hindi')),
                    tenth_maths=safe_int(get_val('tenth_maths')),
                    tenth_science=safe_int(get_val('tenth_science')),
                    tenth_social_science=safe_int(get_val('tenth_social_science')),
                    tenth_total_marks=safe_int(get_val('tenth_total_marks')),
                    
                    # 12th marks
                    twelfth_school_name=safe_str(get_val('twelfth_school_name')),
                    twelfth_year_of_passing=safe_int(get_val('twelfth_year_of_passing')),
                    twelfth_board_of_study=safe_str(get_val('twelfth_board_of_study')),
                    twelfth_english=safe_int(get_val('twelfth_english')),
                    twelfth_tamil=safe_int(get_val('twelfth_tamil')),
                    twelfth_physics=safe_int(get_val('twelfth_physics')),
                    twelfth_chemistry=safe_int(get_val('twelfth_chemistry')),
                    twelfth_maths=safe_int(get_val('twelfth_maths')),
                    twelfth_biology=safe_int(get_val('twelfth_biology')),
                    twelfth_computer_science=safe_int(get_val('twelfth_computer_science')),
                    twelfth_total_marks=safe_int(get_val('twelfth_total_marks')),
                    
                    # Entrance exams
                    entrance_exams=entrance_exams,
                    
                    # Counselling
                    counselling_forum=safe_str(get_val('counselling_forum')),
                    counselling_round=safe_int(get_val('counselling_round')),
                    counselling_college_alloted=safe_str(get_val('counselling_college_alloted')),
                    counselling_year_of_completion=safe_int(get_val('counselling_year_of_completion'))
                )
                
                # Use SAVEPOINT so a single row failure doesn't abort the whole transaction
                insert_student_data(student_data, conn)
                cursor.execute("RELEASE SAVEPOINT student_row")
                success_count += 1
                
            except Exception as e:
                # Rollback only this row's changes, keep the transaction alive
                import traceback
                traceback.print_exc()
                cursor.execute("ROLLBACK TO SAVEPOINT student_row")
                error_count += 1
                error_msg = str(e)
                if "student_pkey" in error_msg or "unique constraint" in error_msg.lower() or "already exists" in error_msg.lower():
                    error_msg = f"Student {row.get('student_id', 'N/A')} already exists in the database"
                errors.append({
                    'row': int(index) + 2,  # +2 because Excel is 1-indexed and has header
                    'student_id': safe_str(row.get('student_id', 'N/A')),
                    'error': error_msg
                })
        
        # Commit all successful insertions
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "message": f"Upload completed",
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors[:10] if errors else []  # Return first 10 errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@app.get("/api/student/batch/{batch_id}")
async def get_students_by_batch(batch_id: int, current_user: dict = Depends(get_current_user)):
    """
    Get all students in a specific batch with their basic information
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection failed"
            )
        
        cursor = conn.cursor()
        
        # Fetch students with basic info
        query = """
            SELECT 
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
                s.email,
                s.created_at
            FROM student s
            WHERE s.batch_id = %s
            ORDER BY s.student_name
        """
        
        cursor.execute(query, (batch_id,))
        rows = cursor.fetchall()
        
        students = []
        for row in rows:
            student = {
                "student_id": row[0],
                "student_name": row[1],
                "gender": row[2],
                "dob": row[3].isoformat() if row[3] else None,
                "community": row[4],
                "grade": row[5],
                "enrollment_year": row[6],
                "course": row[7],
                "branch": row[8],
                "student_mobile": row[9],
                "email": row[10],
                "created_at": row[11].isoformat() if row[11] else None
            }
            students.append(student)
        
        cursor.close()
        conn.close()
        
        return {
            "batch_id": batch_id,
            "count": len(students),
            "students": students
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching students: {str(e)}"
        )


@app.get("/api/student/{student_id}")
async def get_student_details(student_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get complete student details from all related tables
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection failed"
            )
        
        cursor = conn.cursor()
        
        # Fetch student basic info
        cursor.execute("""
            SELECT student_id, batch_id, student_name, dob, grade, community, 
                   enrollment_year, course, branch, gender, student_mobile, 
                   aadhar_no, apaar_id, email, school_name, created_at
            FROM student WHERE student_id = %s
        """, (student_id,))
        
        student_row = cursor.fetchone()
        if not student_row:
            cursor.close()
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student {student_id} not found"
            )
        
        student_data = {
            "student_id": student_row[0],
            "batch_id": student_row[1],
            "student_name": student_row[2],
            "dob": student_row[3].isoformat() if student_row[3] else None,
            "grade": student_row[4],
            "community": student_row[5],
            "enrollment_year": student_row[6],
            "course": student_row[7],
            "branch": student_row[8],
            "gender": student_row[9],
            "student_mobile": student_row[10],
            "aadhar_no": student_row[11],
            "apaar_id": student_row[12],
            "email": student_row[13],
            "school_name": student_row[14],
            "created_at": student_row[15].isoformat() if student_row[15] else None
        }
        
        # Fetch parent info
        cursor.execute("""
            SELECT guardian_name, guardian_occupation, guardian_mobile, guardian_email,
                   father_name, father_occupation, father_mobile, father_email,
                   mother_name, mother_occupation, mother_mobile, mother_email,
                   sibling_name, sibling_grade, sibling_school, sibling_college
            FROM parent_info WHERE student_id = %s
        """, (student_id,))
        
        parent_row = cursor.fetchone()
        if parent_row:
            student_data.update({
                "guardian_name": parent_row[0],
                "guardian_occupation": parent_row[1],
                "guardian_mobile": parent_row[2],
                "guardian_email": parent_row[3],
                "father_name": parent_row[4],
                "father_occupation": parent_row[5],
                "father_mobile": parent_row[6],
                "father_email": parent_row[7],
                "mother_name": parent_row[8],
                "mother_occupation": parent_row[9],
                "mother_mobile": parent_row[10],
                "mother_email": parent_row[11],
                "sibling_name": parent_row[12],
                "sibling_grade": parent_row[13],
                "sibling_school": parent_row[14],
                "sibling_college": parent_row[15]
            })
        
        # Fetch 10th marks
        cursor.execute("""
            SELECT school_name, year_of_passing, board_of_study, english, tamil, hindi,
                   maths, science, social_science, total_marks
            FROM tenth_mark WHERE student_id = %s
        """, (student_id,))
        
        tenth_row = cursor.fetchone()
        if tenth_row:
            student_data.update({
                "tenth_school_name": tenth_row[0],
                "tenth_year_of_passing": tenth_row[1],
                "tenth_board_of_study": tenth_row[2],
                "tenth_english": tenth_row[3],
                "tenth_tamil": tenth_row[4],
                "tenth_hindi": tenth_row[5],
                "tenth_maths": tenth_row[6],
                "tenth_science": tenth_row[7],
                "tenth_social_science": tenth_row[8],
                "tenth_total_marks": tenth_row[9]
            })
        
        # Fetch 12th marks
        cursor.execute("""
            SELECT school_name, year_of_passing, board_of_study, english, physics,
                   maths, chemistry, biology, computer_science, tamil, total_marks
            FROM twelfth_mark WHERE student_id = %s
        """, (student_id,))
        
        twelfth_row = cursor.fetchone()
        if twelfth_row:
            student_data.update({
                "twelfth_school_name": twelfth_row[0],
                "twelfth_year_of_passing": twelfth_row[1],
                "twelfth_board_of_study": twelfth_row[2],
                "twelfth_english": twelfth_row[3],
                "twelfth_physics": twelfth_row[4],
                "twelfth_maths": twelfth_row[5],
                "twelfth_chemistry": twelfth_row[6],
                "twelfth_biology": twelfth_row[7],
                "twelfth_computer_science": twelfth_row[8],
                "twelfth_tamil": twelfth_row[9],
                "twelfth_total_marks": twelfth_row[10]
            })
        
        # Fetch entrance exams
        cursor.execute("""
            SELECT exam_name, physics_marks, chemistry_marks, maths_marks,
                   biology_marks, total_marks, community_rank, overall_rank
            FROM entrance_exams WHERE student_id = %s
        """, (student_id,))
        
        entrance_rows = cursor.fetchall()
        if entrance_rows:
            entrance_exams = []
            for exam_row in entrance_rows:
                entrance_exams.append({
                    "exam_name": exam_row[0],
                    "physics_marks": exam_row[1],
                    "chemistry_marks": exam_row[2],
                    "maths_marks": exam_row[3],
                    "biology_marks": exam_row[4],
                    "total_marks": exam_row[5],
                    "community_rank": exam_row[6],
                    "overall_rank": exam_row[7]
                })
            student_data["entrance_exams"] = entrance_exams
        
        # Fetch counselling details
        cursor.execute("""
            SELECT forum, round, college_alloted, year_of_completion
            FROM counselling_detail WHERE student_id = %s
        """, (student_id,))
        
        counselling_row = cursor.fetchone()
        if counselling_row:
            student_data.update({
                "counselling_forum": counselling_row[0],
                "counselling_round": counselling_row[1],
                "counselling_college_alloted": counselling_row[2],
                "counselling_year_of_completion": counselling_row[3]
            })
        
        cursor.close()
        conn.close()
        
        return student_data
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching student details: {str(e)}"
        )


@app.put("/api/student/{student_id}")
async def update_student(student_id: str, updates: StudentUpdate, current_user: dict = Depends(get_current_user)):
    """
    Update student details - only updates fields that are provided (partial update)
    """
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection failed"
            )
        
        cursor = conn.cursor()
        
        # Check if student exists
        cursor.execute("SELECT student_id FROM student WHERE student_id = %s", (student_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student {student_id} not found"
            )
        
        # Build dynamic UPDATE query for student table - only update provided fields
        student_fields = {
            'student_name': updates.student_name,
            'dob': updates.dob,
            'grade': updates.grade,
            'community': updates.community,
            'enrollment_year': updates.enrollment_year,
            'course': updates.course,
            'branch': updates.branch,
            'gender': updates.gender,
            'student_mobile': updates.student_mobile,
            'aadhar_no': updates.aadhar_no,
            'apaar_id': updates.apaar_id,
            'email': updates.email,
            'school_name': updates.school_name
        }
        
        # Filter out None values (fields not provided)
        student_updates = {k: v for k, v in student_fields.items() if v is not None}
        
        if student_updates:
            set_clause = ", ".join([f"{k} = %s" for k in student_updates.keys()])
            query = f"UPDATE student SET {set_clause} WHERE student_id = %s"
            cursor.execute(query, list(student_updates.values()) + [student_id])
        
        # Update parent_info table (UPSERT logic)
        parent_fields = {
            'guardian_name': updates.guardian_name,
            'guardian_occupation': updates.guardian_occupation,
            'guardian_mobile': updates.guardian_mobile,
            'guardian_email': updates.guardian_email,
            'father_name': updates.father_name,
            'father_occupation': updates.father_occupation,
            'father_mobile': updates.father_mobile,
            'father_email': updates.father_email,
            'mother_name': updates.mother_name,
            'mother_occupation': updates.mother_occupation,
            'mother_mobile': updates.mother_mobile,
            'mother_email': updates.mother_email,
            'sibling_name': updates.sibling_name,
            'sibling_grade': updates.sibling_grade,
            'sibling_school': updates.sibling_school,
            'sibling_college': updates.sibling_college
        }
        
        parent_updates = {k: v for k, v in parent_fields.items() if v is not None}
        
        if parent_updates:
            # Check if parent_info exists
            cursor.execute("SELECT student_id FROM parent_info WHERE student_id = %s", (student_id,))
            parent_exists = cursor.fetchone()
            
            if parent_exists:
                set_clause = ", ".join([f"{k} = %s" for k in parent_updates.keys()])
                query = f"UPDATE parent_info SET {set_clause} WHERE student_id = %s"
                cursor.execute(query, list(parent_updates.values()) + [student_id])
            else:
                columns = ['student_id'] + list(parent_updates.keys())
                placeholders = ', '.join(['%s'] * len(columns))
                query = f"INSERT INTO parent_info ({', '.join(columns)}) VALUES ({placeholders})"
                cursor.execute(query, [student_id] + list(parent_updates.values()))
        
        # Update tenth_mark table (UPSERT logic)
        tenth_fields = {
            'school_name': updates.tenth_school_name,
            'year_of_passing': updates.tenth_year_of_passing,
            'board_of_study': updates.tenth_board_of_study,
            'english': updates.tenth_english,
            'tamil': updates.tenth_tamil,
            'hindi': updates.tenth_hindi,
            'maths': updates.tenth_maths,
            'science': updates.tenth_science,
            'social_science': updates.tenth_social_science,
            'total_marks': updates.tenth_total_marks
        }
        
        tenth_updates = {k: v for k, v in tenth_fields.items() if v is not None}
        
        if tenth_updates:
            cursor.execute("SELECT student_id FROM tenth_mark WHERE student_id = %s", (student_id,))
            tenth_exists = cursor.fetchone()
            
            if tenth_exists:
                set_clause = ", ".join([f"{k} = %s" for k in tenth_updates.keys()])
                query = f"UPDATE tenth_mark SET {set_clause} WHERE student_id = %s"
                cursor.execute(query, list(tenth_updates.values()) + [student_id])
            else:
                columns = ['student_id'] + list(tenth_updates.keys())
                placeholders = ', '.join(['%s'] * len(columns))
                query = f"INSERT INTO tenth_mark ({', '.join(columns)}) VALUES ({placeholders})"
                cursor.execute(query, [student_id] + list(tenth_updates.values()))
        
        # Update twelfth_mark table (UPSERT logic)
        twelfth_fields = {
            'school_name': updates.twelfth_school_name,
            'year_of_passing': updates.twelfth_year_of_passing,
            'board_of_study': updates.twelfth_board_of_study,
            'english': updates.twelfth_english,
            'tamil': updates.twelfth_tamil,
            'physics': updates.twelfth_physics,
            'chemistry': updates.twelfth_chemistry,
            'maths': updates.twelfth_maths,
            'biology': updates.twelfth_biology,
            'computer_science': updates.twelfth_computer_science,
            'total_marks': updates.twelfth_total_marks
        }
        
        twelfth_updates = {k: v for k, v in twelfth_fields.items() if v is not None}
        
        if twelfth_updates:
            cursor.execute("SELECT student_id FROM twelfth_mark WHERE student_id = %s", (student_id,))
            twelfth_exists = cursor.fetchone()
            
            if twelfth_exists:
                set_clause = ", ".join([f"{k} = %s" for k in twelfth_updates.keys()])
                query = f"UPDATE twelfth_mark SET {set_clause} WHERE student_id = %s"
                cursor.execute(query, list(twelfth_updates.values()) + [student_id])
            else:
                columns = ['student_id'] + list(twelfth_updates.keys())
                placeholders = ', '.join(['%s'] * len(columns))
                query = f"INSERT INTO twelfth_mark ({', '.join(columns)}) VALUES ({placeholders})"
                cursor.execute(query, [student_id] + list(twelfth_updates.values()))
        
        # Update counselling_detail table (UPSERT logic)
        counselling_fields = {
            'forum': updates.counselling_forum,
            'round': updates.counselling_round,
            'college_alloted': updates.counselling_college_alloted,
            'year_of_completion': updates.counselling_year_of_completion
        }
        
        counselling_updates = {k: v for k, v in counselling_fields.items() if v is not None}
        
        if counselling_updates:
            cursor.execute("SELECT student_id FROM counselling_detail WHERE student_id = %s", (student_id,))
            counselling_exists = cursor.fetchone()
            
            if counselling_exists:
                set_clause = ", ".join([f"{k} = %s" for k in counselling_updates.keys()])
                query = f"UPDATE counselling_detail SET {set_clause} WHERE student_id = %s"
                cursor.execute(query, list(counselling_updates.values()) + [student_id])
            else:
                columns = ['student_id'] + list(counselling_updates.keys())
                placeholders = ', '.join(['%s'] * len(columns))
                query = f"INSERT INTO counselling_detail ({', '.join(columns)}) VALUES ({placeholders})"
                cursor.execute(query, [student_id] + list(counselling_updates.values()))
        
        # Commit all changes
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "message": f"Student {student_id} updated successfully",
            "student_id": student_id,
            "updated_fields": len(student_updates) + len(parent_updates) + len(tenth_updates) + len(twelfth_updates) + len(counselling_updates)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating student: {str(e)}"
        )

@app.get("/api/student/template")
async def download_template(current_user: dict = Depends(get_current_user)):
    """
    Get the list of required columns for the Excel template
    """
    columns = {
        "required": ["student_id", "student_name"],
        "optional_student_info": [
            "dob", "grade", "community", "enrollment_year", "course", "branch",
            "gender", "student_mobile", "aadhar_no", "apaar_id", "email", "school_name"
        ],
        "optional_parent_info": [
            "guardian_name", "guardian_occupation", "guardian_mobile", "guardian_email",
            "father_name", "father_occupation", "father_mobile", "father_email",
            "mother_name", "mother_occupation", "mother_mobile", "mother_email",
            "sibling_name", "sibling_grade", "sibling_school", "sibling_college"
        ],
        "optional_10th_marks": [
            "tenth_school_name", "tenth_year_of_passing", "tenth_board_of_study",
            "tenth_english", "tenth_tamil", "tenth_hindi", "tenth_maths",
            "tenth_science", "tenth_social_science", "tenth_total_marks"
        ],
        "optional_12th_marks": [
            "twelfth_school_name", "twelfth_year_of_passing", "twelfth_board_of_study",
            "twelfth_english", "twelfth_tamil", "twelfth_physics", "twelfth_chemistry",
            "twelfth_maths", "twelfth_biology", "twelfth_computer_science", "twelfth_total_marks"
        ],
        "optional_entrance_exam": [
            "entrance_exam_name", "entrance_physics_marks", "entrance_chemistry_marks",
            "entrance_maths_marks", "entrance_biology_marks", "entrance_total_marks",
            "entrance_overall_rank", "entrance_community_rank"
        ],
        "optional_counselling": [
            "counselling_forum", "counselling_round", "counselling_college_alloted",
            "counselling_year_of_completion"
        ]
    }
    
    return {
        "message": "Excel template column specifications",
        "columns": columns,
        "notes": [
            "Only 'student_id' and 'student_name' are required",
            "All other columns are optional",
            "Date format for 'dob': YYYY-MM-DD or DD/MM/YYYY",
            "For entrance exams, only one exam per row is supported",
            "batch_id will be provided during upload, not in Excel file"
        ]
    }


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
