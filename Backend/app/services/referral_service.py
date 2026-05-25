from __future__ import annotations

from datetime import date, datetime
from secrets import token_urlsafe
from typing import Any, cast
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import REFERRAL_STATES, WORKFLOW_EVENT_TYPES
from app.models.user import User
from app.core.security import hash_password
from app.repositories.referral_repository import ReferralRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository
from app.schemas.referral import EligibilityCheckRequest, ReferralCreate, ReferralStateTransitionRequest, ReferralUpdate
from app.services.workflow_service import WorkflowService


class ReferralService:
    VALID_REFERRER_ROLES = {"referrer", "admin", "program_owner"}
    VALID_CANDIDATE_ROLES = {"candidate"}
    VALID_MENTOR_ROLES = {"mentor"}

    @staticmethod
    def _json_safe(value: Any):
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, dict):
            return {key: ReferralService._json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [ReferralService._json_safe(item) for item in value]
        return value

    @staticmethod
    def _ensure_user(db: Session, user_id: UUID, allowed_roles: set[str], label: str):
        user = UserRepository.get_user_by_id(db, user_id)
        if not user:
            raise LookupError(f"{label} user not found")
        if user.role not in allowed_roles:
            raise ValueError(f"{label} user must have one of these roles: {sorted(allowed_roles)}")
        return user

    @staticmethod
    def _serialize_referral(referral) -> dict[str, Any]:
        return {
            "id": str(referral.id),
            "referrer_id": str(referral.referrer_id),
            "candidate_id": str(referral.candidate_id),
            "mentor_id": str(referral.mentor_id),
            "status": referral.status,
            "state": referral.state,
            "unpaid_consent_confirmed": referral.unpaid_consent_confirmed,
            "in_person_ready_confirmed": referral.in_person_ready_confirmed,
            "location_match_confirmed": referral.location_match_confirmed,
            "start_date": referral.start_date.isoformat() if referral.start_date else None,
            "end_date": referral.end_date.isoformat() if referral.end_date else None,
            "project_overview": referral.project_overview,
            "location": referral.location,
            "relationship_to_mentor": referral.relationship_to_mentor,
            "additional_data": ReferralService._json_safe(referral.additional_data),
            "created_at": referral.created_at.isoformat() if referral.created_at else None,
            "updated_at": referral.updated_at.isoformat() if referral.updated_at else None,
        }

    @staticmethod
    def _display_name_from_email(email: str) -> str:
        local_part = email.split("@", 1)[0]
        normalized = local_part.replace(".", " ").replace("_", " ").replace("-", " ").strip()
        return normalized.title() if normalized else "Candidate"

    @staticmethod
    def create_referral(
        db: Session,
        payload: ReferralCreate,
        referrer_id: UUID,
        triggered_by: UUID | None = None,
    ):
        ReferralService._ensure_user(db, referrer_id, ReferralService.VALID_REFERRER_ROLES, "Referrer")

        candidate_user = UserRepository.get_user_by_email(db, payload.candidate_email)
        candidate_created_implicitly = False
        if not candidate_user:
            # Referrer-first flow: create a placeholder candidate account from the provided email.
            candidate_user = User(
                email=payload.candidate_email,
                full_name=ReferralService._display_name_from_email(payload.candidate_email),
                hashed_password=hash_password(token_urlsafe(32)),
                role="candidate",
                is_active=True,
            )
            candidate_user = UserRepository.create_user(db, candidate_user)
            candidate_created_implicitly = True
        elif candidate_user.role not in ReferralService.VALID_CANDIDATE_ROLES:
            raise ValueError(f"Candidate user must have one of these roles: {sorted(ReferralService.VALID_CANDIDATE_ROLES)}")

        mentor_user = UserRepository.get_user_by_email(db, payload.mentor_email)
        mentor_created_implicitly = False
        if not mentor_user:
            # Referrer-first flow: create a placeholder mentor account from the provided email.
            mentor_user = User(
                email=payload.mentor_email,
                full_name=ReferralService._display_name_from_email(payload.mentor_email),
                hashed_password=hash_password(token_urlsafe(32)),
                role="mentor",
                is_active=True,
            )
            mentor_user = UserRepository.create_user(db, mentor_user)
            mentor_created_implicitly = True
        elif mentor_user.role not in ReferralService.VALID_MENTOR_ROLES:
            raise ValueError(f"Mentor user must have one of these roles: {sorted(ReferralService.VALID_MENTOR_ROLES)}")

        if payload.start_date and payload.end_date and payload.end_date <= payload.start_date:
            raise ValueError("end_date must be after start_date")

        referral = ReferralRepository.create(
            db=db,
            referrer_id=referrer_id,
            candidate_id=cast(UUID, candidate_user.id),
            mentor_id=cast(UUID, mentor_user.id),
            start_date=payload.start_date,
            end_date=payload.end_date,
            project_overview=payload.project_overview,
            location=payload.location,
            relationship_to_mentor=payload.relationship_to_mentor,
            status="ACTIVE",
            state="SUBMITTED",
            unpaid_consent_confirmed=payload.unpaid_consent_confirmed,
            in_person_ready_confirmed=payload.in_person_ready_confirmed,
            location_match_confirmed=payload.location_match_confirmed,
            additional_data=payload.additional_data,
        )

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, referral.id),
            event_type="REFERRAL_CREATED",
            triggered_by=triggered_by or referrer_id,
            description="Referral submitted through the portal",
            data={
                **ReferralService._serialize_referral(referral),
                "candidate_created_implicitly": candidate_created_implicitly,
                "mentor_created_implicitly": mentor_created_implicitly,
            },
        )

        return referral

    @staticmethod
    def get_referral(db: Session, referral_id: UUID):
        referral = ReferralRepository.get_by_id(db, referral_id)
        if not referral:
            raise LookupError("Referral not found")
        return referral

    @staticmethod
    def list_referrals(
        db: Session,
        filters: dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 50,
    ):
        items, total = ReferralRepository.list_all(db=db, filters=filters, skip=skip, limit=limit)
        return items, total

    @staticmethod
    def list_my_candidate_referrals(
        db: Session,
        candidate_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ):
        return ReferralRepository.list_for_candidate(db=db, candidate_id=candidate_id, skip=skip, limit=limit)

    @staticmethod
    def list_my_mentor_referrals(
        db: Session,
        mentor_id: UUID,
        skip: int = 0,
        limit: int = 50,
        state: str | None = None,
        status_filter: str | None = None,
    ):
        return ReferralRepository.list_for_mentor(
            db=db,
            mentor_id=mentor_id,
            skip=skip,
            limit=limit,
            state=state,
            status=status_filter,
        )

    @staticmethod
    def list_my_referrer_referrals(
        db: Session,
        referrer_id: UUID,
        skip: int = 0,
        limit: int = 50,
        state: str | None = None,
        status_filter: str | None = None,
    ):
        return ReferralRepository.list_for_referrer(
            db=db,
            referrer_id=referrer_id,
            skip=skip,
            limit=limit,
            state=state,
            status=status_filter,
        )

    @staticmethod
    def list_hr_queue(
        db: Session,
        skip: int = 0,
        limit: int = 50,
    ):
        return ReferralRepository.list_hr_queue(db=db, skip=skip, limit=limit)

    @staticmethod
    def update_referral(
        db: Session,
        referral_id: UUID,
        payload: ReferralUpdate,
        triggered_by: UUID | None = None,
    ):
        referral = ReferralService.get_referral(db, referral_id)
        before = ReferralService._serialize_referral(referral)
        updates = payload.model_dump(exclude_unset=True)

        if "state" in updates and updates["state"] is not None:
            if updates["state"] not in REFERRAL_STATES:
                raise ValueError(f"Invalid state: {updates['state']}")
            referral = ReferralRepository.update_state(db, referral_id, updates.pop("state"))
            if not referral:
                raise LookupError("Referral not found")

        if updates:
            referral = ReferralRepository.update(db, referral_id, **updates)
            if not referral:
                raise LookupError("Referral not found")

        after = ReferralService._serialize_referral(referral)
        changed = {key: {"before": before.get(key), "after": after.get(key)} for key in after if before.get(key) != after.get(key)}

        if changed:
            WorkflowEventRepository.create(
                db=db,
                referral_id=cast(UUID, referral.id),
                event_type="REFERRAL_UPDATED",
                triggered_by=triggered_by,
                description="Referral updated",
                data=ReferralService._json_safe(changed),
            )

        return referral

    @staticmethod
    def submit_eligibility_check(
        db: Session,
        referral_id: UUID,
        payload: EligibilityCheckRequest,
        triggered_by: UUID | None = None,
    ):
        referral = ReferralService.get_referral(db, referral_id)
        before = ReferralService._serialize_referral(referral)

        if not (
            payload.unpaid_consent_confirmed
            and payload.in_person_ready_confirmed
            and payload.location_match_confirmed
        ):
            ReferralRepository.mark_eligibility_checked(
                db=db,
                referral_id=referral_id,
                unpaid=payload.unpaid_consent_confirmed,
                in_person=payload.in_person_ready_confirmed,
                location=payload.location_match_confirmed,
            )
            ReferralRepository.update_state(db, referral_id, "ELIGIBILITY_FAILED")
            WorkflowEventRepository.create(
                db=db,
                referral_id=cast(UUID, referral.id),
                event_type="ELIGIBILITY_FAILED",
                triggered_by=triggered_by,
                description="Eligibility failed because one or more confirmations were not completed",
                data={
                    "before": before,
                    "after": ReferralService._serialize_referral(ReferralService.get_referral(db, referral_id)),
                    "notes": payload.notes,
                },
            )
            raise ValueError("All eligibility confirmations must be true before the referral can proceed")

        referral = ReferralRepository.mark_eligibility_checked(
            db=db,
            referral_id=referral_id,
            unpaid=True,
            in_person=True,
            location=True,
        )
        if not referral:
            raise LookupError("Referral not found")

        referral = ReferralRepository.update_state(db, referral_id, "ELIGIBILITY_PASSED")
        if not referral:
            raise LookupError("Referral not found")

        after = ReferralService._serialize_referral(referral)
        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, referral.id),
            event_type="ELIGIBILITY_PASSED",
            triggered_by=triggered_by,
            description="Eligibility confirmed and referral allowed to proceed",
            data={
                "before": before,
                "after": after,
                "notes": payload.notes,
            },
        )

        return referral

    @staticmethod
    def transition_state(
        db: Session,
        referral_id: UUID,
        payload: ReferralStateTransitionRequest,
        triggered_by: UUID | None = None,
    ):
        return WorkflowService.transition_referral(
            db=db,
            referral_id=referral_id,
            next_state=payload.next_state,
            triggered_by=triggered_by,
            notes=payload.notes,
        )

    @staticmethod
    def reassign_mentor(
        db: Session,
        referral_id: UUID,
        mentor_email: str,
        triggered_by: UUID,
        triggered_by_role: str,
        notes: str | None = None,
    ):
        if triggered_by_role not in {"hr", "admin", "program_owner"}:
            raise PermissionError("Only hr, admin, or program_owner can reassign mentor")

        referral = ReferralService.get_referral(db, referral_id)
        mentor_user = UserRepository.get_user_by_email(db, mentor_email)
        if not mentor_user:
            raise LookupError("Mentor user not found")
        if mentor_user.role not in ReferralService.VALID_MENTOR_ROLES:
            raise ValueError("Provided user is not a mentor")

        old_mentor_id = cast(UUID, referral.mentor_id)
        new_mentor_id = cast(UUID, mentor_user.id)
        if old_mentor_id == new_mentor_id:
            return referral

        updated = ReferralRepository.update(db, referral_id, mentor_id=new_mentor_id)
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description="Mentor reassigned",
            data={
                "old_mentor_id": str(old_mentor_id),
                "new_mentor_id": str(new_mentor_id),
                "notes": notes,
            },
        )
        return updated

    @staticmethod
    def hold_referral(
        db: Session,
        referral_id: UUID,
        triggered_by: UUID,
        triggered_by_role: str,
        reason: str,
    ):
        if triggered_by_role not in {"hr", "admin", "program_owner"}:
            raise PermissionError("Only hr, admin, or program_owner can put a referral on hold")

        referral = ReferralService.get_referral(db, referral_id)
        if referral.status == "CLOSED":
            raise ValueError("Cannot put a closed referral on hold")
        if referral.status == "ON_HOLD":
            return referral

        updated = ReferralRepository.update(db, referral_id, status="ON_HOLD")
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description="Referral put on hold",
            data={"reason": reason},
        )
        return updated

    @staticmethod
    def unhold_referral(
        db: Session,
        referral_id: UUID,
        triggered_by: UUID,
        triggered_by_role: str,
        reason: str | None = None,
    ):
        if triggered_by_role not in {"hr", "admin", "program_owner"}:
            raise PermissionError("Only hr, admin, or program_owner can remove hold")

        referral = ReferralService.get_referral(db, referral_id)
        if referral.status != "ON_HOLD":
            raise ValueError("Referral is not currently on hold")

        updated = ReferralRepository.update(db, referral_id, status="ACTIVE")
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description="Referral hold removed",
            data={"reason": reason},
        )
        return updated

    @staticmethod
    def get_timeline(db: Session, referral_id: UUID):
        ReferralService.get_referral(db, referral_id)
        events, total = WorkflowEventRepository.get_by_referral_id(db, referral_id, limit=1000)
        return events, total
