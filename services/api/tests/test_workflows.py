import io

import pytest
from PIL import Image


def headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def photo():
    stream = io.BytesIO()
    Image.new("RGB", (64, 48), "green").save(stream, "JPEG")
    return ("sample.jpg", stream.getvalue(), "image/jpeg")


def create(client, token, **values):
    return client.post(
        "/api/v1/reports",
        headers=token,
        files={"photo": photo()},
        data={
            "description": "Sampah di dekat taman kota",
            "category": "organic",
            "latitude": "-6.2",
            "longitude": "106.8",
            "accuracy": "12",
            **values,
        },
    )


def test_registration_never_grants_admin(client):
    r = client.post(
        "/api/v1/auth/register",
        headers={"X-Client-Type": "mobile"},
        json={
            "name": "Public User",
            "email": "self@example.com",
            "password": "SecurePassword123",
            "role": "admin",
        },
    )
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "user"
    assert "password_hash" not in r.json()["user"]


def test_duplicates_and_password_validation(client, auth):
    auth()
    r = client.post(
        "/api/v1/auth/register",
        json={"name": "Someone", "email": "user@example.com", "password": "StrongPassword123"},
    )
    assert r.status_code == 409
    r = client.post(
        "/api/v1/auth/register",
        json={"name": "Someone", "email": "other@example.com", "password": "short"},
    )
    assert r.status_code == 422
    assert "short" not in r.text


def test_refresh_rotation_replay_revokes_session(client, auth):
    session = auth()
    r = client.post(
        "/api/v1/auth/refresh",
        headers={"X-Client-Type": "mobile"},
        json={"refresh_token": session["refresh_token"]},
    )
    assert r.status_code == 200
    assert r.json()["refresh_token"] != session["refresh_token"]
    replay = client.post(
        "/api/v1/auth/refresh",
        headers={"X-Client-Type": "mobile"},
        json={"refresh_token": session["refresh_token"]},
    )
    assert replay.status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers(r.json())).status_code == 401


def test_logout_revokes_access(client, auth):
    session = auth()
    assert (
        client.post(
            "/api/v1/auth/logout",
            headers={"X-Client-Type": "mobile"},
            json={"refresh_token": session["refresh_token"]},
        ).status_code
        == 204
    )
    assert client.get("/api/v1/auth/me", headers=headers(session)).status_code == 401


def test_web_cookies_csrf_and_origin(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"name": "Web User", "email": "web@example.com", "password": "StrongPassword123"},
    )
    assert r.status_code == 201
    assert r.json()["access_token"] is None
    assert "HttpOnly" in r.headers.get_list("set-cookie")[0]
    assert client.post("/api/v1/auth/refresh", json={}).status_code == 403
    csrf = client.cookies.get("sw_csrf")
    assert (
        client.post("/api/v1/auth/refresh", json={}, headers={"X-CSRF-Token": csrf}).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={},
            headers={"X-CSRF-Token": csrf, "Origin": "https://evil.example"},
        ).status_code
        == 403
    )


def test_report_ownership_media_and_dashboard(client, auth, admin):
    owner = headers(auth())
    report = create(client, owner)
    assert report.status_code == 201, report.text
    body = report.json()
    assert body["status"] == "pending"
    assert body["predictions"][0]["outcome"] == "unavailable"
    other = headers(auth("other@example.com"))
    for path in (f"/api/v1/reports/{body['id']}", f"/api/v1/reports/{body['id']}/photo"):
        assert client.get(path, headers=other).status_code == 404
        assert client.get(path, headers=admin).status_code == 200
    assert client.get("/api/v1/reports", headers=other).json()["total"] == 0
    assert client.get("/api/v1/dashboard", headers=other).json()["total"] == 0
    assert client.get("/api/v1/dashboard", headers=admin).json()["total"] == 1
    assert (
        client.get(
            "/api/v1/reports", headers=owner, params={"q": "taman", "category": "organic"}
        ).json()["total"]
        == 1
    )
    assert (
        client.get("/api/v1/reports", headers=owner, params={"q": body["id"]}).json()["total"] == 1
    )


def test_full_status_flow_and_edit_restrictions(client, auth, admin):
    token = headers(auth())
    report = create(client, token).json()
    path = f"/api/v1/reports/{report['id']}"
    payload = {
        "description": "Sampah diperbarui di taman kota",
        "category": "paper",
        "latitude": "0",
        "longitude": "0",
    }
    edited = client.patch(path, headers=token, data=payload, files={"photo": photo()})
    assert edited.status_code == 200
    assert len(edited.json()["predictions"]) == 2
    assert (
        client.patch(path + "/status", headers=token, json={"status": "in_progress"}).status_code
        == 403
    )
    assert (
        client.patch(path + "/status", headers=admin, json={"status": "completed"}).status_code
        == 409
    )
    assert (
        client.patch(path + "/status", headers=admin, json={"status": "in_progress"}).status_code
        == 200
    )
    assert client.patch(path, headers=token, data=payload).status_code == 409
    assert client.delete(path, headers=token).status_code == 409
    assert (
        client.patch(path + "/status", headers=admin, json={"status": "completed"}).status_code
        == 200
    )
    assert (
        client.patch(path + "/status", headers=admin, json={"status": "pending"}).status_code == 409
    )
    assert client.delete(path, headers=admin).status_code == 204
    assert client.get(path, headers=admin).status_code == 404


def test_rejection_reason(client, auth, admin):
    r = create(client, headers(auth())).json()
    path = f"/api/v1/reports/{r['id']}/status"
    assert (
        client.patch(path, headers=admin, json={"status": "rejected", "note": " "}).status_code
        == 422
    )
    result = client.patch(
        path, headers=admin, json={"status": "rejected", "note": "Lokasi tidak dapat diverifikasi"}
    )
    assert result.status_code == 200
    assert result.json()["history"][-1]["note"] == "Lokasi tidak dapat diverifikasi"


def test_last_admin_and_inactive_users(client, auth, admin):
    current = client.get("/api/v1/auth/me", headers=admin).json()
    assert (
        client.patch(
            f"/api/v1/users/{current['id']}",
            headers=admin,
            json={"name": "Admin", "role": "user", "active": True},
        ).status_code
        == 409
    )
    session = auth()
    assert client.get("/api/v1/users", headers=headers(session)).status_code == 403
    assert (
        client.patch(
            f"/api/v1/users/{session['user']['id']}",
            headers=admin,
            json={"name": "Disabled", "role": "user", "active": False},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me", headers=headers(session)).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "user@example.com", "password": "StrongPassword123"},
        ).status_code
        == 401
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("latitude", "91"),
        ("longitude", "181"),
        ("accuracy", "-1"),
        ("category", "metal"),
        ("description", "          "),
    ],
)
def test_invalid_report_fields(client, auth, field, value):
    assert create(client, headers(auth()), **{field: value}).status_code == 422


def test_invalid_and_large_photos(client, auth):
    token = headers(auth())
    payload = {
        "description": "Sampah di sekitar jalan",
        "category": "plastic",
        "latitude": "0",
        "longitude": "0",
    }
    assert (
        client.post(
            "/api/v1/reports",
            headers=token,
            data=payload,
            files={"photo": ("bad.jpg", b"not an image", "image/jpeg")},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/reports",
            headers=token,
            data=payload,
            files={"photo": ("large.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
        ).status_code
        == 413
    )
    assert (
        client.post("/api/v1/predictions", headers=token, files={"photo": photo()}).status_code
        == 503
    )


def test_photo_normalization_and_manual_category(client, auth, monkeypatch):
    from smart_waste.inference import classifier
    from smart_waste.config import settings

    monkeypatch.setattr(
        classifier,
        "predict",
        lambda _: {
            "category": "plastic",
            "confidence": 0.64,
            "model_version": "test-double",
            "probabilities": {"organic": 0.2, "paper": 0.16, "plastic": 0.64},
            "outcome": "predicted",
        },
    )
    report = create(client, headers(auth()), category="paper").json()
    assert report["category"] == "paper"
    assert report["predictions"][0]["category"] == "plastic"
    stored = list(settings().storage_dir.glob("*.jpg"))
    assert len(stored) == 1
    with Image.open(stored[0]) as image:
        assert image.mode == "RGB"
        assert not image.getexif()


def test_login_rate_limit_and_invalid_date_range(client, auth):
    token = headers(auth())
    assert (
        client.get(
            "/api/v1/reports?start_date=2026-12-01&end_date=2026-01-01", headers=token
        ).status_code
        == 422
    )
    for _ in range(9):
        assert (
            client.post(
                "/api/v1/auth/login", json={"email": "no@example.com", "password": "bad"}
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "no@example.com", "password": "bad"}
        ).status_code
        == 429
    )
