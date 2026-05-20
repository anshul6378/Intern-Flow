from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.schemas.nda import (
    NDAListItemResponse,
    NDAListResponse,
    NDARejectRequest,
    NDAResponse,
    NDASendRequest,
    NDASignRequest,
)
from app.services.nda_service import NDAService


router = APIRouter(prefix="/referrals", tags=["NDA"])


@router.get("/{referral_id}/nda", response_model=NDAResponse)
def get_nda(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nda = NDAService.get_nda(
            db,
            referral_id,
            cast(UUID, current_user.id),
            cast(str, current_user.role),
        )
        return NDAResponse.model_validate(nda)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/nda/send", response_model=NDAResponse)
def send_nda(
    referral_id: UUID,
    payload: NDASendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nda = NDAService.send_for_signature(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            esign_provider=payload.esign_provider,
            template_version=payload.template_version,
            expires_in_hours=payload.expires_in_hours,
        )
        return NDAResponse.model_validate(nda)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/nda/sign", response_model=NDAResponse)
def sign_nda(
    referral_id: UUID,
    payload: NDASignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nda = NDAService.sign_nda(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            archived_url=payload.archived_url,
        )
        return NDAResponse.model_validate(nda)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/nda/reject", response_model=NDAResponse)
def reject_nda(
    referral_id: UUID,
    payload: NDARejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nda = NDAService.reject_nda(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            reason=payload.reason,
        )
        return NDAResponse.model_validate(nda)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/nda/expire", response_model=NDAResponse)
def expire_nda(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nda = NDAService.expire_nda(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
        )
        return NDAResponse.model_validate(nda)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get("/admin/ndas/pending", response_model=NDAListResponse)
def list_pending_ndas(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    items, total = NDAService.list_pending_ndas(db)
    return NDAListResponse(items=[NDAListItemResponse.model_validate(item) for item in items], total=total)
