import pytest
from azure.identity import DefaultAzureCredential

# Import the module under test
from shared import clients


class DummyBlobServiceClient:
  def __init__(self, account_url, credential):
    self.account_url = account_url
    self.credential = credential

  def get_container_client(self, container_name: str):
    return f"dummy_container_client: {container_name}"


@pytest.fixture(autouse=True)
def reset_caches(monkeypatch):
  # Clear caches before each test to avoid caching between tests.
  clients.get_blob_service_client.cache_clear()
  clients.get_blob_container_client.cache_clear()
  yield


def test_get_blob_container_client_happy(monkeypatch):
  dummy = DummyBlobServiceClient("https://example.blob.core.windows.net", DefaultAzureCredential())
  monkeypatch.setattr(clients, "get_blob_service_client", lambda: dummy)

  container_client = clients.get_blob_container_client("testcontainer")
  assert container_client == "dummy_container_client: testcontainer"


  service_client = clients.get_blob_service_client()
  assert service_client is not None
  assert service_client.account_url == "https://example.blob.core.windows.net"
  assert isinstance(service_client.credential, DefaultAzureCredential)


def test_get_blob_container_client_error(monkeypatch):
  # Force the URL resolver to return None, simulating missing configuration.
  monkeypatch.setattr(clients, "get_blob_service_client", lambda: None)

  service_client = clients.get_blob_service_client()
  assert service_client is None

  with pytest.raises(RuntimeError) as excinfo:
    clients.get_blob_container_client("container")
  assert "Azure Blob Storage not configured" in str(excinfo.value)