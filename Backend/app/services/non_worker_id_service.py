from __future__ import annotations

from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import cast
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.non_worker_id_repository import NonWorkerIDTaskRepository
from app.repositories.referral_repository import ReferralRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository


class NonWorkerIDService:
    REVIEWER_ROLES = {"hr", "admin", "program_owner", "it"}

    @staticmethod
    def _ensure_referral(db: Session, referral_id: UUID):
        referral = ReferralRepository.get_by_id(db, referral_id)
        if not referral:
            raise LookupError("Referral not found")
        return referral

    @staticmethod
    def get_task(db: Session, referral_id: UUID):
        return NonWorkerIDTaskRepository.get_by_referral_id(db, referral_id)

    @staticmethod
    def create_or_assign_task(
        db: Session,
        referral_id: UUID,
        created_by: UUID,
        current_user_role: str,
        assigned_to: UUID | None,
    ):
        if current_user_role not in NonWorkerIDService.REVIEWER_ROLES:
            raise PermissionError("Only HR/Admin/Program Owner/IT can create Non-Worker ID tasks")

        NonWorkerIDService._ensure_referral(db, referral_id)
        existing = NonWorkerIDTaskRepository.get_by_referral_id(db, referral_id)
        if existing:
            existing_status = cast(str, existing.status)
            existing_assigned_to = cast(UUID | None, existing.assigned_to)
            return NonWorkerIDTaskRepository.update(
                db,
                cast(UUID, existing.id),
                assigned_to=assigned_to if assigned_to is not None else existing_assigned_to,
                status="IN_PROGRESS" if existing_status == "PENDING" else existing_status,
            )

        task = NonWorkerIDTaskRepository.create(
            db=db,
            referral_id=referral_id,
            created_by=created_by,
            assigned_to=assigned_to,
            sla_deadline=datetime.utcnow() + timedelta(days=1),
            status="PENDING",
        )
        ReferralRepository.update_state(db, referral_id, "NON_WORKER_ID_PENDING")
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NON_WORKER_ID_TASK_CREATED",
            triggered_by=created_by,
            description="Non-Worker ID task created",
            data={"task_id": str(task.id), "assigned_to": str(cast(UUID, task.assigned_to)) if cast(UUID | None, task.assigned_to) is not None else None},
        )
        return task

    @staticmethod
    def mark_in_progress(db: Session, referral_id: UUID, current_user_id: UUID, current_user_role: str):
        if current_user_role not in NonWorkerIDService.REVIEWER_ROLES:
            raise PermissionError("Only HR/Admin/Program Owner/IT can update this task")
        task = NonWorkerIDTaskRepository.get_by_referral_id(db, referral_id)
        if not task:
            raise LookupError("Non-Worker ID task not found")
        task = NonWorkerIDTaskRepository.mark_in_progress(db, cast(UUID, task.id))
        if not task:
            raise LookupError("Failed to mark task in progress")
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NON_WORKER_ID_GENERATED",
            triggered_by=current_user_id,
            description="Non-Worker ID task moved to in-progress",
            data={"task_id": str(task.id)},
        )
        return task

    @staticmethod
    def mark_completed(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        generated_non_worker_id: str,
    ):
        if current_user_role not in NonWorkerIDService.REVIEWER_ROLES:
            raise PermissionError("Only HR/Admin/Program Owner/IT can complete this task")

        task = NonWorkerIDTaskRepository.get_by_referral_id(db, referral_id)
        if not task:
            raise LookupError("Non-Worker ID task not found")

        credentials_token = token_urlsafe(24)
        credentials_token_expiry = datetime.utcnow() + timedelta(hours=24)
        task = NonWorkerIDTaskRepository.mark_completed(
            db,
            cast(UUID, task.id),
            generated_non_worker_id=generated_non_worker_id,
            credentials_token=credentials_token,
            credentials_token_expiry=credentials_token_expiry,
        )
        if not task:
            raise LookupError("Failed to complete Non-Worker ID task")
        ReferralRepository.update_state(db, referral_id, "CREDENTIALS_GENERATED")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NON_WORKER_ID_GENERATED",
            triggered_by=current_user_id,
            description="Non-Worker ID generated",
            data={"task_id": str(task.id), "generated_non_worker_id": generated_non_worker_id},
        )
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="CREDENTIALS_SENT",
            triggered_by=current_user_id,
            description="Credentials token generated for candidate",
            data={"task_id": str(task.id), "credentials_token_expiry": credentials_token_expiry.isoformat()},
        )
        return task

    @staticmethod
    def mark_failed(db: Session, referral_id: UUID, current_user_id: UUID, current_user_role: str):
        if current_user_role not in NonWorkerIDService.REVIEWER_ROLES:
            raise PermissionError("Only HR/Admin/Program Owner/IT can fail this task")

        task = NonWorkerIDTaskRepository.get_by_referral_id(db, referral_id)
        if not task:
            raise LookupError("Non-Worker ID task not found")
        task = NonWorkerIDTaskRepository.mark_failed(db, cast(UUID, task.id))
        if not task:
            raise LookupError("Failed to mark task failed")
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="SYSTEM_ERROR",
            triggered_by=current_user_id,
            description="Non-Worker ID generation failed",
            data={"task_id": str(task.id)},
        )
        return task
