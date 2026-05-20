from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.certificate_repository import CertificateRepository
from app.repositories.referral_repository import ReferralRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository


class CertificateService:
    REVIEWER_ROLES = {"mentor", "hr", "admin", "program_owner", "compliance"}

    @staticmethod
    def _ensure_referral(db: Session, referral_id: UUID):
        referral = ReferralRepository.get_by_id(db, referral_id)
        if not referral:
            raise LookupError("Referral not found")
        return referral

    @staticmethod
    def get_certificate(db: Session, referral_id: UUID):
        return CertificateRepository.get_by_referral_id(db, referral_id)

    @staticmethod
    def request_certificate(db: Session, referral_id: UUID, current_user_id: UUID, current_user_role: str, request_form_url: str):
        referral = CertificateService._ensure_referral(db, referral_id)
        if current_user_role not in {"hr", "admin", "program_owner", "compliance"}:
            raise PermissionError("Only HR/Admin/Program Owner/Compliance can request certificate")

        cert = CertificateRepository.request_certificate(db, referral_id, request_form_url)
        ReferralRepository.update_state(db, referral_id, "IN_CLOSURE")
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="CERTIFICATE_REQUESTED",
            triggered_by=current_user_id,
            description="Certificate request form sent to mentor",
            data={"certificate_id": str(cert.id), "request_form_url": request_form_url, "mentor_id": str(referral.mentor_id)},
        )
        return cert

    @staticmethod
    def submit_mentor_details(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        internship_summary: str,
        skills_acquired: list[str],
        mentor_notes: str | None,
    ):
        referral = CertificateService._ensure_referral(db, referral_id)
        if current_user_role != "mentor" and current_user_role not in {"admin", "program_owner"}:
            raise PermissionError("Only mentor/admin/program owner can submit mentor details")
        if current_user_role == "mentor" and cast(UUID, referral.mentor_id) != current_user_id:
            raise PermissionError("Only assigned mentor can submit details")

        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        if not cert:
            raise LookupError("Certificate request not found")

        cert = CertificateRepository.mark_requested(
            db,
            cast(UUID, cert.id),
            internship_summary=internship_summary,
            skills_acquired=skills_acquired,
            mentor_notes=mentor_notes,
        )
        return cert

    @staticmethod
    def generate_certificate(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        template_used: str,
        archived_url: str,
    ):
        if current_user_role not in {"hr", "admin", "program_owner", "compliance"}:
            raise PermissionError("Only HR/Admin/Program Owner/Compliance can generate certificates")

        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        if not cert:
            raise LookupError("Certificate request not found")

        cert = CertificateRepository.mark_generated(
            db,
            cast(UUID, cert.id),
            template_used=template_used,
            archived_url=archived_url,
        )
        return cert

    @staticmethod
    def issue_certificate(db: Session, referral_id: UUID, current_user_id: UUID, current_user_role: str):
        if current_user_role not in {"hr", "admin", "program_owner", "compliance"}:
            raise PermissionError("Only HR/Admin/Program Owner/Compliance can issue certificates")

        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        if not cert:
            raise LookupError("Certificate request not found")

        cert = CertificateRepository.mark_issued(db, cast(UUID, cert.id))
        ReferralRepository.update_state(db, referral_id, "CLOSED")
        ReferralRepository.update(db, referral_id, status="CLOSED")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="CERTIFICATE_ISSUED",
            triggered_by=current_user_id,
            description="Certificate generated and issued to candidate",
            data={"certificate_id": str(cert.id), "archived_url": cert.archived_url},
        )
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="REFERRAL_CLOSED",
            triggered_by=current_user_id,
            description="Internship workflow closed",
            data={"certificate_id": str(cert.id)},
        )
        return cert
