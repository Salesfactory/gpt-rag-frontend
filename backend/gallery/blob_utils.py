from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from email.utils import parsedate_to_datetime
from financial_doc_processor import BlobStorageManager
from logging import getLogger
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from flask import current_app
import math

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

def get_blobs_with_custom_filtering_paginated(
    container_name: str,
    prefix: str = None,
    include_metadata: str = "no",
    requested_page: int = 1,
    requested_limit: int = 10,
    filter_criteria: Optional[Dict[str, Any]] = None,
    query: Optional[str] = None,
    internal_page_size: int = 30
) -> Dict[str, Any]:
    """
    Get blobs with custom filtering and pagination.

    This function fetches blobs in pages of internal_page_size, applies filtering,
    and builds custom pages that match the requested page size and number.

    Args:
        container_name: Name of the container to list blobs from
        prefix: Filter results to blob names starting with this prefix
        include_metadata: Whether to include metadata ("yes" or "no")
        requested_page: The page number the user wants (1-based)
        requested_limit: Number of items per page the user wants
        filter_criteria: Dict of metadata filters (e.g., {"user_id": "some_value"})
        query: Search string to match across name, content_type, and metadata
        internal_page_size: Internal page size for fetching from blob storage (default: 30)

    Returns:
        Dict containing paginated results with filtering applied
    """
    try:
        blob_storage_manager = BlobStorageManager()
        all_filtered_items: List[Dict[str, Any]] = []
        continuation_token = None
        current_page = 1
        max_pages_to_fetch = 100  # Safety limit to prevent infinite loops

        # Fetch pages until we have enough items for the requested page or hit max pages
        while len(all_filtered_items) < (requested_page * requested_limit) and current_page <= max_pages_to_fetch:
            try:
                paginated_result = blob_storage_manager.list_blobs_in_container_for_upload_files_paginated(
                    container_name=container_name,
                    prefix=prefix,
                    include_metadata=include_metadata,
                    page_size=internal_page_size,
                    page=current_page,
                    continuation_token=continuation_token
                )

                raw_items = paginated_result.get("blobs", [])

                # Apply metadata filtering
                if filter_criteria:
                    filtered_items = []
                    for item in raw_items:
                        metadata = item.get("metadata", {})
                        matches = True
                        for key, value in filter_criteria.items():
                            if key not in metadata or str(metadata[key]).casefold() != str(value).casefold():
                                matches = False
                                break
                        if matches:
                            filtered_items.append(item)
                    raw_items = filtered_items

                # Apply query filtering (search across name, content_type, metadata)
                if query:
                    query_lower = query.lower()
                    filtered_items = []
                    for item in raw_items:
                        # Check name
                        name_match = query_lower in item.get("name", "").lower()
                        # Check content_type
                        content_type_match = query_lower in item.get("content_type", "").lower()
                        # Check metadata
                        metadata_match = False
                        metadata = item.get("metadata", {})
                        if metadata:
                            metadata_string = " ".join(f"{k}:{v}" for k, v in metadata.items()).lower()
                            metadata_match = query_lower in metadata_string

                        if name_match or content_type_match or metadata_match:
                            filtered_items.append(item)

                    raw_items = filtered_items

                all_filtered_items.extend(raw_items)

                # Check if we have more pages
                if not paginated_result.get("has_more", False):
                    break

                continuation_token = paginated_result.get("next_continuation_token")
                current_page += 1

            except StopIteration:
                # No more pages available
                break

        # Calculate pagination for the filtered results
        total_filtered_items = len(all_filtered_items)
        total_pages = math.ceil(total_filtered_items / requested_limit) if total_filtered_items > 0 else 0

        # Extract the specific page requested
        start_index = (requested_page - 1) * requested_limit
        end_index = start_index + requested_limit
        page_items = all_filtered_items[start_index:end_index]

        # Generate SAS URLs for the items
        for item in page_items:
            blob_name = item.get("name")
            if blob_name:
                sas_url = _generate_sas_url(blob_name, container_name=container_name)
                if sas_url:
                    item["url"] = sas_url

        return {
            "blobs": page_items,
            "current_page": requested_page,
            "page_size": requested_limit,
            "total_count": total_filtered_items,
            "has_more": requested_page < total_pages,
            "next_continuation_token": None,  # Custom pagination doesn't use continuation tokens
            "total_pages": total_pages
        }

    except Exception as e:
        logger.exception(f"Error in custom paginated blob retrieval: {e}")
        raise GalleryRetrievalError(f"Failed to retrieve blobs with custom filtering: {str(e)}")


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
        items: List[Dict[str, Any]] = []
        prefix = f"organization_files/{organization_id}/generated_images"

        # Use custom filtering pagination if uploader_id or query is provided
        if uploader_id or query:
            filter_criteria = {"user_id": uploader_id} if uploader_id else None

            paginated_result = get_blobs_with_custom_filtering_paginated(
                container_name="documents",
                prefix=prefix,
                include_metadata="yes",
                requested_page=page,
                requested_limit=limit,
                filter_criteria=filter_criteria,
                query=query
            )
        else:
            # Use the original paginated method when no filtering is needed
            blob_storage_manager = BlobStorageManager()
            paginated_result = blob_storage_manager.list_blobs_in_container_for_upload_files_paginated(
                container_name="documents",
                prefix=prefix,
                include_metadata="yes",
                page_size=limit,
                page=page,
                continuation_token=continuation_token
            )

        raw_items = paginated_result.get("blobs", [])

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

        # Backend search is already handled in the custom function when query is provided,
        # but we still need to apply it if we're using the original method
        if query and not uploader_id:
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

        # Apply pagination - for the original method, we may need to slice the results
        total_items_after_filtering = len(items)

        if uploader_id or query:
            # Custom pagination already handled the pagination
            paginated_items = items
            blob_pagination = {
                "current_page": paginated_result.get("current_page", page),
                "page_size": paginated_result.get("page_size", limit),
                "total_count": paginated_result.get("total_count", total_items_after_filtering),
                "has_more": paginated_result.get("has_more", False),
                "next_continuation_token": paginated_result.get("next_continuation_token"),
                "total_pages": paginated_result.get("total_pages", 1)
            }
        else:
            # Original method - need to slice the results for pagination
            start_index = (page - 1) * limit
            end_index = start_index + limit
            paginated_items = items[start_index:end_index]

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
