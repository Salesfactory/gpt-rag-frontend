import pytest

import shared.clients as clients

import shared.config as config


def _clear_caches():
    """Reset lru_caches so CONFIG changes take effect."""
    # credential & cosmos
    clients.get_default_azure_credential.cache_clear()
    clients.get_cosmos_client.cache_clear()
    clients.get_cosmos_database.cache_clear()
    clients.get_cosmos_container.cache_clear()
    # queue storage
    clients.get_report_jobs_queue_client.cache_clear()


@pytest.fixture(autouse=True)
def fresh_caches():
    _clear_caches()
    yield
    _clear_caches()


@pytest.fixture
def fake_azure(monkeypatch):
    """
    Patch Azure SDK classes referenced by shared.clients and
    replace clients.CONFIG with our own Settings. No network calls happen.
    """
    state = {"cosmos": None, "db": None, "queue": None}

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

    class FakeQueueClient:
        def __init__(self, account_url, queue_name, credential):
            self.account_url = account_url
            self.queue_name = queue_name
            self.credential = credential
            self.closed = False
            self.created = False
            self.sent = []
            state["queue"] = self

        def create_queue(self):
            self.created = True

        def send_message(self, body):
            self.sent.append(body)

        def close(self):
            self.closed = True

    # Patch SDK classes INSIDE the clients module
    monkeypatch.setattr(clients, "DefaultAzureCredential", FakeCredential)
    monkeypatch.setattr(clients, "CosmosClient", FakeCosmosClient)
    monkeypatch.setattr(clients, "QueueClient", FakeQueueClient)

    # Replace CONFIG with our own (frozen) Settings instance
    # Use storage_account so queue_account_url is derived automatically.
    test_config = config.Settings(
        cosmos_url="https://acct.documents.azure.com:443/",  # satisfies cosmos_uri property
        cosmos_account="ignored-when-url-present",
        cosmos_db_name="mydb",
        users_container="users",
        jobs_container="reportJobs",
        storage_account="mystorageacct",
        queue_name="report-jobs",
        _queue_account_url="",  # force derivation from storage_account
    )
    monkeypatch.setattr(clients, "CONFIG", test_config, raising=True)

    _clear_caches()
    return state


def test_warm_up_initializes_cosmos_users_and_queue(fake_azure):
    # Act
    clients.warm_up()

    # Cosmos created and 'users' container touched once
    cos = clients.get_cosmos_client()
    assert cos is fake_azure["cosmos"]
    assert cos.uri == clients.CONFIG.cosmos_uri
    assert fake_azure["cosmos"].db.calls == ["users"]
    assert "users" in fake_azure["cosmos"].db.containers

    # Queue client created and ensured
    qc = clients.get_report_jobs_queue_client()
    assert qc is fake_azure["queue"]
    assert qc.account_url == clients.CONFIG.queue_account_url
    assert qc.queue_name == clients.CONFIG.queue_name
    assert qc.created is True  # create_queue() invoked during init

    # Same credential shared
    assert cos.credential is qc.credential is clients.get_default_azure_credential()


def test_get_cosmos_container_is_cached(fake_azure):
    c1 = clients.get_cosmos_container("reportJobs")
    c2 = clients.get_cosmos_container("reportJobs")
    assert c1 is c2, "Expected lru_cache to cache containers by name"
    # Only one DB call for that container
    assert fake_azure["cosmos"].db.calls.count("reportJobs") == 1


def test_queue_client_none_when_not_configured(monkeypatch, fake_azure):
    # Replace CONFIG with same values but no storage account and no explicit URL
    cfg = config.Settings(
        cosmos_url="https://acct.documents.azure.com:443/",
        cosmos_account="",
        cosmos_db_name="mydb",
        users_container="users",
        jobs_container="report_jobs",
        storage_account="",  # disables queue derivation
        queue_name="report-jobs",
        _queue_account_url="",  # no explicit override
    )
    monkeypatch.setattr(clients, "CONFIG", cfg, raising=True)
    _clear_caches()

    qc = clients.get_report_jobs_queue_client()
    assert qc is None

    # warm_up should tolerate missing queue client too
    clients.warm_up()
    assert fake_azure["queue"] is None  # no QueueClient constructed


def test_shutdown_closes_both_clients(fake_azure):
    clients.warm_up()

    # Precondition
    assert fake_azure["cosmos"].closed is False
    assert fake_azure["queue"].closed is False

    clients._shutdown()

    assert fake_azure["cosmos"].closed is True
    assert fake_azure["queue"].closed is True

    # Idempotent call
    clients._shutdown()
    assert fake_azure["cosmos"].closed is True
    assert fake_azure["queue"].closed is True
