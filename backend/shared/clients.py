# backend/shared/clients.py
from __future__ import annotations
import atexit
import logging
from functools import lru_cache
from typing import Optional
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from shared.config import CONFIG

log = logging.getLogger(__name__)
@lru_cache(maxsize=1)
def get_default_azure_credential() -> DefaultAzureCredential:
    """Return a cached DefaultAzureCredential for all Azure SDK clients."""
    return DefaultAzureCredential()
def _resolve_blob_account_url() -> Optional[str]:
    """
    Resolve the Blob service account URL from config with sensible fallbacks.
    Priority:
      1) CONFIG.blob_account_url
      2) CONFIG.storage_account_url
      3) Derive from CONFIG.queue_account_url (.queue. -> .blob.)
    """
    if getattr(CONFIG, "blob_account_url", None):
        return CONFIG.blob_account_url
    if getattr(CONFIG, "storage_account_url", None):
        return CONFIG.storage_account_url
    if getattr(CONFIG, "queue_account_url", None):
        return str(CONFIG.queue_account_url).replace(".queue.", ".blob.")
    return None
@lru_cache(maxsize=1)
def get_blob_service_client() -> Optional[BlobServiceClient]:
    """
    Return a cached BlobServiceClient or None if not configured.
    """
    account_url = _resolve_blob_account_url()
    if not account_url:
        log.info("Blob account URL not set; BlobServiceClient disabled.")
        return None
    log.info("Creating BlobServiceClient for %s", account_url)
    return BlobServiceClient.from_connection_string(
        CONFIG.blob_account_url_override
    )
@lru_cache(maxsize=64)
def get_blob_container_client(container_name: str):
    """
    Get a cached ContainerClient by name.
    Raises:
        RuntimeError: if Blob service is not configured.
    """
    bsc = get_blob_service_client()
    if bsc is None:
        raise RuntimeError("Azure Blob Storage not configured (no account URL).")
    return bsc.get_container_client(container_name)

# -----------------------------
# Warm-up & graceful shutdown
# -----------------------------
def warm_up() -> None:
    """Pre-initialize credential, DB, users container, queue client, Blob client, and SecretClient."""
    log.info("Warm-up: initializing Azure clients...")
    _ = get_default_azure_credential()
    try:
        _ = get_blob_service_client()
    except Exception as e:
        log.warning("Warm-up: failed to init Azure Blob Storage client: %s", e)
    log.info("Warm-up: done.")
def _shutdown():
    """Close any SDK clients that expose a close()."""
    log.info("Shutting down Azure clients...")
    try:
        bsc = get_blob_service_client()
        if bsc:
            bsc.close()
    except Exception:
        pass
atexit.register(_shutdown)
