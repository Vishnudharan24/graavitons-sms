from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import psycopg2
import bcrypt
from datetime import datetime
import uuid
from config import DB_CONFIG, CORS_ORIGINS, APP_TITLE
from middleware import create_access_token, get_current_user

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

class UserLogin(BaseModel):
    email: str
    password: str


class UserRegister(BaseModel):
    email: str
    password: str
    role: Optional[str] = "Teacher"


# ── Helper ──

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def _build_user_dict(row):
    """Build a user dict from a DB row (id, email, role, created_at)."""
    return {
        "id": row[0],
        "email": row[1],
        "role": row[2],
        "created_at": str(row[3]) if row[3] else None,
    }


# ── Routes ──

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    """Authenticate a user and return a JWT access token."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, email, password, role, created_at FROM users WHERE email = %s;",
            (credentials.email,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # user[2] is the hashed password
        if not verify_password(credentials.password, user[2]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        user_dict = _build_user_dict((user[0], user[1], user[3], user[4]))
        token = create_access_token({
            "sub": user[0],
            "email": user[1],
            "role": user[3],
        })

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user": user_dict,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    """Register a new user."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s;", (user_data.email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists"
            )

        user_id = str(uuid.uuid4())[:8]  # Short unique ID
        hashed_pw = hash_password(user_data.password)

        cursor.execute("""
            INSERT INTO users (id, email, password, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, email, role, created_at;
        """, (user_id, user_data.email, hashed_pw, user_data.role))

        result = cursor.fetchone()
        conn.commit()

        return {
            "message": "Registration successful",
            "user": _build_user_dict(result),
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@app.get("/api/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's info from their JWT."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, email, role, created_at FROM users WHERE id = %s;",
            (current_user["sub"],)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return _build_user_dict(user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    finally:
        if conn:
            conn.close()


@app.get("/api/auth/user/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user info by ID (excludes password). Requires authentication."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, email, role, created_at FROM users WHERE id = %s;",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return _build_user_dict(user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    finally:
        if conn:
            conn.close()
