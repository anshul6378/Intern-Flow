from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


from app.core.database import get_db
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse
)
from app.services.auth_service import AuthService


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/register")
def register(
    payload: UserRegister,
    db: Session = Depends(get_db)
):

    try:
        user = AuthService.register_user(
            db=db,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role=payload.role
        )

        return {
            "message": "User registered successfully",
            "user_id": str(user.id)
        }

    except Exception as e:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db)
):

    try:
        token = AuthService.login_user(
            db=db,
            email=payload.email,
            password=payload.password
        )

        return {
            "access_token": token,
            "token_type": "bearer"
        }

    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=str(e)
        )