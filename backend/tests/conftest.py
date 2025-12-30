# tests/conftest.py (continued)
import sys
import os
import pytest

# Set environment variables BEFORE any modules are imported
os.environ["AZURE_DB_ID"] = "test_db_id"
os.environ["AZURE_DB_NAME"] = "test_db_name"

# Mock the auth_required decorator at MODULE LEVEL before any test files import route modules
# This ensures the decorator is mocked BEFORE any blueprints are loaded
import routes.decorators.auth_decorator as _auth_module

# Save the original decorator
_original_auth_required = _auth_module.auth_required

# Replace with a no-op decorator
def _mock_auth_required(f):
    return f

_auth_module.auth_required = _mock_auth_required


class FakeContainer:
    def __init__(self):
        self.items = {}

    # Match the Azure SDK surface your code uses
    def upsert_item(self, body):
        self.items[body["id"]] = body
        return body

    def create_item(self, body):
        self.items[body["id"]] = body
        return body

    def replace_item(self, item, body):
        assert item == body["id"]
        self.items[item] = body
        return body

    def read_item(self, item, partition_key):
        return self.items[item]

    def delete_item(self, item, partition_key):
        del self.items[item]

    def query_items(self, query, parameters=None, enable_cross_partition_query=False):
        # Keep it simple: return all items; your tests can filter client-side
        return list(self.items.values())


class FakeDB:
    def __init__(self):
        self._containers = {}

    def get_container_client(self, name: str):
        return self._containers.setdefault(name, FakeContainer())


@pytest.fixture
def fake_cosmos_db(monkeypatch, cosmo_db_module):
    """
    Patch shared.cosmo_db._db to an in-memory fake after import.
    """
    fake = FakeDB()
    monkeypatch.setattr(cosmo_db_module, "_db", fake, raising=True)
    return fake


@pytest.fixture(autouse=True)
def mock_kv(monkeypatch):
    import shared.clients as clients

    def fake_get_secret(name: str) -> str:
        return {
            "speechKey": "fake-speech",
            "orchestrator-host--functionKey": "fake-func-key",
            "storageConnectionString": "DefaultEndpointsProtocol=https;AccountName=fake;AccountKey=FAKE;EndpointSuffix=core.windows.net",
        }.get(name, f"fake-{name}")

    monkeypatch.setattr(
        clients, "get_azure_key_vault_secret", fake_get_secret, raising=True
    )

    # Ensure app.py re-import uses the monkeypatched function
    if "app" in sys.modules:
        del sys.modules["app"]
    yield
