# backend/shared/clients.py
from __future__ import annotations
import atexit
import json
import logging
from functools import lru_cache
from typing import Optional
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
from azure.storage.queue import QueueClient
from azure.keyvault.secrets import SecretClient  # <-- NEW

from .config import CONFIG

log = logging.getLogger(__name__)


# -----------------------------
# Credentials (Managed Identity)
# -----------------------------
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
    return BlobServiceClient.from_connection_string(CONFIG.blob_account_url_override)


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
# Cosmos DB (shared)
# -----------------------------
@lru_cache(maxsize=1)
def get_cosmos_client() -> CosmosClient:
    """Create a cached CosmosClient using MI and session consistency."""
    log.info("Creating CosmosClient for %s", CONFIG.cosmos_uri)
    return CosmosClient(
        CONFIG.cosmos_uri, get_default_azure_credential(), consistency_level="Session"
    )


@lru_cache(maxsize=1)
def get_cosmos_database():
    """Get the database client configured by CONFIG."""
    return get_cosmos_client().get_database_client(CONFIG.cosmos_db_name)


@lru_cache(maxsize=64)
def get_cosmos_container(container_name: str):
    """Get a cached container client by name."""
    return get_cosmos_database().get_container_client(container_name)


# --------------------------------------------------------
# Azure Queue Storage (replaces Service Bus queue/sender)
# --------------------------------------------------------
@lru_cache(maxsize=1)
def get_report_jobs_queue_client() -> Optional[QueueClient]:
    """
    Return the QueueClient for the report-jobs queue or None if not configured.
    Uses MI (DefaultAzureCredential) against CONFIG.queue_account_url.
    """
    if not CONFIG.queue_account_url:
        log.info("QUEUE_ACCOUNT_URL not set; Azure Queue Storage client disabled.")
        return None
    qc = QueueClient(
        account_url=CONFIG.queue_account_url,
        queue_name=CONFIG.queue_name,
        credential=get_default_azure_credential(),
    )
    try:
        qc.create_queue()  # idempotent
        log.info(
            "Azure Queue Storage ready: %s/%s",
            CONFIG.queue_account_url,
            CONFIG.queue_name,
        )
    except Exception as e:
        log.warning("Failed to ensure queue exists: %s", e)
    return qc


def enqueue_report_job_message(message_dict: dict) -> None:
    """
    Serialize and send a message to the report-jobs Azure Queue.

    Raises:
        RuntimeError: If the queue client is not configured.
    """
    qc = get_report_jobs_queue_client()
    if qc is None:
        raise RuntimeError(
            "Azure Queue Storage not configured (QUEUE_ACCOUNT_URL or AZURE_STORAGE_ACCOUNT missing)."
        )
    payload = json.dumps(message_dict)
    qc.send_message(payload)
    log.debug("Enqueued report job message: %s", payload)


# -----------------------------
# Azure Key Vault (new)
# -----------------------------
@lru_cache(maxsize=1)
def get_secret_client() -> SecretClient:
    """
    Build a cached SecretClient for Key Vault using MI.

    Returns:
        SecretClient

    Raises:
        RuntimeError: if CONFIG.key_vault_url is not set.
    """
    if not CONFIG.key_vault_url:
        raise RuntimeError(
            "Key Vault not configured. Set AZURE_KEY_VAULT_NAME or AZURE_KEY_VAULT_URL."
        )
    log.info("Creating SecretClient for %s", CONFIG.key_vault_url)
    return SecretClient(
        vault_url=CONFIG.key_vault_url, credential=get_default_azure_credential()
    )


def get_azure_key_vault_secret(secret_name: str) -> str:
    """
    Retrieve a secret's current value from Azure Key Vault.

    Args:
        secret_name: The name of the secret.

    Returns:
        str: Secret value.

    Raises:
        Exception: Any underlying SDK error will be propagated (and can be caught by caller).
    """
    log.info(
        "[webbackend] retrieving Key Vault secret %s from %s",
        secret_name,
        CONFIG.key_vault_url or "<unset>",
    )
    secret = get_secret_client().get_secret(secret_name)
    return secret.value


# -----------------------------
# Warm-up & graceful shutdown
# -----------------------------
def warm_up() -> None:
    """Pre-initialize credential, DB, users container, queue client, Blob client, and SecretClient."""
    log.info("Warm-up: initializing Azure clients...")
    _ = get_default_azure_credential()
    _ = get_default_azure_credential()
    _ = get_cosmos_database()
    try:
        _ = get_blob_service_client()
    except Exception as e:
        log.warning("Warm-up: failed to init Azure Blob Storage client: %s", e)
    try:
        _ = get_cosmos_container(CONFIG.users_container)
        log.info("Warm-up: users container ready: %s", CONFIG.users_container)
    except Exception as e:
        log.warning(
            "Warm-up: failed to get users container '%s': %s", CONFIG.users_container, e
        )
    try:
        _ = get_report_jobs_queue_client()
    except Exception as e:
        log.warning("Warm-up: failed to init Azure Queue Storage client: %s", e)
    try:
        # Do not fetch any secret here; just build the client so import-time callers work.
        _ = get_secret_client()
    except Exception as e:
        # Safe to run app without Key Vault if not needed on startup
        log.warning("Warm-up: Key Vault not initialized: %s", e)
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
    try:
        qc = get_report_jobs_queue_client()
        if qc:
            qc.close()
    except Exception:
        pass
    try:
        cos = get_cosmos_client()
        if hasattr(cos, "close"):
            cos.close()
    except Exception:
        pass


atexit.register(_shutdown)

# Convenience exports
USERS_CONT = CONFIG.users_container
JOBS_CONT = CONFIG.jobs_container
REPORT_JOBS_QUEUE_NAME = CONFIG.queue_name
