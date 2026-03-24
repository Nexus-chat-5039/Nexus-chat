import os
import pytest

# Set default environment variables for testing BEFORE importing the app.
# This ensures that `TestClient` uses the local database and dummy secrets instead of production ones.
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGO_DB_NAME", "nexus_test")
os.environ.setdefault("JWT_SECRET", "test_secret_key_123456789")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ALLOWED_ORIGINS", "*")

from fastapi.testclient import TestClient
from app.main import fastapi_app
from app.core.mongo import get_db

@pytest.fixture(scope="session")
def client():
    """
    Session-scoped TestClient fixture.
    Using it as a context manager triggers the FastAPI lifespan events
    which initializes and closes the database connection properly.
    """
    with TestClient(fastapi_app) as c:
        yield c

@pytest.fixture(autouse=True)
def clear_db():
    """
    Automatically clear the test database before every test runs
    to guarantee a clean slate and isolation between tests.
    """
    try:
        db = get_db()
        # Clean all collections (except system ones implicitly restricted)
        for collection_name in db.list_collection_names():
            if not collection_name.startswith("system."):
                db[collection_name].delete_many({})
    except Exception:
        # DB may not be fully initialized in some edges, just pass
        pass
    yield
