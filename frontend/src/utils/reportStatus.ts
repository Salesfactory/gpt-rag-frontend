import type { BackendReportStatus } from "../api/models";

export type Canonical = BackendReportStatus | "UNKNOWN";
export type UiLabel = "Completed" | "In Progress" | "Pending" | "Failed" | "Unknown";

export const ALLOWED: readonly BackendReportStatus[] = ["SUCCEEDED", "RUNNING", "QUEUED", "FAILED"] as const;

export function toCanonical(s?: string): Canonical {
  const v = String(s || "").toUpperCase();
  return (ALLOWED as readonly string[]).includes(v) ? (v as BackendReportStatus) : "UNKNOWN";
}

