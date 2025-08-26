from shared.idempotency import (
    canonical_report_name,
    weekly_idem_key,
    safe_job_id_from_idem,
)


def test_canonical_report_name():
    assert (
        canonical_report_name(" Brand   Analysis  Report Generation ")
        == "brand-analysis-report-generation"
    )


def test_weekly_idem_key_stable():
    k1 = weekly_idem_key("t_1", "Brand Analysis Report Generation", "2025-08-11")
    k2 = weekly_idem_key("t_1", " brand   analysis  report  generation ", "2025-08-11")
    assert k1 == k2 and len(k1) == 32  # 16-byte blake2s → 32 hex chars


def test_job_id_prefix():
    idem = weekly_idem_key("t", "x", "2025-01-01")
    assert safe_job_id_from_idem(idem).startswith("rj_")
