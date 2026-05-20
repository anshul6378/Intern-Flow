"""Repository for MentorAssignment model."""
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID

from app.models import MentorAssignment


class MentorAssignmentRepository:
    """Data access layer for MentorAssignment model."""

    @staticmethod
    def create(
        db: Session,
        referral_id: UUID,
        mentor_id: UUID,
    ) -> MentorAssignment:
        """Create a new mentor assignment."""
        assignment = MentorAssignment(
            referral_id=referral_id,
            mentor_id=mentor_id
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return assignment

    @staticmethod
    def get_by_id(db: Session, assignment_id: UUID) -> Optional[MentorAssignment]:
        """Retrieve assignment by ID."""
        return db.query(MentorAssignment).filter(MentorAssignment.id == assignment_id).first()

    @staticmethod
    def get_by_referral_id(db: Session, referral_id: UUID) -> List[MentorAssignment]:
        """Get all assignments for a referral."""
        return db.query(MentorAssignment).filter(MentorAssignment.referral_id == referral_id).all()

    @staticmethod
    def get_active_by_mentor(db: Session, mentor_id: UUID) -> List[MentorAssignment]:
        """Get active assignments for a mentor."""
        return db.query(MentorAssignment).filter(
            MentorAssignment.mentor_id == mentor_id,
            MentorAssignment.assignment_status == "ACTIVE"
        ).all()

    @staticmethod
    def update(db: Session, assignment_id: UUID, **updates) -> Optional[MentorAssignment]:
        """Update an assignment."""
        assignment = MentorAssignmentRepository.get_by_id(db, assignment_id)
        if not assignment:
            return None
        
        for key, value in updates.items():
            if hasattr(assignment, key):
                setattr(assignment, key, value)
        
        db.commit()
        db.refresh(assignment)
        return assignment

    @staticmethod
    def close_assignment(db: Session, assignment_id: UUID) -> Optional[MentorAssignment]:
        """Mark assignment as closed."""
        return MentorAssignmentRepository.update(
            db,
            assignment_id,
            assignment_status="CLOSED"
        )

    @staticmethod
    def delete(db: Session, assignment_id: UUID) -> bool:
        """Delete an assignment."""
        assignment = MentorAssignmentRepository.get_by_id(db, assignment_id)
        if not assignment:
            return False
        
        db.delete(assignment)
        db.commit()
        return True
