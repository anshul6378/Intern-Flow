from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class MentorAssignment(Base):
    """Mentor assignment tracking (for potential extensions)."""
    __tablename__ = "mentor_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_id = Column(UUID(as_uuid=True), ForeignKey("referrals.id"), nullable=False)
    mentor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Assignment tracking
    assigned_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    assignment_status = Column(String, nullable=False, default="ACTIVE")  # ACTIVE, CLOSED
    
    # Relationships
    referral = relationship("Referral", back_populates="mentor_assignments")
    mentor = relationship("User", backref="mentor_assignments")


# Status constants
ASSIGNMENT_STATUS = {
    "ACTIVE": "Mentor actively assigned to this referral",
    "CLOSED": "Assignment ended",
}
