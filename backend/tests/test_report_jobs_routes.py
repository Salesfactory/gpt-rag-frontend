# tests/test_report_jobs_routes.py
from __future__ import annotations
import json
import types
import pytest
from flask import Flask

# Import the blueprint under test
from routes.report_jobs import bp as report_jobs_bp


# ----- Fakes -----
class NotFoundError(Exception):
    """Fake CosmosResourceNotFoundError for tests."""


class FakeContainer:
    def __init__(self):
        # key: (organization_id, id) -> doc
        self.store = {}

    def create_item(self, doc):
        key = (doc["organization_id"], doc["id"])
        self.store[key] = dict(doc)
        return dict(doc)

    def read_item(self, item, partition_key):
        key = (partition_key, item)
        if key not in self.store:
            raise NotFoundError("not found")
        return dict(self.store[key])

    def delete_item(self, item, partition_key):
        key = (partition_key, item)
        if key not in self.store:
            raise NotFoundError("not found")
        del self.store[key]

    def query_items(self, query, parameters, partition_key=None):
        # very small evaluator: filter by organization_id
        tid = None
        for p in parameters or []:
            if p["name"] == "@organization_id":
                tid = p["value"]
        items = [doc for (tenant, _), doc in self.store.items() if tenant == tid]
        # order by created_at desc if present
        items.sort(key=lambda d: d.get("created_at", ""), reverse=True)
        return iter(items)


class FakeSbClient:
    def __init__(self, bag):
        self.bag = bag

    def get_queue_sender(self, queue_name: str):
        bag = self.bag

        class Sender:
            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *exc):
                return False

            def send_messages(self_inner, msg):
                # record the send (serialize agnostic)
                bag.append(("sent", queue_name, str(msg)))

        return Sender()


# ----- Pytest fixtures -----
@pytest.fixture
def app(monkeypatch):
    fake_container = FakeContainer()
    sent = []

    # Patch clients.* used by the blueprint

    # Create a tiny module-like object for clients to patch attributes cleanly
    clients_mod = __import__("shared.clients", fromlist=["*"])

    monkeypatch.setattr(clients_mod, "JOBS_CONT", "report_jobs", raising=False)
    monkeypatch.setattr(
        clients_mod, "get_container", lambda name: fake_container, raising=True
    )
    monkeypatch.setattr(
        clients_mod, "sb_client", lambda: FakeSbClient(sent), raising=True
    )
    monkeypatch.setattr(clients_mod, "SB_QUEUE", "report-jobs", raising=False)

    # Also patch exceptions in the route module so our NotFoundError is treated as CosmosResourceNotFoundError
    from routes import report_jobs as routes_mod

    monkeypatch.setattr(
        routes_mod, "CosmosResourceNotFoundError", NotFoundError, raising=True
    )

    app = Flask(__name__)
    app.register_blueprint(report_jobs_bp)

    # Stash fakes on app for tests to access
    app.fake_container = fake_container
    app.sent_messages = sent
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ----- Tests -----
def test_create_job_201(client, app):
    body = {
        "organization_id": "t1",
        "report_name": "brand-analysis",
        "params": {"foo": "bar"},
    }
    resp = client.post("/v1/report-jobs", json=body)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["organization_id"] == "t1"
    assert data["report_name"] == "brand-analysis"
    assert data["status"] == "QUEUED"
    # Service Bus send recorded
    assert any(evt[0] == "sent" for evt in app.sent_messages)


def test_get_job_200(client, app):
    # seed
    created = app.fake_container.create_item(
        {
            "id": "job-1",
            "organization_id": "t1",
            "report_name": "brand",
            "status": "QUEUED",
        }
    )
    resp = client.get("/v1/report-jobs/job-1?organization_id=t1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == created["id"]


def test_get_job_404(client):
    resp = client.get("/v1/report-jobs/does-not-exist?organization_id=t1")
    assert resp.status_code == 404


def test_list_jobs_200(client, app):
    app.fake_container.create_item(
        {
            "id": "a",
            "organization_id": "t1",
            "report_name": "r1",
            "created_at": "2025-01-01T00:00:00+00:00",
        }
    )
    app.fake_container.create_item(
        {
            "id": "b",
            "organization_id": "t1",
            "report_name": "r2",
            "created_at": "2025-02-01T00:00:00+00:00",
        }
    )
    resp = client.get("/v1/report-jobs?organization_id=t1&limit=10")
    assert resp.status_code == 200
    data = resp.get_json()
    # ordered DESC by created_at -> 'b' first
    assert [d["id"] for d in data] == ["b", "a"]


def test_delete_job_204(client, app):
    app.fake_container.create_item(
        {"id": "z", "organization_id": "t1", "report_name": "r3"}
    )
    resp = client.delete("/v1/report-jobs/z?organization_id=t1")
    assert resp.status_code == 204
    # subsequent GET should 404
    resp2 = client.get("/v1/report-jobs/z?organization_id=t1")
    assert resp2.status_code == 404
