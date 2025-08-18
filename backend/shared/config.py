# backend/shared/config.py
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    cosmos_url: str = os.getenv("COSMOS_URL", "")
    cosmos_account: str = os.getenv("AZURE_DB_ID", "")
    cosmos_db_name: str = os.getenv("COSMOS_DB") or os.getenv(
        "AZURE_DB_NAME", "reports"
    )

    # Containers
    users_container: str = os.getenv("COSMOS_CONTAINER_USERS", "users")
    jobs_container: str = os.getenv("COSMOS_CONTAINER_JOBS", "report_jobs")

    # Service Bus
    sb_fqns: str = os.getenv("SB_FQNS", "")
    sb_queue: str = os.getenv("SB_QUEUE", "report-jobs")

    @property
    def cosmos_uri(self) -> str:
        if self.cosmos_url:
            return self.cosmos_url
        if not self.cosmos_account:
            raise RuntimeError("Set COSMOS_URL or AZURE_DB_ID to configure Cosmos.")
        return f"https://{self.cosmos_account}.documents.azure.com:443/"


CONFIG = Settings()
