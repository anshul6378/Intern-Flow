"""Repository for Referral model - Core workflow data access."""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime

from app.models import Referral, REFERRAL_STATES


class ReferralRepository:
    """Data access layer for Referral model."""

    @staticmethod
    def create(
        db: Session,
        referrer_id: UUID,
        candidate_id: UUID,
        mentor_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        project_overview: Optional[str] = None,
        location: Optional[str] = None,
        **kwargs
    ) -> Referral:
        """Create a new referral."""
        referral = Referral(
            referrer_id=referrer_id,
            candidate_id=candidate_id,
            mentor_id=mentor_id,
            start_date=start_date,
            end_date=end_date,
            project_overview=project_overview,
            location=location,
            **kwargs
        )
        db.add(referral)
        db.commit()
        db.refresh(referral)
        return referral

    @staticmethod
    def get_by_id(db: Session, referral_id: UUID) -> Optional[Referral]:
        """Retrieve referral by ID."""
        return db.query(Referral).filter(Referral.id == referral_id).first()

    @staticmethod
    def get_by_referrer_id(db: Session, referrer_id: UUID) -> List[Referral]:
        """Get all referrals submitted by a specific referrer."""
        return db.query(Referral).filter(Referral.referrer_id == referrer_id).all()

    @staticmethod
    def get_by_candidate_id(db: Session, candidate_id: UUID) -> List[Referral]:
        """Get all referrals for a specific candidate."""
        return db.query(Referral).filter(Referral.candidate_id == candidate_id).all()

    @staticmethod
    def get_by_mentor_id(db: Session, mentor_id: UUID) -> List[Referral]:
        """Get all referrals where someone is the mentor."""
        return db.query(Referral).filter(Referral.mentor_id == mentor_id).all()

    @staticmethod
    def get_by_state(db: Session, state: str) -> List[Referral]:
        """Get all referrals in a specific workflow state."""
        return db.query(Referral).filter(Referral.state == state).all()

    @staticmethod
    def get_by_status(db: Session, status: str) -> List[Referral]:
        """Get all referrals with a specific status."""
        return db.query(Referral).filter(Referral.status == status).all()

    @staticmethod
    def list_all(
        db: Session,
        filters: Optional[dict] = None,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[Referral], int]:
        """List referrals with optional filters and pagination."""
        query = db.query(Referral)
        
        if filters:
            if "state" in filters:
                query = query.filter(Referral.state == filters["state"])
            if "status" in filters:
                query = query.filter(Referral.status == filters["status"])
            if "referrer_id" in filters:
                query = query.filter(Referral.referrer_id == filters["referrer_id"])
            if "mentor_id" in filters:
                query = query.filter(Referral.mentor_id == filters["mentor_id"])
        
        total = query.count()
        results = query.offset(skip).limit(limit).all()
        return results, total

    @staticmethod
    def list_for_candidate(
        db: Session,
        candidate_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[Referral], int]:
        """List referrals mapped to a candidate with pagination."""
        query = db.query(Referral).filter(Referral.candidate_id == candidate_id)
        total = query.count()
        results = query.order_by(Referral.created_at.desc()).offset(skip).limit(limit).all()
        return results, total

    @staticmethod
    def list_for_referrer(
        db: Session,
        referrer_id: UUID,
        skip: int = 0,
        limit: int = 50,
        state: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[List[Referral], int]:
        """List referrals mapped to a referrer with optional state/status filters."""
        query = db.query(Referral).filter(Referral.referrer_id == referrer_id)
        if state is not None:
            query = query.filter(Referral.state == state)
        if status is not None:
            query = query.filter(Referral.status == status)
        total = query.count()
        results = query.order_by(Referral.created_at.desc()).offset(skip).limit(limit).all()
        return results, total

    @staticmethod
    def list_for_mentor(
        db: Session,
        mentor_id: UUID,
        skip: int = 0,
        limit: int = 50,
        state: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[List[Referral], int]:
        """List referrals mapped to a mentor with optional state/status filters."""
        query = db.query(Referral).filter(Referral.mentor_id == mentor_id)
        if state is not None:
            query = query.filter(Referral.state == state)
        if status is not None:
            query = query.filter(Referral.status == status)
        total = query.count()
        results = query.order_by(Referral.created_at.desc()).offset(skip).limit(limit).all()
        return results, total

    @staticmethod
    def list_hr_queue(
        db: Session,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[Referral], int]:
        """List referrals that require HR actions in the workflow queue."""
        hr_states = [
            "JOINING_FORM_SUBMITTED",
            "NDA_SIGNED",
            "NON_WORKER_ID_PENDING",
            "IN_CLOSURE",
        ]
        query = db.query(Referral).filter(Referral.state.in_(hr_states), Referral.status == "ACTIVE")
        total = query.count()
        results = query.order_by(Referral.updated_at.desc()).offset(skip).limit(limit).all()
        return results, total

    @staticmethod
    def update(db: Session, referral_id: UUID, **updates) -> Optional[Referral]:
        """Update a referral."""
        referral = ReferralRepository.get_by_id(db, referral_id)
        if not referral:
            return None
        
        for key, value in updates.items():
            if hasattr(referral, key):
                setattr(referral, key, value)
        
        setattr(referral, "updated_at", datetime.utcnow())
        db.commit()
        db.refresh(referral)
        return referral

    @staticmethod
    def update_state(db: Session, referral_id: UUID, new_state: str) -> Optional[Referral]:
        """Update referral workflow state."""
        if new_state not in REFERRAL_STATES:
            raise ValueError(f"Invalid state: {new_state}")
        
        return ReferralRepository.update(db, referral_id, state=new_state)

    @staticmethod
    def mark_eligibility_checked(
        db: Session,
        referral_id: UUID,
        unpaid: bool,
        in_person: bool,
        location: bool
    ) -> Optional[Referral]:
        """Mark eligibility check completed."""
        return ReferralRepository.update(
            db,
            referral_id,
            unpaid_consent_confirmed=unpaid,
            in_person_ready_confirmed=in_person,
            location_match_confirmed=location
        )

    @staticmethod
    def delete(db: Session, referral_id: UUID) -> bool:
        """Delete a referral (soft delete recommended)."""
        referral = ReferralRepository.get_by_id(db, referral_id)
        if not referral:
            return False
        
        db.delete(referral)
        db.commit()
        return True
