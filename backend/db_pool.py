"""
Centralized database connection pool for GRAAVITONS SMS Backend.
Uses psycopg2 ThreadedConnectionPool for thread-safe connection reuse.

Usage in API modules:
    from db_pool import get_db_connection

    conn = get_db_connection()
    try:
        ...
    finally:
        conn.close()   # returns the connection to the pool (not actually closed)
"""

import atexit
from psycopg2.pool import ThreadedConnectionPool
from fastapi import HTTPException, status
from config import DB_CONFIG, DB_POOL_MIN, DB_POOL_MAX

# ── Initialise the pool at module load time ──
try:
    pool = ThreadedConnectionPool(
        minconn=DB_POOL_MIN,
        maxconn=DB_POOL_MAX,
        **DB_CONFIG,
    )
except Exception as e:
    raise RuntimeError(f"Failed to create database connection pool: {e}")


class PooledConnection:
    """
    Thin wrapper around a psycopg2 connection that returns it to the pool
    on .close() instead of destroying it.  All other attribute access is
    forwarded to the underlying connection, so existing code works unchanged.
    """

    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._returned = False

    # Forward everything to the real connection
    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close(self):
        """Return connection to pool instead of closing."""
        if not self._returned:
            self._returned = True
            try:
                if not self._conn.closed:
                    self._conn.reset()
                self._pool.putconn(self._conn)
            except Exception:
                self._pool.putconn(self._conn, close=True)

    # Support context-manager usage:  with get_db_connection() as conn: ...
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


def get_db_connection():
    """
    Get a connection from the pool wrapped in PooledConnection.
    Calling conn.close() returns it to the pool.
    """
    try:
        raw = pool.getconn()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection pool exhausted or unavailable: {e}",
        )
    return PooledConnection(raw, pool)


def close_pool():
    """Gracefully close all connections in the pool."""
    if pool and not pool.closed:
        pool.closeall()


# Ensure the pool is closed on process shutdown
atexit.register(close_pool)
