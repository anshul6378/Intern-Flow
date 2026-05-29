from __future__ import annotations

from datetime import date, datetime
from secrets import token_urlsafe
from typing import Any, cast
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import REFERRAL_STATES, WORKFLOW_EVENT_TYPES
from app.models.user import User
from app.core.security import hash_password
from app.repositories.referral_repository import ReferralRepository
from app.repositories.candidate_repository import CandidateProfileRepository
from app.repositories.joining_form_repository import JoiningFormRepository
from app.repositories.nda_repository import NDADocumentRepository
from app.repositories.non_worker_id_repository import NonWorkerIDTaskRepository
from app.repositories.certificate_repository import CertificateRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository
from app.schemas.referral import EligibilityCheckRequest, ReferralCreate, ReferralStateTransitionRequest, ReferralUpdate
from app.services.notification_service import NotificationService
from app.services.resume_parser_service import ResumeParserService
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
    def _upsert_candidate_profile_from_referral(db: Session, candidate_id: UUID, payload: ReferralCreate) -> None:
        additional_data = payload.additional_data or {}
        candidate_details = additional_data.get("candidate_details") or {}
        parsed_resume = additional_data.get("parsed_resume_data")
        resume_url = additional_data.get("uploaded_resume_url") or additional_data.get("resume_url")
        confidence_score = additional_data.get("resume_parse_confidence")

        profile = CandidateProfileRepository.get_by_user_id(db, candidate_id)

        education = None
        if candidate_details.get("education"):
            education = [candidate_details.get("education")]

        if not profile:
            CandidateProfileRepository.create(
                db=db,
                user_id=candidate_id,
                phone=candidate_details.get("phone"),
                education=education,
                resume_url=resume_url,
                parsed_resume_data=parsed_resume,
                confidence_score=confidence_score,
            )
            return

        updates = {}
        if candidate_details.get("phone"):
            updates["phone"] = candidate_details.get("phone")
        if education:
            updates["education"] = education
        if resume_url:
            updates["resume_url"] = resume_url
        if parsed_resume:
            updates["parsed_resume_data"] = parsed_resume
        if confidence_score is not None:
            updates["confidence_score"] = confidence_score

        if updates:
            CandidateProfileRepository.update(db=db, profile_id=profile.id, **updates)

    @staticmethod
    async def parse_resume_upload(upload_file: UploadFile):
        return await ResumeParserService.parse_resume_upload(upload_file)

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

        duplicate_referral = ReferralRepository.find_active_duplicate(
            db=db,
            candidate_id=cast(UUID, candidate_user.id),
            mentor_id=cast(UUID, mentor_user.id),
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
        if duplicate_referral:
            raise ValueError(
                f"Duplicate active referral exists for candidate and mentor pair (Referral ID: {duplicate_referral.id})"
            )

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

        ReferralService._upsert_candidate_profile_from_referral(
            db=db,
            candidate_id=cast(UUID, candidate_user.id),
            payload=payload,
        )
        NotificationService.notify_referral_submitted(
            db=db,
            referral=referral,
            triggered_by=triggered_by or referrer_id,
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
    def list_pending_extension_requests(
        db: Session,
        skip: int = 0,
        limit: int = 50,
    ):
        referrals, _ = ReferralRepository.list_all(db=db, filters={"status": "ACTIVE"}, skip=0, limit=500)
        pending_items = []
        for referral in referrals:
            additional_data = cast(dict[str, Any], referral.additional_data or {})
            extension_request = additional_data.get("extension_request")
            if not isinstance(extension_request, dict):
                continue
            if extension_request.get("status") == "PENDING":
                pending_items.append(referral)

        total = len(pending_items)
        items = pending_items[skip:skip + limit]
        return items, total

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
    def admin_review_referral(
        db: Session,
        referral_id: UUID,
        decision: str,
        notes: str | None,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        if triggered_by_role != "admin":
            raise PermissionError("Only admin can perform referral review")

        referral = ReferralService.get_referral(db, referral_id)
        referral_state = cast(str, referral.state)
        if referral_state not in {"SUBMITTED", "ELIGIBILITY_REVIEW", "ELIGIBILITY_PASSED"}:
            raise ValueError(f"Referral in state {referral_state} cannot be reviewed by admin")

        decision_value = decision.upper()
        if decision_value not in {"APPROVE", "REJECT", "REQUEST_CHANGES"}:
            raise ValueError("Decision must be APPROVE, REJECT, or REQUEST_CHANGES")

        additional_data = dict(referral.additional_data or {})
        additional_data["admin_review"] = {
            "decision": decision_value,
            "notes": notes,
            "reviewed_by": str(triggered_by),
            "reviewed_at": datetime.utcnow().isoformat(),
        }

        update_payload: dict[str, Any] = {"additional_data": additional_data}
        event_type = "MANUAL_OVERRIDE"
        event_description = "Admin review update"
        event_data: dict[str, Any] = {
            "decision": decision_value,
            "notes": notes,
        }

        if decision_value == "APPROVE":
            update_payload["status"] = "ADMIN_APPROVED"
            update_payload["state"] = "ELIGIBILITY_REVIEW"
            event_type = "ADMIN_REVIEW_APPROVED"
            event_description = "Referral approved by admin"
        elif decision_value == "REJECT":
            if not (notes and notes.strip()):
                raise ValueError("Rejection notes are required")
            update_payload["status"] = "REJECTED"
            update_payload["state"] = "ELIGIBILITY_FAILED"
            event_type = "ADMIN_REVIEW_REJECTED"
            event_description = "Referral rejected by admin"
        else:
            if not (notes and notes.strip()):
                raise ValueError("Notes are required when requesting changes")
            update_payload["status"] = "CHANGES_REQUESTED"
            update_payload["state"] = "SUBMITTED"
            event_type = "ADMIN_REVIEW_CHANGES_REQUESTED"
            event_description = "Admin requested changes from referrer"

        updated = ReferralRepository.update(db, referral_id, **update_payload)
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type=event_type,
            triggered_by=triggered_by,
            description=event_description,
            data=event_data,
        )

        NotificationService.notify_admin_review_result(
            db=db,
            referral=updated,
            decision=decision_value,
            triggered_by=triggered_by,
        )

        return updated

    @staticmethod
    def mentor_review_referral(
        db: Session,
        referral_id: UUID,
        decision: str,
        notes: str | None,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        referral = ReferralService.get_referral(db, referral_id)

        if triggered_by_role not in {"mentor", "admin"}:
            raise PermissionError("Only mentor can perform mentor review")

        if triggered_by_role == "mentor" and cast(UUID, referral.mentor_id) != triggered_by:
            raise PermissionError("You can only review referrals assigned to you")

        referral_status = cast(str, referral.status)
        if referral_status not in {"ADMIN_APPROVED", "ACTIVE"}:
            raise ValueError(f"Referral with status {referral_status} is not ready for mentor review")

        decision_value = decision.upper()
        if decision_value not in {"APPROVE", "REJECT"}:
            raise ValueError("Decision must be APPROVE or REJECT")

        additional_data = dict(referral.additional_data or {})
        additional_data["mentor_review"] = {
            "decision": decision_value,
            "notes": notes,
            "reviewed_by": str(triggered_by),
            "reviewed_at": datetime.utcnow().isoformat(),
        }

        update_payload: dict[str, Any] = {
            "additional_data": additional_data,
        }
        if decision_value == "APPROVE":
            update_payload["status"] = "MENTOR_APPROVED"
            update_payload["state"] = "JOINING_FORM_PENDING"
        else:
            update_payload["status"] = "MENTOR_REJECTED"
            update_payload["state"] = "ELIGIBILITY_FAILED"

        updated = ReferralRepository.update(db, referral_id, **update_payload)
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MENTOR_REVIEW_APPROVED" if decision_value == "APPROVE" else "MENTOR_REVIEW_REJECTED",
            triggered_by=triggered_by,
            description="Mentor approved candidate for onboarding" if decision_value == "APPROVE" else "Mentor rejected candidate",
            data={"decision": decision_value, "notes": notes},
        )

        NotificationService.notify_mentor_review_result(
            db=db,
            referral=updated,
            decision=decision_value,
            triggered_by=triggered_by,
        )

        return updated

    @staticmethod
    def add_mentor_remark(
        db: Session,
        referral_id: UUID,
        remarks: str,
        progress_status: str | None,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        referral = ReferralService.get_referral(db, referral_id)

        if triggered_by_role not in {"mentor", "admin"}:
            raise PermissionError("Only mentor/admin can add internship remarks")

        if triggered_by_role == "mentor" and cast(UUID, referral.mentor_id) != triggered_by:
            raise PermissionError("You can only add remarks for your assigned interns")

        referral_state = cast(str, referral.state)
        if referral_state not in {"READY_TO_START", "IN_PROGRESS", "EXTENDED"}:
            raise ValueError("Mentor remarks are available only during active internship stages")

        additional_data = dict(referral.additional_data or {})
        remarks_history = additional_data.get("mentor_remarks")
        if not isinstance(remarks_history, list):
            remarks_history = []

        remark_item = {
            "remarks": remarks.strip(),
            "progress_status": progress_status,
            "recorded_by": str(triggered_by),
            "recorded_at": datetime.utcnow().isoformat(),
        }
        remarks_history.append(remark_item)
        additional_data["mentor_remarks"] = remarks_history

        updated = ReferralRepository.update(db, referral_id, additional_data=additional_data)
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description="Mentor added internship progress remark",
            data=remark_item,
        )

        return updated

    @staticmethod
    def request_extension(
        db: Session,
        referral_id: UUID,
        new_end_date: date,
        reason: str,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        referral = ReferralService.get_referral(db, referral_id)

        if triggered_by_role not in {"mentor", "admin"}:
            raise PermissionError("Only mentor/admin can request internship extension")

        if triggered_by_role == "mentor" and cast(UUID, referral.mentor_id) != triggered_by:
            raise PermissionError("You can only request extension for your assigned interns")

        referral_state = cast(str, referral.state)
        if referral_state not in {"IN_PROGRESS", "EXTENDED"}:
            raise ValueError("Extension can be requested only for active internships")

        current_end_date = cast(date | None, referral.end_date)
        if current_end_date and new_end_date <= current_end_date:
            raise ValueError("New end date must be later than current end date")

        if new_end_date <= datetime.utcnow().date():
            raise ValueError("New end date must be a future date")

        additional_data = dict(referral.additional_data or {})
        additional_data["extension_request"] = {
            "new_end_date": new_end_date.isoformat(),
            "reason": reason.strip(),
            "requested_by": str(triggered_by),
            "requested_at": datetime.utcnow().isoformat(),
            "current_end_date": current_end_date.isoformat() if current_end_date else None,
            "status": "PENDING",
        }

        updated = ReferralRepository.update(db, referral_id, additional_data=additional_data)
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description="Mentor requested internship extension",
            data={
                "new_end_date": new_end_date.isoformat(),
                "reason": reason,
            },
        )

        return updated

    @staticmethod
    def review_extension_request(
        db: Session,
        referral_id: UUID,
        decision: str,
        notes: str | None,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        if triggered_by_role not in {"hr", "admin"}:
            raise PermissionError("Only HR/Admin can review extension requests")

        referral = ReferralService.get_referral(db, referral_id)
        additional_data = dict(referral.additional_data or {})
        extension_request = additional_data.get("extension_request")
        if not isinstance(extension_request, dict) or extension_request.get("status") != "PENDING":
            raise ValueError("No pending extension request found for this referral")

        decision_value = decision.upper()
        if decision_value not in {"APPROVE", "REJECT"}:
            raise ValueError("Decision must be APPROVE or REJECT")

        extension_request["reviewed_by"] = str(triggered_by)
        extension_request["reviewed_at"] = datetime.utcnow().isoformat()
        extension_request["review_notes"] = notes

        if decision_value == "APPROVE":
            requested_end_date = extension_request.get("new_end_date")
            if not requested_end_date:
                raise ValueError("Extension request is missing requested end date")

            extension_request["status"] = "APPROVED"
            additional_data["extension_request"] = extension_request

            updated = ReferralRepository.update(
                db,
                referral_id,
                end_date=date.fromisoformat(requested_end_date),
                status="ACTIVE",
                state="EXTENDED",
                additional_data=additional_data,
            )
            description = "HR approved internship extension request"
        else:
            extension_request["status"] = "REJECTED"
            additional_data["extension_request"] = extension_request
            updated = ReferralRepository.update(db, referral_id, additional_data=additional_data)
            description = "HR rejected internship extension request"

        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description=description,
            data={
                "decision": decision_value,
                "notes": notes,
                "requested_end_date": extension_request.get("new_end_date"),
            },
        )

        return updated

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

    @staticmethod
    def activate_internship(
        db: Session,
        referral_id: UUID,
        triggered_by: UUID,
        triggered_by_role: str,
        notes: str | None = None,
    ):
        if triggered_by_role not in {"hr", "admin"}:
            raise PermissionError("Only HR/Admin can activate internship")

        referral = ReferralService.get_referral(db, referral_id)
        if cast(str, referral.state) == "CLOSED":
            raise ValueError("Cannot activate a closed referral")

        joining_form = JoiningFormRepository.get_by_referral_id(db, referral_id)
        if not joining_form:
            raise ValueError("Joining form not found")
        if cast(str, joining_form.status) != "APPROVED":
            raise ValueError("Joining form must be completed and HR approved before activation")

        nda = NDADocumentRepository.get_by_referral_id(db, referral_id)
        if not nda or cast(str, nda.status) != "COMPLETED":
            raise ValueError("NDA must be completed before activation")

        government_ids = cast(list[dict[str, Any]], joining_form.government_ids or [])
        if not government_ids:
            raise ValueError("Required documents are missing: government IDs were not submitted")

        has_required_document = any(
            item.get("id_type") and item.get("id_number")
            for item in government_ids
            if isinstance(item, dict)
        )
        if not has_required_document:
            raise ValueError("Required documents are incomplete: valid government ID details are required")

        current_state = cast(str, referral.state)
        if current_state not in {"READY_TO_START", "IN_PROGRESS"}:
            WorkflowService.transition_referral(
                db=db,
                referral_id=referral_id,
                next_state="READY_TO_START",
                triggered_by=triggered_by,
                notes="Internship activation pre-check completed",
            )

        referral = WorkflowService.transition_referral(
            db=db,
            referral_id=referral_id,
            next_state="IN_PROGRESS",
            triggered_by=triggered_by,
            notes=notes or "Internship activated by HR",
        )

        referral = ReferralRepository.update(db, referral_id, status="ACTIVE")
        if not referral:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=referral_id,
            event_type="INTERNSHIP_STARTED",
            triggered_by=triggered_by,
            description="Internship activated by HR",
            data={
                "joining_form_completed": True,
                "nda_completed": True,
                "required_documents_submitted": True,
                "notes": notes,
            },
        )

        NotificationService.notify_internship_activated(
            db=db,
            referral=referral,
            triggered_by=triggered_by,
        )

        return referral

    @staticmethod
    def mark_internship_complete(
        db: Session,
        referral_id: UUID,
        internship_participation: str,
        project_completion: str,
        notes: str | None,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        referral = ReferralService.get_referral(db, referral_id)

        if triggered_by_role not in {"mentor", "admin"}:
            raise PermissionError("Only mentor/admin can mark internship complete")

        if triggered_by_role == "mentor" and cast(UUID, referral.mentor_id) != triggered_by:
            raise PermissionError("You can only complete internships assigned to you")

        current_state = cast(str, referral.state)
        if current_state not in {"IN_PROGRESS", "EXTENDED"}:
            raise ValueError("Internship can be marked complete only from IN_PROGRESS or EXTENDED state")

        completion_summary = {
            "internship_participation": internship_participation.strip(),
            "project_completion": project_completion.strip(),
            "notes": notes,
            "completed_by": str(triggered_by),
            "completed_at": datetime.utcnow().isoformat(),
        }

        additional_data = dict(referral.additional_data or {})
        additional_data["mentor_completion_review"] = completion_summary

        referral = WorkflowService.transition_referral(
            db=db,
            referral_id=referral_id,
            next_state="IN_CLOSURE",
            triggered_by=triggered_by,
            notes="Mentor marked internship complete",
        )

        updated = ReferralRepository.update(
            db,
            referral_id,
            status="COMPLETED",
            additional_data=additional_data,
        )
        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="CLOSURE_INITIATED",
            triggered_by=triggered_by,
            description="Mentor marked internship complete",
            data=completion_summary,
        )

        return updated

    @staticmethod
    def hr_closure_review(
        db: Session,
        referral_id: UUID,
        decision: str,
        notes: str | None,
        triggered_by: UUID,
        triggered_by_role: str,
    ):
        if triggered_by_role not in {"hr", "admin"}:
            raise PermissionError("Only HR/Admin can perform closure review")

        referral = ReferralService.get_referral(db, referral_id)
        referral_status = cast(str, referral.status)
        referral_state = cast(str, referral.state)

        if referral_status != "COMPLETED" or referral_state != "IN_CLOSURE":
            raise ValueError("Closure review is available only after mentor marks internship complete")

        decision_value = decision.upper()
        if decision_value not in {"APPROVE", "REJECT"}:
            raise ValueError("Decision must be APPROVE or REJECT")

        nda = NDADocumentRepository.get_by_referral_id(db, referral_id)
        if not nda or cast(str, nda.status) != "COMPLETED":
            raise ValueError("Closure review blocked: NDA is not completed")

        non_worker_task = NonWorkerIDTaskRepository.get_by_referral_id(db, referral_id)
        if non_worker_task and cast(str, non_worker_task.status) in {"PENDING", "IN_PROGRESS"}:
            raise ValueError("Closure review blocked: non-worker ID task is still pending")

        certificate = CertificateRepository.get_by_referral_id(db, referral_id)
        if certificate and cast(str, certificate.status) in {"REQUEST_FORM_SENT", "REQUESTED", "GENERATED"}:
            raise ValueError("Closure review blocked: certificate workflow has pending activities")

        additional_data = dict(referral.additional_data or {})
        additional_data["hr_closure_review"] = {
            "decision": decision_value,
            "notes": notes,
            "reviewed_by": str(triggered_by),
            "reviewed_at": datetime.utcnow().isoformat(),
        }

        if decision_value == "APPROVE":
            updated = ReferralRepository.update(
                db,
                referral_id,
                status="CLOSURE_APPROVED",
                additional_data=additional_data,
            )
            description = "HR approved internship closure"
        else:
            updated = ReferralRepository.update(
                db,
                referral_id,
                status="COMPLETED",
                additional_data=additional_data,
            )
            description = "HR rejected internship closure"

        if not updated:
            raise LookupError("Referral not found")

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, updated.id),
            event_type="MANUAL_OVERRIDE",
            triggered_by=triggered_by,
            description=description,
            data={
                "decision": decision_value,
                "notes": notes,
            },
        )

        return updated
