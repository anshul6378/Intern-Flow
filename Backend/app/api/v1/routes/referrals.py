from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User
from app.schemas.referral import (
    AdminReferralReviewRequest,
    EligibilityCheckRequest,
    HRExtensionReviewRequest,
    HRClosureReviewRequest,
    MentorCompleteInternshipRequest,
    MentorExtensionRequest,
    MentorRemarkRequest,
    MentorReferralReviewRequest,
    ReferralActivateRequest,
    ReferralCreate,
    ReferralHoldRequest,
    ReferralListResponse,
    ReferralReassignMentorRequest,
    ResumeParseResponse,
    ReferralResponse,
    ReferralTimelineResponse,
    ReferralStateTransitionRequest,
    ReferralUnholdRequest,
    ReferralUpdate,
    WorkflowEventResponse,
)
from app.services.referral_service import ReferralService

router = APIRouter(prefix="/referrals", tags=["Referrals"])


def _serialize_referral(referral) -> ReferralResponse:
    return ReferralResponse.model_validate(referral)


def _serialize_event(event) -> WorkflowEventResponse:
    return WorkflowEventResponse.model_validate(event)


def _list_response(items, total: int, skip: int, limit: int) -> ReferralListResponse:
    return ReferralListResponse(
        items=[_serialize_referral(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ReferralResponse, status_code=status.HTTP_201_CREATED)
def create_referral(
    payload: ReferralCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("referrer", "admin")),
):
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        referral = ReferralService.create_referral(db=db, payload=payload, referrer_id=current_user_id, triggered_by=current_user_id)
        referral_referrer_id = cast(UUID, referral.referrer_id)
        if current_user_role == "referrer" and referral_referrer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only create referrals for yourself")
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/parse-resume", response_model=ResumeParseResponse)
async def parse_resume(
    resume: UploadFile = File(...),
    current_user: User = Depends(require_roles("referrer", "admin")),
):
    try:
        _ = current_user
        parsed = await ReferralService.parse_resume_upload(resume)
        return ResumeParseResponse.model_validate(parsed)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=ReferralListResponse)
def list_referrals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    state: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    referrer_id: UUID | None = None,
    mentor_id: UUID | None = None,
):
    current_user_id = cast(UUID, current_user.id)
    current_user_role = cast(str, current_user.role)
    if current_user_role == "referrer":
        referrer_id = current_user_id

    filters = {
        key: value
        for key, value in {
            "state": state,
            "status": status_filter,
            "referrer_id": referrer_id,
            "mentor_id": mentor_id,
        }.items()
        if value is not None
    }

    items, total = ReferralService.list_referrals(db=db, filters=filters, skip=skip, limit=limit)
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/admin/review-queue", response_model=ReferralListResponse)
def list_admin_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    _ = current_user
    items, total = ReferralService.list_referrals(
        db=db,
        filters={
            "state": "SUBMITTED",
            "status": "ACTIVE",
        },
        skip=skip,
        limit=limit,
    )
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/me/candidate", response_model=ReferralListResponse)
def list_my_candidate_referrals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("candidate", "admin")),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    current_user_id = cast(UUID, current_user.id)
    current_user_role = cast(str, current_user.role)
    if current_user_role == "admin":
        items, total = ReferralService.list_referrals(db=db, filters=None, skip=skip, limit=limit)
        return _list_response(items=items, total=total, skip=skip, limit=limit)

    items, total = ReferralService.list_my_candidate_referrals(
        db=db,
        candidate_id=current_user_id,
        skip=skip,
        limit=limit,
    )
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/me/mentor", response_model=ReferralListResponse)
def list_my_mentor_referrals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("mentor", "admin")),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    state: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
):
    current_user_id = cast(UUID, current_user.id)
    current_user_role = cast(str, current_user.role)
    if current_user_role == "admin":
        filters = {
            key: value
            for key, value in {
                "state": state,
                "status": status_filter,
            }.items()
            if value is not None
        }
        items, total = ReferralService.list_referrals(db=db, filters=filters, skip=skip, limit=limit)
        return _list_response(items=items, total=total, skip=skip, limit=limit)

    items, total = ReferralService.list_my_mentor_referrals(
        db=db,
        mentor_id=current_user_id,
        skip=skip,
        limit=limit,
        state=state,
        status_filter=status_filter,
    )
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/me/referrer", response_model=ReferralListResponse)
def list_my_referrer_referrals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("referrer", "admin")),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    state: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
):
    current_user_id = cast(UUID, current_user.id)
    current_user_role = cast(str, current_user.role)
    if current_user_role == "admin":
        filters = {
            key: value
            for key, value in {
                "state": state,
                "status": status_filter,
            }.items()
            if value is not None
        }
        items, total = ReferralService.list_referrals(db=db, filters=filters, skip=skip, limit=limit)
        return _list_response(items=items, total=total, skip=skip, limit=limit)

    items, total = ReferralService.list_my_referrer_referrals(
        db=db,
        referrer_id=current_user_id,
        skip=skip,
        limit=limit,
        state=state,
        status_filter=status_filter,
    )
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/hr/queue", response_model=ReferralListResponse)
def list_hr_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    current_user_role = cast(str, current_user.role)
    if current_user_role == "admin":
        items, total = ReferralService.list_referrals(db=db, filters=None, skip=skip, limit=limit)
        return _list_response(items=items, total=total, skip=skip, limit=limit)

    items, total = ReferralService.list_hr_queue(db=db, skip=skip, limit=limit)
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/hr/extension-requests", response_model=ReferralListResponse)
def list_hr_extension_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    _ = current_user
    items, total = ReferralService.list_pending_extension_requests(db=db, skip=skip, limit=limit)
    return _list_response(items=items, total=total, skip=skip, limit=limit)


@router.get("/{referral_id}", response_model=ReferralResponse)
def get_referral(referral_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        referral = ReferralService.get_referral(db=db, referral_id=referral_id)
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        referral_referrer_id = cast(UUID, referral.referrer_id)
        if current_user_role == "referrer" and referral_referrer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own referrals")
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{referral_id}", response_model=ReferralResponse)
def update_referral(
    referral_id: UUID,
    payload: ReferralUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("referrer", "admin")),
):
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        referral = ReferralService.update_referral(db=db, referral_id=referral_id, payload=payload, triggered_by=current_user_id)
        referral_referrer_id = cast(UUID, referral.referrer_id)
        if current_user_role == "referrer" and referral_referrer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own referrals")
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/{referral_id}/eligibility", response_model=ReferralResponse)
def submit_eligibility_check(
    referral_id: UUID,
    payload: EligibilityCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("referrer", "admin")),
):
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        referral = ReferralService.submit_eligibility_check(
            db=db,
            referral_id=referral_id,
            payload=payload,
            triggered_by=current_user_id,
        )
        referral_referrer_id = cast(UUID, referral.referrer_id)
        if current_user_role == "referrer" and referral_referrer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own referrals")
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/{referral_id}/state", response_model=ReferralResponse)
def transition_referral_state(
    referral_id: UUID,
    payload: ReferralStateTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("referrer", "admin")),
):
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        referral = ReferralService.transition_state(
            db=db,
            referral_id=referral_id,
            payload=payload,
            triggered_by=current_user_id,
        )
        referral_referrer_id = cast(UUID, referral.referrer_id)
        if current_user_role == "referrer" and referral_referrer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own referrals")
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/admin-review", response_model=ReferralResponse)
def review_referral_as_admin(
    referral_id: UUID,
    payload: AdminReferralReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    try:
        referral = ReferralService.admin_review_referral(
            db=db,
            referral_id=referral_id,
            decision=payload.decision,
            notes=payload.notes,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/mentor-review", response_model=ReferralResponse)
def review_referral_as_mentor(
    referral_id: UUID,
    payload: MentorReferralReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("mentor", "admin")),
):
    try:
        referral = ReferralService.mentor_review_referral(
            db=db,
            referral_id=referral_id,
            decision=payload.decision,
            notes=payload.notes,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/mentor-remarks", response_model=ReferralResponse)
def add_mentor_remarks(
    referral_id: UUID,
    payload: MentorRemarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("mentor", "admin")),
):
    try:
        referral = ReferralService.add_mentor_remark(
            db=db,
            referral_id=referral_id,
            remarks=payload.remarks,
            progress_status=payload.progress_status,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/extension-request", response_model=ReferralResponse)
def request_extension(
    referral_id: UUID,
    payload: MentorExtensionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("mentor", "admin")),
):
    try:
        referral = ReferralService.request_extension(
            db=db,
            referral_id=referral_id,
            new_end_date=payload.new_end_date,
            reason=payload.reason,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/extension-review", response_model=ReferralResponse)
def review_extension(
    referral_id: UUID,
    payload: HRExtensionReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    try:
        referral = ReferralService.review_extension_request(
            db=db,
            referral_id=referral_id,
            decision=payload.decision,
            notes=payload.notes,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/mentor-complete", response_model=ReferralResponse)
def mark_internship_complete(
    referral_id: UUID,
    payload: MentorCompleteInternshipRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("mentor", "admin")),
):
    try:
        referral = ReferralService.mark_internship_complete(
            db=db,
            referral_id=referral_id,
            internship_participation=payload.internship_participation,
            project_completion=payload.project_completion,
            notes=payload.notes,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/closure-review", response_model=ReferralResponse)
def review_closure(
    referral_id: UUID,
    payload: HRClosureReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    try:
        referral = ReferralService.hr_closure_review(
            db=db,
            referral_id=referral_id,
            decision=payload.decision,
            notes=payload.notes,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/reassign-mentor", response_model=ReferralResponse)
def reassign_referral_mentor(
    referral_id: UUID,
    payload: ReferralReassignMentorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin", "program_owner")),
):
    try:
        referral = ReferralService.reassign_mentor(
            db=db,
            referral_id=referral_id,
            mentor_email=payload.mentor_email,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
            notes=payload.notes,
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/hold", response_model=ReferralResponse)
def hold_referral(
    referral_id: UUID,
    payload: ReferralHoldRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin", "program_owner")),
):
    try:
        referral = ReferralService.hold_referral(
            db=db,
            referral_id=referral_id,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
            reason=payload.reason,
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/unhold", response_model=ReferralResponse)
def unhold_referral(
    referral_id: UUID,
    payload: ReferralUnholdRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin", "program_owner")),
):
    try:
        referral = ReferralService.unhold_referral(
            db=db,
            referral_id=referral_id,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
            reason=payload.reason,
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{referral_id}/activate", response_model=ReferralResponse)
def activate_internship(
    referral_id: UUID,
    payload: ReferralActivateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hr", "admin")),
):
    try:
        referral = ReferralService.activate_internship(
            db=db,
            referral_id=referral_id,
            triggered_by=cast(UUID, current_user.id),
            triggered_by_role=cast(str, current_user.role),
            notes=payload.notes,
        )
        return _serialize_referral(referral)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{referral_id}/timeline", response_model=ReferralTimelineResponse)
def get_timeline(referral_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        current_user_id = cast(UUID, current_user.id)
        current_user_role = cast(str, current_user.role)
        referral = ReferralService.get_referral(db=db, referral_id=referral_id)
        referral_referrer_id = cast(UUID, referral.referrer_id)
        if current_user_role == "referrer" and referral_referrer_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own referral timeline")
        events, total = ReferralService.get_timeline(db=db, referral_id=referral_id)
        return ReferralTimelineResponse(
            referral_id=referral_id,
            events=[_serialize_event(event) for event in events],
            total=total,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
