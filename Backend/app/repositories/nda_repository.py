"""Repository for NDADocument model."""
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.models import NDADocument, NDA_STATUS


class NDADocumentRepository:
    """Data access layer for NDADocument model."""

    @staticmethod
    def create(
        db: Session,
        referral_id: UUID,
        **kwargs
    ) -> NDADocument:
        """Create a new NDA document."""
        nda = NDADocument(referral_id=referral_id, **kwargs)
        db.add(nda)
        db.commit()
        db.refresh(nda)
        return nda

    @staticmethod
    def get_by_id(db: Session, nda_id: UUID) -> Optional[NDADocument]:
        """Retrieve NDA by ID."""
        return db.query(NDADocument).filter(NDADocument.id == nda_id).first()

    @staticmethod
    def get_by_referral_id(db: Session, referral_id: UUID) -> Optional[NDADocument]:
        """Retrieve NDA by referral ID."""
        return db.query(NDADocument).filter(NDADocument.referral_id == referral_id).first()

    @staticmethod
    def get_by_status(db: Session, status: str) -> List[NDADocument]:
        """Get all NDAs with a specific status."""
        return db.query(NDADocument).filter(NDADocument.status == status).all()

    @staticmethod
    def update(db: Session, nda_id: UUID, **updates) -> Optional[NDADocument]:
        """Update an NDA document."""
        nda = NDADocumentRepository.get_by_id(db, nda_id)
        if not nda:
            return None
        
        for key, value in updates.items():
            if hasattr(nda, key):
                setattr(nda, key, value)
        
        nda.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(nda)
        return nda

    @staticmethod
    def mark_sent(
        db: Session,
        referral_id: UUID,
        esign_token: str,
        esign_url: str,
        esign_provider: str,
        expires_at: datetime
    ) -> Optional[NDADocument]:
        """Mark NDA as sent for e-signature."""
        query = db.query(NDADocument).filter(NDADocument.referral_id == referral_id)
        nda = query.first()
        
        if not nda:
            # Create new NDA if not exists
            nda = NDADocumentRepository.create(
                db,
                referral_id=referral_id,
                status="SENT",
                esign_token=esign_token,
                esign_url=esign_url,
                esign_provider=esign_provider,
                expires_at=expires_at
            )
            return nda
        
        return NDADocumentRepository.update(
            db,
            nda.id,
            status="SENT",
            esign_token=esign_token,
            esign_url=esign_url,
            esign_provider=esign_provider,
            expires_at=expires_at
        )

    @staticmethod
    def mark_signed(
        db: Session,
        nda_id: UUID,
        signed_by: UUID,
        archived_url: str
    ) -> Optional[NDADocument]:
        """Mark NDA signed copy as uploaded by candidate."""
        return NDADocumentRepository.update(
            db,
            nda_id,
            status="UPLOADED",
            signed_at=datetime.utcnow(),
            signed_by=signed_by,
            archived_url=archived_url,
            archived_at=datetime.utcnow()
        )

    @staticmethod
    def mark_completed(
        db: Session,
        nda_id: UUID,
    ) -> Optional[NDADocument]:
        """Mark NDA as HR-approved and complete."""
        return NDADocumentRepository.update(
            db,
            nda_id,
            status="COMPLETED",
        )

    @staticmethod
    def delete(db: Session, nda_id: UUID) -> bool:
        """Delete an NDA document."""
        nda = NDADocumentRepository.get_by_id(db, nda_id)
        if not nda:
            return False
        
        db.delete(nda)
        db.commit()
        return True
