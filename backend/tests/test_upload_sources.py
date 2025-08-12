import io
import json
import pytest
from flask import Flask

class FakeLLM:
    """A fake LLM that returns a predictable description."""
    def chat_dataframe(self, df, prompt: str) -> str:
        return "This file is a tabular dataset with 3 rows × 2 columns. Columns: a, b."

class FakeBlobMgr:
    """A fake Blob Manager that records upload calls instead of using the network."""
    def __init__(self):
        self.calls = []

    def upload_to_blob(self, file_path, blob_folder, metadata, container):
        self.calls.append({
            "file_path": file_path,
            "blob_folder": blob_folder,
            "metadata": metadata,
            "container": container
        })
        return {"status": "success", "blob_url": "https://blob.example/x"}

@pytest.fixture
def app(monkeypatch):
    """Creates and configures a new app instance for each test."""
    monkeypatch.setenv("AZURE_DB_ID", "dummy-value-for-testing")
    monkeypatch.setenv("AZURE_DB_NAME", "dummy-value-for-testing")
    monkeypatch.setenv("AZURE_KEY_VAULT_NAME", "dummy-value-for-testing")

    # Patch Key Vault secret retrieval BEFORE importing app.py
    import backend.utils as utils  # adjust if utils.py is elsewhere
    monkeypatch.setattr(utils, "get_azure_key_vault_secret", lambda name: "fake-secret-value")

    from app import upload_source_document  # safe now, no network call

    # Patch other dependencies
    monkeypatch.setattr("app.setup_llm", lambda: FakeLLM())
    fake_blob_mgr = FakeBlobMgr()
    monkeypatch.setattr("app.BlobStorageManager", lambda: fake_blob_mgr)

    flask_app = Flask(__name__)
    flask_app.config["TESTING"] = True
    flask_app.fake_blob_mgr = fake_blob_mgr

    flask_app.add_url_rule(
        "/api/upload-source-document",
        view_func=upload_source_document,
        methods=["POST"]
    )
    return flask_app

def test_upload_generates_description_and_uploads(app):
    """
    Tests the happy path: a valid CSV is uploaded, a description is generated,
    and the file is passed to the blob manager with correct metadata.
    """
    client = app.test_client()
    
    test_csv_data = b"a,b\n1,x\n2,x\n3,y\n"
    form_data = {
        "organization_id": "org-123",
        "file": (io.BytesIO(test_csv_data), "sample.csv")
    }
    
    resp = client.post("/api/upload-source-document",
                       data=form_data,
                       content_type="multipart/form-data")
    
    assert resp.status_code == 200, "Request should be successful"
    
    payload = json.loads(resp.get_data(as_text=True))
    assert "blob_url" in payload.get("data", {}), "Response should contain the blob URL"

    # Directly use the fake from the app fixture
    upload_call = app.fake_blob_mgr.calls[0]
    metadata = upload_call["metadata"]
    
    assert metadata.get("organization_id") == "org-123"
    assert "description" in metadata
    assert "3 rows × 2 columns" in metadata["description"]
