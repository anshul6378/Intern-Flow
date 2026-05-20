"""Repository for WorkflowEvent model - Immutable audit trail."""
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.models import WorkflowEvent, WORKFLOW_EVENT_TYPES


class WorkflowEventRepository:
    """Data access layer for WorkflowEvent model - Append-only audit log."""

    @staticmethod
    def create(
        db: Session,
        referral_id: UUID,
        event_type: str,
        triggered_by: Optional[UUID] = None,
        description: Optional[str] = None,
        data: Optional[dict] = None,
    ) -> WorkflowEvent:
        """Create a new workflow event (append-only).
        
        Args:
            db: Database session
            referral_id: UUID of referral
            event_type: Type of event (must be in WORKFLOW_EVENT_TYPES)
            triggered_by: UUID of user who triggered event
            description: Human-readable description
            data: Contextual data (before/after values, etc.)
        
        Returns:
            Created WorkflowEvent
        
        Raises:
            ValueError: If event_type is invalid
        """
        if event_type not in WORKFLOW_EVENT_TYPES:
            raise ValueError(f"Invalid event type: {event_type}")
        
        event = WorkflowEvent(
            referral_id=referral_id,
            event_type=event_type,
            triggered_by=triggered_by,
            description=description,
            data=data,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def get_by_id(db: Session, event_id: UUID) -> Optional[WorkflowEvent]:
        """Retrieve event by ID."""
        return db.query(WorkflowEvent).filter(WorkflowEvent.id == event_id).first()

    @staticmethod
    def get_by_referral_id(
        db: Session,
        referral_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[List[WorkflowEvent], int]:
        """Get all events for a referral (complete audit trail)."""
        query = db.query(WorkflowEvent).filter(WorkflowEvent.referral_id == referral_id)
        total = query.count()
        events = query.order_by(WorkflowEvent.timestamp.asc()).offset(skip).limit(limit).all()
        return events, total

    @staticmethod
    def get_by_event_type(
        db: Session,
        event_type: str,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[WorkflowEvent], int]:
        """Get all events of a specific type."""
        query = db.query(WorkflowEvent).filter(WorkflowEvent.event_type == event_type)
        total = query.count()
        events = query.order_by(WorkflowEvent.timestamp.desc()).offset(skip).limit(limit).all()
        return events, total

    @staticmethod
    def get_by_referral_and_type(
        db: Session,
        referral_id: UUID,
        event_type: str
    ) -> List[WorkflowEvent]:
        """Get all events of a specific type for a referral."""
        return db.query(WorkflowEvent).filter(
            WorkflowEvent.referral_id == referral_id,
            WorkflowEvent.event_type == event_type
        ).order_by(WorkflowEvent.timestamp.asc()).all()

    @staticmethod
    def get_recent_for_referral(db: Session, referral_id: UUID, limit: int = 10) -> List[WorkflowEvent]:
        """Get recent events for a referral."""
        return db.query(WorkflowEvent).filter(
            WorkflowEvent.referral_id == referral_id
        ).order_by(WorkflowEvent.timestamp.desc()).limit(limit).all()

    @staticmethod
    def get_events_since(
        db: Session,
        referral_id: UUID,
        since: datetime
    ) -> List[WorkflowEvent]:
        """Get all events for a referral since a specific timestamp."""
        return db.query(WorkflowEvent).filter(
            WorkflowEvent.referral_id == referral_id,
            WorkflowEvent.timestamp >= since
        ).order_by(WorkflowEvent.timestamp.asc()).all()

    @staticmethod
    def count_by_type_for_referral(db: Session, referral_id: UUID) -> dict:
        """Get count of each event type for a referral."""
        results = db.query(
            WorkflowEvent.event_type,
            db.func.count(WorkflowEvent.id)
        ).filter(
            WorkflowEvent.referral_id == referral_id
        ).group_by(WorkflowEvent.event_type).all()
        
        return {event_type: count for event_type, count in results}

    @staticmethod
    def get_audit_report(
        db: Session,
        referral_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[WorkflowEvent]:
        """Generate audit report for compliance."""
        query = db.query(WorkflowEvent).filter(WorkflowEvent.referral_id == referral_id)
        
        if start_date:
            query = query.filter(WorkflowEvent.timestamp >= start_date)
        if end_date:
            query = query.filter(WorkflowEvent.timestamp <= end_date)
        
        return query.order_by(WorkflowEvent.timestamp.asc()).all()

    # Note: No update or delete methods - audit log is append-only!
    # Events are immutable for compliance and audit requirements.

    @staticmethod
    def get_timeline_summary(db: Session, referral_id: UUID) -> List[dict]:
        """Get human-readable timeline summary."""
        events, _ = WorkflowEventRepository.get_by_referral_id(db, referral_id, limit=1000)
        
        timeline = []
        for event in events:
            timeline.append({
                "timestamp": event.timestamp,
                "event_type": event.event_type,
                "description": event.description or WORKFLOW_EVENT_TYPES.get(event.event_type, "Unknown"),
                "triggered_by": str(event.triggered_by) if event.triggered_by else "System",
            })
        
        return timeline
