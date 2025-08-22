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

    # Azure Queue Storage
    storage_account: str = os.getenv("AZURE_STORAGE_ACCOUNT", "")
    queue_name: str = os.getenv("QUEUE_NAME", "report-jobs")
    _queue_account_url: str = os.getenv("QUEUE_ACCOUNT_URL", "")

    # Azure Key Vault
    key_vault_name: str = os.getenv("AZURE_KEY_VAULT_NAME", "")
    key_vault_url_override: str = os.getenv("AZURE_KEY_VAULT_URL", "")  # optional

    @property
    def queue_account_url(self) -> str:
        """Queue endpoint URL: explicit override or derived from storage account."""
        if self._queue_account_url:
            return self._queue_account_url
        return (
            f"https://{self.storage_account}.queue.core.windows.net"
            if self.storage_account
            else ""
        )

    @property
    def key_vault_url(self) -> str:
        """Key Vault URL: explicit override or derived from AZURE_KEY_VAULT_NAME."""
        if self.key_vault_url_override:
            return self.key_vault_url_override
        return (
            f"https://{self.key_vault_name}.vault.azure.net"
            if self.key_vault_name
            else ""
        )

    @property
    def cosmos_uri(self) -> str:
        """Prefer explicit COSMOS_URL; otherwise derive from account name."""
        if self.cosmos_url:
            return self.cosmos_url
        if not self.cosmos_account:
            raise RuntimeError("Set COSMOS_URL or AZURE_DB_ID to configure Cosmos.")
        return f"https://{self.cosmos_account}.documents.azure.com:443/"


CONFIG = Settings()
