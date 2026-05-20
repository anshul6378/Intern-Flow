"""Repository for NonWorkerIDTask model."""
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.models import NonWorkerIDTask, TASK_STATUS


class NonWorkerIDTaskRepository:
    """Data access layer for NonWorkerIDTask model."""

    @staticmethod
    def create(
        db: Session,
        referral_id: UUID,
        created_by: UUID,
        sla_deadline: datetime,
        assigned_to: Optional[UUID] = None,
        **kwargs
    ) -> NonWorkerIDTask:
        """Create a new Non-Worker ID task."""
        task = NonWorkerIDTask(
            referral_id=referral_id,
            created_by=created_by,
            sla_deadline=sla_deadline,
            assigned_to=assigned_to,
            **kwargs
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_by_id(db: Session, task_id: UUID) -> Optional[NonWorkerIDTask]:
        """Retrieve task by ID."""
        return db.query(NonWorkerIDTask).filter(NonWorkerIDTask.id == task_id).first()

    @staticmethod
    def get_by_referral_id(db: Session, referral_id: UUID) -> Optional[NonWorkerIDTask]:
        """Retrieve task by referral ID."""
        return db.query(NonWorkerIDTask).filter(NonWorkerIDTask.referral_id == referral_id).first()

    @staticmethod
    def get_by_status(db: Session, status: str) -> List[NonWorkerIDTask]:
        """Get all tasks with a specific status."""
        return db.query(NonWorkerIDTask).filter(NonWorkerIDTask.status == status).all()

    @staticmethod
    def get_by_assignee(db: Session, assigned_to: UUID) -> List[NonWorkerIDTask]:
        """Get all tasks assigned to a specific user."""
        return db.query(NonWorkerIDTask).filter(NonWorkerIDTask.assigned_to == assigned_to).all()

    @staticmethod
    def get_overdue(db: Session) -> List[NonWorkerIDTask]:
        """Get all overdue tasks (past SLA deadline)."""
        return db.query(NonWorkerIDTask).filter(
            NonWorkerIDTask.sla_deadline < datetime.utcnow(),
            NonWorkerIDTask.status.in_(["PENDING", "IN_PROGRESS"])
        ).all()

    @staticmethod
    def update(db: Session, task_id: UUID, **updates) -> Optional[NonWorkerIDTask]:
        """Update a task."""
        task = NonWorkerIDTaskRepository.get_by_id(db, task_id)
        if not task:
            return None
        
        for key, value in updates.items():
            if hasattr(task, key):
                setattr(task, key, value)
        
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def mark_in_progress(db: Session, task_id: UUID) -> Optional[NonWorkerIDTask]:
        """Mark task as in progress."""
        return NonWorkerIDTaskRepository.update(
            db,
            task_id,
            status="IN_PROGRESS"
        )

    @staticmethod
    def mark_completed(
        db: Session,
        task_id: UUID,
        generated_non_worker_id: str,
        credentials_token: str,
        credentials_token_expiry: datetime
    ) -> Optional[NonWorkerIDTask]:
        """Mark task as completed with generated ID."""
        return NonWorkerIDTaskRepository.update(
            db,
            task_id,
            status="COMPLETED",
            generated_non_worker_id=generated_non_worker_id,
            credentials_token=credentials_token,
            credentials_token_expiry=credentials_token_expiry,
            completed_at=datetime.utcnow()
        )

    @staticmethod
    def mark_failed(db: Session, task_id: UUID) -> Optional[NonWorkerIDTask]:
        """Mark task as failed."""
        return NonWorkerIDTaskRepository.update(
            db,
            task_id,
            status="FAILED"
        )

    @staticmethod
    def delete(db: Session, task_id: UUID) -> bool:
        """Delete a task."""
        task = NonWorkerIDTaskRepository.get_by_id(db, task_id)
        if not task:
            return False
        
        db.delete(task)
        db.commit()
        return True
