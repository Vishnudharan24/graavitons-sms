from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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


# ── Pydantic Models ──

class AchieverCreate(BaseModel):
    student_id: str
    batch_id: Optional[int] = None
    achievement: str
    achievement_details: Optional[str] = None
    rank: Optional[str] = None
    score: Optional[float] = None
    photo_url: Optional[str] = None
    achieved_date: Optional[date] = None


class AchieverUpdate(BaseModel):
    achievement: Optional[str] = None
    achievement_details: Optional[str] = None
    rank: Optional[str] = None
    score: Optional[float] = None
    photo_url: Optional[str] = None
    achieved_date: Optional[date] = None


# ── Helper ──

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


# ── Routes ──

@app.get("/api/achiever")
async def get_all_achievers():
    """Fetch all achievers with joined student + batch info."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                a.achievement_id,
                a.student_id,
                s.student_name,
                s.gender,
                s.dob,
                s.community,
                s.enrollment_year,
                s.course,
                s.branch,
                s.student_mobile,
                s.aadhar_no,
                s.email,
                s.grade,
                s.photo_url  AS student_photo,
                a.batch_id,
                b.batch_name,
                b.start_year,
                b.end_year,
                a.achievement,
                a.achievement_details,
                a.rank,
                a.score,
                a.photo_url  AS achievement_photo,
                a.achieved_date,
                a.created_at
            FROM achievers a
            JOIN student s ON a.student_id = s.student_id
            LEFT JOIN batch b ON a.batch_id = b.batch_id
            ORDER BY a.created_at DESC;
        """)

        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]

        achievers = []
        for row in rows:
            record = dict(zip(columns, row))
            # Convert date/datetime to string
            for key in ('dob', 'achieved_date', 'created_at'):
                if record.get(key):
                    record[key] = str(record[key])

            # Build a frontend-friendly object
            achievers.append({
                "id": record["achievement_id"],
                "admissionNo": record["student_id"],
                "name": record["student_name"],
                "gender": record.get("gender") or "N/A",
                "dob": record.get("dob") or "",
                "community": record.get("community") or "",
                "academicYear": f"{record.get('start_year', '')}-{record.get('end_year', '')}",
                "course": record.get("course") or "",
                "branch": record.get("branch") or "",
                "studentMobile": record.get("student_mobile") or "",
                "aadharNumber": record.get("aadhar_no") or "",
                "emailId": record.get("email") or "",
                "grade": record.get("grade") or "",
                "photo": record.get("achievement_photo") or record.get("student_photo") or "",
                "batch": record.get("batch_name") or "",
                "batchId": record.get("batch_id"),
                "achievement": record.get("achievement") or "",
                "achievementDetails": record.get("achievement_details") or "",
                "rank": record.get("rank") or "",
                "score": float(record["score"]) if record.get("score") is not None else 0,
                "achievedDate": record.get("achieved_date") or "",
            })

        return {"achievers": achievers, "total": len(achievers)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.get("/api/achiever/{achievement_id}")
async def get_achiever(achievement_id: int):
    """Fetch a single achiever by achievement_id."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                a.achievement_id, a.student_id, a.batch_id,
                a.achievement, a.achievement_details, a.rank,
                a.score, a.photo_url, a.achieved_date, a.created_at,
                s.student_name, s.gender, s.dob, s.community, s.enrollment_year,
                s.course, s.branch, s.student_mobile, s.aadhar_no, s.email, s.grade,
                b.batch_name, b.start_year, b.end_year
            FROM achievers a
            JOIN student s ON a.student_id = s.student_id
            LEFT JOIN batch b ON a.batch_id = b.batch_id
            WHERE a.achievement_id = %s;
        """, (achievement_id,))

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Achiever not found")

        columns = [desc[0] for desc in cursor.description]
        record = dict(zip(columns, row))

        for key in ('dob', 'achieved_date', 'created_at'):
            if record.get(key):
                record[key] = str(record[key])

        return {
            "id": record["achievement_id"],
            "admissionNo": record["student_id"],
            "name": record["student_name"],
            "gender": record.get("gender") or "N/A",
            "dob": record.get("dob") or "",
            "community": record.get("community") or "",
            "course": record.get("course") or "",
            "branch": record.get("branch") or "",
            "grade": record.get("grade") or "",
            "batch": record.get("batch_name") or "",
            "achievement": record.get("achievement") or "",
            "achievementDetails": record.get("achievement_details") or "",
            "rank": record.get("rank") or "",
            "score": float(record["score"]) if record.get("score") is not None else 0,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.post("/api/achiever", status_code=status.HTTP_201_CREATED)
async def create_achiever(achiever: AchieverCreate):
    """Create a new achiever record. The student_id must already exist in the student table."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify that the student exists
        cursor.execute("SELECT student_id FROM student WHERE student_id = %s;", (achiever.student_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail=f"Student with ID '{achiever.student_id}' not found. "
                       "The student must be registered before adding as an achiever."
            )

        cursor.execute("""
            INSERT INTO achievers (student_id, batch_id, achievement, achievement_details,
                                   rank, score, photo_url, achieved_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING achievement_id, created_at;
        """, (
            achiever.student_id,
            achiever.batch_id,
            achiever.achievement,
            achiever.achievement_details,
            achiever.rank,
            achiever.score,
            achiever.photo_url,
            achiever.achieved_date,
        ))

        result = cursor.fetchone()
        conn.commit()

        return {
            "message": "Achiever added successfully!",
            "achievement_id": result[0],
            "created_at": str(result[1]),
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.put("/api/achiever/{achievement_id}")
async def update_achiever(achievement_id: int, data: AchieverUpdate):
    """Update an existing achiever record."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Build dynamic SET clause from provided fields
        updates = {}
        for field, value in data.dict(exclude_unset=True).items():
            if value is not None:
                updates[field] = value

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        set_parts = []
        values = []
        for col, val in updates.items():
            set_parts.append(f"{col} = %s")
            values.append(val)

        values.append(achievement_id)

        cursor.execute(
            f"UPDATE achievers SET {', '.join(set_parts)} WHERE achievement_id = %s RETURNING achievement_id;",
            values
        )

        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Achiever not found")

        conn.commit()
        return {"message": "Achiever updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.delete("/api/achiever/{achievement_id}")
async def delete_achiever(achievement_id: int):
    """Delete an achiever record."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM achievers WHERE achievement_id = %s RETURNING achievement_id;",
            (achievement_id,)
        )

        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Achiever not found")

        conn.commit()
        return {"message": "Achiever deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
