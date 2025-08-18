import pytest

import shared.clients as clients
from shared.config import Settings


def _clear_caches():
    """Reset lru_caches so CONFIG changes take effect."""
    clients._credential.cache_clear()
    clients._cosmos.cache_clear()
    clients._db.cache_clear()
    clients.get_container.cache_clear()
    clients.sb_client.cache_clear()


@pytest.fixture(autouse=True)
def fresh_caches():
    _clear_caches()
    yield
    _clear_caches()


@pytest.fixture
def fake_azure(monkeypatch):
    """
    Patch Azure SDK classes referenced by backend.shared.clients and
    replace clients.CONFIG with our own Settings. No network calls happen.
    """
    state = {"cosmos": None, "db": None, "sb": None}

    class FakeCredential:
        pass

    class FakeContainer:
        def __init__(self, name):
            self.name = name

    class FakeDB:
        def __init__(self):
            self.calls = []  # container names requested
            self.containers = {}  # name -> FakeContainer

        def get_container_client(self, name: str):
            self.calls.append(name)
            if name not in self.containers:
                self.containers[name] = FakeContainer(name)
            return self.containers[name]

    class FakeCosmosClient:
        def __init__(self, uri, credential, consistency_level=None):
            self.uri = uri
            self.credential = credential
            self.consistency_level = consistency_level
            self.closed = False
            self.db = FakeDB()
            state["cosmos"] = self

        def get_database_client(self, name):  # name == CONFIG.cosmos_db_name
            return self.db

        def close(self):
            self.closed = True

    class FakeServiceBusClient:
        def __init__(self, fully_qualified_namespace, credential):
            self.fully_qualified_namespace = fully_qualified_namespace
            self.credential = credential
            self.closed = False
            state["sb"] = self

        def close(self):
            self.closed = True

    # Patch SDK classes INSIDE the clients module
    monkeypatch.setattr(clients, "DefaultAzureCredential", FakeCredential)
    monkeypatch.setattr(clients, "CosmosClient", FakeCosmosClient)
    monkeypatch.setattr(clients, "ServiceBusClient", FakeServiceBusClient)

    # Replace CONFIG with our own (frozen) Settings instance
    test_config = Settings(
        cosmos_url="https://acct.documents.azure.com:443/",  # satisfies cosmos_uri property
        cosmos_account="ignored-when-url-present",
        cosmos_db_name="mydb",
        users_container="users",
        jobs_container="report_jobs",
        sb_fqns="sb-namespace.example.net",
        sb_queue="report-jobs",
    )
    monkeypatch.setattr(clients, "CONFIG", test_config, raising=True)

    _clear_caches()
    return state


def test_warm_up_initializes_cosmos_users_and_sb(fake_azure):
    # Act
    clients.warm_up()

    # Cosmos created and 'users' container touched once
    cos = clients._cosmos()
    assert cos is fake_azure["cosmos"]
    assert cos.uri == clients.CONFIG.cosmos_uri
    assert fake_azure["cosmos"].db.calls == ["users"]
    assert "users" in fake_azure["cosmos"].db.containers

    # SB created
    sb = clients.sb_client()
    assert sb is fake_azure["sb"]
    assert sb.fully_qualified_namespace == clients.CONFIG.sb_fqns

    # Same credential shared
    assert cos.credential is sb.credential is clients._credential()


def test_get_container_is_cached(fake_azure):
    c1 = clients.get_container("report_jobs")
    c2 = clients.get_container("report_jobs")
    assert c1 is c2, "Expected lru_cache to cache containers by name"
    # Only one DB call for that container
    assert fake_azure["cosmos"].db.calls.count("report_jobs") == 1


def test_sb_client_none_when_fqdn_absent(monkeypatch, fake_azure):
    # Replace CONFIG with same values but no SB FQDN
    cfg = Settings(
        cosmos_url="https://acct.documents.azure.com:443/",
        cosmos_account="",
        cosmos_db_name="mydb",
        users_container="users",
        jobs_container="report_jobs",
        sb_fqns="",  # disables SB
        sb_queue="report-jobs",
    )
    monkeypatch.setattr(clients, "CONFIG", cfg, raising=True)
    _clear_caches()

    sb = clients.sb_client()
    assert sb is None

    # warm_up should tolerate missing SB too
    clients.warm_up()
    assert fake_azure["sb"] is None  # no SB client constructed


def test_shutdown_closes_both_clients(fake_azure):
    clients.warm_up()

    # Precondition
    assert fake_azure["cosmos"].closed is False
    assert fake_azure["sb"].closed is False

    clients._shutdown()

    assert fake_azure["cosmos"].closed is True
    assert fake_azure["sb"].closed is True

    # Idempotent call
    clients._shutdown()
    assert fake_azure["cosmos"].closed is True
    assert fake_azure["sb"].closed is True
