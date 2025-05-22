import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReportBlobs } from "../../api";
import styles from "./Reportscopy.module.css";
import { TextField } from "@fluentui/react";
import { Filter, Search, FileText, Download } from "lucide-react";

interface IReport {
    status: string;
    id: string;
    title: string;
    creationDate: string;
    type: string;
    downloadUrl: string;
}

export default function Reports() {
    const [reports, setReports] = useState<IReport[]>([]);
    const [allReports, setAllReports] = useState<IReport[]>([]);
    const [searchText, setSearchText] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [showRoleDropdown, setShowRoleDropdown] = useState<boolean>(false);

    useEffect(() => {
        setLoading(true);
        const getData = async () => {
            const reports = await getReportBlobs({
                container_name: "documents",
                prefix: "Reports/Curation_Reports",
                include_metadata: "yes",
                max_results: "10"
            });

            const cleanedReports = reports.data.map((report: any, index: number) => {
                const name = report.name.split("/");
                return {
                    id: index + 1,
                    title: name[name.length - 1].split(".")[0],
                    type: name.length > 2 ? name[2] : "",
                    creationDate: report.created_on,
                    downloadUrl: report.url
                };
            });

            const finalReports = [...cleanedReports];

            setReports(finalReports);
            setAllReports(finalReports);
            setLoading(false);
        };
        getData();
    }, []);

    const handleSearch = () => {
        if (searchText) {
            const filteredReports = allReports.filter(report => report.title.toLowerCase().includes(searchText.toLowerCase()));
            setReports(filteredReports);
        } else {
            setReports(allReports);
        }
    };

    const clearSearch = () => {
        setSearchText("");
        setReports(allReports);
    };

    return (
        <div className={styles.container}>
            {/* Main Content */}
            <main className={styles.mainContent}>
                {/* Page Description */}

                <div className={styles.pageBar}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <span
                            style={{
                                position: "absolute",
                                left: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                zIndex: 1,
                                color: "#9ca3af",
                                pointerEvents: "none",
                                paddingBottom: "2px"
                            }}
                        >
                            <Search />
                        </span>
                        <TextField
                            className={styles.responsiveSearch}
                            placeholder="Search Reports..."
                            styles={{
                                fieldGroup: {
                                    height: "40px",
                                    paddingLeft: 36,
                                    borderRadius: "0.5rem",
                                    border: "1px solid #e5e7eb",
                                    position: "relative",
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
                                }
                            }}
                            onChange={(_ev, newValue) => {}}
                        />
                    </div>

                    <div style={{ position: "relative" }}>
                        {/*Disable this button for now */}
                        {/* <button
                            className={styles.filterButton}
                            type="button"
                            onClick={() => setShowRoleDropdown(prev => !prev)}
                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                        >
                            <Filter size={18} style={{ marginRight: 6 }} />
                            <span style={{ fontSize: "16px" }}>Filters</span>
                        </button> */}
                        {showRoleDropdown && (
                            <div
                                className={styles.dropdownMenu}
                                style={{
                                    position: "absolute",
                                    top: "110%",
                                    left: 0,
                                    background: "white",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "0.5rem",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                    zIndex: 10,
                                    minWidth: 140,
                                    padding: "12px"
                                }}
                            ></div>
                        )}
                    </div>
                </div>

                {/* Reports Table */}
                <div className={styles.reportsTableContainer}>
                    {loading ? (
                        <div className={styles.loadingState}>
                            <p>Loading...</p>
                        </div>
                    ) : (
                        <div className={styles.tableWrapper}>
                            <table className={styles.reportsTable}>
                                <thead className={styles.tableHeader}>
                                    <tr>
                                        <th className={styles.tableHeaderCell}>Report ID</th>
                                        <th className={styles.tableHeaderCell}>Title</th>
                                        <th className={styles.tableHeaderCell}>Type</th>
                                        <th className={styles.tableHeaderCell}>Creation Date</th>
                                        <th className={styles.tableHeaderCell}>Status</th>
                                        <th className={styles.tableHeaderCell + " " + styles.actionsCell}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.length > 0 ? (
                                        reports.map((report, idx) => (
                                            <tr key={report.id} className={idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                                                <td className={styles.tableCellId}>{report.id}</td>
                                                <td className={styles.tableCellTitle}>
                                                    <div className={styles.reportTitle}>
                                                        <FileText className={styles.fileIcon} size={16} />
                                                        {report.title}
                                                    </div>
                                                </td>
                                                <td className={styles.tableCellType}>{report.type}</td>
                                                <td className={styles.tableCellType}>
                                                    {report.creationDate ? new Date(report.creationDate).toDateString() : ""}
                                                </td>
                                                <td className={styles.tableCellStatus}>{report.status || "—"}</td>
                                                <td className={styles.tableCell + " " + styles.actionsCell}>
                                                    <button className={styles.viewButton}>View</button>
                                                    {report.downloadUrl && (
                                                        <a href={report.downloadUrl} target="_blank" rel="noopener noreferrer" className={styles.downloadLink}>
                                                            <Download className={styles.downloadIcon} size={16} />
                                                            Download
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className={styles.emptyState}>
                                                No reports found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
