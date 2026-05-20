from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NDASendRequest(BaseModel):
    esign_provider: str = Field(default="DocuSign", min_length=2, max_length=64)
    template_version: str | None = Field(default=None, max_length=64)
    expires_in_hours: int = Field(default=48, ge=1, le=168)


class NDASignRequest(BaseModel):
    archived_url: str | None = None


class NDARejectRequest(BaseModel):
    reason: str | None = None


class NDAResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referral_id: UUID
    status: str
    esign_token: str | None = None
    esign_url: str | None = None
    esign_provider: str | None = None
    signed_at: datetime | None = None
    signed_by: UUID | None = None
    archived_url: str | None = None
    archived_at: datetime | None = None
    expires_at: datetime | None = None
    template_version: str | None = None
    created_at: datetime
    updated_at: datetime


class NDAListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referral_id: UUID
    status: str
    esign_provider: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class NDAListResponse(BaseModel):
    items: list[NDAListItemResponse]
    total: int
