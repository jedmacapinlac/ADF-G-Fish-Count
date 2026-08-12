from sqlalchemy import create_engine, text

from . import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=0,     
    pool_pre_ping=True,
)


def ping() -> bool:
    """True if the database answers. Cheap enough for a health endpoint."""
    with engine.connect() as conn:
        return conn.execute(text("SELECT 1")).scalar() == 1