from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import REFERRAL_STATES
from app.repositories.referral_repository import ReferralRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository


class WorkflowService:
	ALLOWED_STATE_TRANSITIONS = {
		"DRAFT": {"SUBMITTED"},
		"SUBMITTED": {"ELIGIBILITY_REVIEW", "ELIGIBILITY_PASSED", "ELIGIBILITY_FAILED"},
		"ELIGIBILITY_REVIEW": {"ELIGIBILITY_PASSED", "ELIGIBILITY_FAILED"},
		"ELIGIBILITY_PASSED": {"JOINING_FORM_PENDING", "NDA_PENDING"},
		"ELIGIBILITY_FAILED": set(),
		"JOINING_FORM_PENDING": {"JOINING_FORM_SUBMITTED"},
		"JOINING_FORM_SUBMITTED": {"NDA_PENDING"},
		"NDA_PENDING": {"NDA_SIGNED"},
		"NDA_SIGNED": {"NON_WORKER_ID_PENDING", "READY_TO_START"},
		"NON_WORKER_ID_PENDING": {"CREDENTIALS_GENERATED"},
		"CREDENTIALS_GENERATED": {"READY_TO_START"},
		"READY_TO_START": {"IN_PROGRESS"},
		"IN_PROGRESS": {"DELAYED", "EXTENDED", "IN_CLOSURE"},
		"DELAYED": {"IN_PROGRESS", "EXTENDED", "IN_CLOSURE"},
		"EXTENDED": {"IN_PROGRESS", "IN_CLOSURE"},
		"IN_CLOSURE": {"CLOSED"},
		"CLOSED": set(),
	}

	@staticmethod
	def validate_transition(current_state: str, next_state: str) -> None:
		if next_state not in REFERRAL_STATES:
			raise ValueError(f"Invalid state: {next_state}")

		allowed_next_states = WorkflowService.ALLOWED_STATE_TRANSITIONS.get(current_state, set())
		if next_state not in allowed_next_states:
			raise ValueError(f"Transition from {current_state} to {next_state} is not allowed")

	@staticmethod
	def transition_referral(
		db: Session,
		referral_id: UUID,
		next_state: str,
		triggered_by: UUID | None,
		notes: str | None = None,
	):
		referral = ReferralRepository.get_by_id(db, referral_id)
		if not referral:
			raise LookupError("Referral not found")

		current_state = cast(str, referral.state)
		current_status = cast(str, referral.status)
		WorkflowService.validate_transition(current_state=current_state, next_state=next_state)

		if next_state in {"READY_TO_START", "IN_PROGRESS"} and current_status != "NDA_COMPLETED":
			raise ValueError("Internship activation is blocked until NDA completion (status NDA_COMPLETED)")

		referral = ReferralRepository.update_state(db, referral_id, next_state)
		if not referral:
			raise LookupError("Referral not found")

		WorkflowEventRepository.create(
			db=db,
			referral_id=cast(UUID, referral.id),
			event_type="REFERRAL_UPDATED",
			triggered_by=triggered_by,
			description=f"Referral state changed from {current_state} to {next_state}",
			data={
				"before_state": current_state,
				"after_state": next_state,
				"notes": notes,
			},
		)

		return referral
