"""Repository for CandidateProfile model."""
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.models import CandidateProfile


class CandidateProfileRepository:
    """Data access layer for CandidateProfile model."""

    @staticmethod
    def create(
        db: Session,
        user_id: UUID,
        phone: Optional[str] = None,
        education: Optional[list] = None,
        skills: Optional[list] = None,
        resume_url: Optional[str] = None,
        parsed_resume_data: Optional[dict] = None,
        confidence_score: Optional[float] = None,
    ) -> CandidateProfile:
        """Create a new candidate profile."""
        profile = CandidateProfile(
            user_id=user_id,
            phone=phone,
            education=education,
            skills=skills,
            resume_url=resume_url,
            parsed_resume_data=parsed_resume_data,
            confidence_score=confidence_score,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def get_by_id(db: Session, profile_id: UUID) -> Optional[CandidateProfile]:
        """Retrieve candidate profile by ID."""
        return db.query(CandidateProfile).filter(CandidateProfile.id == profile_id).first()

    @staticmethod
    def get_by_user_id(db: Session, user_id: UUID) -> Optional[CandidateProfile]:
        """Retrieve candidate profile by user ID."""
        return db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()

    @staticmethod
    def update(db: Session, profile_id: UUID, **updates) -> Optional[CandidateProfile]:
        """Update a candidate profile."""
        profile = CandidateProfileRepository.get_by_id(db, profile_id)
        if not profile:
            return None
        
        for key, value in updates.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def update_parsed_resume(
        db: Session,
        user_id: UUID,
        parsed_data: dict,
        confidence_score: float
    ) -> Optional[CandidateProfile]:
        """Update parsed resume data (after AI processing)."""
        profile = CandidateProfileRepository.get_by_user_id(db, user_id)
        if not profile:
            return None
        
        return CandidateProfileRepository.update(
            db,
            profile.id,
            parsed_resume_data=parsed_data,
            confidence_score=confidence_score
        )

    @staticmethod
    def delete(db: Session, profile_id: UUID) -> bool:
        """Delete a candidate profile."""
        profile = CandidateProfileRepository.get_by_id(db, profile_id)
        if not profile:
            return False
        
        db.delete(profile)
        db.commit()
        return True
