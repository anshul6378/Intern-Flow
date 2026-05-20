from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class Certificate(Base):
    """Certificate request and management (FR-16 to FR-19)."""
    __tablename__ = "certificates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_id = Column(UUID(as_uuid=True), ForeignKey("referrals.id"), nullable=False)
    
    # Certificate status (FR-16 to FR-19)
    status = Column(String, nullable=False, default="PENDING")  # Various states below
    
    # Request tracking
    request_date = Column(DateTime, nullable=True)  # When certificate was requested
    request_form_url = Column(String, nullable=True)  # URL/link to request form for mentor
    
    # Certificate details (from mentor form)
    internship_summary = Column(Text, nullable=True)  # Summary of work done
    skills_acquired = Column(JSON, nullable=True)  # Array: ["Skill 1", "Skill 2", ...]
    mentor_notes = Column(Text, nullable=True)  # Additional comments from mentor
    mentor_signature_date = Column(DateTime, nullable=True)  # When mentor submitted form
    
    # Generation & issuance
    issued_date = Column(DateTime, nullable=True)  # When certificate was generated
    template_used = Column(String, nullable=True)  # Certificate template version
    archived_url = Column(String, nullable=True)  # S3/storage URL of final PDF
    archived_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    referral = relationship("Referral", back_populates="certificates")


# Status constants
CERTIFICATE_STATUS = {
    "PENDING": "Waiting for internship to end",
    "REQUEST_FORM_SENT": "Form sent to mentor",
    "REQUESTED": "Mentor submitted request form",
    "GENERATED": "Certificate PDF generated",
    "ISSUED": "Certificate sent to candidate",
    "ARCHIVED": "Certificate archived for compliance",
}

# Timeline: Certificate requested after internship end (FR-16-19)
