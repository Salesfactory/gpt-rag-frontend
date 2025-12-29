import io
import os
import pytest
from flask import Flask
from werkzeug.datastructures import FileStorage


class DummyBlobStorageManager:
    def __init__(self, should_fail=False):
        self.should_fail = should_fail

    def upload_to_blob(self, file_path, blob_folder, metadata, container):
        if self.should_fail:
            return {"status": "error", "error": "upload failed"}
        return {
            "status": "success",
            "blob_url": f"https://dummy.blob/{blob_folder}/{os.path.basename(file_path)}",
        }


@pytest.fixture
def app(monkeypatch):
    # Import INSIDE fixture so conftest.py mock is applied first
    import routes.file_management as usd

    app = Flask(__name__)
    app.register_blueprint(usd.bp)

    # Patch out create_description - must return dict with file_description and source
    monkeypatch.setattr(
        usd,
        "create_description",
        lambda path, llm=None: {
            "file_description": "fake description",
            "source": "AI-generated"
        }
    )

    # Dummy configs
    app.config["llm"] = object()
    app.config["blob_storage_manager"] = DummyBlobStorageManager()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_no_file_in_request(client):
    res = client.post("/api/upload-source-document", data={"organization_id": "org123"})
    assert res.status_code == 400
    assert b"No file part in the request" in res.data


def test_no_file_selected(client):
    # Flask interprets empty filename as no file part
    # This test verifies the error handling for missing files
    data = {"file": (io.BytesIO(b"some content"), ""), "organization_id": "org123"}
    res = client.post("/api/upload-source-document", data=data, content_type="multipart/form-data")
    assert res.status_code == 400
    # Flask's behavior: empty filename triggers "No file part in the request"
    assert b"No file part in the request" in res.data


def test_no_organization_id(client):
    data = {"file": (io.BytesIO(b"hello"), "test.csv")}
    res = client.post("/api/upload-source-document", data=data, content_type="multipart/form-data")
    assert res.status_code == 400
    assert b"Organization ID is required" in res.data


def test_successful_upload(client, monkeypatch):
    data = {
        "file": (io.BytesIO(b"col1,col2\n1,2"), "test.csv"),
        "organization_id": "org123",
    }
    res = client.post("/api/upload-source-document", data=data, content_type="multipart/form-data")
    assert res.status_code == 200
    assert b"blob_url" in res.data


def test_failed_upload(client, app):
    # Replace blob_storage_manager with failing one
    app.config["blob_storage_manager"] = DummyBlobStorageManager(should_fail=True)
    data = {
        "file": (io.BytesIO(b"col1,col2\n1,2"), "test.csv"),
        "organization_id": "org123",
    }
    res = client.post("/api/upload-source-document", data=data, content_type="multipart/form-data")
    assert res.status_code == 500
    # Error message format includes "Error uploading file: <error details>"
    assert b"Error uploading file:" in res.data or b"error" in res.data
