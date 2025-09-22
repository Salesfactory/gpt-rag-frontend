from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from email.utils import parsedate_to_datetime
from financial_doc_processor import BlobStorageManager
from logging import getLogger
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from flask import current_app

logger = getLogger(__name__)

class GalleryRetrievalError(Exception):
    """Custom exception for gallery retrieval errors."""

_MIN = datetime.min.replace(tzinfo=timezone.utc)

def _coerce_dt(value: Any) -> datetime:
    """
    Coerce different date/time representations into a timezone-aware datetime (UTC).
    Accepted inputs:
      - datetime (aware or naive)
      - int/float epoch (seconds or milliseconds)
      - str in ISO-8601 (with or without 'Z'), RFC 1123, or numeric epoch
    On failure, returns _MIN (datetime.min in UTC).
    """
    if value is None:
        return _MIN

    # Already a datetime
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    # Epoch number (seconds or milliseconds)
    if isinstance(value, (int, float)):
        try:
            timestamp = value / 1000.0 if value > 1e12 else float(value)
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except Exception:
            return _MIN

    # String inputs
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return _MIN

        # Try ISO-8601 (handle trailing 'Z')
        try:
            normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
            parsed_iso = datetime.fromisoformat(normalized)
            return parsed_iso if parsed_iso.tzinfo else parsed_iso.replace(tzinfo=timezone.utc)
        except Exception:
            pass

        # Try RFC 1123 (e.g., "Wed, 04 Sep 2024 13:22:10 GMT")
        try:
            parsed_rfc = parsedate_to_datetime(text)
            return parsed_rfc if parsed_rfc.tzinfo else parsed_rfc.replace(tzinfo=timezone.utc)
        except Exception:
            pass

        # Try numeric epoch in string (seconds or milliseconds)
        try:
            # allow one decimal point
            if text.replace(".", "", 1).isdigit():
                epoch_value = float(text)
                if epoch_value > 1e12:  # likely milliseconds
                    epoch_value = epoch_value / 1000.0
                return datetime.fromtimestamp(epoch_value, tz=timezone.utc)
        except Exception:
            pass

    return _MIN

def _generate_sas_url(blob_name: str, container_name: str = "documents", expiry_hours: int = 24) -> Optional[str]:
    """
    Generate a SAS URL for a blob with read permissions.
    
    Args:
        blob_name: Name of the blob
        container_name: Name of the container (default: "documents")
        expiry_hours: Hours until the SAS URL expires (default: 24)
    
    Returns:
        SAS URL string or None if generation fails
    """
    try:
        blob_service_client = BlobServiceClient.from_connection_string(
            current_app.config["AZURE_STORAGE_CONNECTION_STRING"]
        )
        account_name = blob_service_client.account_name
        
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(hours=expiry_hours),
        )
        
        return f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}?{sas_token}"
        
    except Exception as e:
        logger.warning(f"Failed to generate SAS URL for blob {blob_name}: {e}")
        return None

def get_gallery_items_by_org(
    organization_id: str,
    uploader_id: Optional[str] = None,
    order: str = "newest",
    query: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    continuation_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    List the organization's blobs and apply server-side filtering/sorting with pagination.
    - Filter by metadata.user_id == uploader_id (case-insensitive).
    - Search by query across name, content_type, and serialized metadata.
    - Sort by created_on (fallback: last_modified). order: 'newest' | 'oldest'.
    - Apply pagination with page and limit parameters.
    Returns a dictionary with items, total count, and pagination info.
    """
    try:
        prefix = f"organization_files/{organization_id}/generated_images"
        blob_storage_manager = BlobStorageManager()
        
        # Use the new paginated method
        paginated_result = blob_storage_manager.list_blobs_in_container_for_upload_files_paginated(
            container_name="documents",
            prefix=prefix,
            include_metadata="yes",
            page_size=limit,
            page=page,
            continuation_token=continuation_token
        )
        
        raw_items: List[Dict[str, Any]] = paginated_result.get("blobs", [])

        items: List[Dict[str, Any]] = []
        for item in raw_items:
            metadata = item.get("metadata") or {}
            blob_name = item.get("name")
            
            # Generate SAS URL instead of using direct URL
            sas_url = _generate_sas_url(blob_name, container_name="documents") if blob_name else None
            
            items.append({
                "name": blob_name,
                "size": item.get("size"),
                "content_type": item.get("content_type"),
                "created_on": item.get("last_modified"),
                "last_modified": item.get("last_modified"),
                "metadata": metadata,
                "url": sas_url or item.get("url")  # Fallback to original URL if SAS generation fails
            })

        # Backend-only user filter
        if uploader_id:
            uid = ("" if uploader_id is None else str(uploader_id)).casefold()
            items = [
                it for it in items
                if it.get("metadata", {}).get("user_id", "").casefold() == uid
            ]

        # Backend search (no date text search)
        if query:
            query_list = ("" if query is None else str(query)).casefold()
            filtered: List[Dict[str, Any]] = []
            for item in items:
                name_ok = query_list in item.get("name", "").casefold()
                content_type_ok   = query_list in item.get("content_type", "").casefold()
                metadata_string = " ".join(f"{k}:{v}" for k, v in item.get("metadata", {}).items()).casefold()
                if name_ok or content_type_ok or (query_list in metadata_string):
                    filtered.append(item)
            items = filtered

        # Stable sort by created_on, fallback last_modified; tie-breaker by name
        def sort_key(it: Dict[str, Any]) -> datetime:
            created = _coerce_dt(it.get("created_on"))
            return created if created != _MIN else _coerce_dt(it.get("last_modified"))

        reverse = (order or "newest").lower() == "newest"
        items.sort(key=lambda i: (sort_key(i), i.get("name", "")), reverse=reverse)

        # Apply pagination - items are already paginated from blob storage,
        # but we may need to further filter/sort them
        total_items_after_filtering = len(items)
        
        # Since we're already getting paginated results from blob storage,
        # we don't need to re-paginate unless we filtered items
        paginated_items = items
        
        # Use pagination info from the blob storage result, but adjust for any filtering we did
        blob_pagination = {
            "current_page": paginated_result.get("current_page", page),
            "page_size": paginated_result.get("page_size", limit),
            "total_count": paginated_result.get("total_count", total_items_after_filtering),
            "has_more": paginated_result.get("has_more", False),
            "next_continuation_token": paginated_result.get("next_continuation_token"),
            "total_pages": paginated_result.get("total_pages", 1)
        }

        return {
            "items": paginated_items,
            "total": total_items_after_filtering,
            "page": blob_pagination["current_page"],
            "limit": blob_pagination["page_size"],
            "total_pages": blob_pagination["total_pages"],
            "has_next": blob_pagination["has_more"],
            "has_prev": page > 1,
            "next_continuation_token": blob_pagination["next_continuation_token"]
        }

    except Exception as e:
        logger.exception(f"Error retrieving gallery items for org {organization_id}: {e}")
        raise GalleryRetrievalError(
            f"Failed to retrieve gallery items for organization {organization_id}"
        ) from e
