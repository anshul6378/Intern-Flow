from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NonWorkerTaskCreateRequest(BaseModel):
    assigned_to: UUID | None = None


class NonWorkerTaskCompleteRequest(BaseModel):
    generated_non_worker_id: str


class NonWorkerTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referral_id: UUID
    status: str
    assigned_to: UUID | None = None
    created_by: UUID
    generated_non_worker_id: str | None = None
    credentials_token: str | None = None
    credentials_token_expiry: datetime | None = None
    sla_deadline: datetime
    sla_breached: bool
    created_at: datetime
    completed_at: datetime | None = None
    updated_at: datetime
