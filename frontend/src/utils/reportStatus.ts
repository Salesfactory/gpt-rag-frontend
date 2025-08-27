import type { BackendReportStatus } from "../api/models";

export type Canonical = BackendReportStatus | "UNKNOWN";
export type UiLabel = "Completed" | "In Progress" | "Pending" | "Failed" | "Unknown";

export const ALLOWED: readonly BackendReportStatus[] = ["COMPLETED", "RUNNING", "QUEUED", "FAILED"] as const;

export function toCanonical(s?: string): Canonical {
  const v = String(s || "").toUpperCase();
  return (ALLOWED as readonly string[]).includes(v) ? (v as BackendReportStatus) : "UNKNOWN";
}

export function statusLabel(c: Canonical): UiLabel {
  switch (c) {
    case "COMPLETED": return "Completed";
    case "RUNNING":   return "In Progress";
    case "QUEUED":    return "Pending";
    case "FAILED":    return "Failed";
    default:          return "Unknown";
  }
}

export function uiLabelToBackendStatus(ui?: UiLabel | "All Status"): BackendReportStatus | undefined {
  switch (ui) {
    case "Completed":    return "COMPLETED";
    case "In Progress":  return "RUNNING";
    case "Pending":      return "QUEUED";
    case "Failed":       return "FAILED";
    default:             return undefined;
  }
}
