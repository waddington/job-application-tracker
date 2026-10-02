"""role decisions: where a role came from (person, call) and whether you passed on it

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-02 20:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("roles", schema=None) as batch_op:
        batch_op.add_column(sa.Column("contact_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("meeting_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("decision", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("decision_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("decided_on", jat.db.types.ISODate(length=10), nullable=True))
        batch_op.create_index(batch_op.f("ix_roles_contact_id"), ["contact_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_roles_meeting_id"), ["meeting_id"], unique=False)
        batch_op.create_foreign_key("fk_roles_contact_id", "contacts", ["contact_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    with op.batch_alter_table("roles", schema=None) as batch_op:
        batch_op.drop_constraint("fk_roles_contact_id", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_roles_meeting_id"))
        batch_op.drop_index(batch_op.f("ix_roles_contact_id"))
        batch_op.drop_column("decided_on")
        batch_op.drop_column("decision_reason")
        batch_op.drop_column("decision")
        batch_op.drop_column("meeting_id")
        batch_op.drop_column("contact_id")
