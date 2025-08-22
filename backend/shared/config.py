# backend/shared/config.py
import os
from dataclasses import dataclass
from utils import get_azure_key_vault_secret

@dataclass(frozen=True)
class Settings:
    # Storage account name (used to derive the Blob service URL if no override is given)
    storage_account: str = os.getenv("STORAGE_ACCOUNT", "")
    # Explicit Blob service URL override (e.g., "https://mystorage.blob.core.windows.net")
    blob_account_url_override: str = get_azure_key_vault_secret("storageConnectionString")
    # Default containers (optional, for convenience)
    default_container: str = os.getenv("BLOB_CONTAINER_NAME", "public")
    financial_container: str = os.getenv("FINANCIAL_AGENT_CONTAINER", "financial")
    # Optional base folder used by your previous manager (kept for compatibility)
    blob_base_folder: str = os.getenv("BLOB_BASE_FOLDER", "financial")
    # Optional SAS token for link building (MI is used for auth; SAS is only for generating shareable URLs)
    blob_sas_token: str = os.getenv("BLOB_SAS_TOKEN", "")
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
CONFIG = Settings()