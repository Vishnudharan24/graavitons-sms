from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
import psycopg2
from psycopg2 import sql
from datetime import datetime
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


# Pydantic models
class BatchCreate(BaseModel):
    batch_name: str
    start_year: int
    end_year: int
    type: Optional[str] = None
    subjects: List[str] = []
    
    @validator('end_year')
    def validate_year_range(cls, v, values):
        if 'start_year' in values and v <= values['start_year']:
            raise ValueError('end_year must be greater than start_year')
        return v


class BatchResponse(BaseModel):
    batch_id: int
    batch_name: str
    start_year: int
    end_year: int
    type: Optional[str]
    subjects: List[str]
    created_at: Optional[datetime]


class BatchListResponse(BaseModel):
    batches: List[BatchResponse]
    count: int


class MessageResponse(BaseModel):
    message: str
    batch: BatchResponse


def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
        return None


@app.post("/api/batch", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(batch: BatchCreate):
    """
    Create a new batch
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
        
        cursor = conn.cursor()
        
        # Insert batch into database
        insert_query = """
            INSERT INTO batch (batch_name, start_year, end_year, type, subjects)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING batch_id, batch_name, start_year, end_year, type, subjects, created_at;
        """
        
        cursor.execute(
            insert_query,
            (batch.batch_name, batch.start_year, batch.end_year, batch.type, batch.subjects)
        )
        
        # Fetch the inserted batch
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        # Prepare response
        batch_data = BatchResponse(
            batch_id=result[0],
            batch_name=result[1],
            start_year=result[2],
            end_year=result[3],
            type=result[4],
            subjects=result[5] if result[5] else [],
            created_at=result[6]
        )
        
        cursor.close()
        conn.close()
        
        return MessageResponse(
            message="Batch created successfully",
            batch=batch_data
        )
        
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Batch with this name might already exist"
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


@app.get("/api/batch", response_model=BatchListResponse)
async def get_batches():
    """Get all batches"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection failed"
            )
        
        cursor = conn.cursor()
        
        # Fetch all batches
        cursor.execute("""
            SELECT batch_id, batch_name, start_year, end_year, type, subjects, created_at
            FROM batch
            ORDER BY created_at DESC;
        """)
        
        batches = cursor.fetchall()
        
        # Format response
        batch_list = []
        for batch in batches:
            batch_list.append(BatchResponse(
                batch_id=batch[0],
                batch_name=batch[1],
                start_year=batch[2],
                end_year=batch[3],
                type=batch[4],
                subjects=batch[5] if batch[5] else [],
                created_at=batch[6]
            ))
        
        cursor.close()
        conn.close()
        
        return BatchListResponse(
            batches=batch_list,
            count=len(batch_list)
        )
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server error: {str(e)}"
        )


@app.delete("/api/batch/{batch_id}", status_code=status.HTTP_200_OK)
async def delete_batch(batch_id: int):
    """
    Delete a batch and ALL related data:
    - Student-related: parent_info, tenth_mark, twelfth_mark, entrance_exams,
      counselling_detail, feedback, daily_test, mock_test
    - Batch-related: achievers
    - Then students and the batch itself
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

        # 1. Verify batch exists
        cursor.execute("SELECT batch_id, batch_name FROM batch WHERE batch_id = %s", (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch with ID {batch_id} not found"
            )

        batch_name = batch_row[1]

        # 2. Get all student_ids in this batch
        cursor.execute("SELECT student_id FROM student WHERE batch_id = %s", (batch_id,))
        student_ids = [row[0] for row in cursor.fetchall()]

        # 3. Delete all student-related records if students exist
        if student_ids:
            # Use ANY() with a postgres array for efficient bulk delete
            student_id_tuple = tuple(student_ids)

            # Child tables that reference student_id
            student_child_tables = [
                "feedback",
                "entrance_exams",
                "counselling_detail",
                "twelfth_mark",
                "tenth_mark",
                "parent_info",
                "daily_test",
                "mock_test",
            ]

            for table in student_child_tables:
                cursor.execute(
                    sql.SQL("DELETE FROM {} WHERE student_id IN %s").format(
                        sql.Identifier(table)
                    ),
                    (student_id_tuple,)
                )

        # 4. Delete achievers linked to this batch
        cursor.execute("DELETE FROM achievers WHERE batch_id = %s", (batch_id,))

        # 5. Delete all students in this batch
        cursor.execute("DELETE FROM student WHERE batch_id = %s", (batch_id,))
        deleted_students = cursor.rowcount

        # 6. Delete the batch itself
        cursor.execute("DELETE FROM batch WHERE batch_id = %s", (batch_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "message": f"Batch '{batch_name}' and all related data deleted successfully",
            "batch_id": batch_id,
            "batch_name": batch_name,
            "students_deleted": deleted_students
        }

    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise

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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
