"""event seq: explicit recording order for events

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-30 18:17:59
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("events", schema=None) as batch_op:
        batch_op.add_column(sa.Column("seq", sa.Integer(), nullable=True))
    # Existing rows keep the order they were inserted in.
    op.execute("UPDATE events SET seq = (SELECT COUNT(*) FROM events AS e2 WHERE e2.rowid <= events.rowid)")
    with op.batch_alter_table("events", schema=None) as batch_op:
        batch_op.alter_column("seq", existing_type=sa.Integer(), nullable=False)
        batch_op.create_unique_constraint("uq_events_seq", ["seq"])


def downgrade() -> None:
    with op.batch_alter_table("events", schema=None) as batch_op:
        batch_op.drop_constraint("uq_events_seq", type_="unique")
        batch_op.drop_column("seq")
