# backend/shared/config.py
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Cosmos DB
    cosmos_url: str = os.getenv("COSMOS_URL", "")
    cosmos_account: str = os.getenv("AZURE_DB_ID", "")
    cosmos_db_name: str = os.getenv("COSMOS_DB") or os.getenv(
        "AZURE_DB_NAME", "reports"
    )

    # Containers
    users_container: str = os.getenv("COSMOS_CONTAINER_USERS", "users")
    jobs_container: str = os.getenv("COSMOS_CONTAINER_JOBS", "report_jobs")

    # ---- Azure Queue Storage (replacing Service Bus) ----
    # Storage account name, e.g. "mystorageacct"
    storage_account: str = os.getenv("AZURE_STORAGE_ACCOUNT", "")
    # Queue name (defaults to report-jobs)
    queue_name: str = os.getenv("QUEUE_NAME", "report-jobs")
    # Optional explicit override for the full account URL
    _queue_account_url: str = os.getenv("QUEUE_ACCOUNT_URL", "")

    @property
    def queue_account_url(self) -> str:
        """
        Returns the Queue service account URL.
        Priority:
          1) Explicit QUEUE_ACCOUNT_URL if set
          2) Construct from AZURE_STORAGE_ACCOUNT: https://<acct>.queue.core.windows.net
          3) Empty string if neither is available (caller can treat as 'not configured')
        """
        if self._queue_account_url:
            return self._queue_account_url
        if self.storage_account:
            return f"https://{self.storage_account}.queue.core.windows.net"
        return ""

    @property
    def cosmos_uri(self) -> str:
        """
        Prefer explicit COSMOS_URL; otherwise derive from account name.
        """
        if self.cosmos_url:
            return self.cosmos_url
        if not self.cosmos_account:
            raise RuntimeError("Set COSMOS_URL or AZURE_DB_ID to configure Cosmos.")
        return f"https://{self.cosmos_account}.documents.azure.com:443/"


CONFIG = Settings()
