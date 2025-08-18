# backend/shared/clients.py
from __future__ import annotations
import atexit
import logging
from functools import lru_cache
from typing import Optional

from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
from azure.servicebus import ServiceBusClient
from .config import CONFIG

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _credential() -> DefaultAzureCredential:
    return DefaultAzureCredential()


@lru_cache(maxsize=1)
def _cosmos() -> CosmosClient:
    log.info("Creating CosmosClient for %s", CONFIG.cosmos_uri)
    return CosmosClient(CONFIG.cosmos_uri, _credential(), consistency_level="Session")


@lru_cache(maxsize=1)
def _db():
    return _cosmos().get_database_client(CONFIG.cosmos_db_name)


@lru_cache(maxsize=64)
def get_container(name: str):
    return _db().get_container_client(name)


@lru_cache(maxsize=1)
def sb_client() -> Optional[ServiceBusClient]:
    if not CONFIG.sb_fqns:
        log.info("SB_FQNS not set; Service Bus client disabled.")
        return None
    return ServiceBusClient(
        fully_qualified_namespace=CONFIG.sb_fqns, credential=_credential()
    )


def warm_up() -> None:
    """Pre-initialize credential, DB, and the USERS container."""
    log.info("Warm-up: initializing Azure clients...")
    _ = _credential()
    _ = _db()
    try:
        _ = get_container(CONFIG.users_container)  # <- users container
        log.info("Warm-up: users container ready: %s", CONFIG.users_container)
    except Exception as e:
        log.warning(
            "Warm-up: failed to get users container '%s': %s", CONFIG.users_container, e
        )
    try:
        _ = sb_client()
    except Exception as e:
        log.warning("Warm-up: failed to init Service Bus client: %s", e)
    log.info("Warm-up: done.")


def _shutdown():
    log.info("Shutting down Azure clients...")
    try:
        sb = sb_client()
        if sb:
            sb.close()
    except Exception:
        pass
    try:
        cos = _cosmos()
        if hasattr(cos, "close"):
            cos.close()
    except Exception:
        pass


atexit.register(_shutdown)

# Convenience exports
USERS_CONT = CONFIG.users_container
JOBS_CONT = CONFIG.jobs_container
SB_QUEUE = CONFIG.sb_queue
