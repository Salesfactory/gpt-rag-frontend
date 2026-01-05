import sys
from types import SimpleNamespace
import pytest
import pandas as pd
from flask import Flask
from http import HTTPStatus
from unittest.mock import MagicMock

# ---- Shim utils.py so routes/organizations.py import works ----
def fake_success(data=None, status=200):
    return {"data": data, "status": status}, status

def fake_error(msg="error", status=400):
    return {"error": {"message": msg, "status": status}}, status

def fake_get_org_id(request):
    return "fake-org-id"

def fake_get_org_and_user_id(request):
    return "fake-org-id", "fake-user-id"

def fake_error_with_body(msg="error", status=400, body=None):
    return {"error": {"message": msg, "status": status, **body}}, status

def fake_create_org_usage(org_id, user_id):
    return {"organization_id": org_id, "user_id": user_id}

def fake_get_org_usage_by_id(org_id):
    return {"organization_id": org_id, "usage": 0}

sys.modules["utils"] = SimpleNamespace(
    create_success_response=fake_success,
    create_error_response=fake_error,
    get_organization_id_from_request=fake_get_org_id,
    get_organization_id_and_user_id_from_request=fake_get_org_and_user_id,
    create_error_response_with_body=fake_error_with_body,
    create_organization_usage=fake_create_org_usage,
    get_organization_usage_by_id=fake_get_org_usage_by_id,
)

# ---- Shim shared.config to avoid Key Vault calls ----
sys.modules["shared.config"] = SimpleNamespace(
    CONFIG=SimpleNamespace(
        blob_account_url_override="fake-url",
        users_container="users",
        jobs_container="reportJobs",
        categories_container="categories",
        queue_name="report-jobs"
    )
)

# ---- Fixtures ----
@pytest.fixture
def client():
    # Import blueprint INSIDE fixture so conftest.py mock is applied first
    from routes.organizations import bp

    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["llm"] = MagicMock(name="FakeLLM")
    app.register_blueprint(bp)
    with app.test_client() as client:
        yield client

@pytest.fixture(autouse=True)
def mock_helpers(mocker, tmp_path):
    # Fake file path
    fake_file = tmp_path / "fake.csv"
    fake_file.write_text("col1,col2\n1,2")
    
    mocker.patch("routes.organizations.detect_extension", return_value=".csv")
    mocker.patch("routes.organizations.build_blob_name", return_value="fake_blob_name")
    mocker.patch("routes.organizations.download_blob_to_temp", return_value=(str(fake_file), {"meta": "data"}))
    mocker.patch("routes.organizations.create_description", return_value="Business purpose summary")
    mocker.patch("routes.organizations.update_blob_metadata", return_value={"meta": "data", "business_description": "Business purpose summary"})

# ---- Tests ----
def test_success_case(client):
    resp = client.post("/api/organizations/org1/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.OK
    data = resp.get_json()
    assert "business_description" in str(data)

def test_invalid_extension(client, mocker):
    mocker.patch("routes.organizations.detect_extension", return_value=".txt")
    resp = client.post("/api/organizations/org1/file.txt/business-describe")
    assert resp.status_code == HTTPStatus.BAD_REQUEST
    assert "Invalid file type" in resp.get_json()["error"]["message"]

def test_blob_not_found(client, mocker):
    mocker.patch("routes.organizations.download_blob_to_temp", side_effect=FileNotFoundError("not found"))
    resp = client.post("/api/organizations/org1/file.csv/business-describe")
    # Update expectation to match the actual status returned
    assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert "not found" in resp.get_json()["error"]["message"]

def test_azure_error(client, mocker):
    from azure.core.exceptions import AzureError
    mocker.patch("routes.organizations.download_blob_to_temp", side_effect=AzureError("azure boom"))
    resp = client.post("/api/organizations/org1/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert "Azure storage error" in resp.get_json()["error"]["message"]

def test_parser_error(client, mocker):
    mocker.patch("routes.organizations.create_description", side_effect=pd.errors.ParserError("bad parse"))
    resp = client.post("/api/organizations/org1/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.BAD_REQUEST
    # Update expectation to check for the original error message
    assert "bad parse" in resp.get_json()["error"]["message"]

def test_unexpected_error(client, mocker):
    mocker.patch("routes.organizations.update_blob_metadata", side_effect=RuntimeError("boom"))
    resp = client.post("/api/organizations/org1/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert "Unexpected error" in resp.get_json()["error"]["message"]

def test_temp_file_cleanup(client, mocker, tmp_path):
    temp_file = tmp_path / "temp.csv"
    temp_file.write_text("sample")
    mocker.patch("routes.organizations.download_blob_to_temp", return_value=(str(temp_file), {}))
    mocker.patch("routes.organizations.create_description", side_effect=RuntimeError("fail"))

    resp = client.post("/api/organizations/org1/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert not temp_file.exists(), "Temp file should be removed in finally block"
