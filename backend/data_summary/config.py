import os
from dataclasses import dataclass

@dataclass(frozen=True)
class AzureOpenAIConfig:
    endpoint: str
    api_key: str
    api_version: str
    deployment_name: str

def get_azure_openai_config(deployment_name: str = "gpt-4.1") -> AzureOpenAIConfig:
    """Fetch required Azure OpenAI config from environment variables.

    Raises:
        RuntimeError: If one or more required environment variables are missing or empty.

    Returns:
        AzureOpenAIConfig: Fully initialized configuration object.
    """
    required_env_vars = ["O1_ENDPOINT", "O1_KEY"]

    env_values = {var: os.getenv(var, "").strip() for var in required_env_vars}

    missing = [var for var, value in env_values.items() if not value]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Please set them before running this program."
        )
    
    return AzureOpenAIConfig(
        endpoint=env_values["O1_ENDPOINT"],
        api_key=env_values["O1_KEY"],
        api_version="2025-04-01-preview", # TODO Update the version in the infra
        deployment_name=deployment_name
    )
