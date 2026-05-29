from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CertificateRequestStart(BaseModel):
    request_form_url: str


class CandidateCertificateRequest(BaseModel):
    notes: str | None = None


class CertificateMentorSubmit(BaseModel):
    internship_summary: str
    skills_acquired: list[str]
    mentor_notes: str | None = None


class CertificateGenerateRequest(BaseModel):
    template_used: str = "default-v1"
    certificate_pdf_url: str
    letterhead_pdf_url: str
    archive_copy_url: str


class CertificateIssueRequest(BaseModel):
    candidate_download_url: str
    candidate_email_sent_to: str


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referral_id: UUID
    status: str
    request_date: datetime | None = None
    request_form_url: str | None = None
    internship_summary: str | None = None
    skills_acquired: list[str] | None = None
    mentor_notes: str | None = None
    mentor_signature_date: datetime | None = None
    issued_date: datetime | None = None
    template_used: str | None = None
    certificate_pdf_url: str | None = None
    letterhead_pdf_url: str | None = None
    archive_copy_url: str | None = None
    candidate_download_url: str | None = None
    candidate_email_sent_to: str | None = None
    candidate_email_sent_at: datetime | None = None
    archived_url: str | None = None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
