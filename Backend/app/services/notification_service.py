from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.user_repository import UserRepository
from app.repositories.workflow_event_repository import WorkflowEventRepository


class NotificationService:
    @staticmethod
    def _queue_notifications(
        db: Session,
        referral_id: UUID,
        triggered_by: UUID | None,
        recipients: list[tuple[str, str, UUID]],
        template: str,
    ) -> None:
        seen_recipient_ids: set[str] = set()
        for role, email, recipient_id in recipients:
            recipient_key = str(recipient_id)
            if recipient_key in seen_recipient_ids:
                continue
            seen_recipient_ids.add(recipient_key)

            WorkflowEventRepository.create(
                db=db,
                referral_id=referral_id,
                event_type="NOTIFICATION_SENT",
                triggered_by=triggered_by,
                description=f"Notification queued for {role}",
                data={
                    "recipient_role": role,
                    "recipient_user_id": str(recipient_id),
                    "recipient_email": email,
                    "channel": "in_app",
                    "template": template,
                },
            )

    @staticmethod
    def notify_referral_submitted(db: Session, referral, triggered_by: UUID | None = None) -> None:
        recipients: list[tuple[str, str, UUID]] = []

        mentor = UserRepository.get_user_by_id(db, referral.mentor_id)
        if mentor:
            recipients.append(("mentor", mentor.email, cast(UUID, mentor.id)))

        admin_users = UserRepository.get_users_by_role(db, "admin")
        for admin in admin_users:
            recipients.append(("admin", admin.email, cast(UUID, admin.id)))

        NotificationService._queue_notifications(
            db=db,
            referral_id=cast(UUID, referral.id),
            triggered_by=triggered_by,
            recipients=recipients,
            template="referral_submitted",
        )

    @staticmethod
    def notify_admin_review_result(
        db: Session,
        referral,
        decision: str,
        triggered_by: UUID | None = None,
    ) -> None:
        recipients: list[tuple[str, str, UUID]] = []

        referrer = UserRepository.get_user_by_id(db, referral.referrer_id)
        if referrer:
            recipients.append(("referrer", referrer.email, cast(UUID, referrer.id)))

        if decision == "APPROVE":
            mentor = UserRepository.get_user_by_id(db, referral.mentor_id)
            if mentor:
                recipients.append(("mentor", mentor.email, cast(UUID, mentor.id)))

        NotificationService._queue_notifications(
            db=db,
            referral_id=cast(UUID, referral.id),
            triggered_by=triggered_by,
            recipients=recipients,
            template=f"admin_review_{decision.lower()}",
        )

    @staticmethod
    def notify_mentor_review_result(
        db: Session,
        referral,
        decision: str,
        triggered_by: UUID | None = None,
    ) -> None:
        recipients: list[tuple[str, str, UUID]] = []

        hr_users = UserRepository.get_users_by_role(db, "hr")
        for hr in hr_users:
            recipients.append(("hr", hr.email, cast(UUID, hr.id)))

        if decision == "APPROVE":
            candidate = UserRepository.get_user_by_id(db, referral.candidate_id)
            if candidate:
                recipients.append(("candidate", candidate.email, cast(UUID, candidate.id)))

        NotificationService._queue_notifications(
            db=db,
            referral_id=cast(UUID, referral.id),
            triggered_by=triggered_by,
            recipients=recipients,
            template=f"mentor_review_{decision.lower()}",
        )

    @staticmethod
    def notify_internship_activated(
        db: Session,
        referral,
        triggered_by: UUID | None = None,
    ) -> None:
        recipients: list[tuple[str, str, UUID]] = []

        candidate = UserRepository.get_user_by_id(db, referral.candidate_id)
        if candidate:
            recipients.append(("candidate", candidate.email, cast(UUID, candidate.id)))

        mentor = UserRepository.get_user_by_id(db, referral.mentor_id)
        if mentor:
            recipients.append(("mentor", mentor.email, cast(UUID, mentor.id)))

        referrer = UserRepository.get_user_by_id(db, referral.referrer_id)
        if referrer:
            recipients.append(("referrer", referrer.email, cast(UUID, referrer.id)))

        NotificationService._queue_notifications(
            db=db,
            referral_id=cast(UUID, referral.id),
            triggered_by=triggered_by,
            recipients=recipients,
            template="internship_activated",
        )

    @staticmethod
    def notify_certificate_issued(
        db: Session,
        referral,
        candidate_email: str,
        download_url: str,
        triggered_by: UUID | None = None,
    ) -> None:
        candidate = UserRepository.get_user_by_id(db, referral.candidate_id)
        if not candidate:
            return

        WorkflowEventRepository.create(
            db=db,
            referral_id=cast(UUID, referral.id),
            event_type="NOTIFICATION_SENT",
            triggered_by=triggered_by,
            description="Certificate email copy sent to candidate",
            data={
                "recipient_role": "candidate",
                "recipient_user_id": str(candidate.id),
                "recipient_email": candidate_email,
                "channel": "email",
                "template": "certificate_issued",
                "download_url": download_url,
            },
        )
