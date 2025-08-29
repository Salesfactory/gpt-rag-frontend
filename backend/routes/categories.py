# backend/routes/categories.py
"""
Category API endpoints.

This module exposes CRUD-ish HTTP endpoints for categories, backed by
Azure Cosmos DB (SQL API).

Key behaviors:
- POST /api/categories: creates a category document and returns the created item.
- GET /api/categories/<id>: fetch a single category by id and organization partition.
- GET /api/categories: list categories for an organization (partition scan).
- DELETE /api/categories/<id>: delete a category.

Partitioning: all category documents are partitioned by `organization_id`.
"""

from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

from flask import Blueprint, request, jsonify, abort

# Azure exceptions (used only for typing/handling; tests will monkeypatch if needed)
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError

from shared import clients

bp = Blueprint("categories", __name__, url_prefix="/api/categories")
log = logging.getLogger(__name__)


# --------- helpers ---------
def _utc_now_iso() -> str:
    """Return the current UTC time in RFC3339/ISO-8601 format with timezone."""
    return datetime.now(timezone.utc).isoformat()


def _require_organization_id() -> str:
    """
    Resolve the caller's organization id from the request.

    Resolution order (first match wins):
      1) JSON body field `organization_id`
      2) Query string param `?organization_id=...`
      3) Header `X-Tenant-Id`

    Returns:
        str: Resolved organization id.

    Aborts:
        400: If no organization id is provided by any of the supported sources.
    """
    if request.is_json:
        tid = (request.get_json(silent=True) or {}).get("organization_id")
        if tid:
            return tid
    tid = request.args.get("organization_id") or request.headers.get("X-Tenant-Id")
    if not tid:
        abort(
            400,
            "'organization_id' is required (body.organization_id, ?organization_id=, or X-Tenant-Id)",
        )
    return tid


def _categories_container():
    """
    Get the Cosmos container client for categories.

    Returns:
        azure.cosmos.ContainerProxy: Container client for the categories container.
    """
    return clients.get_cosmos_container(clients.CATEGORIES_CONT)


# --------- routes ---------
@bp.post("")
def create_category():
    """
    Create a new category and return the created document.

    Request JSON:
        {
          "organization_id": "org-123"  (optional if provided via query/header)
          "category_id": "optional-explicit-id",  # else server generates UUID4
          "name": "Category Name",
          "description": "Optional category description",
          "color": "#FF5733",  # optional hex color
          "metadata": { ... }  # free-form; must be JSON-serializable
        }

    Headers/Query:
        - `organization_id` can also be supplied via `?organization_id=` or `X-Tenant-Id`.

    Returns:
        201 Created with the created Cosmos document as JSON.

    Errors:
        400: Missing required fields (e.g., name or organization_id).
        502: Cosmos write error.

    Side effects:
        - Persists a category document in Cosmos DB partitioned by `organization_id`.
    """
    data = request.get_json(force=True) or {}
    organization_id = _require_organization_id()

    category_id = data.get("category_id") or str(uuid.uuid4())
    name = data.get("name")

    if not name:
        abort(400, "'name' is required")

    now = _utc_now_iso()
    doc = {
        "id": category_id,  # Cosmos item id
        "organization_id": organization_id,  # PK
        "name": name,
        "created_at": now,
        "updated_at": now,
    }

    try:
        created = _categories_container().create_item(doc)
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error creating category: {e}")

    return jsonify(created), 201


@bp.get("/<category_id>")
def get_category(category_id: str):
    """
    Fetch a single category document by id within the caller's organization partition.

    Path params:
        category_id: The Cosmos item `id`.

    Headers/Query:
        Must provide `organization_id` (body/query/header as documented in `_require_organization_id`).

    Returns:
        200 OK with the category document JSON.

    Errors:
        404: If the item does not exist in the organization partition.
        502: Cosmos read errors.
    """
    organization_id = _require_organization_id()
    try:
        doc = _categories_container().read_item(
            item=category_id, partition_key=organization_id
        )
        return jsonify(doc)
    except CosmosResourceNotFoundError:
        abort(404, "Category not found")
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error reading category: {e}")


@bp.get("")
def list_categories():
    """
    List categories for an organization (most recent first).

    Query params:
        organization_id: Organization/partition id (required; can also be in header/body).
        limit: Optional integer limit (default: 50, applied client-side).

    Returns:
        200 OK with a JSON array of category documents (max `limit` items).

    Errors:
        502: Cosmos query errors.
    """
    organization_id = _require_organization_id()
    limit = int(request.args.get("limit", 50))
    query = "SELECT * FROM c WHERE c.organization_id = @organization_id ORDER BY c.created_at DESC"
    params = [{"name": "@organization_id", "value": organization_id}]
    try:
        it: Iterable[Dict[str, Any]] = _categories_container().query_items(
            query=query, parameters=params, partition_key=organization_id
        )
        out: List[Dict[str, Any]] = []
        for i, item in enumerate(it):
            if i >= limit:
                break
            out.append(item)
        return jsonify(out)
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error listing categories: {e}")


@bp.delete("/<category_id>")
def delete_category(category_id: str):
    """
    Delete a category by id within the caller's organization partition.

    Path params:
        category_id: The Cosmos item `id`.

    Headers/Query:
        Must provide `organization_id` (body/query/header as documented in `_require_organization_id`).

    Returns:
        204 No Content on successful deletion.

    Errors:
        404: If the item does not exist in the organization partition.
        502: Cosmos delete errors.
    """
    organization_id = _require_organization_id()
    try:
        _categories_container().delete_item(
            item=category_id, partition_key=organization_id
        )
        return ("", 204)
    except CosmosResourceNotFoundError:
        abort(404, "Category not found")
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error deleting category: {e}")
