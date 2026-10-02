"""awaiting reply: when you replied and started waiting to hear back

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-02 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("applications", "contacts"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(sa.Column("awaiting_reply_since", jat.db.types.ISODate(length=10), nullable=True))


def downgrade() -> None:
    for table in ("applications", "contacts"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_column("awaiting_reply_since")
