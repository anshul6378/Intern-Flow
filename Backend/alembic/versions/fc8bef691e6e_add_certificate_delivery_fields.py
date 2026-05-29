"""add certificate generation and delivery fields

Revision ID: fc8bef691e6e
Revises: fc8bef691e6d
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc8bef691e6e'
down_revision: Union[str, Sequence[str], None] = 'fc8bef691e6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('certificates', sa.Column('certificate_pdf_url', sa.String(), nullable=True))
    op.add_column('certificates', sa.Column('letterhead_pdf_url', sa.String(), nullable=True))
    op.add_column('certificates', sa.Column('archive_copy_url', sa.String(), nullable=True))
    op.add_column('certificates', sa.Column('candidate_download_url', sa.String(), nullable=True))
    op.add_column('certificates', sa.Column('candidate_email_sent_to', sa.String(), nullable=True))
    op.add_column('certificates', sa.Column('candidate_email_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('certificates', 'candidate_email_sent_at')
    op.drop_column('certificates', 'candidate_email_sent_to')
    op.drop_column('certificates', 'candidate_download_url')
    op.drop_column('certificates', 'archive_copy_url')
    op.drop_column('certificates', 'letterhead_pdf_url')
    op.drop_column('certificates', 'certificate_pdf_url')
