from sqlalchemy import Column, String, Boolean, Float, Date, JSON, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class CandidateProfile(Base):
    """Profile for intern/candidate candidates with AI-parsed resume data."""
    __tablename__ = "candidate_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    
    # Contact & education info
    phone = Column(String, nullable=True)
    education = Column(JSON, nullable=True)  # Array: [{degree, institution, year}, ...]
    skills = Column(JSON, nullable=True)  # Array: ["Python", "AWS", "React", ...]
    
    # Resume data
    resume_url = Column(String, nullable=True)  # S3/cloud storage URL
    parsed_resume_data = Column(JSON, nullable=True)  # AI extracted: name, email, phone, education, skills
    confidence_score = Column(Float, nullable=True)  # AI parsing confidence 0.0-1.0
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", backref="candidate_profile")
