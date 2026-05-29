from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.certificate_repository import CertificateRepository
from app.repositories.referral_repository import ReferralRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository
from app.services.notification_service import NotificationService


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
    def request_certificate_as_candidate(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        notes: str | None = None,
    ):
        referral = CertificateService._ensure_referral(db, referral_id)
        if current_user_role != "candidate" or cast(UUID, referral.candidate_id) != current_user_id:
            raise PermissionError("Only the mapped candidate can request certificate")

        if cast(str, referral.status) not in {"COMPLETED", "CLOSURE_APPROVED", "CLOSED"}:
            raise ValueError("Certificate can only be requested after internship completion")

        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        if cert and cast(str, cert.status) in {"REQUEST_FORM_SENT", "REQUESTED", "GENERATED", "ISSUED", "ARCHIVED"}:
            raise ValueError("Certificate request has already been initiated")

        request_form_url = f"https://forms.example.com/certificate-request/{referral_id}"
        cert = CertificateRepository.request_certificate(db, referral_id, request_form_url)

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="CERTIFICATE_REQUESTED",
            triggered_by=current_user_id,
            description="Candidate requested internship certificate",
            data={
                "certificate_id": str(cert.id),
                "request_form_url": request_form_url,
                "notes": notes,
            },
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
        certificate_pdf_url: str,
        letterhead_pdf_url: str,
        archive_copy_url: str,
    ):
        referral = CertificateService._ensure_referral(db, referral_id)
        if current_user_role not in {"hr", "admin", "program_owner", "compliance"}:
            raise PermissionError("Only HR/Admin/Program Owner/Compliance can generate certificates")

        if cast(str, referral.status) not in {"CLOSURE_APPROVED", "COMPLETED"}:
            raise ValueError("Certificate generation is allowed only after closure readiness")

        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        if not cert:
            raise LookupError("Certificate request not found")

        cert = CertificateRepository.mark_generated(
            db,
            cast(UUID, cert.id),
            template_used=template_used,
            certificate_pdf_url=certificate_pdf_url,
            letterhead_pdf_url=letterhead_pdf_url,
            archive_copy_url=archive_copy_url,
        )
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="CERTIFICATE_GENERATED",
            triggered_by=current_user_id,
            description="Certificate artifacts generated (standard PDF, letterhead version, archive copy)",
            data={
                "certificate_id": str(cert.id),
                "certificate_pdf_url": certificate_pdf_url,
                "letterhead_pdf_url": letterhead_pdf_url,
                "archive_copy_url": archive_copy_url,
                "template_used": template_used,
            },
        )
        return cert

    @staticmethod
    def issue_certificate(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        candidate_download_url: str,
        candidate_email_sent_to: str,
    ):
        referral = CertificateService._ensure_referral(db, referral_id)
        if current_user_role not in {"hr", "admin", "program_owner", "compliance"}:
            raise PermissionError("Only HR/Admin/Program Owner/Compliance can issue certificates")

        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        if not cert:
            raise LookupError("Certificate request not found")

        if cast(str, cert.status) != "GENERATED":
            raise ValueError("Certificate must be generated before issuing to candidate")

        cert = CertificateRepository.mark_issued(
            db,
            cast(UUID, cert.id),
            candidate_download_url=candidate_download_url,
            candidate_email_sent_to=candidate_email_sent_to,
        )
        ReferralRepository.update_state(db, referral_id, "CLOSED")
        ReferralRepository.update(db, referral_id, status="CERTIFICATE_ISSUED")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="CERTIFICATE_ISSUED",
            triggered_by=current_user_id,
            description="Certificate issued to candidate with download link and email copy",
            data={
                "certificate_id": str(cert.id),
                "candidate_download_url": candidate_download_url,
                "candidate_email_sent_to": candidate_email_sent_to,
                "archive_copy_url": cert.archive_copy_url,
            },
        )
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="REFERRAL_CLOSED",
            triggered_by=current_user_id,
            description="Internship workflow closed",
            data={"certificate_id": str(cert.id)},
        )

        NotificationService.notify_certificate_issued(
            db=db,
            referral=referral,
            candidate_email=candidate_email_sent_to,
            download_url=candidate_download_url,
            triggered_by=current_user_id,
        )
        return cert
