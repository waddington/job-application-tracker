"""offers: pay and terms of an offer on an application

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-30 22:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import jat.db.types

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "offers",
        sa.Column("application_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("received_on", jat.db.types.ISODate(length=10), nullable=True),
        sa.Column("respond_by", jat.db.types.ISODate(length=10), nullable=True),
        sa.Column("start_on", jat.db.types.ISODate(length=10), nullable=True),
        sa.Column("employment_type", sa.String(length=20), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("salary", sa.Integer(), nullable=True),
        sa.Column("bonus", sa.Integer(), nullable=True),
        sa.Column("equity", sa.Text(), nullable=True),
        sa.Column("equity_value", sa.Integer(), nullable=True),
        sa.Column("pension_percent", sa.Float(), nullable=True),
        sa.Column("holiday_days", sa.Integer(), nullable=True),
        sa.Column("day_rate", sa.Integer(), nullable=True),
        sa.Column("ir35", sa.String(length=20), nullable=True),
        sa.Column("contract_months", sa.Integer(), nullable=True),
        sa.Column("benefits", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.Column("updated_at", jat.db.types.UTCDateTime(length=32), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_offers_application_id"), ["application_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_offers_respond_by"), ["respond_by"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_offers_respond_by"))
        batch_op.drop_index(batch_op.f("ix_offers_application_id"))
    op.drop_table("offers")
