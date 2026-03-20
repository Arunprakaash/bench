import json
import secrets
import base64
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
 
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session, get_db
from app.models.user import User

router = APIRouter()

PBKDF2_ITERATIONS = 260_000


def _hash_password(password: str, salt_b: bytes) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_b, PBKDF2_ITERATIONS)
    return base64.b64encode(digest).decode("ascii")


def _random_salt() -> str:
    return base64.b64encode(secrets.token_bytes(16)).decode("ascii")


def _verify_password(password: str, salt_b64: str | None, hash_b64: str | None) -> bool:
    if not salt_b64 or not hash_b64:
        return False
    try:
        salt_b = base64.b64decode(salt_b64.encode("ascii"))
    except Exception:
        return False
    expected = _hash_password(password, salt_b)
    # Constant-time compare
    return secrets.compare_digest(expected, hash_b64)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateMeRequest(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None


def _create_token(user: User) -> str:
    now = datetime.utcnow()
    exp = now + timedelta(days=7)
    payload = {"sub": str(user.id), "email": user.email, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def _get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    auth = request.headers.get("authorization") or ""
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth[len("Bearer ") :]
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = decoded.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    try:
        user_id = uuid.UUID(str(sub))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# Public alias so other routers can import and use it as a dependency.
get_current_user = _get_current_user


@router.get("/me")
async def me(current_user: User = Depends(_get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
    }


@router.patch("/me")
async def update_me(data: UpdateMeRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(_get_current_user)):
    current_user.display_name = data.display_name
    current_user.avatar_url = data.avatar_url
    await db.commit()
    await db.refresh(current_user)
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
    }


@router.post("/register")
async def register(data: RegisterRequest):
    email = str(data.email).lower().strip()
    if not data.password or len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    async with async_session() as db:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        salt_b64 = _random_salt()
        password_hash = _hash_password(data.password, base64.b64decode(salt_b64.encode("ascii")))

        user = User(
            email=email,
            display_name=data.display_name,
            avatar_url=None,
            password_salt=salt_b64,
            password_hash=password_hash,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        token = _create_token(user)
        return {
            "token": token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
            },
        }


@router.post("/login")
async def login(data: LoginRequest):
    email = str(data.email).lower().strip()

    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not _verify_password(data.password, user.password_salt, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = _create_token(user)
        return {
            "token": token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
            },
        }


@router.post("/logout", status_code=204)
async def logout():
    # Token is stored client-side for now.
    return None

