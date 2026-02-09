# backend/shared/clients.py
from __future__ import annotations
import os
import atexit
import base64
import json
import logging
from functools import lru_cache
from typing import Optional
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
from azure.storage.queue import QueueClient
from azure.keyvault.secrets import SecretClient
from azure.core.exceptions import (
    HttpResponseError,
    ClientAuthenticationError,
    ResourceNotFoundError,
)
from urllib.parse import urlparse

from .config import CONFIG

log = logging.getLogger(__name__)

QUEUE_DEBUG = os.getenv("QUEUE_DEBUG", "0") == "1"


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc or url
    except Exception:
        return url


# -----------------------------
# Credentials (Managed Identity)
# -----------------------------
@lru_cache(maxsize=1)
def get_default_azure_credential() -> DefaultAzureCredential:
    """Return a cached DefaultAzureCredential for all Azure SDK clients."""
    return DefaultAzureCredential()


# -----------------------------
# Cosmos DB (shared)
# -----------------------------
@lru_cache(maxsize=1)
def get_cosmos_client() -> CosmosClient:
    """Create a cached CosmosClient using MI and session consistency."""
    log.debug("Creating CosmosClient for %s", _host(CONFIG.cosmos_uri))
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
    log.debug("[kv] retrieving secret")
    return SecretClient(
        vault_url=CONFIG.key_vault_url,
        credential=get_default_azure_credential(),
        logging_enable=False,
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
    log.info("[kv] retrieving secret")
    secret = get_secret_client().get_secret(secret_name, logging_enable=False)
    return secret.value


@lru_cache(maxsize=1)
def get_blob_service_client() -> Optional[BlobServiceClient]:
    """
    Return a cached BlobServiceClient or None if not configured.
    """
    log.debug("Creating BlobServiceClient for %s", _host(CONFIG.blob_account_url))
    return BlobServiceClient(
        account_url=CONFIG.blob_account_url,
        credential=get_default_azure_credential(),
        logging_enable=False,
    )


# -----------------------------
# Blob Storage (containers)
# -----------------------------
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
        cos = get_cosmos_client()
        if hasattr(cos, "close"):
            cos.close()
    except Exception:
        pass


atexit.register(_shutdown)

# Convenience exports
USERS_CONT = CONFIG.users_container
JOBS_CONT = CONFIG.jobs_container
CATEGORIES_CONT = CONFIG.categories_container
REPORT_JOBS_QUEUE_NAME = CONFIG.queue_name
