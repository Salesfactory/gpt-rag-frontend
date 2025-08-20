from __future__ import annotations
import atexit
import json
import logging
from functools import lru_cache
from typing import Optional

from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
from azure.storage.queue import QueueClient

from .config import CONFIG

log = logging.getLogger(__name__)


# -----------------------------
# Credentials (Managed Identity)
# -----------------------------
@lru_cache(maxsize=1)
def get_default_azure_credential() -> DefaultAzureCredential:
    return DefaultAzureCredential()


# -----------------------------
# Cosmos DB (shared)
# -----------------------------
@lru_cache(maxsize=1)
def get_cosmos_client() -> CosmosClient:
    log.info("Creating CosmosClient for %s", CONFIG.cosmos_uri)
    return CosmosClient(
        CONFIG.cosmos_uri, get_default_azure_credential(), consistency_level="Session"
    )


@lru_cache(maxsize=1)
def get_cosmos_database():
    return get_cosmos_client().get_database_client(CONFIG.cosmos_db_name)


@lru_cache(maxsize=64)
def get_cosmos_container(container_name: str):
    return get_cosmos_database().get_container_client(container_name)


# --------------------------------------------------------
# Azure Queue Storage (replaces Service Bus queue/sender)
# --------------------------------------------------------
@lru_cache(maxsize=1)
def get_report_jobs_queue_client() -> Optional[QueueClient]:
    """
    Returns a QueueClient for the report-jobs queue, or None if not configured.
    Uses Managed Identity (DefaultAzureCredential) against QUEUE_ACCOUNT_URL.
    """
    if not CONFIG.queue_account_url:
        log.info("QUEUE_ACCOUNT_URL not set; Azure Queue Storage client disabled.")
        return None

    credential = get_default_azure_credential()
    qc = QueueClient(
        account_url=CONFIG.queue_account_url,
        queue_name=CONFIG.queue_name,
        credential=credential,
    )
    try:
        # Idempotent: creates the queue if it doesn't exist; no-op if it does.
        qc.create_queue()
        log.info(
            "Azure Queue Storage ready: %s/%s",
            CONFIG.queue_account_url,
            CONFIG.queue_name,
        )
    except Exception as e:
        log.warning("Failed to ensure Azure Queue Storage queue exists: %s", e)
    return qc


def enqueue_report_job_message(message_dict: dict) -> None:
    """
    Serialize and send a message to the report-jobs Azure Queue.
    Raises RuntimeError if the queue client is not configured.
    """
    qc = get_report_jobs_queue_client()
    if qc is None:
        raise RuntimeError(
            "Azure Queue Storage not configured (QUEUE_ACCOUNT_URL missing)."
        )

    payload = json.dumps(message_dict)
    qc.send_message(payload)
    log.debug("Enqueued report job message: %s", payload)


# -----------------------------
# Warm-up & graceful shutdown
# -----------------------------
def warm_up() -> None:
    """Pre-initialize credential, DB, users container, and the queue client."""
    log.info("Warm-up: initializing Azure clients...")
    _ = get_default_azure_credential()
    _ = get_cosmos_database()
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
    log.info("Warm-up: done.")


def _shutdown():
    log.info("Shutting down Azure clients...")
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


# -----------------------------
# Convenience exports
# -----------------------------
USERS_CONT = CONFIG.users_container
JOBS_CONT = CONFIG.jobs_container
REPORT_JOBS_QUEUE_NAME = CONFIG.queue_name
