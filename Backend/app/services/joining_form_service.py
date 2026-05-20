"""Service for joining form business logic."""
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.models import JoiningForm, Referral
from app.repositories.joining_form_repository import JoiningFormRepository
from app.repositories.referral_repository import ReferralRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository


class JoiningFormService:
    """Business logic for joining form workflow (FR-6)."""

    def __init__(self, db: Session):
        self.db = db
        self.form_repo = JoiningFormRepository
        self.referral_repo = ReferralRepository
        self.event_repo = WorkflowEventRepository

    def get_or_create_form(self, referral_id: UUID) -> JoiningForm:
        """Get existing form or create a new draft for referral."""
        existing_form = self.form_repo.get_by_referral_id(self.db, referral_id)
        if existing_form:
            return existing_form
        
        # Create new draft form
        form = self.form_repo.create(self.db, referral_id=referral_id, status="DRAFT")
        return form

    def save_draft(self, referral_id: UUID, form_data: dict, current_user_id: UUID) -> JoiningForm:
        """Save form draft (partial data allowed)."""
        # Verify user has access to referral
        referral = self.referral_repo.get_by_id(self.db, referral_id)
        if not referral:
            raise ValueError(f"Referral {referral_id} not found")
        
        # Check access: candidate or referrer
        if referral.candidate_id != current_user_id and referral.referrer_id != current_user_id:
            raise PermissionError("User does not have access to this referral")
        
        # Get or create form
        form = self.get_or_create_form(referral_id)
        
        # Save draft data
        draft_data = {}
        for key in ["personal_details", "address", "emergency_contact", "education_history", "employment_history", "government_ids"]:
            if key in form_data:
                draft_data[key] = form_data[key]
        
        form = self.form_repo.save_draft(self.db, form.id, **draft_data)
        
        # Log draft save event
        self.event_repo.create(
            self.db,
            referral_id=referral_id,
            event_type="JOINING_FORM_DRAFT_SAVED",
            triggered_by=current_user_id,
            description="Candidate saved joining form draft",
            context={}
        )
        
        return form

    def submit_form(self, referral_id: UUID, form_data: dict, current_user_id: UUID) -> JoiningForm:
        """Submit completed form for HR review with full validation."""
        # Verify referral and access
        referral = self.referral_repo.get_by_id(self.db, referral_id)
        if not referral:
            raise ValueError(f"Referral {referral_id} not found")
        
        # Only candidate can submit their joining form
        if referral.candidate_id != current_user_id:
            raise PermissionError("Only the candidate can submit their joining form")
        
        # Get or create form
        form = self.get_or_create_form(referral_id)
        
        # Validate all required fields are present
        required_fields = ["personal_details", "address", "emergency_contact", "education_history", "employment_history", "government_ids"]
        for field in required_fields:
            if field not in form_data or not form_data[field]:
                raise ValueError(f"Missing required field: {field}")
        
        # Update form with submitted data
        form = self.form_repo.update(
            self.db,
            form.id,
            personal_details=form_data.get("personal_details"),
            address=form_data.get("address"),
            emergency_contact=form_data.get("emergency_contact"),
            education_history=form_data.get("education_history"),
            employment_history=form_data.get("employment_history"),
            government_ids=form_data.get("government_ids"),
            declarations_signed=form_data.get("declarations_signed", True),
            signature_date=datetime.utcnow()
        )
        
        # Submit form
        form = self.form_repo.submit(self.db, form.id, submitted_by=current_user_id)
        
        # Update referral state to JOINING_FORM_IN_PROGRESS
        self.referral_repo.update_state(self.db, referral_id, "JOINING_FORM_IN_PROGRESS")
        
        # Log form submission event
        self.event_repo.create(
            self.db,
            referral_id=referral_id,
            event_type="JOINING_FORM_SUBMITTED",
            triggered_by=current_user_id,
            description="Candidate submitted joining form for HR review",
            context={
                "form_id": str(form.id),
                "email": form.personal_details.get("email") if form.personal_details else None
            }
        )
        
        return form

    def get_form(self, referral_id: UUID, current_user_id: UUID) -> JoiningForm:
        """Retrieve joining form with access control."""
        referral = self.referral_repo.get_by_id(self.db, referral_id)
        if not referral:
            raise ValueError(f"Referral {referral_id} not found")
        
        # Check access: candidate, referrer, or mentor
        is_authorized = (
            referral.candidate_id == current_user_id or
            referral.referrer_id == current_user_id or
            referral.mentor_id == current_user_id
        )
        if not is_authorized:
            raise PermissionError("User does not have access to this referral")
        
        form = self.form_repo.get_by_referral_id(self.db, referral_id)
        if not form:
            raise ValueError(f"Joining form not found for referral {referral_id}")
        
        return form

    def approve_form(self, referral_id: UUID, current_user_id: UUID, notes: Optional[str] = None) -> JoiningForm:
        """HR approves joining form."""
        # Verify referral
        referral = self.referral_repo.get_by_id(self.db, referral_id)
        if not referral:
            raise ValueError(f"Referral {referral_id} not found")
        
        # Get form
        form = self.form_repo.get_by_referral_id(self.db, referral_id)
        if not form:
            raise ValueError(f"Joining form not found for referral {referral_id}")
        
        if form.status != "SUBMITTED":
            raise ValueError(f"Cannot approve form with status {form.status}")
        
        # Approve
        form = self.form_repo.approve(self.db, form.id, reviewed_by=current_user_id)
        
        # Update referral state to JOINING_FORM_APPROVED
        self.referral_repo.update_state(self.db, referral_id, "JOINING_FORM_APPROVED")
        
        # Log approval event
        self.event_repo.create(
            self.db,
            referral_id=referral_id,
            event_type="JOINING_FORM_APPROVED",
            triggered_by=current_user_id,
            description=f"HR approved joining form. Notes: {notes or 'None'}",
            context={
                "form_id": str(form.id),
                "notes": notes
            }
        )
        
        return form

    def reject_form(self, referral_id: UUID, current_user_id: UUID, notes: Optional[str] = None) -> JoiningForm:
        """HR rejects joining form for resubmission."""
        # Verify referral
        referral = self.referral_repo.get_by_id(self.db, referral_id)
        if not referral:
            raise ValueError(f"Referral {referral_id} not found")
        
        # Get form
        form = self.form_repo.get_by_referral_id(self.db, referral_id)
        if not form:
            raise ValueError(f"Joining form not found for referral {referral_id}")
        
        if form.status != "SUBMITTED":
            raise ValueError(f"Cannot reject form with status {form.status}")
        
        # Reject
        form = self.form_repo.reject(self.db, form.id, reviewed_by=current_user_id)
        
        # Keep referral state as JOINING_FORM_PENDING (candidate needs to resubmit)
        
        # Log rejection event
        self.event_repo.create(
            self.db,
            referral_id=referral_id,
            event_type="JOINING_FORM_REJECTED",
            triggered_by=current_user_id,
            description=f"HR rejected joining form. Reason: {notes or 'See notes in form'}",
            context={
                "form_id": str(form.id),
                "reason": notes
            }
        )
        
        return form

    def list_forms_for_review(self, status: str = "SUBMITTED") -> list:
        """List all forms for HR review (filtered by status)."""
        forms = self.form_repo.get_by_status(self.db, status)
        return forms

    def get_form_status(self, referral_id: UUID, current_user_id: UUID) -> dict:
        """Get high-level form status."""
        form = self.get_form(referral_id, current_user_id)
        
        return {
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
            "has_education": form.education_history is not None,
            "has_employment": form.employment_history is not None,
            "has_government_ids": form.government_ids is not None,
        }
