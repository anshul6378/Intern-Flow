from sqlalchemy.orm import Session

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
        role: str
    ):

        existing_user = UserRepository.get_user_by_email(
            db,
            email
        )

        if existing_user:
            raise Exception("User already exists")

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=role
        )

        return UserRepository.create_user(
            db,
            user
        )

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