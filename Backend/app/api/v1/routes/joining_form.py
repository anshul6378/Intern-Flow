"""API routes for joining form workflow."""
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User
from app.schemas.joining_form import (
    JoiningFormDraftSave,
    JoiningFormSubmit,
    JoiningFormHRAction,
    JoiningFormResponse,
    JoiningFormListResponse,
)
from app.services.joining_form_service import JoiningFormService

router = APIRouter(prefix="/referrals", tags=["Joining Forms"])


def _serialize_form(form) -> JoiningFormResponse:
    return JoiningFormResponse.model_validate(form)


def _serialize_form_list(form) -> JoiningFormListResponse:
    return JoiningFormListResponse.model_validate(form)


@router.get(
    "/{referral_id}/joining-form",
    response_model=JoiningFormResponse,
)
def get_joining_form(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get joining form for a referral."""
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        service = JoiningFormService(db)
        if current_user_role in {"hr", "admin"}:
            form = service.form_repo.get_by_referral_id(db, referral_id)
            if not form:
                raise ValueError(f"Joining form not found for referral {referral_id}")
        else:
            form = service.get_form(referral_id, current_user_id)
        return _serialize_form(form)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/{referral_id}/joining-form/draft",
    response_model=JoiningFormResponse,
)
def save_joining_form_draft(
    referral_id: UUID,
    payload: JoiningFormDraftSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save joining form draft (partial data allowed)."""
    try:
        current_user_id = cast(UUID, current_user.id)
        service = JoiningFormService(db)
        form = service.save_draft(referral_id, payload.model_dump(exclude_none=True), current_user_id)
        return _serialize_form(form)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/{referral_id}/joining-form/submit",
    response_model=JoiningFormResponse,
)
def submit_joining_form(
    referral_id: UUID,
    payload: JoiningFormSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit completed joining form for HR review."""
    try:
        current_user_id = cast(UUID, current_user.id)
        service = JoiningFormService(db)
        form = service.submit_form(
            referral_id,
            payload.model_dump(exclude_none=False),
            current_user_id
        )
        return _serialize_form(form)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.put(
    "/{referral_id}/joining-form/approve",
    response_model=JoiningFormResponse,
)
def approve_joining_form(
    referral_id: UUID,
    payload: JoiningFormHRAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    """HR approves joining form."""
    if payload.action != "APPROVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /joining-form/reject for rejection"
        )
    
    try:
        current_user_id = cast(UUID, current_user.id)
        service = JoiningFormService(db)
        form = service.approve_form(referral_id, current_user_id, payload.notes)
        return _serialize_form(form)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.put(
    "/{referral_id}/joining-form/reject",
    response_model=JoiningFormResponse,
)
def reject_joining_form(
    referral_id: UUID,
    payload: JoiningFormHRAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    """HR rejects joining form (requires resubmission)."""
    if payload.action != "REJECT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /joining-form/approve for approval"
        )
    
    try:
        current_user_id = cast(UUID, current_user.id)
        service = JoiningFormService(db)
        form = service.reject_form(referral_id, current_user_id, payload.notes)
        return _serialize_form(form)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get(
    "/{referral_id}/joining-form/status",
    response_model=dict,
)
def get_joining_form_status(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get high-level joining form status."""
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        service = JoiningFormService(db)
        if current_user_role in {"hr", "admin"}:
            form = service.form_repo.get_by_referral_id(db, referral_id)
            if not form:
                raise ValueError(f"Joining form not found for referral {referral_id}")
            status_data = {
                "form_id": form.id,
                "referral_id": form.referral_id,
                "status": form.status,
                "declarations_signed": form.declarations_signed,
                "created_at": form.created_at,
                "submitted_at": form.submitted_at,
                "approved_at": form.approved_at,
                "submitted_by": form.submitted_by,
                "reviewed_by": form.reviewed_by,
                "has_personal_details": form.personal_details is not None,
                "has_address": form.address is not None,
                "has_emergency_contact": form.emergency_contact is not None,
                "has_education": form.education_history is not None and len(form.education_history) > 0,
                "has_government_ids": form.government_ids is not None and len(form.government_ids) > 0,
            }
        else:
            status_data = service.get_form_status(referral_id, current_user_id)
        return status_data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get(
    "/admin/joining-forms/pending",
    response_model=list[JoiningFormListResponse],
)
def list_pending_forms_for_review(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    """List all joining forms pending HR review."""
    service = JoiningFormService(db)
    forms = service.list_forms_for_review(status="SUBMITTED")
    return [_serialize_form_list(f) for f in forms]
