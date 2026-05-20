from sqlalchemy import Column, String, Boolean, Date, JSON, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class Referral(Base):
    """Core referral workflow - tracks internship from submission to closure."""
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Key participants
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # Employee who referred
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # Intern/candidate
    mentor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # Project mentor
    
    # Status & workflow state tracking
    status = Column(String, nullable=False, default="ACTIVE")  # ACTIVE, CLOSED, REJECTED
    state = Column(String, nullable=False, default="DRAFT")  # Workflow state (see below for valid values)
    
    # Eligibility confirmations (BRD Section 7.4)
    unpaid_consent_confirmed = Column(Boolean, default=False)  # Candidate confirmed unpaid
    in_person_ready_confirmed = Column(Boolean, default=False)  # Candidate confirmed ready to work in-person
    location_match_confirmed = Column(Boolean, default=False)  # Location alignment confirmed
    
    # Internship details
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    project_overview = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    relationship_to_mentor = Column(String, nullable=True)  # "Team member", "Peer", "Friend", etc.
    
    
    # Additional data (stored as JSON for flexibility)
    # DB column is named "metadata" from initial migration; map it to a safe Python attribute name.
    additional_data = Column("metadata", JSON, nullable=True)  # Flexible storage for additional data
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    referrer = relationship("User", foreign_keys=[referrer_id], backref="referrals_as_referrer")
    candidate = relationship("User", foreign_keys=[candidate_id], backref="referrals_as_candidate")
    mentor = relationship("User", foreign_keys=[mentor_id], backref="mentors_of")
    joining_form = relationship("JoiningForm", back_populates="referral", uselist=False)
    nda_document = relationship("NDADocument", back_populates="referral", uselist=False)
    non_worker_id_task = relationship("NonWorkerIDTask", back_populates="referral", uselist=False)
    certificates = relationship("Certificate", back_populates="referral")
    workflow_events = relationship("WorkflowEvent", back_populates="referral", cascade="all, delete-orphan")
    mentor_assignments = relationship("MentorAssignment", back_populates="referral")


# Valid workflow states for referral lifecycle
# FR-8, 7.0 lifecycle states
REFERRAL_STATES = {
    "DRAFT": "Referral created, not submitted",
    "SUBMITTED": "Awaiting eligibility check",
    "ELIGIBILITY_REVIEW": "AI + manual review in progress",
    "ELIGIBILITY_PASSED": "All checks passed, can proceed",
    "ELIGIBILITY_FAILED": "Blocked due to eligibility check",
    "JOINING_FORM_PENDING": "Awaiting candidate to complete joining form",
    "JOINING_FORM_SUBMITTED": "Form submitted, awaiting HR review",
    "NDA_PENDING": "Awaiting candidate e-signature on NDA",
    "NDA_SIGNED": "NDA signed successfully",
    "NON_WORKER_ID_PENDING": "Awaiting HR to generate Non-Worker ID",
    "CREDENTIALS_GENERATED": "AD credentials generated, awaiting provisioning",
    "READY_TO_START": "All prerequisites met, ready for start",
    "IN_PROGRESS": "Internship active",
    "DELAYED": "Start date passed but not started (escalation needed)",
    "EXTENDED": "End date extended",
    "IN_CLOSURE": "Termination process in progress",
    "CLOSED": "Internship complete, all tasks done",
}
