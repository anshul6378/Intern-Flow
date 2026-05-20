from __future__ import annotations

from datetime import datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.repositories.nda_repository import NDADocumentRepository
from app.repositories.referral_repository import ReferralRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository


class NDAService:
    REVIEWER_ROLES = {"hr", "admin"}

    @staticmethod
    def _ensure_referral(db: Session, referral_id: UUID):
        referral = ReferralRepository.get_by_id(db, referral_id)
        if not referral:
            raise LookupError("Referral not found")
        return referral

    @staticmethod
    def _ensure_access(referral, current_user_id: UUID, current_user_role: str):
        if current_user_role in NDAService.REVIEWER_ROLES:
            return
        allowed_ids = {referral.referrer_id, referral.candidate_id, referral.mentor_id}
        if current_user_id not in allowed_ids:
            raise PermissionError("User does not have access to this NDA")

    @staticmethod
    def get_or_create_nda(db: Session, referral_id: UUID):
        nda = NDADocumentRepository.get_by_referral_id(db, referral_id)
        if nda:
            return nda
        return NDADocumentRepository.create(db, referral_id=referral_id, status="PENDING")

    @staticmethod
    def get_nda(db: Session, referral_id: UUID, current_user_id: UUID, current_user_role: str):
        referral = NDAService._ensure_referral(db, referral_id)
        NDAService._ensure_access(referral, current_user_id, current_user_role)
        return NDAService.get_or_create_nda(db, referral_id)

    @staticmethod
    def send_for_signature(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        esign_provider: str,
        template_version: str | None,
        expires_in_hours: int,
    ):
        referral = NDAService._ensure_referral(db, referral_id)
        if current_user_role not in NDAService.REVIEWER_ROLES and current_user_id != referral.referrer_id:
            raise PermissionError("Only HR/Admin or referral owner can issue NDA")

        esign_token = uuid4().hex
        esign_url = f"https://esign.example.com/sign/{esign_token}"
        expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

        nda = NDADocumentRepository.mark_sent(
            db=db,
            referral_id=referral_id,
            esign_token=esign_token,
            esign_url=esign_url,
            esign_provider=esign_provider,
            expires_at=expires_at,
        )
        if not nda:
            raise LookupError("Failed to create or update NDA")

        if template_version:
            nda = NDADocumentRepository.update(db, cast(UUID, nda.id), template_version=template_version)
            if not nda:
                raise LookupError("Failed to update NDA template metadata")

        ReferralRepository.update_state(db, referral_id, "NDA_PENDING")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NDA_ISSUED",
            triggered_by=current_user_id,
            description=f"NDA issued via {esign_provider}",
            data={
                "nda_id": str(nda.id),
                "esign_provider": esign_provider,
                "expires_at": expires_at.isoformat(),
            },
        )
        return nda

    @staticmethod
    def sign_nda(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        archived_url: str | None,
    ):
        referral = NDAService._ensure_referral(db, referral_id)
        if current_user_id != referral.candidate_id and current_user_role not in NDAService.REVIEWER_ROLES:
            raise PermissionError("Only the candidate (or reviewer role) can sign this NDA")

        nda = NDAService.get_or_create_nda(db, referral_id)
        archived_value = archived_url or f"https://storage.example.com/nda/{nda.id}.pdf"

        nda = NDADocumentRepository.mark_signed(
            db=db,
            nda_id=cast(UUID, nda.id),
            signed_by=current_user_id,
            archived_url=archived_value,
        )
        if not nda:
            raise LookupError("Failed to mark NDA as signed")

        ReferralRepository.update_state(db, referral_id, "NDA_SIGNED")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NDA_SIGNED",
            triggered_by=current_user_id,
            description="NDA signed successfully",
            data={"nda_id": str(nda.id), "archived_url": archived_value},
        )
        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NDA_ARCHIVED",
            triggered_by=current_user_id,
            description="Signed NDA archived",
            data={"nda_id": str(nda.id), "archived_url": archived_value},
        )

        return nda

    @staticmethod
    def reject_nda(
        db: Session,
        referral_id: UUID,
        current_user_id: UUID,
        current_user_role: str,
        reason: str | None,
    ):
        referral = NDAService._ensure_referral(db, referral_id)
        if current_user_id != referral.candidate_id and current_user_role not in NDAService.REVIEWER_ROLES:
            raise PermissionError("Only the candidate (or reviewer role) can reject this NDA")

        nda = NDAService.get_or_create_nda(db, referral_id)
        nda = NDADocumentRepository.update(db, cast(UUID, nda.id), status="REJECTED")
        if not nda:
            raise LookupError("Failed to mark NDA as rejected")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NDA_SIGNATURE_FAILED",
            triggered_by=current_user_id,
            description="NDA signature rejected",
            data={"nda_id": str(nda.id), "reason": reason},
        )
        return nda

    @staticmethod
    def expire_nda(db: Session, referral_id: UUID, current_user_id: UUID, current_user_role: str):
        referral = NDAService._ensure_referral(db, referral_id)
        if current_user_role not in NDAService.REVIEWER_ROLES and current_user_id != referral.referrer_id:
            raise PermissionError("Only reviewer roles or referral owner can expire this NDA")

        nda = NDAService.get_or_create_nda(db, referral_id)
        nda = NDADocumentRepository.update(db, cast(UUID, nda.id), status="EXPIRED")
        if not nda:
            raise LookupError("Failed to mark NDA as expired")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="NDA_SIGNATURE_FAILED",
            triggered_by=current_user_id,
            description="NDA expired before signature",
            data={"nda_id": str(nda.id)},
        )
        return nda

    @staticmethod
    def list_pending_ndas(db: Session):
        items = NDADocumentRepository.get_by_status(db, "SENT")
        return items, len(items)
