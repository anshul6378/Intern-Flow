"""Pydantic schemas for joining form."""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class PersonalDetailsSchema(BaseModel):
    """Personal information step."""
    name: str = Field(..., min_length=1)
    email: EmailStr
    date_of_birth: str  # ISO format YYYY-MM-DD
    phone: str
    gender: Optional[str] = None
    nationality: Optional[str] = None


class AddressSchema(BaseModel):
    """Address information step."""
    street: str
    city: str
    state: str
    zip_code: str
    country: str


class EmergencyContactSchema(BaseModel):
    """Emergency contact information."""
    name: str
    phone: str
    relationship: str


class EducationEntrySchema(BaseModel):
    """Single education entry."""
    institution: str
    degree: str
    field_of_study: str
    graduation_year: int
    details: Optional[str] = None


class EmploymentEntrySchema(BaseModel):
    """Single employment entry."""
    company: str
    job_title: str
    start_date: str  # ISO format YYYY-MM-DD
    end_date: Optional[str] = None
    description: Optional[str] = None
    is_current: bool = False


class GovernmentIDSchema(BaseModel):
    """Government ID document."""
    id_type: str  # SSN, PASSPORT, DRIVER_LICENSE, etc.
    id_number: str
    issue_date: str  # ISO format
    expiry_date: Optional[str] = None
    document_url: Optional[str] = None


class JoiningFormDraftSave(BaseModel):
    """Request to save form draft (partial data allowed)."""
    personal_details: Optional[PersonalDetailsSchema] = None
    address: Optional[AddressSchema] = None
    emergency_contact: Optional[EmergencyContactSchema] = None
    education_history: Optional[List[EducationEntrySchema]] = None
    employment_history: Optional[List[EmploymentEntrySchema]] = None
    government_ids: Optional[List[GovernmentIDSchema]] = None
    
    model_config = ConfigDict(extra="ignore")


class JoiningFormSubmit(BaseModel):
    """Request to submit completed form."""
    personal_details: PersonalDetailsSchema
    address: AddressSchema
    emergency_contact: EmergencyContactSchema
    education_history: List[EducationEntrySchema]
    employment_history: List[EmploymentEntrySchema]
    government_ids: List[GovernmentIDSchema]
    declarations_signed: bool = Field(default=True)


class JoiningFormHRAction(BaseModel):
    """HR approval or rejection action."""
    action: str  # APPROVE or REJECT
    notes: Optional[str] = None


class JoiningFormResponse(BaseModel):
    """Response schema for joining form."""
    id: UUID
    referral_id: UUID
    status: str
    
    # Step data (as JSON)
    personal_details: Optional[Dict[str, Any]] = None
    address: Optional[Dict[str, Any]] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    education_history: Optional[List[Dict[str, Any]]] = None
    employment_history: Optional[List[Dict[str, Any]]] = None
    government_ids: Optional[List[Dict[str, Any]]] = None
    
    # Declaration
    declarations_signed: bool
    signature_date: Optional[datetime] = None
    
    # Tracking
    submitted_by: Optional[UUID] = None
    reviewed_by: Optional[UUID] = None
    created_at: datetime
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class JoiningFormListResponse(BaseModel):
    """Response for listing joining forms."""
    id: UUID
    referral_id: UUID
    status: str
    declarations_signed: bool
    created_at: datetime
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
