# SPDX-License-Identifier: MIT
# Simple, deterministic idempotency helpers for weekly report jobs.

from __future__ import annotations
import hashlib
import re
from typing import Mapping, Optional


_ALLOWED_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_ALLOWED_KEY_CHARS = re.compile(r"[^a-z0-9\-]+")


def canonical_report_name(name: str) -> str:
    """
    Normalize a human label like 'Brand Analysis Report Generation'
    into a stable key used for hashing and paths, e.g. 'brand-analysis-report-generation'.

    - lowercase
    - collapse whitespace to single '-'
    - remove any non [a-z0-9-]
    """
    s = re.sub(r"\s+", "-", name.strip().lower())
    s = _ALLOWED_KEY_CHARS.sub("", s)
    return re.sub(r"-{2,}", "-", s).strip("-")


def weekly_idem_key(
    organization_id: str,
    report_name: str,
    week_start_iso: str,
    extra: Optional[Mapping[str, str]] = None,
    digest_size: int = 16,
) -> str:
    parts = [organization_id, canonical_report_name(report_name), week_start_iso]
    if extra:
        for k in sorted(extra):
            parts.append(f"{k}={extra[k]}")
    return hashlib.blake2s(
        "|".join(parts).encode(), digest_size=digest_size
    ).hexdigest()


def safe_job_id_from_idem(idem_key: str) -> str:
    """Prefix the idempotency key to form a stable job_id."""

    if _ALLOWED_ID.match(idem_key or ""):
        return f"rj_{idem_key}"
    return "rj_" + hashlib.blake2s(idem_key.encode(), digest_size=16).hexdigest()
