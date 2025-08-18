# backend/routes/report_jobs.py
from __future__ import annotations
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

from flask import Blueprint, request, jsonify, abort

# Azure exceptions (used only for typing/handling; tests will monkeypatch if needed)
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError
from azure.servicebus import ServiceBusMessage

from shared import clients

bp = Blueprint("report_jobs", __name__, url_prefix="/api/report-jobs")
log = logging.getLogger(__name__)


# --------- helpers ---------
def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_organization_id() -> str:
    # Accept JSON body, query string, or X-Tenant-Id header (pick your policy)
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
    return clients.get_container(clients.JOBS_CONT)


def _maybe_send_sb(event: Dict[str, Any]) -> None:
    """Fire-and-forget send to Service Bus if configured; ignore errors."""
    try:
        sb = clients.sb_client()
        if not sb:
            return
        with sb.get_queue_sender(queue_name=clients.SB_QUEUE) as sender:
            sender.send_messages(ServiceBusMessage(json.dumps(event)))
    except Exception as e:  # don't fail request due to SB
        log.warning("Service Bus send failed: %s", e)


# --------- routes ---------
@bp.post("")
def create_job():
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

    # Optionally enqueue a notification/task on Service Bus
    _maybe_send_sb(
        {
            "type": "report_job_created",
            "job_id": job_id,
            "organization_id": organization_id,
        }
    )

    return jsonify(created), 201


@bp.get("/<job_id>")
def get_job(job_id: str):
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
    organization_id = _require_organization_id()
    limit = int(request.args.get("limit", 50))
    query = "SELECT * FROM c WHERE c.organization_id = @organization_id ORDER BY c.created_at DESC"
    params = [{"name": "@organization_id", "value": organization_id}]
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
    organization_id = _require_organization_id()
    try:
        _jobs_container().delete_item(item=job_id, partition_key=organization_id)
        return ("", 204)
    except CosmosResourceNotFoundError:
        abort(404, "Job not found")
    except CosmosHttpResponseError as e:
        abort(502, f"Cosmos error deleting job: {e}")
