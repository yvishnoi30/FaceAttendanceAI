
from backend.app.core.config import settings
from sqlalchemy import create_engine, text

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True
)

try:
    with engine.connect() as connection:
        database = connection.execute(
            text("SELECT current_database()")
        ).scalar()

        vector_version = connection.execute(
            text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        ).scalar()

        print("Database:", database)
        print("pgvector:", vector_version)

except Exception as error:
    print("Connection failed:", error)

finally:
    engine.dispose()
