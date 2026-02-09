"""
JWT Authentication middleware for GRAAVITONS SMS Backend.
Provides token creation, verification, and a FastAPI dependency
to protect routes.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES

# Scheme that extracts the token from "Authorization: Bearer <token>"
bearer_scheme = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: payload dict – must include "sub" (user id), "email", "role".
        expires_delta: optional custom expiry; defaults to JWT_EXPIRY_MINUTES.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRY_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Returns:
        The decoded payload dict.

    Raises:
        HTTPException 401 if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency – extracts and verifies the Bearer token,
    returns the decoded user payload.

    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            ...
    """
    return verify_token(credentials.credentials)
