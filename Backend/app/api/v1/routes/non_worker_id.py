from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.non_worker_id import (
    NonWorkerTaskCompleteRequest,
    NonWorkerTaskCreateRequest,
    NonWorkerTaskResponse,
)
from app.services.non_worker_id_service import NonWorkerIDService

router = APIRouter(prefix="/referrals", tags=["Non-Worker ID"])


@router.get("/{referral_id}/non-worker", response_model=NonWorkerTaskResponse)
def get_non_worker_task(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = NonWorkerIDService.get_task(db, referral_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Non-Worker ID task not found")
    return NonWorkerTaskResponse.model_validate(task)


@router.post("/{referral_id}/non-worker", response_model=NonWorkerTaskResponse)
def create_or_assign_non_worker_task(
    referral_id: UUID,
    payload: NonWorkerTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = NonWorkerIDService.create_or_assign_task(
            db=db,
            referral_id=referral_id,
            created_by=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            assigned_to=payload.assigned_to,
        )
        return NonWorkerTaskResponse.model_validate(task)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/non-worker/in-progress", response_model=NonWorkerTaskResponse)
def non_worker_in_progress(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = NonWorkerIDService.mark_in_progress(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
        )
        return NonWorkerTaskResponse.model_validate(task)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/non-worker/complete", response_model=NonWorkerTaskResponse)
def non_worker_complete(
    referral_id: UUID,
    payload: NonWorkerTaskCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = NonWorkerIDService.mark_completed(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            generated_non_worker_id=payload.generated_non_worker_id,
        )
        return NonWorkerTaskResponse.model_validate(task)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/non-worker/fail", response_model=NonWorkerTaskResponse)
def non_worker_fail(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = NonWorkerIDService.mark_failed(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
        )
        return NonWorkerTaskResponse.model_validate(task)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
