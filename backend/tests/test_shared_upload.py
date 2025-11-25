import io
import os
import pytest
from flask import Flask
from unittest.mock import MagicMock, PropertyMock

# Import blueprint module
import routes.file_management as fm


class DummyBlobStorageManager:
    """Mock blob storage manager for testing"""
    def __init__(self, should_fail=False):
        self.should_fail = should_fail
        self.blob_service_client = DummyBlobServiceClient()

    def upload_to_blob(self, file_path, blob_folder, metadata, container):
        if self.should_fail:
            return {"status": "error", "error": "upload failed"}
        
        return {
            "status": "success",
            "blob_url": f"https://dummy.blob/{blob_folder}/{os.path.basename(file_path)}",
        }


class DummyBlob:
    """Mock blob object"""
    def __init__(self, name):
        self.name = name


class DummyContainerClient:
    """Mock container client for blob storage"""
    def __init__(self):
        pass

    def list_blobs(self, name_starts_with=None):
        return []

    def get_blob_client(self, blob_name):
        return MagicMock()


class DummyBlobServiceClient:
    """Mock blob service client"""
    def __init__(self):
        pass

    def get_container_client(self, container_name):
        return DummyContainerClient()


@pytest.fixture
def app(monkeypatch):
    """Create Flask app for testing"""
    app = Flask(__name__)
    app.register_blueprint(fm.bp)

    # Mock the auth_required decorator to do nothing
    def mock_auth_decorator(f):
        return f
    
    monkeypatch.setattr(fm, "auth_required", mock_auth_decorator)

    # Patch out create_description
    monkeypatch.setattr(
        fm, 
        "create_description", 
        lambda path, llm=None: {
            "file_description": "fake description",
            "source": "test"
        }
    )

    # Patch validate_file_signature to always return True
    monkeypatch.setattr(fm, "validate_file_signature", lambda path, mime: True)

    # Dummy configs
    app.config["llm"] = object()
    app.config["blob_storage_manager"] = DummyBlobStorageManager()

    return app


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


def test_no_file_in_request(client):
    """Test upload with no file in request"""
    res = client.post("/api/upload-shared-document", data={})
    assert res.status_code == 400
    json_data = res.get_json()
    assert "No file part" in json_data["error"]["message"]


def test_no_file_selected(client):
    """Test upload with empty filename"""
    # Note: When sending empty filename with Flask test client, it removes the file from request
    # So this actually triggers "No file part" error, not "No file selected"
    data = {"file": (io.BytesIO(b""), "")}
    res = client.post("/api/upload-shared-document", data=data, content_type="multipart/form-data")
    assert res.status_code == 400
    json_data = res.get_json()
    # Flask test client behavior: empty filename results in no file being sent
    assert "No file part" in json_data["error"]["message"]


def test_invalid_file_type(client):
    """Test upload with invalid file type"""
    data = {"file": (io.BytesIO(b"hello"), "test.exe")}
    res = client.post(
        "/api/upload-shared-document", 
        data=data, 
        content_type="multipart/form-data"
    )
    assert res.status_code == 422
    json_data = res.get_json()
    assert "Invalid file type" in json_data["error"]["message"]


def test_file_signature_mismatch(client, monkeypatch, app):
    """Test upload with mismatched file signature"""
    # Mock validate_file_signature to return False
    monkeypatch.setattr(
        "routes.file_management.validate_file_signature", 
        lambda path, mime: False
    )
    
    # Create a CSV file (which is in ALLOWED_MIME_TYPES)
    csv_content = b"col1,col2\n1,2"
    data = {
        "file": (io.BytesIO(csv_content), "test.csv")
    }
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 422
    json_data = res.get_json()
    assert "File content does not match declared type" in json_data["error"]["message"]


def test_successful_upload(client):
    """Test successful upload to shared folder"""
    csv_content = b"col1,col2\n1,2"
    data = {"file": (io.BytesIO(csv_content), "test.csv")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 200
    json_response = res.get_json()
    json_data = json_response["data"]
    
    # Check response structure
    assert "message" in json_data
    assert "filename" in json_data
    assert json_data["filename"] == "test.csv"
    assert "blob_url" in json_data
    assert "organization_files/shared" in json_data["blob_url"]


def test_upload_failure(client, app):
    """Test upload failing"""
    # Replace with failing blob storage manager
    app.config["blob_storage_manager"] = DummyBlobStorageManager(should_fail=True)
    
    csv_content = b"col1,col2\n1,2"
    data = {"file": (io.BytesIO(csv_content), "test.csv")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 500
    json_data = res.get_json()
    assert "Failed to upload file" in json_data["error"]["message"]


def test_pdf_upload(client):
    """Test uploading a PDF file (no description generation)"""
    # Create fake PDF content (just for testing, signature validation is mocked)
    pdf_content = b"%PDF-1.4\nfake pdf content"
    data = {"file": (io.BytesIO(pdf_content), "test.pdf")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 200
    json_response = res.get_json()
    json_data = json_response["data"]
    assert json_data["filename"] == "test.pdf"
    assert "blob_url" in json_data


def test_xlsx_upload_with_description(client):
    """Test uploading an Excel file (should generate description)"""
    # Create fake Excel content
    xlsx_content = b"PK\x03\x04fake excel content"
    data = {"file": (io.BytesIO(xlsx_content), "test.xlsx")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 200
    json_response = res.get_json()
    json_data = json_response["data"]
    assert json_data["filename"] == "test.xlsx"
    assert "blob_url" in json_data


def test_docx_upload(client):
    """Test uploading a Word document"""
    # Create fake DOCX content (ZIP signature)
    docx_content = b"PK\x03\x04fake word content"
    data = {"file": (io.BytesIO(docx_content), "test.docx")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 200
    json_response = res.get_json()
    json_data = json_response["data"]
    assert json_data["filename"] == "test.docx"
    assert "blob_url" in json_data


def test_pptx_upload(client):
    """Test uploading a PowerPoint presentation"""
    # Create fake PPTX content (ZIP signature)
    pptx_content = b"PK\x03\x04fake powerpoint content"
    data = {"file": (io.BytesIO(pptx_content), "test.pptx")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 200
    json_response = res.get_json()
    json_data = json_response["data"]
    assert json_data["filename"] == "test.pptx"
    assert "blob_url" in json_data


def test_mimetype_mismatch(client):
    """Test file with mismatched extension and mimetype"""
    # File claims to be CSV but has wrong extension
    data = {
        "file": (io.BytesIO(b"col1,col2\n1,2"), "test.txt")
    }
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 422
    json_data = res.get_json()
    assert "Invalid file type" in json_data["error"]["message"]


def test_shared_file_metadata(client, monkeypatch):
    """Test that uploaded files have correct metadata including shared_file flag"""
    uploaded_metadata = []
    
    # Capture metadata from upload_to_blob calls
    original_upload = DummyBlobStorageManager.upload_to_blob
    def capture_upload(self, file_path, blob_folder, metadata, container):
        uploaded_metadata.append(metadata)
        return original_upload(self, file_path, blob_folder, metadata, container)
    
    monkeypatch.setattr(DummyBlobStorageManager, "upload_to_blob", capture_upload)
    
    csv_content = b"col1,col2\n1,2"
    data = {"file": (io.BytesIO(csv_content), "test.csv")}
    
    res = client.post(
        "/api/upload-shared-document",
        data=data,
        content_type="multipart/form-data"
    )
    assert res.status_code == 200
    
    # Verify metadata for uploads
    assert len(uploaded_metadata) == 1
    metadata = uploaded_metadata[0]
    assert "shared_file" in metadata
    assert metadata["shared_file"] == "true"
    assert "organization_id" in metadata
    assert metadata["organization_id"] == "shared"
    assert "description" in metadata
    assert "description_source" in metadata
