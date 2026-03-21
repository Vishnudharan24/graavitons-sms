"""
Centralized configuration module for GRAAVITONS SMS Backend.
All environment variables are loaded here and exported for use across the app.
"""

import os
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import urlparse, unquote

# Load .env file from the backend directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

def _db_config_from_url(database_url: str):
    """Parse postgres connection URL into psycopg2 connection kwargs."""
    parsed = urlparse(database_url)

    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("DATABASE_URL must start with postgres:// or postgresql://")

    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "database": (parsed.path or "").lstrip("/") or "graavitons_db",
        "user": unquote(parsed.username) if parsed.username else "graav_user",
        "password": unquote(parsed.password) if parsed.password else "",
        "sslmode": os.getenv("DB_SSLMODE", "require"),
    }


# ── Database Configuration ──
_database_url = os.getenv("DATABASE_URL", "").strip()

if _database_url:
    DB_CONFIG = _db_config_from_url(_database_url)
else:
    DB_CONFIG = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME", "graavitons_db"),
        "user": os.getenv("DB_USER", "graav_user"),
        "password": os.getenv("DB_PASSWORD", ""),
        "sslmode": os.getenv("DB_SSLMODE", "prefer"),
    }

# ── Database Connection Pool ──
DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "2"))
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))

# ── Server Configuration ──
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", os.getenv("PORT", "8000")))

# ── CORS Configuration ──
_cors_origins = os.getenv("CORS_ORIGINS", "*")


def _normalize_origin(origin: str) -> str:
    origin = origin.strip()
    if origin in ("", "*"):
        return origin
    if origin.startswith(("http://", "https://")):
        return origin
    return f"https://{origin}"


CORS_ORIGINS = [_normalize_origin(origin) for origin in _cors_origins.split(",") if origin.strip()]

# ── JWT Configuration ──
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# ── App Configuration ──
APP_TITLE = os.getenv("APP_TITLE", "GRAAVITONS SMS API")
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
