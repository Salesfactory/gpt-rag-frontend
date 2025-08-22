# backend/shared/config.py
import os
from dataclasses import dataclass
from utils import get_azure_key_vault_secret


@dataclass(frozen=True)
class Settings:
    # Storage account name (used to derive the Blob service URL if no override is given)
    storage_account: str = os.getenv("STORAGE_ACCOUNT", "")
    # Explicit Blob service URL override (e.g., "https://mystorage.blob.core.windows.net")
    blob_account_url_override: str = get_azure_key_vault_secret(
        "storageConnectionString"
    )
    # Default containers (optional, for convenience)
    default_container: str = os.getenv("BLOB_CONTAINER_NAME", "public")
    financial_container: str = os.getenv("FINANCIAL_AGENT_CONTAINER", "financial")
    # Optional base folder used by your previous manager (kept for compatibility)
    blob_base_folder: str = os.getenv("BLOB_BASE_FOLDER", "financial")
    # Optional SAS token for link building (MI is used for auth; SAS is only for generating shareable URLs)
    blob_sas_token: str = os.getenv("BLOB_SAS_TOKEN", "")
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
    def blob_account_url(self) -> str:
        """
        Blob endpoint URL: explicit override or derived from storage account.
        """
        if self.blob_account_url_override:
            return self.blob_account_url_override
        return (
            f"https://{self.storage_account}.blob.core.windows.net"
            if self.storage_account
            else ""
        )

    @property
    def storage_account_url(self) -> str:
        """
        Back-compat alias used by some client fallbacks.
        """
        return self.blob_account_url

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
