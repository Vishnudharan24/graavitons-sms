from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
import psycopg2
from psycopg2 import sql
from datetime import datetime

app = FastAPI(title="GRAAVITONS SMS API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'database': 'graavitons_db',
    'user': 'graav_user',
    'password': '123456'
}


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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
