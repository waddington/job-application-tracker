"""todos: your own to-dos, on their own or about a company, person, role or application

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-02 23:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "todos",
        sa.Column("text", sa.String(length=500), nullable=False),
        sa.Column("due_on", jat.db.types.ISODate(length=10), nullable=True),
        sa.Column("done_at", jat.db.types.UTCDateTime(length=32), nullable=True),
        sa.Column("entity_type", sa.String(length=20), nullable=True),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.Column("updated_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_todos_done_at"), ["done_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_todos_due_on"), ["due_on"], unique=False)
        batch_op.create_index(batch_op.f("ix_todos_entity_id"), ["entity_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_todos_entity_id"))
        batch_op.drop_index(batch_op.f("ix_todos_due_on"))
        batch_op.drop_index(batch_op.f("ix_todos_done_at"))
    op.drop_table("todos")
