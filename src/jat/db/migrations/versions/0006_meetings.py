"""meetings: calls and meetings with people, booked or had, not tied to an application

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-02 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meetings",
        sa.Column("contact_id", sa.String(length=36), nullable=False),
        sa.Column("application_id", sa.String(length=36), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("starts_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.Column("ends_at", jat.db.types.UTCDateTime(length=32), nullable=True),
        sa.Column("location", sa.String(length=300), nullable=True),
        sa.Column("meeting_url", sa.String(length=1000), nullable=True),
        sa.Column("agenda", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.Column("updated_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("meetings", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_meetings_application_id"), ["application_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_meetings_contact_id"), ["contact_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_meetings_starts_at"), ["starts_at"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("meetings", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_meetings_starts_at"))
        batch_op.drop_index(batch_op.f("ix_meetings_contact_id"))
        batch_op.drop_index(batch_op.f("ix_meetings_application_id"))
    op.drop_table("meetings")
