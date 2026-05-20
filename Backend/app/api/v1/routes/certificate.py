from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.certificate import (
    CertificateGenerateRequest,
    CertificateMentorSubmit,
    CertificateRequestStart,
    CertificateResponse,
)
from app.services.certificate_service import CertificateService

router = APIRouter(prefix="/referrals", tags=["Certificate"])


@router.get("/{referral_id}/certificate", response_model=CertificateResponse)
def get_certificate(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cert = CertificateService.get_certificate(db, referral_id)
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    return CertificateResponse.model_validate(cert)


@router.post("/{referral_id}/certificate/request", response_model=CertificateResponse)
def request_certificate(
    referral_id: UUID,
    payload: CertificateRequestStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cert = CertificateService.request_certificate(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            request_form_url=payload.request_form_url,
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/certificate/mentor-submit", response_model=CertificateResponse)
def submit_mentor_certificate_details(
    referral_id: UUID,
    payload: CertificateMentorSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cert = CertificateService.submit_mentor_details(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            internship_summary=payload.internship_summary,
            skills_acquired=payload.skills_acquired,
            mentor_notes=payload.mentor_notes,
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/certificate/generate", response_model=CertificateResponse)
def generate_certificate(
    referral_id: UUID,
    payload: CertificateGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cert = CertificateService.generate_certificate(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            template_used=payload.template_used,
            archived_url=payload.archived_url,
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post("/{referral_id}/certificate/issue", response_model=CertificateResponse)
def issue_certificate(
    referral_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cert = CertificateService.issue_certificate(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
