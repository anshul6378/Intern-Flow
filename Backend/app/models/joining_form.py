from sqlalchemy import Column, String, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class JoiningForm(Base):
    """Digital joining form (FR-6) - Multi-step onboarding form."""
    __tablename__ = "joining_forms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_id = Column(UUID(as_uuid=True), ForeignKey("referrals.id"), nullable=False, unique=True)
    
    # Form status (FR-6: save-draft, validations, attachments, HR lock)
    status = Column(String, nullable=False, default="DRAFT")  # DRAFT, SUBMITTED, HR_REVIEW, APPROVED, REJECTED
    
    # Step 1: Personal Information
    personal_details = Column(JSON, nullable=True)  # {name, email, dob, phone, gender, etc.}
    
    # Step 2: Address & Emergency Contact
    address = Column(JSON, nullable=True)  # {street, city, state, zip, country}
    emergency_contact = Column(JSON, nullable=True)  # {name, phone, relationship}
    
    # Step 3: Education History
    education_history = Column(JSON, nullable=True)  # [{degree, institution, year, field}, ...]
    
    # Step 4: Employment History
    employment_history = Column(JSON, nullable=True)  # [{company, title, duration, description}, ...]
    
    # Step 5: Government IDs & Documents
    government_ids = Column(JSON, nullable=True)  # {id_type: {url, upload_date}, ...}
    
    # Step 6: Declaration & Signature
    declarations_signed = Column(Boolean, default=False)
    signature_date = Column(DateTime, nullable=True)
    
    # HR tracking (FR-6: HR lock capability)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Candidate
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # HR person
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    referral = relationship("Referral", back_populates="joining_form")
    submitter = relationship("User", foreign_keys=[submitted_by], backref="joining_forms_submitted")
    reviewer = relationship("User", foreign_keys=[reviewed_by], backref="joining_forms_reviewed")


# Status constants
JOINING_FORM_STATUS = {
    "DRAFT": "In progress, not submitted",
    "SUBMITTED": "Submitted by candidate, awaiting HR review",
    "HR_REVIEW": "HR is reviewing the form",
    "APPROVED": "HR approved the form",
    "REJECTED": "HR rejected, needs resubmission",
}
