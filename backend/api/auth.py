from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg2
import bcrypt
from datetime import datetime
import uuid
from config import CORS_ORIGINS, APP_TITLE
from db_pool import get_db_connection
from api.middleware import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)

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
    username: str
    password: str


class UserRegister(BaseModel):
    username: str
    password: str
    role: Optional[str] = "Teacher"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Helper ──

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


# ── Routes ──

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    """Authenticate a user with username and password."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, username, password, role, created_at FROM users WHERE username = %s;",
            (credentials.username,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        # user[2] is the hashed password
        if not verify_password(credentials.password, user[2]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        # Build JWT claims
        token_data = {
            "sub": user[0],
            "username": user[1],
            "role": user[3],
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return {
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user[0],
                "username": user[1],
                "role": user[3],
                "created_at": str(user[4]) if user[4] else None
            }
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

        # Check if username already exists
        cursor.execute("SELECT id FROM users WHERE username = %s;", (user_data.username,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this username already exists"
            )

        user_id = str(uuid.uuid4())[:8]  # Short unique ID
        hashed_pw = hash_password(user_data.password)

        cursor.execute("""
            INSERT INTO users (id, username, password, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, username, role, created_at;
        """, (user_id, user_data.username, hashed_pw, user_data.role))

        result = cursor.fetchone()
        conn.commit()

        return {
            "message": "Registration successful",
            "user": {
                "id": result[0],
                "username": result[1],
                "role": result[2],
                "created_at": str(result[3]) if result[3] else None
            }
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


@app.post("/api/auth/refresh")
async def refresh_access_token(body: RefreshRequest):
    """Accept a refresh token and return a new access token."""
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    token_data = {
        "sub": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role"),
    }
    new_access_token = create_access_token(token_data)
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }


@app.get("/api/auth/user/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user info by ID (excludes password)."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, username, role, created_at FROM users WHERE id = %s;",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "id": user[0],
            "username": user[1],
            "role": user[2],
            "created_at": str(user[3]) if user[3] else None
        }

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
