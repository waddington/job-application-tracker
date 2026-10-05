"""reply to read: they've replied and you haven't read it properly yet

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-05 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("applications", "contacts"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(sa.Column("reply_to_read_since", jat.db.types.ISODate(length=10), nullable=True))


def downgrade() -> None:
    for table in ("applications", "contacts"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_column("reply_to_read_since")
