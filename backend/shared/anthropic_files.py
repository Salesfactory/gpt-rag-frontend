from __future__ import annotations

import logging
import mimetypes
from pathlib import Path
from typing import Any, Dict, Optional
from dotenv import load_dotenv

import os

import anthropic
from anthropic import Anthropic

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_BETA_HEADER = "files-api-2025-04-14"
DEFAULT_TIMEOUT_S = 60.0


class AnthropicFilesError(Exception):
    """Base exception for Anthropic Files API operations."""


class AnthropicFilesConfigError(AnthropicFilesError):
    """Raised when required configuration is missing or invalid."""


class AnthropicFilesRequestError(AnthropicFilesError):
    """Raised when a request to the Files API fails."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        error_type: Optional[str] = None,
        response_text: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.response_text = response_text


class AnthropicFilesClient:
    """Sync client wrapper for the Anthropic Files API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        beta_header: str = DEFAULT_BETA_HEADER,
        timeout: Optional[float] = DEFAULT_TIMEOUT_S,
        max_retries: Optional[int] = None,
        default_headers: Optional[Dict[str, str]] = None,
        client: Optional[Anthropic] = None,
        http_client: Optional[Any] = None,
    ) -> None:
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise AnthropicFilesConfigError(
                "Missing Anthropic API key. Set ANTHROPIC_API_KEY."
            )

        self.beta_header = beta_header

        self._client = client or self._build_client(
            api_key=self.api_key,
            timeout=timeout,
            max_retries=max_retries,
            default_headers=default_headers,
            http_client=http_client,
        )
        self._owns_client = client is None

    def __enter__(self) -> "AnthropicFilesClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def _build_client(
        self,
        *,
        api_key: str,
        timeout: Optional[float],
        max_retries: Optional[int],
        default_headers: Optional[Dict[str, str]],
        http_client: Optional[Any],
    ) -> Anthropic:
        headers = {"anthropic-beta": self.beta_header}
        if default_headers:
            headers.update(default_headers)

        client_kwargs: Dict[str, Any] = {
            "api_key": api_key,
            "default_headers": headers,
        }
        if timeout is not None:
            client_kwargs["timeout"] = timeout
        if max_retries is not None:
            client_kwargs["max_retries"] = max_retries
        if http_client is not None:
            client_kwargs["http_client"] = http_client

        return Anthropic(**client_kwargs)

    def upload_file(
        self,
        file_path: str | Path,
        *,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload a file and return the Files API metadata response.
        """
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            raise AnthropicFilesError(f"File not found: {path}")

        resolved_name = filename or path.name
        resolved_mime = mime_type or mimetypes.guess_type(resolved_name)[0]
        if not resolved_mime:
            resolved_mime = "application/octet-stream"

        if filename or mime_type:
            file_payload = (resolved_name, path.read_bytes(), resolved_mime)
        else:
            file_payload = path

        return self._call_api(self._client.beta.files.upload, file=file_payload)

    def list_files(self, **params: Any) -> Any:
        """
        List uploaded files.
        """
        return self._call_api(self._client.beta.files.list, **params)

    def get_file_metadata(self, file_id: str) -> Dict[str, Any]:
        """
        Retrieve metadata for a specific file.
        """
        self._require_file_id(file_id)
        return self._call_api(self._client.beta.files.retrieve_metadata, file_id)

    def delete_file(self, file_id: str) -> Dict[str, Any]:
        """
        Delete a file and return the API response.
        """
        self._require_file_id(file_id)
        return self._call_api(self._client.beta.files.delete, file_id)

    def _require_file_id(self, file_id: str) -> None:
        if not file_id:
            raise AnthropicFilesError("file_id is required")

    def _call_api(self, func, *args, **kwargs):
        try:
            return func(*args, **kwargs)
        except anthropic.APIConnectionError as exc:
            raise AnthropicFilesRequestError(
                f"Anthropic Files API connection error: {exc}"
            ) from exc
        except anthropic.APIStatusError as exc:
            error_type = None
            response_text = None
            if hasattr(exc, "response") and exc.response is not None:
                response_text = getattr(exc.response, "text", None)
            if hasattr(exc, "error") and exc.error is not None:
                error_type = getattr(exc.error, "type", None)

            logger.error(
                "Anthropic Files API error: status=%s type=%s message=%s",
                exc.status_code,
                error_type,
                exc,
            )
            raise AnthropicFilesRequestError(
                str(exc),
                status_code=exc.status_code,
                error_type=error_type,
                response_text=response_text,
            ) from exc
        except anthropic.APIError as exc:
            raise AnthropicFilesRequestError(
                f"Anthropic Files API error: {exc}"
            ) from exc
