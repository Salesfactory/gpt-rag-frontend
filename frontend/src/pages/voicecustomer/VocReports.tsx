import React, { useMemo, useState } from "react";
import { Search, TrendingUp, X, Clock, CheckCircle, AlertCircle } from "lucide-react";
import styles from "./VoiceCustomer.module.css";

type JobStatus = "Completed" | "In Progress" | "Pending" | "Failed";

interface ReportJob {
  id: number;
  type: string;
  target: string;
  status: JobStatus;
  progress: number;
  startDate: string | null;
  endDate: string | null;
}

function getStatusClass(status: JobStatus): string {
  switch (status) {
    case "Completed":
      return styles.Completed;
    case "In Progress":
      return styles.InProgress;
    case "Pending":
      return styles.Pending;
    case "Failed":
      return styles.Failed;
    default:
      return styles.Unknown;
  }
}

const VocReports: React.FC = () => {
  // Estado local (puedes reemplazar por datos reales cuando tengas API)
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"All Status" | JobStatus>("All Status");
  const [reportJobs] = useState<ReportJob[]>([
    { id: 1, type: "Brand Analysis",       target: "Apple",            status: "Completed",   progress: 100, startDate: "2024-07-15", endDate: "2024-07-16" },
    { id: 2, type: "Product Analysis",     target: "iPhone 15",        status: "In Progress", progress: 65,  startDate: "2024-07-16", endDate: null },
    { id: 3, type: "Competitive Analysis", target: "Samsung vs Apple", status: "Pending",     progress: 0,   startDate: null,         endDate: null },
    { id: 4, type: "Brand Analysis",       target: "Nike",             status: "Failed",      progress: 30,  startDate: "2024-07-14", endDate: null },
    { id: 5, type: "Product Analysis",     target: "MacBook Pro",      status: "Completed",   progress: 100, startDate: "2024-07-13", endDate: "2024-07-15" },
  ]);

  const getStatusIcon = (status: JobStatus) => {
    if (status === "Completed")   return <CheckCircle size={16} style={{ color: "#16a34a" }} />;
    if (status === "In Progress") return <Clock       size={16} style={{ color: "#2563eb" }} />;
    if (status === "Failed")      return <AlertCircle size={16} style={{ color: "#dc2626" }} />;
    return <Clock size={16} style={{ color: "#6b7280" }} />;
  };

  const jobsToDisplay = useMemo(() => {
    const filtered = reportJobs.filter(job => {
      const matchesSearch =
        job.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.target.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === "All Status" || job.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    const withEnd = filtered.filter(j => j.endDate !== null);
    const withoutEnd = filtered.filter(j => j.endDate === null);

    withEnd.sort((a, b) => {
      const aTime = new Date(a.endDate as string).getTime();
      const bTime = new Date(b.endDate as string).getTime();
      return bTime - aTime;
    });

    return [...withEnd, ...withoutEnd].slice(0, 10);
  }, [reportJobs, searchQuery, selectedStatus]);

  return (
    <section className={styles.reportSection}>
      <div className={styles.reportHeader}>
        <TrendingUp size={20} />
        <h3 className={styles.reportTitle}>Report Generation Status</h3>
      </div>

      <div className={styles.filtersContainer}>
        <div className={styles.filtersContent}>
          {/* Search */}
          <div className={styles.searchContainer}>
            <div className={styles.searchIcon}>
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className={styles.clearSearchButton} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className={styles.filterDropdown}>
            <button
              type="button"
              className={styles.filterButton}
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              aria-expanded={showStatusFilter}
              aria-haspopup="listbox"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {selectedStatus}
            </button>

            {showStatusFilter && (
              <div className={styles.filterMenu} role="listbox">
                <div className={styles.filterMenuItems}>
                  {["All Status", "Completed", "In Progress", "Pending", "Failed"].map((status) => (
                    <button
                      key={status}
                      className={`${styles.filterOption} ${selectedStatus === status ? styles.activeFilter : ""}`}
                      onClick={() => {
                        setSelectedStatus(status as typeof selectedStatus);
                        setShowStatusFilter(false);
                      }}
                      role="option"
                      aria-selected={selectedStatus === status}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.tableTh}>Type</th>
              <th className={styles.tableTh}>End Date</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {jobsToDisplay.map((job) => (
              <tr key={job.id} className={styles.tableRow}>
                <td className={styles.tableCell}>
                  <div className={styles.statusCell}>
                    {getStatusIcon(job.status)}
                    <span className={styles.jobType}>{job.type}</span>
                    <span className={`${styles.statusBadge} ${getStatusClass(job.status)}`}>{job.status}</span>
                  </div>
                  {/* Si quisieras mostrar también el target:
                  <div className={styles.itemDescription}>{job.target}</div>
                  */}
                </td>
                <td className={styles.tableCell}>{job.endDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default VocReports;
