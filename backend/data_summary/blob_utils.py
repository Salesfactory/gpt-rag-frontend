from __future__ import annotations
import io
from typing import Dict, Tuple
from azure.core.exceptions import ResourceNotFoundError
from shared import clients
from data_summary.file_utils import bytesio_to_tempfile, detect_extension


def download_blob_to_temp(blob_name: str, container_name: str) -> Tuple[str, Dict]:
    """
    Download a blob into a temp file.
    Returns:
        (temp_path, metadata)
    Raises:
        ResourceNotFoundError: if the blob does not exist.
        RuntimeError: if Blob service is not configured.
    """
    container_client = clients.get_blob_container_client(container_name)
    blob_client = container_client.get_blob_client(blob_name)
    try:
        props = blob_client.get_blob_properties()
    except ResourceNotFoundError:
        # re-raise to keep behavior explicit for callers
        raise ResourceNotFoundError(message="Blob not found", response=None)
    blob_metadata = props.metadata or {}
    raw_file = blob_client.download_blob(max_concurrency=2).readall()
    buffer = io.BytesIO(raw_file)
    temp_path = bytesio_to_tempfile(buffer, detect_extension(blob_name))
    return temp_path, blob_metadata

def update_blob_metadata(blob_name: str, metadata: Dict, container_name: str) -> Dict:
    """
    Merge and update blob metadata with the provided key/values.
    Notes:
      - Azure requires all metadata values to be strings.
    Returns:
      merged metadata dict.
    Raises:
      ResourceNotFoundError: if the blob does not exist.
      RuntimeError: if Blob service is not configured.
    """
    container_client = clients.get_blob_container_client(container_name)
    blob_client = container_client.get_blob_client(blob_name)
    try:
        props = blob_client.get_blob_properties()
    except ResourceNotFoundError:
        raise ResourceNotFoundError(message="Blob not found", response=None)
    existing = props.metadata or {}
    merged = {**existing, **(metadata or {})}
    merged = {str(k): ("" if v is None else str(v)) for k, v in merged.items()}
    blob_client.set_blob_metadata(metadata=merged)
    return merged

def build_blob_name(organization_id: str, file_name: str, prefix: str) -> str:
    """Normalize file path to match blob storage structure."""
    if file_name.startswith(f"{prefix}/"):
        return file_name
    return f"{prefix}/{organization_id}/{file_name}"

