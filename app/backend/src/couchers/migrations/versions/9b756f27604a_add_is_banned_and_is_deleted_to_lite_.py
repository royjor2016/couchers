"""Add is_banned and is_deleted to lite_users

Revision ID: 9b756f27604a
Revises: 0613ce600e4b
Create Date: 2025-08-08 06:43:29.845840

"""

from alembic import op
from sqlalchemy.dialects import postgresql

from couchers.materialized_views import make_lite_users_selectable

# revision identifiers, used by Alembic.
revision = "9b756f27604a"
down_revision = "8c878b177151"
branch_labels = None
depends_on = None


def _sql():
    sel = make_lite_users_selectable(create=True)
    return str(sel.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def upgrade():
    op.execute("DROP MATERIALIZED VIEW IF EXISTS lite_users CASCADE")
    op.execute(f"CREATE MATERIALIZED VIEW lite_users AS {_sql()} WITH NO DATA")
    op.execute("CREATE UNIQUE INDEX uq_lite_users_id ON lite_users (id)")
    op.execute("CREATE INDEX ix_lite_users_id_visible ON lite_users USING hash (id) WHERE is_visible")
    op.execute("CREATE INDEX ix_lite_users_username_visible ON lite_users USING hash (username) WHERE is_visible")
    op.execute("CREATE INDEX idx_lite_users_geom ON lite_users USING gist (geom)")


def downgrade():
    op.execute("DROP MATERIALIZED VIEW IF EXISTS lite_users CASCADE")
    op.execute(f"CREATE MATERIALIZED VIEW lite_users AS {_sql()} WITH NO DATA")
    op.execute("CREATE UNIQUE INDEX uq_lite_users_id ON lite_users (id)")
    op.execute("CREATE INDEX ix_lite_users_id_visible ON lite_users USING hash (id) WHERE is_visible")
    op.execute("CREATE INDEX ix_lite_users_username_visible ON lite_users USING hash (username) WHERE is_visible")
    op.execute("CREATE INDEX idx_lite_users_geom ON lite_users USING gist (geom)")
