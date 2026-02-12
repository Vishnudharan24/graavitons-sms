from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator
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
    marks: str


class DailyTestCreate(BaseModel):
    batch_id: int
    examName: str
    examDate: date
    subject: str
    unitName: str
    totalMarks: int
    examType: str
    studentMarks: List[DailyTestStudentMark]


# Pydantic models for Mock Test
class MockTestStudentMark(BaseModel):
    id: str  # student_id
    mathsMarks: str
    physicsMarks: str
    chemistryMarks: str
    biologyMarks: str


class MockTestCreate(BaseModel):
    batch_id: int
    examName: str
    examDate: date
    examType: str
    mathsUnitNames: str
    physicsUnitNames: str
    chemistryUnitNames: str
    biologyUnitNames: str
    studentMarks: List[MockTestStudentMark]


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
            SELECT batch_name, type FROM batch WHERE batch_id = %s
        """, (exam_data.batch_id,))
        
        batch_result = cursor.fetchone()
        if not batch_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {exam_data.batch_id} not found"
            )
        
        batch_name, batch_type = batch_result
        
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
        
        for student_mark in exam_data.studentMarks:
            try:
                # Skip if marks is empty
                if not student_mark.marks or student_mark.marks.strip() == '':
                    continue
                
                # Get student's branch
                cursor.execute("""
                    SELECT branch FROM student WHERE student_id = %s
                """, (student_mark.id,))
                
                student_result = cursor.fetchone()
                if not student_result:
                    failed_students.append({
                        "student_id": student_mark.id,
                        "reason": "Student not found"
                    })
                    continue
                
                branch = student_result[0]
                
                # Store marks as-is (supports integers, 'A' for absent, '-' for N/A, negative marks)
                marks = student_mark.marks.strip()
                
                # Insert daily test record
                cursor.execute("""
                    INSERT INTO daily_test (
                        student_id, grade, branch, test_date, 
                        subject, unit_name, total_marks
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    student_mark.id,
                    grade,
                    branch,
                    exam_data.examDate,
                    exam_data.subject,
                    exam_data.unitName,
                    marks
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
            "subject": exam_data.subject,
            "unit_name": exam_data.unitName,
            "total_marks": exam_data.totalMarks,
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
        
        # Get batch details to extract grade
        cursor.execute("""
            SELECT batch_name, type FROM batch WHERE batch_id = %s
        """, (exam_data.batch_id,))
        
        batch_result = cursor.fetchone()
        if not batch_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {exam_data.batch_id} not found"
            )
        
        batch_name, batch_type = batch_result
        
        # Extract grade from batch
        grade = None
        if batch_name:
            import re
            grade_match = re.search(r'\d+', batch_name)
            if grade_match:
                grade = int(grade_match.group())
        
        # Parse unit names (convert comma-separated strings to arrays)
        maths_units = [u.strip() for u in exam_data.mathsUnitNames.split(',') if u.strip()]
        physics_units = [u.strip() for u in exam_data.physicsUnitNames.split(',') if u.strip()]
        chemistry_units = [u.strip() for u in exam_data.chemistryUnitNames.split(',') if u.strip()]
        biology_units = [u.strip() for u in exam_data.biologyUnitNames.split(',') if u.strip()]
        
        inserted_count = 0
        failed_students = []
        
        for student_mark in exam_data.studentMarks:
            try:
                # Skip if all marks are empty
                if (not student_mark.mathsMarks or student_mark.mathsMarks.strip() == '') and \
                   (not student_mark.physicsMarks or student_mark.physicsMarks.strip() == '') and \
                   (not student_mark.chemistryMarks or student_mark.chemistryMarks.strip() == '') and \
                   (not student_mark.biologyMarks or student_mark.biologyMarks.strip() == ''):
                    continue
                
                # Get student's branch
                cursor.execute("""
                    SELECT branch FROM student WHERE student_id = %s
                """, (student_mark.id,))
                
                student_result = cursor.fetchone()
                if not student_result:
                    failed_students.append({
                        "student_id": student_mark.id,
                        "reason": "Student not found"
                    })
                    continue
                
                branch = student_result[0]
                
                # Store marks as-is (supports integers, 'A' for absent, '-' for N/A, negative marks)
                maths_marks = student_mark.mathsMarks.strip() if student_mark.mathsMarks and student_mark.mathsMarks.strip() else ''
                physics_marks = student_mark.physicsMarks.strip() if student_mark.physicsMarks and student_mark.physicsMarks.strip() else ''
                chemistry_marks = student_mark.chemistryMarks.strip() if student_mark.chemistryMarks and student_mark.chemistryMarks.strip() else ''
                biology_marks = student_mark.biologyMarks.strip() if student_mark.biologyMarks and student_mark.biologyMarks.strip() else ''
                
                # Calculate total marks only from numeric values
                def safe_int(val):
                    try:
                        return int(val)
                    except (ValueError, TypeError):
                        return None
                
                numeric_marks = [safe_int(m) for m in [maths_marks, physics_marks, chemistry_marks, biology_marks]]
                valid_marks = [m for m in numeric_marks if m is not None]
                total_marks = str(sum(valid_marks)) if valid_marks else ''
                
                # Insert mock test record
                cursor.execute("""
                    INSERT INTO mock_test (
                        student_id, grade, branch, test_date,
                        maths_marks, physics_marks, chemistry_marks, biology_marks,
                        maths_unit_names, physics_unit_names, chemistry_unit_names, biology_unit_names,
                        total_marks
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    student_mark.id,
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
                    total_marks
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
            "units": {
                "maths": maths_units,
                "physics": physics_units,
                "chemistry": chemistry_units,
                "biology": biology_units
            },
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


@app.get("/api/exam/health")
async def health_check(current_user: dict = Depends(get_current_user)):
    """Health check endpoint"""
    return {"status": "healthy", "service": "exam-api"}


@app.get("/api/exam/template/daily-test/{batch_id}")
async def get_daily_test_template(batch_id: int, total_marks: int = 100, current_user: dict = Depends(get_current_user)):
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
            ORDER BY student_id
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
        headers = ['Admission Number', 'Student Name', f'Marks (out of {total_marks})']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border
        
        # Add student data
        for row, (student_id, student_name) in enumerate(students, 2):
            ws.cell(row=row, column=1, value=student_id).border = border
            ws.cell(row=row, column=2, value=student_name).border = border
            ws.cell(row=row, column=3, value="").border = border
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 35
        ws.column_dimensions['C'].width = 20
        
        # Add instructions in a separate sheet
        instructions_ws = wb.create_sheet("Instructions")
        instructions = [
            ["Daily Test Marks Template - Instructions"],
            [""],
            ["1. Fill in the marks for each student in the 'Marks' column"],
            ["2. Do not modify the Admission Number or Student Name columns"],
            ["3. Ensure marks are within the specified range (0 to total marks)"],
            ["4. Save the file and upload it back to the system"],
            ["5. Empty marks will be skipped during upload"],
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
                "Content-Disposition": f"attachment; filename=daily_test_template_batch_{batch_id}.xlsx"
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
async def get_mock_test_template(batch_id: int, current_user: dict = Depends(get_current_user)):
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
            ORDER BY student_id
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
        headers = ['Admission Number', 'Student Name', 'Maths Marks', 'Physics Marks', 'Biology Marks', 'Chemistry Marks']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = border
        
        # Add student data
        for row, (student_id, student_name) in enumerate(students, 2):
            ws.cell(row=row, column=1, value=student_id).border = border
            ws.cell(row=row, column=2, value=student_name).border = border
            ws.cell(row=row, column=3, value="").border = border  # Maths
            ws.cell(row=row, column=4, value="").border = border  # Physics
            ws.cell(row=row, column=5, value="").border = border  # Biology
            ws.cell(row=row, column=6, value="").border = border  # Chemistry
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 35
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 15
        ws.column_dimensions['E'].width = 15
        ws.column_dimensions['F'].width = 15
        
        # Add instructions in a separate sheet
        instructions_ws = wb.create_sheet("Instructions")
        instructions = [
            ["Mock Test Marks Template - Instructions"],
            [""],
            ["1. Fill in the marks for each student for all four subjects"],
            ["2. Do not modify the Admission Number or Student Name columns"],
            ["3. Enter marks for: Maths, Physics, Biology, and Chemistry"],
            ["4. All subject marks are required for each student"],
            ["5. Save the file and upload it back to the system"],
            ["6. Empty marks will be treated as 0 during upload"],
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
                "Content-Disposition": f"attachment; filename=mock_test_template_batch_{batch_id}.xlsx"
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


@app.get("/api/exam/daily-test/student/{student_id}")
async def get_student_daily_tests(student_id: str, current_user: dict = Depends(get_current_user)):
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
                created_at
            FROM daily_test
            WHERE student_id = %s
            ORDER BY test_date DESC, subject, unit_name
        """, (student_id,))
        
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
                "created_at": test[7].isoformat() if test[7] else None
            })
        
        return {
            "student_id": student_id,
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


@app.get("/api/exam/mock-test/student/{student_id}")
async def get_student_mock_tests(student_id: str, current_user: dict = Depends(get_current_user)):
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
                created_at
            FROM mock_test
            WHERE student_id = %s
            ORDER BY test_date DESC
        """, (student_id,))
        
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
                "created_at": test[13].isoformat() if test[13] else None
            })
        
        return {
            "student_id": student_id,
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
            ORDER BY s.student_name
        """, (batch_id,))
        student_rows = cursor.fetchall()

        student_ids = [r[0] for r in student_rows]

        # 3. Per-student daily test counts
        daily_counts = {}
        if student_ids:
            cursor.execute("""
                SELECT student_id, COUNT(*) as cnt
                FROM daily_test
                WHERE student_id = ANY(%s)
                GROUP BY student_id
            """, (student_ids,))
            for row in cursor.fetchall():
                daily_counts[row[0]] = row[1]

        # 4. Per-student mock test counts
        mock_counts = {}
        if student_ids:
            cursor.execute("""
                SELECT student_id, COUNT(*) as cnt
                FROM mock_test
                WHERE student_id = ANY(%s)
                GROUP BY student_id
            """, (student_ids,))
            for row in cursor.fetchall():
                mock_counts[row[0]] = row[1]

        # 5. Total distinct daily tests conducted for this batch
        total_daily_tests = 0
        if student_ids:
            cursor.execute("""
                SELECT COUNT(DISTINCT (test_date, subject, unit_name))
                FROM daily_test
                WHERE student_id = ANY(%s)
            """, (student_ids,))
            total_daily_tests = cursor.fetchone()[0] or 0

        # 6. Total distinct mock tests conducted for this batch
        total_mock_tests = 0
        if student_ids:
            cursor.execute("""
                SELECT COUNT(DISTINCT test_date)
                FROM mock_test
                WHERE student_id = ANY(%s)
            """, (student_ids,))
            total_mock_tests = cursor.fetchone()[0] or 0

        # 7. Fetch all daily test records for batch students
        daily_tests = []
        if student_ids:
            cursor.execute("""
                SELECT dt.student_id, s.student_name, dt.test_date,
                       dt.subject, dt.unit_name, dt.total_marks
                FROM daily_test dt
                JOIN student s ON s.student_id = dt.student_id
                WHERE dt.student_id = ANY(%s)
                ORDER BY dt.test_date, s.student_name
            """, (student_ids,))
            for r in cursor.fetchall():
                daily_tests.append({
                    "student_id": r[0],
                    "student_name": r[1],
                    "test_date": r[2].isoformat() if r[2] else None,
                    "subject": r[3],
                    "unit_name": r[4],
                    "total_marks": r[5],
                })

        # 8. Fetch all mock test records for batch students
        mock_tests = []
        if student_ids:
            cursor.execute("""
                SELECT mt.student_id, s.student_name, mt.test_date,
                       mt.maths_marks, mt.physics_marks,
                       mt.chemistry_marks, mt.biology_marks, mt.total_marks
                FROM mock_test mt
                JOIN student s ON s.student_id = mt.student_id
                WHERE mt.student_id = ANY(%s)
                ORDER BY mt.test_date, s.student_name
            """, (student_ids,))
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
                })

        # Build student list
        students = []
        for row in student_rows:
            sid = row[0]
            students.append({
                "student_id": sid,
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
                "daily_test_count": daily_counts.get(sid, 0),
                "mock_test_count": mock_counts.get(sid, 0),
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
