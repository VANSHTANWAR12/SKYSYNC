from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr

from backend.services.auth_service import (
    create_session,
    create_user,
    get_user_by_email,
    get_user_by_token,
    invalidate_session,
    verify_user_password,
)

router = APIRouter()


class AuthPayload(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


def get_current_user(authorization: str | None = Header(default=None)) -> UserOut:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    user = get_user_by_token(token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


@router.post("/auth/register", response_model=AuthResponse)
def register(payload: AuthPayload):
    existing = get_user_by_email(payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )

    user = create_user(payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create user",
        )

    token = create_session(user["id"])
    return {"token": token, "user": user}


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: AuthPayload):
    user = verify_user_password(payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_session(user["id"])
    return {"token": token, "user": user}


@router.post("/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        invalidate_session(token)
    return {"status": "ok"}


@router.get("/auth/me", response_model=UserOut)
def me(current_user: UserOut = Depends(get_current_user)):
    return current_user
