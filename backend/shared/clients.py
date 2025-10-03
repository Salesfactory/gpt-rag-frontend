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
from azure.core.exceptions import HttpResponseError, ClientAuthenticationError, ResourceNotFoundError
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
        logging_enable=False,
    )
    try:
        qc.create_queue()  # idempotent
        log.debug("Azure Queue Storage ready: %s/%s", _host(CONFIG.queue_account_url), CONFIG.queue_name)
    except Exception as e:
        log.warning("Failed to ensure queue exists: %s", e)
    return qc

def _approx_base64_len(n_bytes: int) -> int:
    # base64 expands by 4/3, rounded up to multiple of 4
    return ((n_bytes + 2) // 3) * 4

def enqueue_report_job_message(
    message_dict: dict,
    *,
    visibility_timeout: int | None = None,
    time_to_live: int | None = None,
    timeout: int | None = None,
) -> None:
    """
    Serialize and send a message to the report-jobs Azure Queue with rich diagnostics.

    Logs:
      - queue endpoint & name
      - raw and approx base64 sizes (64 KiB limit)
      - returned message_id, pop_receipt, request IDs
      - queue approximate message count after enqueue

    Raises:
      RuntimeError if the queue client is not configured.
      Re-raises HttpResponseError for callers that want to handle it; logs full detail.
    """
    qc = get_report_jobs_queue_client()
    if qc is None:
        log.error("Azure Queue Storage not configured (account_url missing).")
        raise RuntimeError("Azure Queue Storage is not configured.")

    # Build payload
    payload = base64.b64encode(json.dumps(message_dict, separators=(",", ":")).encode("utf-8")).decode("utf-8")
    raw_len = len(payload.encode("utf-8"))
    approx_b64 = _approx_base64_len(raw_len)

    # The queue service enforces 64 KiB on the *encoded* message.
    # Keep a headroom (e.g., <= 63*1024) to be safe.
    if approx_b64 > 63 * 1024:
        log.warning(
            "Queue message likely too large after base64 (raw=%dB, approx_b64=%dB). "
            "Trim payload or store large data in Blob and reference it.",
            raw_len, approx_b64,
        )

    # Sanity checks on visibility/TTL
    if visibility_timeout is not None and time_to_live is not None and visibility_timeout > time_to_live:
        log.warning(
            "visibility_timeout (%s) > time_to_live (%s). Message may expire before becoming visible.",
            visibility_timeout, time_to_live,
        )

    # Verbose pre-send log (no PII)
    log.info(
        "Enqueue -> account_host=%s queue=%s raw=%dB ~b64=%dB vis=%s ttl=%s",
        _host(CONFIG.queue_account_url), CONFIG.queue_name, raw_len, approx_b64,
        visibility_timeout, time_to_live,
    )
    if QUEUE_DEBUG:
        log.debug("Enqueue payload: %s", payload)

    try:
        qm = qc.send_message(
            payload,
            visibility_timeout=visibility_timeout,
            time_to_live=time_to_live,
            timeout=timeout,
        )
        if QUEUE_DEBUG:
            log.debug("Sent payload (b64): %s", payload)
        # Post-send diagnostics
        try:
            props = qc.get_queue_properties()
            approx_count = getattr(props, "approximate_message_count", None)
        except Exception as e_props:
            approx_count = None
            log.debug("Failed to read queue properties after send: %s", e_props)

        log.info(
            "Enqueued OK: msg_id=%s next_visible=%s expires=%s approx_count=%s",
            getattr(qm, "id", None),
            getattr(qm, "next_visible_on", None),
            getattr(qm, "expires_on", None),
            approx_count,
        )
    except (ClientAuthenticationError, ResourceNotFoundError, HttpResponseError) as e:
        # Try to surface the most useful details (HTTP code, x-ms-request-id, error code)
        status = getattr(getattr(e, "response", None), "status_code", None)
        headers = getattr(getattr(e, "response", None), "headers", {}) or {}
        req_id = headers.get("x-ms-request-id") or headers.get("x-ms-client-request-id")
        err_code = headers.get("x-ms-error-code")
        log.error(
            "Enqueue FAILED: status=%s err_code=%s request_id=%s exc=%r",
            status, err_code, req_id, e,
        )
        # Common causes to call out explicitly:
        if status == 403:
            log.error("403 forbidden: check RBAC. Managed Identity needs 'Storage Queue Data Message Sender' on the account/queue.")
        if status == 404:
            log.error("404 not found: queue may not exist or wrong account/queue name. account_host=%s queue=%s",
                      _host(CONFIG.queue_account_url), CONFIG.queue_name)
        raise
    except Exception as e:
        log.exception("Unexpected failure enqueuing message: %r", e)
        raise


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
CATEGORIES_CONT = CONFIG.categories_container
REPORT_JOBS_QUEUE_NAME = CONFIG.queue_name
