from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class NDADocument(Base):
    """NDA tracking (FR-8) - E-signature, archival, and compliance."""
    __tablename__ = "nda_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referral_id = Column(UUID(as_uuid=True), ForeignKey("referrals.id"), nullable=False, unique=True)
    
    # Status tracking (FR-8)
    status = Column(String, nullable=False, default="PENDING")  # PENDING, SENT, SIGNED, EXPIRED, REJECTED
    
    # E-signature provider integration (FR-8)
    esign_token = Column(String, nullable=True)  # Token from DocuSign/Adobe Sign
    esign_url = Column(String, nullable=True)  # URL for candidate to sign
    esign_provider = Column(String, nullable=True)  # "DocuSign", "Adobe Sign", etc.
    
    # Signature tracking
    signed_at = Column(DateTime, nullable=True)
    signed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # User who signed
    
    # Document archival
    archived_url = Column(String, nullable=True)  # S3/storage URL of signed PDF
    archived_at = Column(DateTime, nullable=True)
    
    # Metadata
    expires_at = Column(DateTime, nullable=True)  # E-sign link expiration
    template_version = Column(String, nullable=True)  # Version of NDA template used
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    referral = relationship("Referral", back_populates="nda_document")
    signer = relationship("User", foreign_keys=[signed_by], backref="ndas_signed")


# Status constants
NDA_STATUS = {
    "PENDING": "NDA not yet issued",
    "SENT": "E-sign email sent to candidate",
    "SIGNED": "Candidate signed successfully",
    "EXPIRED": "E-sign link expired",
    "REJECTED": "Candidate rejected signature",
}

# SLA: NDA must be signed >= 1 day before start (BRD Section 13)
