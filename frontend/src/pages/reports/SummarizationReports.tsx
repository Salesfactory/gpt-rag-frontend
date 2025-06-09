import React, { useEffect, useState } from "react";
import styles from "./SummarizationReports.module.css";
import { useNavigate } from "react-router-dom";
import { deleteReport, getFilteredReports } from "../../api";
import { IconTrash, IconX } from "@tabler/icons-react";
import { CornerDownLeft, FilePlus } from "lucide-react";
import { Label, Spinner } from "@fluentui/react";

const SummarizationReports: React.FC = () => {
    const navigate = useNavigate();
    const [dataLoad, setDataLoad] = useState(false);
    const [filteredReports, setFilteredReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleteActive, setIsDeleteActive] = useState(false);
    const [deletedReportID, setdeletedReportID] = useState("");
    const [deletedReportName, setdeletedReportName] = useState("");

    useEffect(() => {
        const getReportList = async () => {
            setLoading(true);

            try {
                let reportList = await getFilteredReports("companySummarization");

                if (!Array.isArray(reportList)) {
                    reportList = [];
                }

                setFilteredReports(reportList);
            } catch (error) {
                console.error("Error fetching user list:", error);
                setFilteredReports([]);
            } finally {
                setLoading(false);
            }
        };

        getReportList();
    }, [dataLoad]);

    const handleDeleteButton = (reportID: string, reportName: string) => {
        setIsDeleteActive(!isDeleteActive);
        setdeletedReportID(reportID);
        setdeletedReportName(reportName);
    };

    const handleConfirmDelete = async () => {
        setIsDeleteActive(!isDeleteActive);

        try {
            await deleteReport(deletedReportID);
            setDataLoad(!dataLoad);
        } catch (error) {
            console.error("Error trying to delete the report: ", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelDelete = () => {
        setIsDeleteActive(!isDeleteActive);
        setdeletedReportID("");
        setdeletedReportName("");
    };

    return (
        <div className={styles.page_container}>
            <div className={styles.labelContainer}>
                <button
                    className={styles.button}
                    title="Return to Report Management"
                    aria-label="Return to Report Management"
                    onClick={() => navigate("/view-manage-reports")}
                >
                    <CornerDownLeft className={styles.iconColor} />
                    <Label className={styles.textButton}>Return to Report Management</Label>
                </button>
                <button
                    className={styles.button}
                    title="Create Summarization Report"
                    aria-label="Create Summarization Report"
                    onClick={() => navigate("/create-summarization-report")}
                >
                    <FilePlus className={styles.iconColor} />
                    <Label className={styles.textButton}>Create Summarization Report</Label>
                </button>
            </div>
            {loading ? (
                <Spinner styles={{ root: { marginTop: "50px" } }} />
            ) : (
                <div className={styles.tableContainer}>
                    <table className={`${styles.table} ${styles.desktopTable}`}>
                        <thead className={styles.thead}>
                            <tr>
                                <th className={styles.tableName}>Ticker</th>
                                <th className={styles.tableName}>Report Type</th>
                                <th className={styles.tableName}>Created At</th>
                                <th className={styles.tableName}>Status</th>
                                <th className={styles.tableName}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReports.length > 0 ? (
                                filteredReports.map((report, index) => (
                                    <tr key={index} className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                        <td className={styles.tableText2}>{report.companyTickers}</td>
                                        <td className={styles.tableText}>{report.reportTemplate}</td>
                                        <td>
                                            <div className={styles.tableTypeContainer}>
                                                <div className={styles.tableText}>{new Date(report.createAt).toLocaleDateString()}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.tableStatusContainer}>
                                                <div
                                                    className={`${report.status === "active" ? styles.tableStatusActive : styles.tableStatusArchived} ${
                                                        styles.extraClass
                                                    }`}
                                                >
                                                    {report.status}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.tableText}>
                                                <button
                                                    className={styles.button}
                                                    title="Delete Report"
                                                    aria-label="Delete Report"
                                                    onClick={() => handleDeleteButton(report.id, report.name)}
                                                >
                                                    <IconTrash className={styles.iconColor} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr key="error">
                                    <td colSpan={5}>
                                        <Label className={styles.tableName}>No Reports available.</Label>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className={styles.mobileCards}>
                        {filteredReports.length > 0 ? (
                            filteredReports.map((report, index) => (
                                <div key={index} className={styles.mobileCard}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>{report.companyTickers}</h3>
                                        <div className={styles.cardActions}>
                                            <button
                                                className={styles.button}
                                                title="Delete Report"
                                                aria-label="Delete Report"
                                                onClick={() => handleDeleteButton(report.id, report.name)}
                                            >
                                                <IconTrash className={styles.iconColor} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div className={styles.cardRow}>
                                            <span className={styles.cardLabel}>Report Type:</span>
                                            <span className={styles.cardValue}>{report.reportTemplate}</span>
                                        </div>
                                        <div className={styles.cardRow}>
                                            <span className={styles.cardLabel}>Created:</span>
                                            <span className={styles.cardValue}>{new Date(report.createAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className={styles.cardRow}>
                                            <span className={styles.cardLabel}>Status:</span>
                                            <div
                                                className={`${report.status === "active" ? styles.tableStatusActive : styles.tableStatusArchived} ${
                                                    styles.extraClass
                                                }`}
                                            >
                                                {report.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={styles.noReports}>
                                <Label className={styles.tableName}>No Reports available.</Label>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {isDeleteActive && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCancelDelete}>
                        <IconX />
                    </button>
                    <Label className={styles.text}>Are you sure you want to delete {deletedReportName}?</Label>
                    <div className={styles.buttonContainer}>
                        <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelDelete}>
                            Cancel
                        </button>
                        <button className={styles.button} title="Confirm" aria-label="Confirm" onClick={handleConfirmDelete}>
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SummarizationReports;
