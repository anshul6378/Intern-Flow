"""extend users table with department, manager_id, and timestamps

Revision ID: fc8bef691e6b
Revises: fc8bef691e6a
Create Date: 2026-05-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'fc8bef691e6b'
down_revision: Union[str, Sequence[str], None] = 'fc8bef691e6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add new columns to users table."""
    # Add timestamp columns
    op.add_column('users', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    
    # Add department and manager_id
    op.add_column('users', sa.Column('department', sa.String(), nullable=True))
    op.add_column('users', sa.Column('manager_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add foreign key for manager_id (self-referencing)
    op.create_foreign_key('fk_users_manager_id', 'users', 'users', ['manager_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema - Revert users table changes."""
    op.drop_constraint('fk_users_manager_id', 'users', type_='foreignkey')
    op.drop_column('users', 'manager_id')
    op.drop_column('users', 'department')
    op.drop_column('users', 'updated_at')
    op.drop_column('users', 'created_at')
