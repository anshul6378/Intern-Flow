"""Repository for JoiningForm model."""
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.models import JoiningForm, JOINING_FORM_STATUS


class JoiningFormRepository:
    """Data access layer for JoiningForm model."""

    @staticmethod
    def create(
        db: Session,
        referral_id: UUID,
        **kwargs
    ) -> JoiningForm:
        """Create a new joining form."""
        form = JoiningForm(referral_id=referral_id, **kwargs)
        db.add(form)
        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def get_by_id(db: Session, form_id: UUID) -> Optional[JoiningForm]:
        """Retrieve joining form by ID."""
        return db.query(JoiningForm).filter(JoiningForm.id == form_id).first()

    @staticmethod
    def get_by_referral_id(db: Session, referral_id: UUID) -> Optional[JoiningForm]:
        """Retrieve joining form by referral ID."""
        return db.query(JoiningForm).filter(JoiningForm.referral_id == referral_id).first()

    @staticmethod
    def get_by_status(db: Session, status: str) -> List[JoiningForm]:
        """Get all joining forms with a specific status."""
        return db.query(JoiningForm).filter(JoiningForm.status == status).all()

    @staticmethod
    def update(db: Session, form_id: UUID, **updates) -> Optional[JoiningForm]:
        """Update a joining form."""
        form = JoiningFormRepository.get_by_id(db, form_id)
        if not form:
            return None
        
        for key, value in updates.items():
            if hasattr(form, key):
                setattr(form, key, value)
        
        form.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def save_draft(db: Session, form_id: UUID, **form_data) -> Optional[JoiningForm]:
        """Save draft without full validation."""
        form = JoiningFormRepository.get_by_id(db, form_id)
        if not form:
            return None
        
        for key, value in form_data.items():
            if hasattr(form, key) and key not in ["id", "referral_id", "status"]:
                setattr(form, key, value)
        
        form.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def submit(
        db: Session,
        form_id: UUID,
        submitted_by: UUID
    ) -> Optional[JoiningForm]:
        """Submit form (mark as submitted)."""
        return JoiningFormRepository.update(
            db,
            form_id,
            status="SUBMITTED",
            submitted_at=datetime.utcnow(),
            submitted_by=submitted_by
        )

    @staticmethod
    def approve(
        db: Session,
        form_id: UUID,
        reviewed_by: UUID
    ) -> Optional[JoiningForm]:
        """Approve form by HR."""
        return JoiningFormRepository.update(
            db,
            form_id,
            status="APPROVED",
            approved_at=datetime.utcnow(),
            reviewed_by=reviewed_by
        )

    @staticmethod
    def reject(db: Session, form_id: UUID, reviewed_by: UUID) -> Optional[JoiningForm]:
        """Reject form, requires resubmission."""
        return JoiningFormRepository.update(
            db,
            form_id,
            status="REJECTED",
            reviewed_by=reviewed_by
        )

    @staticmethod
    def delete(db: Session, form_id: UUID) -> bool:
        """Delete a joining form."""
        form = JoiningFormRepository.get_by_id(db, form_id)
        if not form:
            return False
        
        db.delete(form)
        db.commit()
        return True
