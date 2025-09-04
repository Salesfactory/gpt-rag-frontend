import styles from "./VoiceCustomer.module.css";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Canonical } from "../../utils/reportStatus";

export function statusClass(c: Canonical): string {
  switch (c) {
    case "SUCCEEDED": return styles.Completed;
    case "RUNNING":   return styles.InProgress;
    case "QUEUED":    return styles.Pending;
    case "FAILED":    return styles.Failed;
    default:          return styles.Unknown;
  }
}

export function statusLabel(c: Canonical): string {
  switch (c) {
    case "SUCCEEDED": return "Completed";
    case "RUNNING":   return "In Progress";
    case "FAILED":    return "Failed";
    case "QUEUED":    return "Pending";
    default:           return "Unknown";
  }
}

export function statusType(string: string | undefined): string {
  switch (string) {
    case "brand_analysis": return "Brand Analysis";
    case "product_analysis":   return "Product Analysis";
    case "competitor_analysis":    return "Competitor Analysis";
    default:           return "Unknown";
  }
}

export function statusIcon(c: Canonical) {
  if (c === "SUCCEEDED") return <CheckCircle size={16} style={{ color: "#16a34a" }} />;
  if (c === "RUNNING")   return <Clock size={16} style={{ color: "#2563eb" }} />;
  if (c === "FAILED")    return <AlertCircle size={16} style={{ color: "#dc2626" }} />;
  return <Clock size={16} style={{ color: "#6b7280" }} />;
}
