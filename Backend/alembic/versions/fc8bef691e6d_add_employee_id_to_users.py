"""add employee_id to users table

Revision ID: fc8bef691e6d
Revises: fc8bef691e6c
Create Date: 2026-05-26 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc8bef691e6d'
down_revision: Union[str, Sequence[str], None] = 'fc8bef691e6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('employee_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_users_employee_id', 'users', ['employee_id'])


def downgrade() -> None:
    op.drop_constraint('uq_users_employee_id', 'users', type_='unique')
    op.drop_column('users', 'employee_id')
