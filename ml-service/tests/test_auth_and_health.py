import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr("app.config.settings.DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
    monkeypatch.setattr("app.config.settings.API_KEY", "test-api-key")
    from app.main import app
    return TestClient(app)


class TestHealth:
    def test_health_returns_503_when_models_not_trained(self, client):
        resp = client.get("/api/ml/health")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "models_not_ready"


class TestApiKeyAuth:
    def test_train_endpoints_reject_missing_key(self, client):
        for path in ["/train/all", "/train/fraud", "/train/demand", "/train/pricing"]:
            resp = client.post(f"/api/ml{path}")
            assert resp.status_code == 403, f"{path} should require API key"

    def test_train_endpoints_reject_wrong_key(self, client):
        resp = client.post("/api/ml/train/all", headers={"X-API-Key": "wrong"})
        assert resp.status_code == 403

    def test_analyze_endpoints_reject_missing_key(self, client):
        resp = client.get("/api/ml/fraud/analyze/123e4567-e89b-12d3-a456-426614174000")
        assert resp.status_code == 403

    def test_forecast_endpoints_reject_missing_key(self, client):
        resp = client.get("/api/ml/forecast/123e4567-e89b-12d3-a456-426614174000")
        assert resp.status_code == 403

    def test_pricing_endpoints_reject_missing_key(self, client):
        resp = client.get("/api/ml/pricing/123e4567-e89b-12d3-a456-426614174000")
        assert resp.status_code == 403

    def test_model_status_rejects_missing_key(self, client):
        resp = client.get("/api/ml/models/status")
        assert resp.status_code == 403


class TestUuidValidation:
    def test_invalid_uuid_returns_422(self, client):
        resp = client.get(
            "/api/ml/fraud/analyze/not-a-uuid",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 422

    def test_invalid_uuid_forecast_returns_422(self, client):
        resp = client.get(
            "/api/ml/forecast/xyz",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 422


class TestRateLimiting:
    def test_rate_limit_returns_429_after_threshold(self, client, monkeypatch):
        from app.main import rate_limiter
        original = rate_limiter.max_requests
        rate_limiter.max_requests = 2
        try:
            for _ in range(3):
                resp = client.get("/api/ml/models/status", headers={"X-API-Key": "test-api-key"})
            assert resp.status_code == 429
        finally:
            rate_limiter.max_requests = original
            rate_limiter._hits.clear()
