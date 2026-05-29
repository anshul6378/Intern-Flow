from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.certificate import (
    CandidateCertificateRequest,
    CertificateGenerateRequest,
    CertificateIssueRequest,
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


@router.post("/{referral_id}/certificate/request-candidate", response_model=CertificateResponse)
def request_certificate_as_candidate(
    referral_id: UUID,
    payload: CandidateCertificateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cert = CertificateService.request_certificate_as_candidate(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            notes=payload.notes,
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
            certificate_pdf_url=payload.certificate_pdf_url,
            letterhead_pdf_url=payload.letterhead_pdf_url,
            archive_copy_url=payload.archive_copy_url,
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/certificate/issue", response_model=CertificateResponse)
def issue_certificate(
    referral_id: UUID,
    payload: CertificateIssueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cert = CertificateService.issue_certificate(
            db=db,
            referral_id=referral_id,
            current_user_id=cast(UUID, current_user.id),
            current_user_role=cast(str, current_user.role),
            candidate_download_url=payload.candidate_download_url,
            candidate_email_sent_to=payload.candidate_email_sent_to,
        )
        return CertificateResponse.model_validate(cert)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
