import pytest
import json
from flask import Flask

# Import your blueprint
from routes.voice_customer import bp as voice_costumer_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(voice_costumer_bp)
    app.testing = True
    return app.test_client()



#PRODUCT TEST

#
# --- Fixtures for monkeypatching DB layer ---
#

@pytest.fixture
def mock_create_prod(monkeypatch):
    def _mock(name, desc, industry, brand_id, org_id):
        return {
            "id": "prod123",
            "name": name,
            "description": desc,
            "industry": industry,
            "brand_id": brand_id,
            "organization_id": org_id,
        }
    monkeypatch.setattr("routes.voice_customer.create_prod", _mock)
    return _mock

@pytest.fixture
def mock_get_prods(monkeypatch):
    def _mock(org_id):
        return [{"id": "p1", "organization_id": org_id, "name": "Sample"}]
    monkeypatch.setattr("routes.voice_customer.get_prods_by_organization", _mock)
    return _mock

@pytest.fixture
def mock_update_prod(monkeypatch):
    def _mock(**kwargs):
        return {**kwargs, "updated": True}
    monkeypatch.setattr("routes.voice_customer.update_prod_by_id", _mock)
    return _mock

@pytest.fixture
def mock_delete_prod(monkeypatch):
    def _mock(prod_id, org_id):
        return {"deleted": True, "id": prod_id, "organization_id": org_id}
    monkeypatch.setattr("routes.voice_customer.delete_prod_by_id", _mock)
    return _mock


#
# --- Tests ---
#

def test_create_product_success(client, mock_create_prod):
    payload = {
        "product_name": "Widget",
        "product_description": "A test product",
        "brand_id": "b1",
        "category":"c1",
        "organization_id": "org1",
    }
    resp = client.post("/api/voice-customer/products",
                       data=json.dumps(payload),
                       content_type="application/json")
    assert resp.status_code == 201

def test_create_product_missing_fields(client):
    payload = {"product_name": "X"}
    resp = client.post("/api/voice-customer/products",
                       data=json.dumps(payload),
                       content_type="application/json")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "Missing required fields" in data["message"]

def test_create_product_no_json(client):
    resp = client.post("/api/voice-customer/products")
    assert resp.status_code == 400


def test_get_products_success(client, mock_get_prods):
    resp = client.get("/api/voice-customer/organizations/org123/products")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data["data"], list)
    assert data["data"][0]["organization_id"] == "org123"

def test_get_products_missing_org(client):
    # organization_id empty string
    resp = client.get("/api/voice-customer/organizations//products")
    assert resp.status_code == 404  # Flask route won't match empty
    # This tests route coverage; actual missing-org-id logic is covered by handler.


# BRAND TEST


def test_update_product_success(client, mock_update_prod):
    payload = {
        "product_name": "New Name",
        "product_description": "Updated description",
        "brand_id": "b1",
        "category":"c1",
        "organization_id": "org1",
    }
    resp = client.patch("/api/voice-customer/products/prod123",
                        data=json.dumps(payload),
                        content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["data"]["updated"] is True
    assert data["data"]["name"] == "New Name"

def test_update_product_missing_fields(client):
    payload = {"product_name": "Incomplete"}
    resp = client.patch("/api/voice-customer/products/prod123",
                        data=json.dumps(payload),
                        content_type="application/json")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "Missing required fields" in data["message"]

def test_update_product_no_json(client):
    resp = client.patch("/api/voice-customer/products/prod123")
    assert resp.status_code == 400


def test_delete_product_success(client, mock_delete_prod):
    payload = {"organization_id": "org1"}
    resp = client.delete("/api/voice-customer/products/prod123",
                         data=json.dumps(payload),
                         content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["data"]["deleted"] is True

def test_delete_product_missing_org(client):
    resp = client.delete("/api/voice-customer/products/prod123",
                         data=json.dumps({}),
                         content_type="application/json")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "Organization ID is required" in data["message"]

def test_delete_product_missing_product_id(client):
    # Direct call without product_id in URL not possible due to route
    # Instead simulate product_id empty string if app supported
    # Not directly testable, route enforces <product_id>
    pass



#
# --- Fixtures for monkeypatching DB functions ---
#

@pytest.fixture
def mock_create_brand(monkeypatch):
    def _mock(brand_name, brand_description, organization_id):
        return {
            "id": "brand123",
            "brand_name": brand_name,
            "brand_description": brand_description,
            "organization_id": organization_id,
        }
    monkeypatch.setattr("routes.voice_customer.create_new_brand", _mock)
    return _mock

@pytest.fixture
def mock_get_brands(monkeypatch):
    def _mock(org_id):
        return [{"id": "b1", "brand_name": "Acme", "organization_id": org_id}]
    monkeypatch.setattr("routes.voice_customer.get_brands_by_organization", _mock)
    return _mock

@pytest.fixture
def mock_update_brand(monkeypatch):
    def _mock(brand_id, brand_name, brand_description, organization_id):
        return {
            "id": brand_id,
            "brand_name": brand_name,
            "brand_description": brand_description,
            "organization_id": organization_id,
            "updated": True,
        }
    monkeypatch.setattr("routes.voice_customer.update_brand_by_id", _mock)
    return _mock

@pytest.fixture
def mock_delete_brand(monkeypatch):
    def _mock(brand_id, organization_id):
        return {"deleted": True, "id": brand_id, "organization_id": organization_id}
    monkeypatch.setattr("routes.voice_customer.delete_brand_by_id", _mock)
    return _mock



def test_create_brand_success(client, mock_create_brand):
    payload = {
        "brand_name": "Acme",
        "brand_description": "Leading brand",
        "organization_id": "org1",
    }
    resp = client.post("/api/voice-customer/brands",
                       data=json.dumps(payload),
                       content_type="application/json")
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["data"]["brand_name"] == "Acme"

def test_create_brand_missing_fields(client):
    payload = {"brand_name": "Incomplete"}
    resp = client.post("/api/voice-customer/brands",
                       data=json.dumps(payload),
                       content_type="application/json")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "Missing required fields" in data["message"]

def test_create_brand_no_json(client):
    resp = client.post("/api/voice-customer/brands")
    assert resp.status_code == 400


def test_get_brands_success(client, mock_get_brands):
    resp = client.get("/api/voice-customer/organizations/org1/brands")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data["data"], list)
    assert data["data"][0]["organization_id"] == "org1"


def test_update_brand_success(client, mock_update_brand):
    payload = {
        "brand_name": "New Name",
        "brand_description": "Updated description",
        "organization_id": "org1",
    }
    resp = client.patch("/api/voice-customer/brands/brand123",
                        data=json.dumps(payload),
                        content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["data"]["updated"] is True
    assert data["data"]["brand_name"] == "New Name"

def test_update_brand_missing_fields(client):
    payload = {"brand_name": "Incomplete"}
    resp = client.patch("/api/voice-customer/brands/brand123",
                        data=json.dumps(payload),
                        content_type="application/json")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "Missing required fields" in data["message"]

def test_update_brand_no_json(client):
    resp = client.patch("/api/voice-customer/brands/brand123")
    assert resp.status_code == 400


def test_delete_brand_success(client, mock_delete_brand):
    payload = {"organization_id": "org1"}
    resp = client.delete("/api/voice-customer/brands/brand123",
                         data=json.dumps(payload),
                         content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["data"]["deleted"] is True

def test_delete_brand_missing_org(client):
    resp = client.delete("/api/voice-customer/brands/brand123",
                         data=json.dumps({}),
                         content_type="application/json")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "Organization ID is required" in data["message"]

def test_delete_brand_missing_id(client):
    # Cannot hit DELETE without brand_id because route requires it.
    # This test documents that brand_id is enforced at routing level.
    pass