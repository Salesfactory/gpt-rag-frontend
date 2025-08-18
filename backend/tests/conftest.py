# tests/conftest.py (continued)
import pytest


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
