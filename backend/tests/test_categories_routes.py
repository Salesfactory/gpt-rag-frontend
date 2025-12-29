# tests/test_categories_routes.py
from __future__ import annotations
import pytest
from flask import Flask


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


# ----- Pytest fixtures -----
@pytest.fixture
def app(monkeypatch):
    fake_container = FakeContainer()

    # Patch clients.* used by the blueprint

    # Create a tiny module-like object for clients to patch attributes cleanly
    clients_mod = __import__("shared.clients", fromlist=["*"])

    # Cosmos container handle
    monkeypatch.setattr(clients_mod, "CATEGORIES_CONT", "categories", raising=False)
    monkeypatch.setattr(
        clients_mod, "get_cosmos_container", lambda name: fake_container, raising=True
    )

    # Also patch exceptions in the route module so our NotFoundError is treated as CosmosResourceNotFoundError
    from routes import categories as routes_mod

    monkeypatch.setattr(
        routes_mod, "CosmosResourceNotFoundError", NotFoundError, raising=True
    )

    # Import blueprint INSIDE fixture so conftest.py mock is applied first
    from routes.categories import bp as categories_bp

    app = Flask(__name__)
    app.register_blueprint(categories_bp)

    # Stash fakes on app for tests to access
    app.fake_container = fake_container
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ----- Tests -----
def test_create_category_201(client, app):
    body = {
        "organization_id": "t1",
        "name": "Marketing",
    }
    resp = client.post("/api/categories", json=body)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["organization_id"] == "t1"
    assert data["name"] == "Marketing"


def test_create_category_minimal_201(client, app):
    body = {
        "organization_id": "t1",
        "name": "Finance",
    }
    resp = client.post("/api/categories", json=body)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["organization_id"] == "t1"
    assert data["name"] == "Finance"


def test_create_category_missing_name_400(client):
    body = {
        "organization_id": "t1",
        "description": "No name provided",
    }
    resp = client.post("/api/categories", json=body)
    assert resp.status_code == 400


def test_get_category_200(client, app):
    # seed
    created = app.fake_container.create_item(
        {
            "id": "cat-1",
            "organization_id": "t1",
            "name": "Sales",
        }
    )
    resp = client.get("/api/categories/cat-1?organization_id=t1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == created["id"]
    assert data["name"] == "Sales"


def test_get_category_404(client):
    resp = client.get("/api/categories/does-not-exist?organization_id=t1")
    assert resp.status_code == 404


def test_list_categories_200(client, app):
    app.fake_container.create_item(
        {
            "id": "a",
            "organization_id": "t1",
            "name": "Category A",
            "created_at": "2025-01-01T00:00:00+00:00",
        }
    )
    app.fake_container.create_item(
        {
            "id": "b",
            "organization_id": "t1",
            "name": "Category B",
            "created_at": "2025-02-01T00:00:00+00:00",
        }
    )
    resp = client.get("/api/categories?organization_id=t1&limit=10")
    assert resp.status_code == 200
    data = resp.get_json()
    # ordered DESC by created_at -> 'b' first
    assert [d["id"] for d in data] == ["b", "a"]


def test_delete_category_204(client, app):
    app.fake_container.create_item(
        {"id": "z", "organization_id": "t1", "name": "To Delete"}
    )
    resp = client.delete("/api/categories/z?organization_id=t1")
    assert resp.status_code == 204
    # subsequent GET should 404
    resp2 = client.get("/api/categories/z?organization_id=t1")
    assert resp2.status_code == 404


def test_create_category_with_explicit_id(client, app):
    body = {
        "organization_id": "t1",
        "category_id": "custom-id-123",
        "name": "Custom ID Category",
    }
    resp = client.post("/api/categories", json=body)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["id"] == "custom-id-123"
    assert data["name"] == "Custom ID Category"


def test_list_categories_with_limit(client, app):
    # Create 3 categories
    for i in range(3):
        app.fake_container.create_item(
            {
                "id": f"cat-{i}",
                "organization_id": "t1",
                "name": f"Category {i}",
                "created_at": f"2025-01-0{i+1}T00:00:00+00:00",
            }
        )

    # Request with limit=2
    resp = client.get("/api/categories?organization_id=t1&limit=2")
    assert resp.status_code == 200
    data = resp.get_json()
    # Should only return 2 items (most recent first)
    assert len(data) == 2
    assert [d["id"] for d in data] == ["cat-2", "cat-1"]


def test_organization_id_from_header(client, app):
    body = {
        "name": "Header Test Category",
    }
    # Pass organization_id via X-Tenant-Id header instead of body
    resp = client.post("/api/categories", json=body, headers={"X-Tenant-Id": "t1"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["organization_id"] == "t1"
    assert data["name"] == "Header Test Category"
