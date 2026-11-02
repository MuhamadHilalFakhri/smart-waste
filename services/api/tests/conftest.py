import os

os.environ.setdefault("JWT_SECRET", "test-only-signing-key-with-more-than-32-chars")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from smart_waste.config import settings
from smart_waste.database import Base, get_db
from smart_waste.main import app
from smart_waste.inference import classifier
from smart_waste.models import User
from smart_waste.security import attempts, hasher


@pytest.fixture
def environment(tmp_path):
    url = os.getenv("TEST_DATABASE_URL", "sqlite://")
    engine = create_engine(
        url,
        **(
            {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
            if url.startswith("sqlite")
            else {}
        ),
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    settings().storage_dir = tmp_path / "media"
    classifier.model = None
    attempts.clear()

    def db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = db
    with factory() as session:
        admin = User(
            name="Admin",
            email="admin@example.com",
            role="admin",
            password_hash=hasher.hash("AdminPassword123"),
        )
        session.add(admin)
        session.commit()
    yield factory
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(environment):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth(client):
    def register(email="user@example.com"):
        result = client.post(
            "/api/v1/auth/register",
            json={"name": "Pelapor", "email": email, "password": "StrongPassword123"},
            headers={"X-Client-Type": "mobile"},
        )
        assert result.status_code == 201, result.text
        return result.json()

    return register


@pytest.fixture
def admin(client):
    result = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword123"},
        headers={"X-Client-Type": "mobile"},
    )
    assert result.status_code == 200
    return {"Authorization": f"Bearer {result.json()['access_token']}"}
