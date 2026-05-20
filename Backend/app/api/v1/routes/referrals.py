from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User
from app.schemas.referral import (
    EligibilityCheckRequest,
    ReferralCreate,
    ReferralListResponse,
    ReferralResponse,
    ReferralTimelineResponse,
    ReferralStateTransitionRequest,
    ReferralUpdate,
    WorkflowEventResponse,
)
from app.services.referral_service import ReferralService

router = APIRouter(prefix="/referrals", tags=["Referrals"])


def _serialize_referral(referral) -> ReferralResponse:
    return ReferralResponse.model_validate(referral)


def _serialize_event(event) -> WorkflowEventResponse:
    return WorkflowEventResponse.model_validate(event)


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
    return ReferralListResponse(
        items=[_serialize_referral(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


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
