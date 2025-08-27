# backend/routes/report_jobs.py
"""
Report job API endpoints.

This module exposes CRUD-ish HTTP endpoints for report jobs, backed by
Azure Cosmos DB (SQL API) and Azure Queue Storage for asynchronous processing.

Key behaviors:
- POST /api/report-jobs: creates a job document (status=QUEUED) and enqueues a
  lightweight message on the "report-jobs" Azure Storage queue (fire-and-forget).
- GET /api/report-jobs/<id>: fetch a single job by id and organization partition.
- GET /api/report-jobs: list recent jobs for an organization (partition scan).
- DELETE /api/report-jobs/<id>: delete a job.

Partitioning: all job documents are partitioned by `organization_id`.
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

bp = Blueprint("report_jobs", __name__, url_prefix="/api/report-jobs")
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


def _jobs_container():
    """
    Get the Cosmos container client for report jobs.

    Returns:
        azure.cosmos.ContainerProxy: Container client for the jobs container.
    """
    return clients.get_cosmos_container(clients.JOBS_CONT)


def _maybe_enqueue_report_job(message: Dict[str, Any]) -> None:
    """
    Best-effort enqueue of a report job message to Azure Queue Storage.

    Sends a small JSON payload (e.g., {"type": "...", "job_id": "...", "organization_id": "..."})
    to the configured `report-jobs` queue. Any exception during enqueue is logged and **not**
    propagated to the HTTP caller (to avoid failing the create call on transient queue issues).

    Args:
        message: Dict payload that will be JSON-serialized and sent as the queue message.
    """
    try:
        clients.enqueue_report_job_message(message)
    except Exception as e:
        log.warning("Azure Queue enqueue failed: %s", e)


# --------- routes ---------
@bp.post("")
def create_job():
    """
    Create a new report job (status=QUEUED) and enqueue a processing message.

    Request JSON:
        {
          "organization_id": "org-123"  (optional if provided via query/header)
          "job_id": "optional-explicit-id",  # else server generates UUID4
          "report_name": "Brand Analysis Report Generation",
          "params": { ... }  # free-form; must be JSON-serializable
        }

    Headers/Query:
        - `organization_id` can also be supplied via `?organization_id=` or `X-Tenant-Id`.

    Returns:
        201 Created with the created Cosmos document as JSON.

    Errors:
        400: Missing required fields (e.g., report_name or organization_id).
        502: Cosmos write error.

    Side effects:
        - Persists a job document in Cosmos DB partitioned by `organization_id`.
        - Fire-and-forget enqueue of a small message to Azure Queue Storage.
    """
    data = request.get_json(force=True) or {}
    organization_id = _require_organization_id()

    job_id = data.get("job_id") or str(uuid.uuid4())
    report_name = data.get("report_name")
    params = data.get("params") or {}

    if not report_name:
        abort(400, "'report_name' is required")

    now = _utc_now_iso()
    doc = {
        "id": job_id,  # Cosmos item id
        "organization_id": organization_id,  # PK
        "report_name": report_name,
        "params": params,
        "status": "QUEUED",
        "created_at": now,
        "updated_at": now,
    }

    try:
        created = _jobs_container().create_item(doc)
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error creating job: {e}")

    # Optionally enqueue a task/notification on Azure Queue Storage (replaces Service Bus)
    _maybe_enqueue_report_job(
        {
            "type": "report_job_created",
            "job_id": job_id,
            "organization_id": organization_id,
        }
    )

    return jsonify(created), 201


@bp.get("/<job_id>")
def get_job(job_id: str):
    """
    Fetch a single job document by id within the caller's organization partition.

    Path params:
        job_id: The Cosmos item `id`.

    Headers/Query:
        Must provide `organization_id` (body/query/header as documented in `_require_organization_id`).

    Returns:
        200 OK with the job document JSON.

    Errors:
        404: If the item does not exist in the organization partition.
        502: Cosmos read errors.
    """
    organization_id = _require_organization_id()
    try:
        doc = _jobs_container().read_item(item=job_id, partition_key=organization_id)
        return jsonify(doc)
    except CosmosResourceNotFoundError:
        abort(404, "Job not found")
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error reading job: {e}")


@bp.get("")
def list_jobs():
    """
    List recent report jobs for an organization (most recent first).

    Query parameters:
        organization_id (str): Required partition key. You may also provide it
            via the JSON body or the `X-Tenant-Id` header.
        limit (int, optional): Maximum number of items to return. Defaults to 50.
        status (str, optional): Filter by status. One of:
            COMPLETED | FAILED | RUNNING | QUEUED.

    Returns:
        200 OK with a JSON array of job documents (max `limit` items).

    Errors:
        502: Cosmos query errors.
    """
    organization_id = _require_organization_id()
    limit = int(request.args.get("limit", 50))
    status = request.args.get("status")

    status_clause = " AND c.status = @status" if status else ""
    query = (
        f"SELECT * FROM c "
        f"WHERE c.organization_id = @organization_id{status_clause} "
        f"ORDER BY c.created_at DESC"
    )
    params = [{"name": "@organization_id", "value": organization_id}]
    if status:
        params.append({"name": "@status", "value": status})

    try:
        it: Iterable[Dict[str, Any]] = _jobs_container().query_items(
            query=query, parameters=params, partition_key=organization_id
        )
        out: List[Dict[str, Any]] = []
        for i, item in enumerate(it):
            if i >= limit:
                break
            out.append(item)
        return jsonify(out)
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error listing jobs: {e}")



@bp.delete("/<job_id>")
def delete_job(job_id: str):
    """
    Delete a job by id within the caller's organization partition.

    Path params:
        job_id: The Cosmos item `id`.

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
        _jobs_container().delete_item(item=job_id, partition_key=organization_id)
        return ("", 204)
    except CosmosResourceNotFoundError:
        abort(404, "Job not found")
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error deleting job: {e}")
