"""create core internship tables

Revision ID: fc8bef691e6c
Revises: fc8bef691e6b
Create Date: 2026-05-19 10:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'fc8bef691e6c'
down_revision: Union[str, Sequence[str], None] = 'fc8bef691e6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create core internship tables."""
    
    # 1. CandidateProfile table
    op.create_table('candidate_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('education', sa.JSON(), nullable=True),  # Array of education records
        sa.Column('skills', sa.JSON(), nullable=True),  # Array of skills
        sa.Column('resume_url', sa.String(), nullable=True),  # S3/storage URL
        sa.Column('parsed_resume_data', sa.JSON(), nullable=True),  # AI parsed resume
        sa.Column('confidence_score', sa.Float(), nullable=True),  # AI parsing confidence (0-1)
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.UniqueConstraint('user_id')
    )
    
    # 2. Referrals table (core workflow table)
    op.create_table('referrals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referrer_id', postgresql.UUID(as_uuid=True), nullable=False),  # Employee who referred
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),  # Intern/candidate
        sa.Column('mentor_id', postgresql.UUID(as_uuid=True), nullable=False),  # Project mentor
        
        # Status & Stage tracking
        sa.Column('status', sa.String(), nullable=False),  # e.g., ACTIVE, CLOSED, REJECTED
        sa.Column('state', sa.String(), nullable=False),  # Workflow state: DRAFT, SUBMITTED, ELIGIBILITY_REVIEW, etc.
        
        # Eligibility flags
        sa.Column('unpaid_consent_confirmed', sa.Boolean(), default=False),
        sa.Column('in_person_ready_confirmed', sa.Boolean(), default=False),
        sa.Column('location_match_confirmed', sa.Boolean(), default=False),
        
        # Internship details
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('project_overview', sa.Text(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('relationship_to_mentor', sa.String(), nullable=True),  # "Team member", "Friend", etc.
        
        # Metadata
        sa.Column('metadata', sa.JSON(), nullable=True),  # Store additional data
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['candidate_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['mentor_id'], ['users.id'], ),
    )
    
    op.create_table('joining_forms',
    sa.Column('additional_data', sa.JSON(), nullable=True),  # Store additional data
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referral_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False),  # DRAFT, SUBMITTED, HR_REVIEW, APPROVED
        
        # Personal Information
        sa.Column('personal_details', sa.JSON(), nullable=True),  # name, email, dob, phone, etc.
        sa.Column('address', sa.JSON(), nullable=True),  # Full address object
        sa.Column('emergency_contact', sa.JSON(), nullable=True),  # Contact info
        
        # Employment/Education History
        sa.Column('education_history', sa.JSON(), nullable=True),  # Array of education records
        sa.Column('employment_history', sa.JSON(), nullable=True),  # Array of employment records
        
        # Government IDs & Documents
        sa.Column('government_ids', sa.JSON(), nullable=True),  # Multiple ID types + URLs
        
        # Declarations
        sa.Column('declarations_signed', sa.Boolean(), default=False),
        sa.Column('signature_date', sa.DateTime(), nullable=True),
        
        # HR tracking
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=True),  # Candidate ID
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),  # HR reviewer ID
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
    )
    
    # 4. NDADocuments table
    op.create_table('nda_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referral_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False),  # PENDING, SENT, SIGNED, EXPIRED, REJECTED
        
        # E-signature tracking
        sa.Column('esign_token', sa.String(), nullable=True),  # Token from e-sign provider
        sa.Column('esign_url', sa.String(), nullable=True),  # URL for candidate to sign
        sa.Column('esign_provider', sa.String(), nullable=True),  # "DocuSign", "Adobe Sign", etc.
        
        # Signature tracking
        sa.Column('signed_at', sa.DateTime(), nullable=True),
        sa.Column('signed_by', postgresql.UUID(as_uuid=True), nullable=True),  # User who signed
        
        # Document archival
        sa.Column('archived_url', sa.String(), nullable=True),  # S3/storage URL of signed PDF
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        
        # Metadata
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('template_version', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
        sa.ForeignKeyConstraint(['signed_by'], ['users.id'], ),
    )
    
    # 5. NonWorkerIDTasks table (HR tasks)
    op.create_table('non_worker_id_tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referral_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False),  # PENDING, IN_PROGRESS, COMPLETED, FAILED
        
        # Task assignment
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),  # HR person ID
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),  # Who created task
        
        # Generated ID & credentials
        sa.Column('generated_non_worker_id', sa.String(), nullable=True),
        sa.Column('credentials_token', sa.String(), nullable=True),  # OTP or magic link
        sa.Column('credentials_token_expiry', sa.DateTime(), nullable=True),
        
        # SLA & deadline tracking
        sa.Column('sla_deadline', sa.DateTime(), nullable=False),  # 1 business day from creation
        sa.Column('sla_breached', sa.Boolean(), default=False),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    )
    
    # 6. Certificates table
    op.create_table('certificates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referral_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False),  # PENDING, REQUEST_FORM_SENT, REQUESTED, GENERATED, ISSUED, ARCHIVED
        
        # Request tracking
        sa.Column('request_date', sa.DateTime(), nullable=True),
        sa.Column('request_form_url', sa.String(), nullable=True),
        
        # Certificate details (from mentor form)
        sa.Column('internship_summary', sa.Text(), nullable=True),
        sa.Column('skills_acquired', sa.JSON(), nullable=True),  # Array of skills
        sa.Column('mentor_notes', sa.Text(), nullable=True),
        sa.Column('mentor_signature_date', sa.DateTime(), nullable=True),
        
        # Generation & issuance
        sa.Column('issued_date', sa.DateTime(), nullable=True),
        sa.Column('template_used', sa.String(), nullable=True),  # Template version
        sa.Column('archived_url', sa.String(), nullable=True),  # S3/storage URL of final PDF
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        
        # Metadata
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
    )
    
    # 7. WorkflowEvents table (immutable audit log)
    op.create_table('workflow_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referral_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),  # REFERRAL_CREATED, ELIGIBILITY_PASSED, NDA_SIGNED, etc.
        
        # Event details
        sa.Column('triggered_by', postgresql.UUID(as_uuid=True), nullable=True),  # User who triggered event
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),  # Contextual data (before/after values, etc.)
        
        # Immutable timestamp (cannot update)
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
        sa.ForeignKeyConstraint(['triggered_by'], ['users.id'], ),
    )
    
    # 8. MentorAssignments table (tracking - may not be needed if captured in Referral)
    # Adding for clarity and potential future extensions
    op.create_table('mentor_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referral_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mentor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_date', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('assignment_status', sa.String(), nullable=False),  # ACTIVE, CLOSED
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ),
        sa.ForeignKeyConstraint(['mentor_id'], ['users.id'], ),
    )
    
    # Create indexes for common queries
    op.create_index('idx_referrals_referrer_id', 'referrals', ['referrer_id'])
    op.create_index('idx_referrals_candidate_id', 'referrals', ['candidate_id'])
    op.create_index('idx_referrals_mentor_id', 'referrals', ['mentor_id'])
    op.create_index('idx_referrals_state', 'referrals', ['state'])
    op.create_index('idx_referrals_status', 'referrals', ['status'])
    op.create_index('idx_joining_forms_referral_id', 'joining_forms', ['referral_id'])
    op.create_index('idx_non_worker_id_tasks_status', 'non_worker_id_tasks', ['status'])
    op.create_index('idx_non_worker_id_tasks_assigned_to', 'non_worker_id_tasks', ['assigned_to'])
    op.create_index('idx_workflow_events_referral_id', 'workflow_events', ['referral_id'])
    op.create_index('idx_workflow_events_event_type', 'workflow_events', ['event_type'])


def downgrade() -> None:
    """Downgrade schema - Drop all created tables."""
    op.drop_index('idx_workflow_events_event_type')
    op.drop_index('idx_workflow_events_referral_id')
    op.drop_index('idx_non_worker_id_tasks_assigned_to')
    op.drop_index('idx_non_worker_id_tasks_status')
    op.drop_index('idx_joining_forms_referral_id')
    op.drop_index('idx_referrals_status')
    op.drop_index('idx_referrals_state')
    op.drop_index('idx_referrals_mentor_id')
    op.drop_index('idx_referrals_candidate_id')
    op.drop_index('idx_referrals_referrer_id')
    
    op.drop_table('mentor_assignments')
    op.drop_table('workflow_events')
    op.drop_table('certificates')
    op.drop_table('non_worker_id_tasks')
    op.drop_table('nda_documents')
    op.drop_table('joining_forms')
    op.drop_table('referrals')
    op.drop_table('candidate_profiles')
