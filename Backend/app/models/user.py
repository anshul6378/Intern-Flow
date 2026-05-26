from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    # Primary key & authentication
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Role & permissions
    # Valid roles: referrer, candidate, mentor, hr, admin, security, it, program_owner, compliance
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # User metadata
    employee_id = Column(String, unique=True, nullable=True)  # Company employee ID
    department = Column(String, nullable=True)  # Department of employee
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # For manager hierarchy
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    manager = relationship("User", remote_side=[id], backref="reports")