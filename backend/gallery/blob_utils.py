from financial_doc_processor import BlobStorageManager
from logging import getLogger
from datetime import datetime

logger = getLogger(__name__)

class GalleryRetrievalError(Exception):
    """Custom exception for gallery retrieval errors."""

def get_gallery_items_by_org(organization_id: str, sort_order: str = 'newest'):
    """
    Retrieve gallery items for a specific organization from blob storage.

    Args:
        organization_id (str): The unique identifier of the organization.
        sort_order (str): Sort order - 'newest' (default) or 'oldest'.

    Returns:
        list[dict]: A list of gallery items (blobs) with metadata.

    Raises:
        GalleryRetrievalError: If there is an error accessing blob storage or retrieving items.

    Example:
        >>> get_gallery_items_by_org("org_123")
        [{'name': 'image1.png', 'metadata': {...}}, ...]

    Notes:
        - Uses BlobStorageManager to interact with blob storage.
        - Items are sorted by last_modified timestamp (newest first by default).
        - Logs exceptions and returns an empty list if an error occurs.
    """
    try:
        prefix = f"organization_files/{organization_id}/generated_images"
        blob_storage_manager = BlobStorageManager()
        items = blob_storage_manager.list_blobs_in_container_for_upload_files(
            container_name="documents",
            prefix=prefix,
            include_metadata="yes"
        )

        if items:
            items.sort(key=lambda item: datetime.fromisoformat(item['last_modified']), 
            reverse=(sort_order == 'newest'))
            
        return items
    
    except Exception as e:
        logger.exception(f"Error retrieving gallery items for org {organization_id}: {e}")
        raise GalleryRetrievalError(f"Failed to retrieve gallery items for organization {organization_id}") from e