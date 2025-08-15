import io

from financial_doc_processor import BlobStorageManager
from azure.core.exceptions import ResourceNotFoundError
from data_summary.file_utils import (bytesio_to_tempfile, detect_extension)


def download_blob_to_temp(blob_name: str, container_name) -> tuple[str, dict]:
    """Download blob and return temp file path + metadata."""
    blob_storage_manager = BlobStorageManager()
    container_client = blob_storage_manager.blob_service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(blob_name)

    if not blob_client.exists():
        raise ResourceNotFoundError("Blob not found")

    blob_properties = blob_client.get_blob_properties()
    blob_metadata = blob_properties.metadata or {}

    raw_file = blob_client.download_blob().readall()
    buffer = io.BytesIO(raw_file)

    temp_path = bytesio_to_tempfile(buffer, detect_extension(blob_name))
    return temp_path, blob_metadata


def update_blob_metadata(blob_name: str, metadata: dict, container_name):
    """Merge and update blob metadata."""
    blob_storage_manager = BlobStorageManager()
    container_client = blob_storage_manager.blob_service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(blob_name)

    blob_client.set_blob_metadata(metadata=metadata)
    return metadata

def build_blob_name(organization_id: str, file_name: str, prefix: str) -> str:
    """Normalize file path to match blob storage structure."""
    if file_name.startswith(f"{prefix}/"):
        return file_name
    return f"{prefix}/{organization_id}/{file_name}"