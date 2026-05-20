from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ReferralCreate(BaseModel):
    candidate_email: EmailStr
    mentor_email: EmailStr

    start_date: date | None = None
    end_date: date | None = None
    project_overview: str | None = None
    location: str | None = None
    relationship_to_mentor: str | None = None

    unpaid_consent_confirmed: bool = Field(default=False)
    in_person_ready_confirmed: bool = Field(default=False)
    location_match_confirmed: bool = Field(default=False)

    additional_data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, end_date: date | None, info):
        start_date = info.data.get("start_date")
        if start_date and end_date and end_date <= start_date:
            raise ValueError("end_date must be after start_date")
        return end_date


class ReferralUpdate(BaseModel):
    status: str | None = None
    state: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    project_overview: str | None = None
    location: str | None = None
    relationship_to_mentor: str | None = None
    unpaid_consent_confirmed: bool | None = None
    in_person_ready_confirmed: bool | None = None
    location_match_confirmed: bool | None = None
    additional_data: dict[str, Any] | None = None

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, end_date: date | None, info):
        start_date = info.data.get("start_date")
        if start_date and end_date and end_date <= start_date:
            raise ValueError("end_date must be after start_date")
        return end_date


class EligibilityCheckRequest(BaseModel):
    unpaid_consent_confirmed: bool
    in_person_ready_confirmed: bool
    location_match_confirmed: bool
    notes: str | None = None


class ReferralStateTransitionRequest(BaseModel):
    next_state: str
    notes: str | None = None


class WorkflowEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referral_id: UUID
    event_type: str
    triggered_by: UUID | None = None
    description: str | None = None
    data: dict[str, Any] | None = None
    timestamp: datetime


class ReferralResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referrer_id: UUID
    candidate_id: UUID
    mentor_id: UUID
    status: str
    state: str
    unpaid_consent_confirmed: bool
    in_person_ready_confirmed: bool
    location_match_confirmed: bool
    start_date: date | None = None
    end_date: date | None = None
    project_overview: str | None = None
    location: str | None = None
    relationship_to_mentor: str | None = None
    additional_data: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class ReferralListResponse(BaseModel):
    items: list[ReferralResponse]
    total: int
    skip: int
    limit: int


class ReferralTimelineResponse(BaseModel):
    referral_id: UUID
    events: list[WorkflowEventResponse]
    total: int
