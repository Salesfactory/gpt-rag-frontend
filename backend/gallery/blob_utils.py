from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from email.utils import parsedate_to_datetime
from financial_doc_processor import BlobStorageManager
from logging import getLogger

logger = getLogger(__name__)

class GalleryRetrievalError(Exception):
    """Custom exception for gallery retrieval errors."""

def _to_lower(x: Any) -> str:
    try:
        return str(x or "").lower()
    except Exception:
        return ""

_MIN = datetime.min.replace(tzinfo=timezone.utc)

def _coerce_dt(v: Any) -> datetime:
    """Return a timezone-aware datetime. Falls back to datetime.min(UTC) on failure."""
    if v is None:
        return _MIN

    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)

    # epoch number (seconds or ms)
    if isinstance(v, (int, float)):
        try:
            # detect ms range and convert
            ts = v / 1000.0 if v > 1e12 else float(v)
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            return _MIN

    if isinstance(v, str):
        s = v.strip()
        if not s:
            return _MIN

        # Try ISO-8601
        try:
            iso = s[:-1] + "+00:00" if s.endswith("Z") else s
            dt = datetime.fromisoformat(iso)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

        # Try RFC 1123 (e.g., "Wed, 04 Sep 2024 13:22:10 GMT")
        try:
            dt = parsedate_to_datetime(s)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

        # Try epoch in string (seconds or ms)
        try:
            if s.replace(".", "", 1).isdigit():
                val = float(s)
                if val > 1e12:  # likely ms
                    val = val / 1000.0
                return datetime.fromtimestamp(val, tz=timezone.utc)
        except Exception:
            pass

    return _MIN

def get_gallery_items_by_org(
    organization_id: str,
    uploader_id: Optional[str] = None,
    order: str = "newest",
    q: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    List the organization's blobs and apply server-side filtering/sorting.
    - Filter by metadata.user_id == uploader_id (case-insensitive).
    - Search by q across name, content_type, serialized metadata, and date fields.
    - Sort by created_on (fallback: last_modified). order: 'newest' | 'oldest'.
    Always returns a list (possibly empty).
    """
    try:
        prefix = f"organization_files/{organization_id}/generated_images"
        bsm = BlobStorageManager()
        raw_items: List[Dict[str, Any]] = bsm.list_blobs_in_container_for_upload_files(
            container_name="documents",
            prefix=prefix,
            include_metadata="yes"
        ) or []

        items: List[Dict[str, Any]] = []
        for it in raw_items:
            meta = it.get("metadata") or {}
            items.append({
                "name": it.get("name"),
                "size": it.get("size"),
                "content_type": it.get("content_type"),
                "created_on": it.get("created_on") or it.get("creation_time") or it.get("created"),
                "last_modified": it.get("last_modified"),
                "metadata": meta,
                "url": it.get("url")
            })
        if uploader_id:
            uid = _to_lower(uploader_id)
            items = [it for it in items if _to_lower((it.get("metadata") or {}).get("user_id")) == uid]
        if q:
            ql = _to_lower(q)
            filtered = []
            for it in items:
                name_ok = ql in _to_lower(it.get("name"))
                ct_ok = ql in _to_lower(it.get("content_type"))
                meta = it.get("metadata") or {}
                meta_str = _to_lower(" ".join(f"{k}:{v}" for k, v in meta.items()))
                meta_ok = ql in meta_str
                created_ok = ql in _to_lower(it.get("created_on"))
                modified_ok = ql in _to_lower(it.get("last_modified"))
                if name_ok or ct_ok or meta_ok or created_ok or modified_ok:
                    filtered.append(it)
            items = filtered

        def sort_key(it: Dict[str, Any]) -> datetime:
            co = _coerce_dt(it.get("created_on"))
            if co == datetime.min.replace(tzinfo=timezone.utc):
                return _coerce_dt(it.get("last_modified"))
            return co

        reverse = (order or "newest").lower() == "newest"
        items.sort(key=sort_key, reverse=reverse)

        return items

    except Exception as e:
        logger.exception(f"Error retrieving gallery items for org {organization_id}: {e}")
        raise GalleryRetrievalError(
            f"Failed to retrieve gallery items for organization {organization_id}"
        ) from e
