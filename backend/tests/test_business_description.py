import pytest
import pandas as pd
from http import HTTPStatus
from flask import Flask 
from azure.core.exceptions import ResourceNotFoundError, AzureError
import os
import sys


@pytest.fixture(scope="session", autouse=True)
def setup_environment():
    """Set up environment variables before any imports."""
    os.environ["AZURE_DB_ID"] = "dummy-value-for-testing"
    os.environ["AZURE_DB_NAME"] = "dummy-value-for-testing"


@pytest.fixture
def app():
    """Creates and configures a new app instance for each test."""
    # Clear any existing imports to force re-import with new env vars
    if 'app' in sys.modules:
        del sys.modules['app']
    
    # Import AFTER environment variables are guaranteed to be set
    from app import generate_business_description

    app = Flask(__name__)
    app.config["TESTING"] = True

    app.add_url_rule("/api/organization/<organization_id>/<file_name>/business-describe",
                     view_func=generate_business_description,
                     methods=["POST"])
    return app


@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return app.test_client()


@pytest.fixture(autouse=True)
def mock_helpers(mocker):
    """Mock out all external dependencies."""
    mocker.patch("data_summary.blob_utils.build_blob_name", return_value="mock_blob_path")
    mocker.patch("data_summary.blob_utils.download_blob_to_temp", return_value=("/tmp/mockfile.csv", {"existing": "meta"}))
    mocker.patch("data_summary.summarize.create_description", return_value="Mock business description test")
    mocker.patch("data_summary.blob_utils.update_blob_metadata", return_value={"existing": "meta", "business_description": "Mock business description"})
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")

# ---- Tests ----

def test_success_case(client, mocker):
    """Returns 200 OK and includes merged metadata with business_description."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")
    resp = client.post("/api/organization/org123/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.OK
    data = resp.get_json()
    assert data["status"] == 200
    assert "business_description" in data["data"]
    # ensure original metadata remains
    assert data["data"].get("existing") == "meta"


def test_invalid_extension(client, mocker):
    """Returns 400 when file extension is not allowed (.exe by default fixture)."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".exe")
    resp = client.post("/api/organization/org123/file.exe/business-describe")
    assert resp.status_code == 400



def test_blob_not_found(client, mocker):
    """Returns 404 when blob does not exist (ResourceNotFoundError)."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")
    mocker.patch(
        "data_summary.blob_utils.download_blob_to_temp",
        side_effect=ResourceNotFoundError("not found"),
    )
    resp = client.post("/api/organization/org123/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.NOT_FOUND
    assert "does not exist" in resp.get_json()["message"]


def test_azure_error(client, mocker):
    """Returns 503 when Azure storage encounters a service error."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")
    mocker.patch(
        "data_summary.blob_utils.download_blob_to_temp",
        side_effect=AzureError("service down"),
    )
    resp = client.post("/api/organization/org123/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert "Azure storage error" in resp.get_json()["message"]


def test_file_processing_error(client, mocker):
    """Returns 500 when file processing (I/O) fails."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")
    mocker.patch(
        "data_summary.summarize.create_description",
        side_effect=OSError("disk error"),
    )
    resp = client.post("/api/organization/org123/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert "File processing error" in resp.get_json()["message"]


def test_parser_error(client, mocker):
    """Returns 400 when Pandas fails to parse the file."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")
    mocker.patch(
        "data_summary.summarize.create_description",
        side_effect=pd.errors.ParserError("parse fail"),
    )
    resp = client.post("/api/organization/org123/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.BAD_REQUEST
    assert "Error parsing file" in resp.get_json()["message"]


def test_unexpected_error(client, mocker):
    """Returns 500 when an unexpected exception occurs."""
    mocker.patch("data_summary.file_utils.detect_extension", return_value=".csv")
    mocker.patch(
        "data_summary.summarize.create_description",
        side_effect=RuntimeError("boom"),
    )
    resp = client.post("/api/organization/org123/file.csv/business-describe")
    assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert "Unexpected error" in resp.get_json()["message"]
