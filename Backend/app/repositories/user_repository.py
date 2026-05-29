from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:

    @staticmethod
    def get_user_by_email(
        db: Session,
        email: str
    ):
        result = db.execute(
            select(User).where(User.email == email)
        )

        return result.scalar_one_or_none()

    @staticmethod
    def get_user_by_id(
        db: Session,
        user_id
    ):
        result = db.execute(
            select(User).where(User.id == user_id)
        )

        return result.scalar_one_or_none()

    @staticmethod
    def get_user_by_employee_id(
        db: Session,
        employee_id: str
    ):
        result = db.execute(
            select(User).where(User.employee_id == employee_id)
        )

        return result.scalar_one_or_none()

    @staticmethod
    def create_user(
        db: Session,
        user: User
    ):
        db.add(user)

        db.commit()

        db.refresh(user)

        return user

    @staticmethod
    def get_user_by_role(
        db: Session,
        role: str
    ):
        result = db.execute(
            select(User).where(User.role == role).limit(1)
        )

        return result.scalar_one_or_none()

    @staticmethod
    def get_users_by_role(
        db: Session,
        role: str
    ):
        result = db.execute(
            select(User).where(User.role == role)
        )

        return list(result.scalars().all())