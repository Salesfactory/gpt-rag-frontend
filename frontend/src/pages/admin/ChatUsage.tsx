import React, { useState, useMemo } from "react";
import { TextField } from "@fluentui/react/lib/TextField";
import { Search, X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { Spinner } from "@fluentui/react";
import styles from "./ChatUsage.module.css";

type LimitStatus = "ok" | "warning" | "exceeded";
type SortField = "organization" | "tier" | "usage" | "limit" | "status";
type SortOrder = "asc" | "desc";

interface OrganizationUsage {
    id: string;
    organizationName: string;
    currentTier: string;
    usage: number;
    limit: number;
    percentageUsed: number;
    status: LimitStatus;
    lastUpdated: string;
}

// Placeholder data for demonstration
const generatePlaceholderData = (): OrganizationUsage[] => {
    return [
        {
            id: "1",
            organizationName: "Acme Corporation",
            currentTier: "Enterprise",
            usage: 45000,
            limit: 100000,
            percentageUsed: 45,
            status: "ok",
            lastUpdated: "2025-11-26T10:30:00"
        },
        {
            id: "2",
            organizationName: "TechStart Inc.",
            currentTier: "Professional",
            usage: 8500,
            limit: 10000,
            percentageUsed: 85,
            status: "warning",
            lastUpdated: "2025-11-26T09:15:00"
        },
        {
            id: "3",
            organizationName: "Global Solutions Ltd",
            currentTier: "Enterprise",
            usage: 125000,
            limit: 100000,
            percentageUsed: 125,
            status: "exceeded",
            lastUpdated: "2025-11-26T11:45:00"
        },
        {
            id: "4",
            organizationName: "Innovation Labs",
            currentTier: "Basic",
            usage: 1200,
            limit: 5000,
            percentageUsed: 24,
            status: "ok",
            lastUpdated: "2025-11-26T08:00:00"
        },
        {
            id: "5",
            organizationName: "Digital Dynamics",
            currentTier: "Professional",
            usage: 9800,
            limit: 10000,
            percentageUsed: 98,
            status: "exceeded",
            lastUpdated: "2025-11-26T10:00:00"
        },
        {
            id: "6",
            organizationName: "Cloud Services Co",
            currentTier: "Enterprise",
            usage: 72000,
            limit: 100000,
            percentageUsed: 72,
            status: "ok",
            lastUpdated: "2025-11-26T09:30:00"
        },
        {
            id: "7",
            organizationName: "DataFlow Systems",
            currentTier: "Professional",
            usage: 7800,
            limit: 10000,
            percentageUsed: 78,
            status: "warning",
            lastUpdated: "2025-11-26T11:00:00"
        },
        {
            id: "8",
            organizationName: "NextGen Analytics",
            currentTier: "Basic",
            usage: 3200,
            limit: 5000,
            percentageUsed: 64,
            status: "ok",
            lastUpdated: "2025-11-26T07:45:00"
        },
        {
            id: "9",
            organizationName: "Smart Enterprises",
            currentTier: "Enterprise",
            usage: 95000,
            limit: 100000,
            percentageUsed: 95,
            status: "warning",
            lastUpdated: "2025-11-26T10:15:00"
        },
        {
            id: "10",
            organizationName: "Vision Tech",
            currentTier: "Professional",
            usage: 4500,
            limit: 10000,
            percentageUsed: 45,
            status: "ok",
            lastUpdated: "2025-11-26T08:30:00"
        }
    ];
};

const ChatUsage = () => {
    const [search, setSearch] = useState("");
    const [loading] = useState(false);
    const [sortField, setSortField] = useState<SortField>("organization");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [statusFilter, setStatusFilter] = useState<LimitStatus | "all">("all");
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    const organizations = useMemo(() => generatePlaceholderData(), []);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const filteredAndSortedOrganizations = useMemo(() => {
        let filtered = organizations;

        // Apply search filter
        if (search) {
            filtered = filtered.filter(org =>
                org.organizationName.toLowerCase().includes(search.toLowerCase()) ||
                org.currentTier.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Apply status filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(org => org.status === statusFilter);
        }

        // Apply sorting
        const sorted = [...filtered].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortField) {
                case "organization":
                    aValue = a.organizationName.toLowerCase();
                    bValue = b.organizationName.toLowerCase();
                    break;
                case "tier":
                    aValue = a.currentTier.toLowerCase();
                    bValue = b.currentTier.toLowerCase();
                    break;
                case "usage":
                    aValue = a.usage;
                    bValue = b.usage;
                    break;
                case "limit":
                    aValue = a.limit;
                    bValue = b.limit;
                    break;
                case "status":
                    aValue = a.percentageUsed;
                    bValue = b.percentageUsed;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
            if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [organizations, search, statusFilter, sortField, sortOrder]);

    const getStatusIcon = (status: LimitStatus) => {
        switch (status) {
            case "ok":
                return <CheckCircle className={styles.statusIconOk} size={16} />;
            case "warning":
                return <AlertTriangle className={styles.statusIconWarning} size={16} />;
            case "exceeded":
                return <AlertCircle className={styles.statusIconExceeded} size={16} />;
        }
    };

    const getStatusBadge = (status: LimitStatus) => {
        const badges = {
            ok: { text: "OK", className: styles.statusBadgeOk },
            warning: { text: "Warning", className: styles.statusBadgeWarning },
            exceeded: { text: "Exceeded", className: styles.statusBadgeExceeded }
        };
        return badges[status];
    };

    const getTierBadge = (tier: string) => {
        const className =
            tier === "Enterprise"
                ? styles.tierEnterprise
                : tier === "Professional"
                ? styles.tierProfessional
                : styles.tierBasic;
        return className;
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };

    const statusFilterOptions = [
        { label: "All Status", value: "all" },
        { label: "OK", value: "ok" },
        { label: "Warning", value: "warning" },
        { label: "Exceeded", value: "exceeded" }
    ];

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        const total = organizations.length;
        const ok = organizations.filter(o => o.status === "ok").length;
        const warning = organizations.filter(o => o.status === "warning").length;
        const exceeded = organizations.filter(o => o.status === "exceeded").length;
        const totalUsage = organizations.reduce((sum, org) => sum + org.usage, 0);
        const totalLimit = organizations.reduce((sum, org) => sum + org.limit, 0);

        return { total, ok, warning, exceeded, totalUsage, totalLimit };
    }, [organizations]);

    return (
        <div className={styles.pageContainer}>
            <div className={styles.headerSection}>
                <div>
                    <h1 className={styles.pageTitle}>Chat Usage Dashboard</h1>
                    <p className={styles.pageSubtitle}>Monitor usage across all organizations</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Total Organizations</span>
                    </div>
                    <div className={styles.summaryCardValue}>{summaryStats.total}</div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Status: OK</span>
                        <CheckCircle className={styles.statusIconOk} size={18} />
                    </div>
                    <div className={styles.summaryCardValue}>{summaryStats.ok}</div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Status: Warning</span>
                        <AlertTriangle className={styles.statusIconWarning} size={18} />
                    </div>
                    <div className={styles.summaryCardValue}>{summaryStats.warning}</div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryCardHeader}>
                        <span className={styles.summaryCardLabel}>Status: Exceeded</span>
                        <AlertCircle className={styles.statusIconExceeded} size={18} />
                    </div>
                    <div className={styles.summaryCardValue}>{summaryStats.exceeded}</div>
                </div>
            </div>

            {/* Search and Filter Controls */}
            <div className={styles.controlsContainer}>
                <div className={styles.searchContainer}>
                    <span className={styles.searchIcon}>
                        <Search size={16} />
                    </span>
                    <TextField
                        className={styles.searchInput}
                        placeholder="Search by organization or tier..."
                        value={search}
                        styles={{
                            fieldGroup: {
                                height: "40px",
                                paddingLeft: 36,
                                borderRadius: "0.5rem",
                                border: "1px solid #e5e7eb",
                                selectors: {
                                    "::after": {
                                        borderRadius: "0.5rem"
                                    }
                                }
                            },
                            field: {
                                fontSize: "16px",
                                selectors: {
                                    ":focus": {
                                        outline: "none"
                                    },
                                    ":focus-visible": {
                                        outline: "none"
                                    },
                                    "::placeholder": {
                                        color: "#9ca3af",
                                        fontSize: "16px"
                                    }
                                }
                            },
                            root: {
                                selectors: {
                                    ":focus-within": {
                                        outline: "none"
                                    },
                                    "::after": {
                                        border: "none !important",
                                        display: "none !important"
                                    }
                                }
                            },
                            suffix: {
                                background: "white !important",
                                color: "#9ca3af",
                                padding: "0px 8px",
                                borderRadius: "0 0.5rem 0.5rem 0"
                            }
                        }}
                        onChange={(_ev, newValue) => {
                            setSearch(newValue || "");
                        }}
                        onRenderSuffix={() =>
                            search ? (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setSearch("")}
                                    className={styles.clearButton}
                                >
                                    <X size={16} />
                                </button>
                            ) : null
                        }
                    />
                </div>

                <div className={styles.filterContainer}>
                    <button
                        className={styles.filterButton}
                        type="button"
                        onClick={() => setShowStatusDropdown(v => !v)}
                        aria-label="Filter by status"
                    >
                        <span>{statusFilterOptions.find(opt => opt.value === statusFilter)?.label || "Filter"}</span>
                    </button>
                    {showStatusDropdown && (
                        <div className={styles.dropdownMenu}>
                            {statusFilterOptions.map(option => (
                                <div
                                    key={option.value}
                                    className={styles.dropdownItem}
                                    onClick={() => {
                                        setStatusFilter(option.value as LimitStatus | "all");
                                        setShowStatusDropdown(false);
                                    }}
                                    style={{
                                        fontWeight: statusFilter === option.value ? "bold" : "normal",
                                        background: statusFilter === option.value ? "#f3f4f6" : "white"
                                    }}
                                >
                                    {option.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Results Info */}
            <div className={styles.resultsInfo}>
                Showing {filteredAndSortedOrganizations.length} of {organizations.length} organizations
            </div>

            {/* Table */}
            {loading ? (
                <Spinner
                    styles={{
                        root: {
                            marginTop: "50px"
                        }
                    }}
                />
            ) : (
                <div className={styles.tableScroll}>
                    <table className={styles.usageTable}>
                        <thead>
                            <tr className={styles.tableHeader}>
                                <th className={styles.sortableHeader} onClick={() => handleSort("organization")}>
                                    <div className={styles.headerContent}>
                                        Organization
                                        {sortField === "organization" && (
                                            <span className={styles.sortIndicator}>
                                                {sortOrder === "asc" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className={styles.sortableHeader} onClick={() => handleSort("tier")}>
                                    <div className={styles.headerContent}>
                                        Tier
                                        {sortField === "tier" && (
                                            <span className={styles.sortIndicator}>
                                                {sortOrder === "asc" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className={styles.sortableHeader} onClick={() => handleSort("usage")}>
                                    <div className={styles.headerContent}>
                                        Usage
                                        {sortField === "usage" && (
                                            <span className={styles.sortIndicator}>
                                                {sortOrder === "asc" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className={styles.sortableHeader} onClick={() => handleSort("limit")}>
                                    <div className={styles.headerContent}>
                                        Limit
                                        {sortField === "limit" && (
                                            <span className={styles.sortIndicator}>
                                                {sortOrder === "asc" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className={styles.centerAlign}>Usage Progress</th>
                                <th className={styles.sortableHeader} onClick={() => handleSort("status")}>
                                    <div className={styles.headerContent}>
                                        Status
                                        {sortField === "status" && (
                                            <span className={styles.sortIndicator}>
                                                {sortOrder === "asc" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedOrganizations.map((org, index) => (
                                <tr key={org.id} className={index % 2 === 0 ? styles.evenRow : styles.oddRow}>
                                    <td className={styles.organizationCell}>
                                        <div className={styles.organizationName}>{org.organizationName}</div>
                                    </td>
                                    <td>
                                        <span className={getTierBadge(org.currentTier)}>{org.currentTier}</span>
                                    </td>
                                    <td className={styles.numberCell}>{formatNumber(org.usage)}</td>
                                    <td className={styles.numberCell}>{formatNumber(org.limit)}</td>
                                    <td>
                                        <div className={styles.progressContainer}>
                                            <div className={styles.progressBar}>
                                                <div
                                                    className={`${styles.progressFill} ${
                                                        org.status === "exceeded"
                                                            ? styles.progressExceeded
                                                            : org.status === "warning"
                                                            ? styles.progressWarning
                                                            : styles.progressOk
                                                    }`}
                                                    style={{ width: `${Math.min(org.percentageUsed, 100)}%` }}
                                                />
                                            </div>
                                            <span className={styles.percentageText}>{org.percentageUsed}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.statusCell}>
                                            {getStatusIcon(org.status)}
                                            <span className={getStatusBadge(org.status).className}>{getStatusBadge(org.status).text}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filteredAndSortedOrganizations.length === 0 && !loading && (
                <div className={styles.emptyState}>
                    <p>No organizations found matching your search criteria.</p>
                </div>
            )}
        </div>
    );
};

export default ChatUsage;

