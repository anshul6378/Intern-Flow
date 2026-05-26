from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


from app.core.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    ClaimAccountRequest,
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
            role=payload.role,
            employee_id=payload.employee_id
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


@router.post("/claim-account")
def claim_account(
    payload: ClaimAccountRequest,
    db: Session = Depends(get_db)
):

    try:
        user = AuthService.claim_account(
            db=db,
            email=payload.email,
            password=payload.password,
            role=payload.role
        )

        return {
            "message": "Account claimed successfully",
            "user_id": str(user.id),
            "role": user.role
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "employee_id": current_user.employee_id,
        "role": current_user.role,
        "department": current_user.department,
        "is_active": current_user.is_active,
    }