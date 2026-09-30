"""interview rounds: a round number and a free-text description per interview

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-30 19:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("interviews", schema=None) as batch_op:
        batch_op.add_column(sa.Column("round", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("title", sa.String(length=200), nullable=True))
    # Number any existing interviews per application, in the order they happen(ed).
    op.execute(
        """
        UPDATE interviews SET round = (
            SELECT COUNT(*) FROM interviews AS i2
            WHERE i2.application_id = interviews.application_id
              AND (COALESCE(i2.starts_at, i2.deadline_at, i2.created_at), i2.id)
                  <= (COALESCE(interviews.starts_at, interviews.deadline_at, interviews.created_at), interviews.id)
        )
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("interviews", schema=None) as batch_op:
        batch_op.drop_column("title")
        batch_op.drop_column("round")
