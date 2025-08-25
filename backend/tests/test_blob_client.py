import io
import pytest
from azure.core.exceptions import ResourceNotFoundError
from data_summary.blob_utils import download_blob_to_temp, update_blob_metadata


# Fake Blob client to be returned by our container client.
class FakeBlobClient:
    def __init__(self, *, metadata=None, raw_file: bytes = b'fake content', raise_not_found: bool = False):
        self._metadata = metadata
        self._raw_file = raw_file
        self.raise_not_found = raise_not_found

    def get_blob_properties(self):
        if self.raise_not_found:
            raise ResourceNotFoundError("Blob not found")
        # Fake properties object with a `metadata` attribute.
        class Props:
            pass
        props = Props()
        props.metadata = self._metadata
        return props

    def download_blob(self, max_concurrency: int = 1):
        class FakeDownload:
            def __init__(self, data):
                self.data = data

            def readall(self):
                return self.data

        return FakeDownload(self._raw_file)


# Fake Container client that returns our fake blob client.
class FakeContainerClient:
    def __init__(self, blob_client: FakeBlobClient):
        self._blob_client = blob_client

    def get_blob_client(self, blob_name: str):
        return self._blob_client


def fake_bytesio_to_tempfile(buffer: io.BytesIO, extension: str) -> str:
    # For testing we just return a predictable file path.
    return f'/tmp/fake_tempfile{extension}'


def fake_detect_extension(blob_name: str) -> str:
    # For testing we return a constant extension.
    return '.fake'


def test_download_blob_to_temp_success(monkeypatch):
    # Setup the fake blob and container clients for the happy path.
    fake_metadata = {'key': 'value'}
    fake_blob_client = FakeBlobClient(metadata=fake_metadata, raw_file=b'hello world')
    fake_container_client = FakeContainerClient(fake_blob_client)
    
    # Patch the get_blob_container_client call in the module under test.
    from shared import clients
    monkeypatch.setattr(clients, 'get_blob_container_client', lambda container_name: fake_container_client)
    
    # Patch bytesio_to_tempfile and detect_extension in blob_utils (where they are used).
    from data_summary import blob_utils
    monkeypatch.setattr(blob_utils, 'bytesio_to_tempfile', fake_bytesio_to_tempfile)
    monkeypatch.setattr(blob_utils, 'detect_extension', fake_detect_extension)
    
    from data_summary.blob_utils import download_blob_to_temp
    temp_path, metadata = download_blob_to_temp('test_blob', 'test_container')
    assert temp_path == '/tmp/fake_tempfile.fake'
    assert metadata == fake_metadata


def test_download_blob_to_temp_blob_not_found(monkeypatch):
    # Setup a fake blob client that simulates a missing blob (raises ResourceNotFoundError).
    fake_blob_client = FakeBlobClient(raise_not_found=True)
    fake_container_client = FakeContainerClient(fake_blob_client)
    
    from shared import clients
    monkeypatch.setattr(clients, 'get_blob_container_client', lambda container_name: fake_container_client)
    
    with pytest.raises(ResourceNotFoundError, match="Blob not found"):
        download_blob_to_temp('nonexistent_blob', 'test_container')


def test_download_blob_to_temp_service_not_configured(monkeypatch):
    # Simulate that get_blob_container_client raises a RuntimeError because the service is not configured.
    from shared import clients
    monkeypatch.setattr(clients, 'get_blob_container_client', lambda container_name: (_ for _ in ()).throw(RuntimeError("Azure Blob Storage not configured (no account URL).")))
    
    with pytest.raises(RuntimeError, match="Azure Blob Storage not configured"):
        download_blob_to_temp('any_blob', 'test_container')


class FakeProps:
    def __init__(self, metadata=None):
        self.metadata = metadata


class FakeBlobClientUpdate:
    def __init__(self, *, metadata=None, raise_not_found=False):
        self._initial_metadata = metadata
        self.raise_not_found = raise_not_found
        self.updated_metadata = None

    def get_blob_properties(self):
        if self.raise_not_found:
            raise ResourceNotFoundError("Blob not found", response=None)
        return FakeProps(metadata=self._initial_metadata)

    def set_blob_metadata(self, metadata):
        self.updated_metadata = metadata  # simulate saving metadata


class FakeContainerClient:
    def __init__(self, blob_client: FakeBlobClientUpdate):
        self._blob_client = blob_client

    def get_blob_client(self, blob_name: str):
        return self._blob_client


def test_update_blob_metadata_success(monkeypatch):
    # initial metadata with key 'a', then new metadata that overrides 'a' to None (should become empty string)
    initial_metadata = {'a': '1'}
    new_metadata = {'b': '2', 'a': None}  # 'a' becomes ""
    expected_merged = {'a': '', 'b': '2'}

    fake_blob_client = FakeBlobClientUpdate(metadata=initial_metadata)
    fake_container_client = FakeContainerClient(fake_blob_client)

    # Patch the get_blob_container_client call from shared.clients.
    from shared import clients
    monkeypatch.setattr(clients, 'get_blob_container_client', lambda container_name: fake_container_client)

    merged = update_blob_metadata("test_blob", new_metadata, "test_container")
    assert merged == expected_merged
    assert fake_blob_client.updated_metadata == expected_merged


def test_update_blob_metadata_blob_not_found(monkeypatch):
    fake_blob_client = FakeBlobClientUpdate(raise_not_found=True)
    fake_container_client = FakeContainerClient(fake_blob_client)

    from shared import clients
    monkeypatch.setattr(clients, 'get_blob_container_client', lambda container_name: fake_container_client)

    with pytest.raises(ResourceNotFoundError, match="Blob not found"):
        update_blob_metadata("nonexistent_blob", {"b": "2"}, "test_container")


def test_update_blob_metadata_service_not_configured(monkeypatch):
    # Simulate get_blob_container_client raising a RuntimeError (service not configured).
    from shared import clients
    monkeypatch.setattr(
        clients,
        'get_blob_container_client',
        lambda container_name: (_ for _ in ()).throw(
            RuntimeError("Azure Blob Storage not configured (no account URL).")
        )
    )

    with pytest.raises(RuntimeError, match="Azure Blob Storage not configured"):
        update_blob_metadata("any_blob", {"b": "2"}, "test_container")