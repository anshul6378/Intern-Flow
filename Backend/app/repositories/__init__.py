"""Repositories - Data access layer."""
from app.repositories.referral_repository import ReferralRepository
from app.repositories.candidate_repository import CandidateProfileRepository
from app.repositories.joining_form_repository import JoiningFormRepository
from app.repositories.nda_repository import NDADocumentRepository
from app.repositories.non_worker_id_repository import NonWorkerIDTaskRepository
from app.repositories.certificate_repository import CertificateRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository
from app.repositories.mentor_assignment_repository import MentorAssignmentRepository

__all__ = [
    "ReferralRepository",
    "CandidateProfileRepository",
    "JoiningFormRepository",
    "NDADocumentRepository",
    "NonWorkerIDTaskRepository",
    "CertificateRepository",
    "WorkflowEventRepository",
    "MentorAssignmentRepository",
]
