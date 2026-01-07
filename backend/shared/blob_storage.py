import logging
import os
from typing import Any, Dict, List, Optional

from azure.storage.blob import BlobServiceClient, ContentSettings

from _secrets import get_secret

logger = logging.getLogger(__name__)


class BlobStorageError(Exception):
    """Base exception for blob storage operations."""


class BlobConnectionError(BlobStorageError):
    """Raised when the blob service client cannot be created."""


class ContainerNotFoundError(BlobStorageError):
    """Raised when a requested container does not exist."""


class BlobAuthenticationError(BlobStorageError):
    """Raised when blob authentication fails."""


class BlobNotFoundError(BlobStorageError):
    """Raised when a blob cannot be found."""


class BlobUploadError(BlobStorageError):
    """Raised when a blob upload fails."""


class BlobDownloadError(BlobStorageError):
    """Raised when a blob download fails."""


class BlobMetadataError(BlobStorageError):
    """Raised when blob metadata access fails."""


class BlobStorageManager:
    def __init__(self, default_container_name: Optional[str] = None):
        try:
            connection_string = get_secret(
                "storageConnectionString", env_name="AZURE_STORAGE_CONNECTION_STRING"
            )
            if not connection_string:
                raise ValueError(
                    "The Azure Blob Storage connection string is not set."
                )

            self.blob_service_client = BlobServiceClient.from_connection_string(
                connection_string
            )
            self.default_container_name = (
                default_container_name
                or os.getenv("BLOB_CONTAINER_NAME", "documents")
            )
        except ValueError as e:
            raise BlobConnectionError(f"Invalid connection string: {str(e)}")
        except Exception as e:
            raise BlobConnectionError(f"Failed to initialize blob storage: {str(e)}")

    def _get_container_client(self, container_name: Optional[str]):
        name = container_name or self.default_container_name
        if not name:
            raise ValueError("Container name is required and cannot be empty")
        return self.blob_service_client.get_container_client(name), name

    def upload_to_blob(
        self,
        file_path: str,
        blob_folder: str,
        metadata: Optional[Dict[str, str]] = None,
        container: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload a file to Azure Blob Storage.
        """
        if not file_path:
            raise ValueError("file_path is required")

        if not os.path.exists(file_path):
            return {"status": "failed", "error": f"File not found: {file_path}"}

        try:
            blob_sas_token = get_secret("blobSasToken", env_name="BLOB_SAS_TOKEN")
            if not blob_sas_token:
                raise ValueError(
                    "The SAS token for Azure Blob Storage is not set."
                )
        except Exception as e:
            logger.error("Error retrieving the SAS token for Azure Blob Storage.")
            logger.debug(f"Detailed error: {e}")
            return {"status": "failed", "error": str(e)}

        blob_folder = (blob_folder or "").strip("/")
        file_name = os.path.basename(file_path)
        blob_path = f"{blob_folder}/{file_name}" if blob_folder else file_name

        if blob_path.endswith(".pdf"):
            content_type = "application/pdf"
        elif blob_path.endswith(".html"):
            content_type = "text/html"
        elif blob_path.endswith(".txt"):
            content_type = "text/plain"
        else:
            content_type = "application/octet-stream"

        try:
            container_client, container_name = self._get_container_client(container)
            with open(file_path, "rb") as data:
                try:
                    container_client.upload_blob(
                        name=blob_path,
                        data=data,
                        overwrite=True,
                        content_settings=ContentSettings(content_type=content_type),
                        metadata=metadata,
                    )
                except Exception as e:
                    raise BlobUploadError(f"Failed to upload {blob_path}: {str(e)}")

            blob_url = (
                f"{self.blob_service_client.url}{container_name}/{blob_path}"
                f"?{blob_sas_token}"
            )

            return {
                "status": "success",
                "blob_path": blob_path,
                "blob_url": blob_url,
                "metadata": metadata,
            }

        except Exception as e:
            logger.error(f"Failed to upload file {file_path}: {str(e)}")
            return {"status": "failed", "error": str(e)}

    def upload_fileobj_to_blob(
        self,
        fileobj,
        filename: str,
        blob_folder: str,
        metadata: Optional[Dict[str, str]] = None,
        container: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload a file-like object to Azure Blob Storage directly from memory.
        """
        if not fileobj:
            raise ValueError("fileobj is required")

        blob_folder = (blob_folder or "").strip("/")
        blob_path = f"{blob_folder}/{filename}" if blob_folder else filename

        # Determine content type
        if blob_path.endswith(".pdf"):
            content_type = "application/pdf"
        elif blob_path.endswith(".html"):
            content_type = "text/html"
        elif blob_path.endswith(".txt"):
            content_type = "text/plain"
        elif blob_path.endswith(".csv"):
            content_type = "text/csv"
        else:
            content_type = "application/octet-stream"

        try:
            container_client, container_name = self._get_container_client(container)
            
            fileobj.seek(0)
            
            try:
                container_client.upload_blob(
                    name=blob_path,
                    data=fileobj,
                    overwrite=True,
                    content_settings=ContentSettings(content_type=content_type),
                    metadata=metadata,
                )
            except Exception as e:
                raise BlobUploadError(f"Failed to upload {blob_path}: {str(e)}")

            return {
                "status": "success",
            }

        except Exception as e:
            logger.error(f"Failed to upload file {filename}: {str(e)}")
            return {"status": "failed", "error": str(e)}
        
    
    def delete_blob(
        self,
        blob_name: str,
        container_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Delete a blob from Azure Blob Storage.
        """
        if not blob_name:
            return {"status": "failed", "error": "blob_name is required"}

        try:
            container_client, container = self._get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_name)

            if not blob_client.exists():
                return {
                    "status": "failed",
                    "error": f"Blob not found: {blob_name}",
                }

            blob_client.delete_blob()
            return {"status": "success", "container": container}
        except Exception as e:
            logger.error(f"Failed to delete blob {blob_name}: {str(e)}")
            return {"status": "failed", "error": str(e)}

    def list_blobs_in_container(
        self,
        container_name: str,
        prefix: str = None,
        include_metadata: str = "no",
        max_results: int = None,
    ) -> List[Dict[str, Any]]:
        """
        List blobs in a container with filtering and metadata.
        """
        if not container_name or not container_name.strip():
            raise ValueError("Container name is required and cannot be empty")

        if max_results is not None and max_results <= 0:
            raise ValueError("max_results must be greater than 0")

        try:
            container_client = self.blob_service_client.get_container_client(
                container_name
            )

            if not container_client.exists():
                raise ContainerNotFoundError(f"Container not found: {container_name}")

            list_params = {
                "name_starts_with": prefix if prefix else None,
                "results_per_page": max_results,
            }

            blob_list = []
            blobs = container_client.list_blobs(
                **{k: v for k, v in list_params.items() if v is not None}
            )

            for blob in blobs:
                blob_info = {
                    "name": blob.name,
                    "size": blob.size,
                    "created_on": blob.creation_time.isoformat(),
                    "last_modified": blob.last_modified.isoformat(),
                    "content_type": blob.content_settings.content_type,
                    "url": f"{self.blob_service_client.url}{container_name}/{blob.name}",
                }
                if include_metadata == "yes":
                    try:
                        blob_client = container_client.get_blob_client(blob.name)
                        properties = blob_client.get_blob_properties()
                        blob_info["metadata"] = properties.metadata
                    except Exception as e:
                        logger.warning(
                            f"Failed to retrieve metadata for {blob.name}: {str(e)}"
                        )
                        blob_info["metadata"] = None

                blob_list.append(blob_info)

                if max_results and len(blob_list) >= max_results:
                    break

            return blob_list

        except Exception as e:
            if "AuthenticationFailed" in str(e):
                raise BlobAuthenticationError(
                    f"Error authenticating with blob storage: {str(e)}"
                )
            logger.error(f"Error listing blobs in container: {str(e)}")
            raise

    def list_blobs_in_container_for_upload_files(
        self,
        container_name: str,
        prefix: str = None,
        include_metadata: str = "no",
        max_results: int = None,
    ) -> List[Dict[str, Any]]:
        """
        List blobs in a container with optional filtering by prefix and metadata.
        """
        if not container_name or not container_name.strip():
            raise ValueError("Container name is required and cannot be empty")

        if max_results is not None and max_results <= 0:
            raise ValueError("max_results must be greater than 0")

        try:
            container_client = self.blob_service_client.get_container_client(
                container_name
            )

            if not container_client.exists():
                raise ContainerNotFoundError(f"Container not found: {container_name}")

            list_params = {
                "name_starts_with": prefix if prefix else None,
                "results_per_page": max_results,
            }

            blob_list = []
            blobs = container_client.list_blobs(
                **{k: v for k, v in list_params.items() if v is not None}
            )

            effective_prefix = prefix if prefix else ""

            for blob in blobs:
                if effective_prefix and not blob.name.startswith(effective_prefix):
                    continue
                blob_info = {
                    "name": blob.name,
                    "size": blob.size,
                    "created_on": blob.creation_time.isoformat(),
                    "last_modified": blob.last_modified.isoformat(),
                    "content_type": blob.content_settings.content_type,
                    "url": f"{self.blob_service_client.url}{container_name}/{blob.name}",
                }
                if include_metadata == "yes":
                    try:
                        blob_client = container_client.get_blob_client(blob.name)
                        properties = blob_client.get_blob_properties()
                        blob_info["metadata"] = properties.metadata
                    except Exception as e:
                        logger.warning(
                            f"Failed to retrieve metadata for {blob.name}: {str(e)}"
                        )
                        blob_info["metadata"] = None

                blob_list.append(blob_info)

                if max_results is not None and len(blob_list) >= max_results:
                    break

            return blob_list

        except Exception as e:
            if "AuthenticationFailed" in str(e):
                raise BlobAuthenticationError(
                    f"Error authenticating with blob storage: {str(e)}"
                )
            logger.error(f"Error listing blobs in container: {str(e)}")
            raise

    def list_blobs_in_container_paginated(
        self,
        container_name: str,
        prefix: str = None,
        include_metadata: str = "no",
        page_size: int = 10,
        page: int = 1,
        continuation_token: str = None,
    ) -> Dict[str, Any]:
        """
        List blobs in a container with pagination support using continuation tokens.
        """
        if not container_name or not container_name.strip():
            raise ValueError("Container name is required and cannot be empty")

        if page_size <= 0 or page_size > 100:
            raise ValueError("page_size must be between 1 and 100")

        if page < 1:
            raise ValueError("page must be greater than 0")

        try:
            container_client = self.blob_service_client.get_container_client(
                container_name
            )

            if not container_client.exists():
                raise ContainerNotFoundError(f"Container not found: {container_name}")

            list_params = {
                "name_starts_with": prefix if prefix else None,
                "results_per_page": page_size,
            }

            blobs = container_client.list_blobs(
                **{k: v for k, v in list_params.items() if v is not None}
            )

            pages = blobs.by_page(continuation_token=continuation_token)

            if not continuation_token and page > 1:
                for _ in range(page - 1):
                    try:
                        next(pages)
                    except StopIteration:
                        return {
                            "blobs": [],
                            "current_page": page,
                            "page_size": page_size,
                            "total_count": 0,
                            "has_more": False,
                            "next_continuation_token": None,
                            "total_pages": 0,
                        }

            try:
                current_page = next(pages)
                blob_list = []

                for blob in current_page:
                    blob_info = {
                        "name": blob.name,
                        "size": blob.size,
                        "created_on": blob.creation_time.isoformat(),
                        "last_modified": blob.last_modified.isoformat(),
                        "content_type": blob.content_settings.content_type,
                        "url": f"{self.blob_service_client.url}{container_name}/{blob.name}",
                    }

                    if include_metadata == "yes":
                        try:
                            blob_client = container_client.get_blob_client(blob.name)
                            properties = blob_client.get_blob_properties()
                            blob_info["metadata"] = properties.metadata
                        except Exception as e:
                            logger.warning(
                                f"Failed to retrieve metadata for {blob.name}: {str(e)}"
                            )
                            blob_info["metadata"] = None

                    blob_list.append(blob_info)

                next_continuation_token = (
                    pages.continuation_token if hasattr(pages, "continuation_token") else None
                )

                has_more = next_continuation_token is not None
                estimated_total = (page - 1) * page_size + len(blob_list)
                estimated_total_pages = (
                    max(1, (estimated_total + page_size - 1) // page_size)
                    if estimated_total > 0
                    else 0
                )

                return {
                    "blobs": blob_list,
                    "current_page": page,
                    "page_size": page_size,
                    "total_count": estimated_total,
                    "has_more": has_more,
                    "next_continuation_token": next_continuation_token,
                    "total_pages": estimated_total_pages,
                }

            except StopIteration:
                return {
                    "blobs": [],
                    "current_page": page,
                    "page_size": page_size,
                    "total_count": 0,
                    "has_more": False,
                    "next_continuation_token": None,
                    "total_pages": 0,
                }

        except Exception as e:
            if "AuthenticationFailed" in str(e):
                raise BlobAuthenticationError(
                    f"Error authenticating with blob storage: {str(e)}"
                )
            logger.error(
                f"Error listing blobs in container with pagination: {str(e)}"
            )
            raise

    def list_blobs_in_container_for_upload_files_paginated(
        self,
        container_name: str,
        prefix: str = None,
        include_metadata: str = "no",
        page_size: int = 10,
        page: int = 1,
        continuation_token: str = None,
    ) -> Dict[str, Any]:
        """
        List blobs in a container for upload files with pagination support.
        """
        if not container_name or not container_name.strip():
            raise ValueError("Container name is required and cannot be empty")

        if page_size <= 0 or page_size > 100:
            raise ValueError("page_size must be between 1 and 100")

        if page < 1:
            raise ValueError("page must be greater than 0")

        try:
            container_client = self.blob_service_client.get_container_client(
                container_name
            )

            if not container_client.exists():
                raise ContainerNotFoundError(f"Container not found: {container_name}")

            list_params = {
                "name_starts_with": prefix if prefix else None,
                "results_per_page": page_size,
            }

            blobs = container_client.list_blobs(
                **{k: v for k, v in list_params.items() if v is not None}
            )

            pages = blobs.by_page(continuation_token=continuation_token)
            effective_prefix = prefix if prefix else ""

            if not continuation_token and page > 1:
                for _ in range(page - 1):
                    try:
                        next(pages)
                    except StopIteration:
                        return {
                            "blobs": [],
                            "current_page": page,
                            "page_size": page_size,
                            "total_count": 0,
                            "has_more": False,
                            "next_continuation_token": None,
                            "total_pages": 0,
                        }

            try:
                current_page = next(pages)
                blob_list = []

                for blob in current_page:
                    if effective_prefix and not blob.name.startswith(effective_prefix):
                        continue

                    blob_info = {
                        "name": blob.name,
                        "size": blob.size,
                        "created_on": blob.creation_time.isoformat(),
                        "last_modified": blob.last_modified.isoformat(),
                        "content_type": blob.content_settings.content_type,
                        "url": f"{self.blob_service_client.url}{container_name}/{blob.name}",
                    }

                    if include_metadata == "yes":
                        try:
                            blob_client = container_client.get_blob_client(blob.name)
                            properties = blob_client.get_blob_properties()
                            blob_info["metadata"] = properties.metadata
                        except Exception as e:
                            logger.warning(
                                f"Failed to retrieve metadata for {blob.name}: {str(e)}"
                            )
                            blob_info["metadata"] = None

                    blob_list.append(blob_info)

                next_continuation_token = (
                    pages.continuation_token if hasattr(pages, "continuation_token") else None
                )

                has_more = next_continuation_token is not None
                estimated_total = (page - 1) * page_size + len(blob_list)
                estimated_total_pages = (
                    max(1, (estimated_total + page_size - 1) // page_size)
                    if estimated_total > 0
                    else 0
                )

                return {
                    "blobs": blob_list,
                    "current_page": page,
                    "page_size": page_size,
                    "total_count": estimated_total,
                    "has_more": has_more,
                    "next_continuation_token": next_continuation_token,
                    "total_pages": estimated_total_pages,
                }

            except StopIteration:
                return {
                    "blobs": [],
                    "current_page": page,
                    "page_size": page_size,
                    "total_count": 0,
                    "has_more": False,
                    "next_continuation_token": None,
                    "total_pages": 0,
                }

        except Exception as e:
            if "AuthenticationFailed" in str(e):
                raise BlobAuthenticationError(
                    f"Error authenticating with blob storage: {str(e)}"
                )
            logger.error(
                f"Error listing blobs in container with pagination: {str(e)}"
            )
            raise
