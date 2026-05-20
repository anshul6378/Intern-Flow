"""Repository for Certificate model."""
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.models import Certificate, CERTIFICATE_STATUS


class CertificateRepository:
    """Data access layer for Certificate model."""

    @staticmethod
    def create(
        db: Session,
        referral_id: UUID,
        **kwargs
    ) -> Certificate:
        """Create a new certificate."""
        cert = Certificate(referral_id=referral_id, **kwargs)
        db.add(cert)
        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def get_by_id(db: Session, cert_id: UUID) -> Optional[Certificate]:
        """Retrieve certificate by ID."""
        return db.query(Certificate).filter(Certificate.id == cert_id).first()

    @staticmethod
    def get_by_referral_id(db: Session, referral_id: UUID) -> Optional[Certificate]:
        """Retrieve certificate by referral ID."""
        return db.query(Certificate).filter(Certificate.referral_id == referral_id).first()

    @staticmethod
    def get_by_status(db: Session, status: str) -> List[Certificate]:
        """Get all certificates with a specific status."""
        return db.query(Certificate).filter(Certificate.status == status).all()

    @staticmethod
    def update(db: Session, cert_id: UUID, **updates) -> Optional[Certificate]:
        """Update a certificate."""
        cert = CertificateRepository.get_by_id(db, cert_id)
        if not cert:
            return None
        
        for key, value in updates.items():
            if hasattr(cert, key):
                setattr(cert, key, value)
        
        cert.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def request_certificate(
        db: Session,
        referral_id: UUID,
        request_form_url: str
    ) -> Optional[Certificate]:
        """Create certificate request."""
        cert = CertificateRepository.get_by_referral_id(db, referral_id)
        
        if cert:
            # Update existing
            return CertificateRepository.update(
                db,
                cert.id,
                status="REQUEST_FORM_SENT",
                request_date=datetime.utcnow(),
                request_form_url=request_form_url
            )
        else:
            # Create new
            return CertificateRepository.create(
                db,
                referral_id,
                status="REQUEST_FORM_SENT",
                request_date=datetime.utcnow(),
                request_form_url=request_form_url
            )

    @staticmethod
    def mark_requested(
        db: Session,
        cert_id: UUID,
        internship_summary: str,
        skills_acquired: list,
        mentor_notes: Optional[str] = None
    ) -> Optional[Certificate]:
        """Mark certificate as requested (mentor form submitted)."""
        return CertificateRepository.update(
            db,
            cert_id,
            status="REQUESTED",
            internship_summary=internship_summary,
            skills_acquired=skills_acquired,
            mentor_notes=mentor_notes,
            mentor_signature_date=datetime.utcnow()
        )

    @staticmethod
    def mark_generated(
        db: Session,
        cert_id: UUID,
        template_used: str,
        archived_url: str
    ) -> Optional[Certificate]:
        """Mark certificate as generated."""
        return CertificateRepository.update(
            db,
            cert_id,
            status="GENERATED",
            template_used=template_used,
            archived_url=archived_url,
            archived_at=datetime.utcnow(),
            issued_date=datetime.utcnow()
        )

    @staticmethod
    def mark_issued(db: Session, cert_id: UUID) -> Optional[Certificate]:
        """Mark certificate as issued."""
        return CertificateRepository.update(
            db,
            cert_id,
            status="ISSUED"
        )

    @staticmethod
    def delete(db: Session, cert_id: UUID) -> bool:
        """Delete a certificate."""
        cert = CertificateRepository.get_by_id(db, cert_id)
        if not cert:
            return False
        
        db.delete(cert)
        db.commit()
        return True
