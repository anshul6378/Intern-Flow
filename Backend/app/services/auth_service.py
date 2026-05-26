from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token
)


class AuthService:

    @staticmethod
    def register_user(
        db: Session,
        email: str,
        full_name: str,
        password: str,
        role: str,
        employee_id: str | None = None,
    ):

        existing_user = UserRepository.get_user_by_email(
            db,
            email
        )

        if existing_user:
            raise Exception("User already exists")

        if employee_id:
            existing_employee = UserRepository.get_user_by_employee_id(
                db,
                employee_id
            )

            if existing_employee:
                raise Exception("Employee ID already exists")

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=role,
            employee_id=employee_id,
        )

        try:
            return UserRepository.create_user(
                db,
                user
            )
        except IntegrityError as e:
            db.rollback()

            error_text = str(e.orig)
            if "uq_users_employee_id" in error_text or "employee_id" in error_text:
                raise Exception("Employee ID already exists")
            if "users_email_key" in error_text or "email" in error_text:
                raise Exception("User already exists")

            raise Exception("Unable to register user")

    @staticmethod
    def login_user(
        db: Session,
        email: str,
        password: str
    ):

        user = UserRepository.get_user_by_email(
            db,
            email
        )

        if not user:
            raise Exception("Invalid credentials")

        if not verify_password(
            password,
            user.hashed_password
        ):
            raise Exception("Invalid credentials")

        token = create_access_token(
            {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role
            }
        )

        return token

    @staticmethod
    def claim_account(
        db: Session,
        email: str,
        password: str,
        role: str | None = None,
    ):
        user = UserRepository.get_user_by_email(db, email)
        if not user:
            raise Exception("User not found")

        if role and user.role != role:
            raise Exception(f"User role mismatch. Expected {role}, found {user.role}")

        if user.role not in {"candidate", "mentor"}:
            raise Exception("Only candidate or mentor accounts can be claimed")

        user.hashed_password = hash_password(password)
        user.is_active = True
        db.commit()
        db.refresh(user)
        return user