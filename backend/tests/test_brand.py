# tests/test_brands.py
import sys
import pytest
from types import SimpleNamespace
import json
from flask import Flask

import routes.voice_customer as voc

@pytest.fixture
def app(monkeypatch):
    app = Flask(__name__)
    app.register_blueprint(voc.bp)

    return app


@pytest.fixture
def client(app):
    return app.test_client()

# === Test Suite for POST /brands ===
def test_create_brand_success(client, mocker):
    """
    GIVEN a Flask application configured for testing
    WHEN a POST request is made to /api/voice-customer/brands with valid data
    THEN check that the database function is called correctly and a 201 success response is returned
    """
    # Mock the database function
    mock_create = mocker.patch(
        'routes.brands.create_new_brand',
        return_value={"id": "brand123", "brand_name": "Test Brand"}
    )
    
    # Test data
    new_brand_data = {
        "brand_name": "Test Brand",
        "brand_description": "A brand for testing.",
        "organization_id": "org456"
    }

    # Make the request
    response = client.post(
        "/api/voice-customer/brands",
        data=json.dumps(new_brand_data),
        content_type="application/json"
    )

    # Assertions
    assert response.status_code == 201
    response_data = response.get_json()
    assert response_data["status"] == "success"
    assert response_data["data"]["id"] == "brand123"
    
    # Verify the mock was called correctly
    mock_create.assert_called_once_with(
        brand_name="Test Brand",
        brand_description="A brand for testing.",
        organization_id="org456"
    )

def test_create_brand_missing_fields(client):
    """
    GIVEN a Flask application
    WHEN a POST request is made to /api/voice-customer/brands with missing required fields
    THEN check that a 400 error response is returned
    """
    # Missing 'organization_id'
    incomplete_data = {"brand_name": "Test Brand"}
    
    response = client.post(
        "/api/voice-customer/brands",
        data=json.dumps(incomplete_data),
        content_type="application/json"
    )
    
    assert response.status_code == 400
    response_data = response.get_json()
    assert response_data["status"] == "error"
    assert "Missing required fields" in response_data["message"]

def test_create_brand_db_error(client, mocker):
    """
    GIVEN a Flask application
    WHEN the database function raises an exception during brand creation
    THEN check that a 500 error response is returned
    """
    mocker.patch(
        'routes.brands.create_new_brand',
        side_effect=Exception("Database connection failed")
    )
    
    brand_data = {
        "brand_name": "Test Brand",
        "organization_id": "org456"
    }

    response = client.post(
        "/api/voice-customer/brands",
        data=json.dumps(brand_data),
        content_type="application/json"
    )

    assert response.status_code == 500
    response_data = response.get_json()
    assert "Error creating brand" in response_data["message"]
    assert "Database connection failed" in response_data["message"]


# === Test Suite for GET /organizations/<id>/brands ===
def test_get_brands_by_organization_success(client, mocker):
    """
    GIVEN a Flask application
    WHEN a GET request is made to /api/voice-customer/organizations/<id>/brands
    THEN check that the database function is called and a 200 success response with data is returned
    """
    mock_get = mocker.patch(
        'routes.brands.get_brands_by_organization',
        return_value=[{"id": "brand1", "name": "Brand One"}, {"id": "brand2", "name": "Brand Two"}]
    )
    
    organization_id = "org789"
    response = client.get(f"/api/voice-customer/organizations/{organization_id}/brands")
    
    assert response.status_code == 200
    response_data = response.get_json()
    assert response_data["status"] == "success"
    assert len(response_data["data"]) == 2
    
    mock_get.assert_called_once_with(organization_id)

def test_get_brands_db_error(client, mocker):
    """
    GIVEN a Flask application
    WHEN the database function raises an exception during brand retrieval
    THEN check that a 500 error response is returned
    """
    mocker.patch(
        'routes.brands.get_brands_by_organization',
        side_effect=Exception("Query failed")
    )
    
    organization_id = "org789"
    response = client.get(f"/api/voice-customer/organizations/{organization_id}/brands")
    
    assert response.status_code == 500
    response_data = response.get_json()
    assert "Error retrieving brands" in response_data["message"]


# === Test Suite for PATCH /brands/<id> ===
def test_update_brand_success(client, mocker):
    """
    GIVEN a Flask application
    WHEN a PATCH request is made to /api/voice-customer/brands/<id> with valid data
    THEN check that the update function is called and a 200 success response is returned
    """
    mock_update = mocker.patch(
        'routes.brands.update_brand_by_id',
        return_value={"id": "brandABC", "brand_name": "Updated Name"}
    )
    
    brand_id = "brandABC"
    update_data = {
        "brand_name": "Updated Name",
        "brand_description": "Updated description.",
        "organization_id": "org123"
    }

    response = client.patch(
        f"/api/voice-customer/brands/{brand_id}",
        data=json.dumps(update_data),
        content_type="application/json"
    )
    
    assert response.status_code == 200
    response_data = response.get_json()
    assert response_data["data"]["brand_name"] == "Updated Name"
    
    mock_update.assert_called_once_with(
        brand_id=brand_id,
        brand_name="Updated Name",
        brand_description="Updated description.",
        organization_id="org123"
    )

def test_update_brand_missing_data(client):
    """
    GIVEN a Flask application
    WHEN a PATCH request is made with missing fields
    THEN check that a 400 error is returned
    """
    incomplete_data = {"brand_name": "Only a name"} # Missing other required fields
    response = client.patch(
        "/api/voice-customer/brands/brandABC",
        data=json.dumps(incomplete_data),
        content_type="application/json"
    )
    
    assert response.status_code == 400
    assert "Missing required fields" in response.get_json()["message"]


# === Test Suite for DELETE /brands/<id> ===
def test_delete_brand_success(client, mocker):
    """
    GIVEN a Flask application
    WHEN a DELETE request is made to /api/voice-customer/brands/<id>
    THEN check that the delete function is called and a 200 success response is returned
    """
    mock_delete = mocker.patch(
        'routes.brands.delete_brand_by_id',
        return_value={"message": "Brand deleted successfully"}
    )
    
    brand_id = "brandToDelete"
    org_id = "org123"
    
    response = client.delete(
        f"/api/voice-customer/brands/{brand_id}",
        data=json.dumps({"organization_id": org_id}),
        content_type="application/json"
    )
    
    assert response.status_code == 200
    response_data = response.get_json()
    assert response_data["data"]["message"] == "Brand deleted successfully"
    
    mock_delete.assert_called_once_with(brand_id, org_id)

def test_delete_brand_missing_org_id(client):
    """
    GIVEN a Flask application
    WHEN a DELETE request is made without an organization_id in the body
    THEN check that a 400 error is returned
    """
    response = client.delete(
        "/api/voice-customer/brands/brandToDelete",
        data=json.dumps({}), # Missing organization_id
        content_type="application/json"
    )
    
    assert response.status_code == 400
    response_data = response.get_json()
    assert response_data["message"] == "Organization ID is required"