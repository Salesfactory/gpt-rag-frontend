import React, { useEffect, useState } from "react";
import styles from "./ReportTemplates.module.css";
import { Label, Spinner } from "@fluentui/react";
import { IconArrowBack, IconEdit, IconFilePlus, IconTrash, IconX } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSummarizationTemplates, deleteSummarizationReportTemplate } from "../../api";

export const TemplateReports: React.FC = () => {
    const [dataLoad, setDataLoad] = useState(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setFilteredData] = useState<any>([]);
    const [isDeleteActive, setIsDeleteActive] = useState(false);
    const [deletedReportID, setdeletedReportID] = useState("");
    const [deletedReportName, setdeletedReportName] = useState("");
    const [popUp, setPopUp] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const getReportsTemplatesList = async () => {
            if (location.state && location.state.popUp) {
                setPopUp(true);
                // Clear the popUp state after handling it
                navigate(location.pathname, { replace: true, state: {} });
                setTimeout(() => {
                    setPopUp(false);
                }, 3000);
            }
            setLoading(true);
            try {
                let templateList = await getSummarizationTemplates();
                if (!Array.isArray(templateList)) {
                    templateList = [];
                }
                setFilteredData(templateList);
            } catch (error) {
                console.error("Error fetching user list:", error);
                setFilteredData([]);
            } finally {
                setLoading(false);
            }
        };
        getReportsTemplatesList();
    }, [dataLoad]);

    const handleDeleteButton = (id: string, templateType: string, companyName: string) => {
        setIsDeleteActive(true);
        setdeletedReportID(id);
        setdeletedReportName(templateType + " - " + companyName);
    };

    const handleCancelDelete = () => {
        setIsDeleteActive(false);
        setdeletedReportID("");
        setdeletedReportName("");
    };

    const handleConfirmDelete = async () => {
        setIsDeleteActive(false);
        try {
            await deleteSummarizationReportTemplate(deletedReportID);
            setDataLoad(!dataLoad);
        } catch (error) {
            console.error("Error trying to delete the report: ", error);
        } finally {
            setLoading(false);
        }
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
                    <IconArrowBack className={styles.iconColor} />
                    <Label className={styles.textButton}>Return to Report Management</Label>
                </button>

                <button className={styles.button} title="Add a New Report" aria-label="Add a New Report" onClick={() => navigate("/create-template-report")}>
                    <IconFilePlus className={styles.iconColor} />
                    <Label className={styles.textButton}>Add Template Report</Label>
                </button>
            </div>
            {loading ? (
                <Spinner styles={{ root: { marginTop: "50px" } }} />
            ) : (
                <div className={styles.tableContainer}>
                    {/* Desktop Table */}
                    <table className={`${styles.table} ${styles.desktopTable}`}>
                        <thead className={styles.thead}>
                            <tr>
                                <th className={styles.tableName}>Summarization Report</th>
                                <th className={styles.tableName}>Company Name</th>
                                <th className={styles.tableName}>Created At</th>
                                <th className={styles.tableName}>Description</th>
                                <th className={styles.tableName}>Status</th>
                                <th className={styles.tableName}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length > 0 ? (
                                data.map((report: any, index: number) => (
                                    <tr key={index} className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                        <td className={styles.tableText2}>
                                            {report.companyTicker} {report.templateType}
                                        </td>
                                        <td className={styles.tableText}>{report.companyName}</td>
                                        <td className={styles.tableText}>{new Date(report.createdAt).toLocaleString()}</td>
                                        <td className={styles.tableText}>{report.description}</td>
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
                                                    onClick={() => handleDeleteButton(report.id, report.templateType, report.companyName)}
                                                >
                                                    <IconTrash className={styles.iconColor} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr key="error">
                                    <td colSpan={6}>
                                        <Label className={styles.tableName}>No Reports available.</Label>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Cards */}
                    <div className={styles.mobileCards}>
                        {data.length > 0 ? (
                            data.map((report: any, index: number) => (
                                <div key={index} className={styles.mobileCard}>
                                    <div className={styles.cardHeader}>
                                        <h3 className={styles.cardTitle}>
                                            {report.companyTicker} {report.templateType}
                                        </h3>
                                        <div className={styles.cardActions}>
                                            <button
                                                className={styles.button}
                                                title="Delete Report"
                                                aria-label="Delete Report"
                                                onClick={() => handleDeleteButton(report.id, report.templateType, report.companyName)}
                                            >
                                                <IconTrash className={styles.iconColor} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div className={styles.cardRow}>
                                            <span className={styles.cardLabel}>Company:</span>
                                            <span className={styles.cardValue}>{report.companyName}</span>
                                        </div>
                                        <div className={styles.cardRow}>
                                            <span className={styles.cardLabel}>Created:</span>
                                            <span className={styles.cardValue}>{new Date(report.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className={styles.cardRow}>
                                            <span className={styles.cardLabel}>Description:</span>
                                            <span className={styles.cardValue}>{report.description}</span>
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
                    <Label className={styles.text}>Are you sure you want to delete "{deletedReportName}"?</Label>
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

            {popUp && (
                <div className={styles.modalPopup}>
                    <Label className={styles.text}>
                        The report has been added. It needs to be implemented for generation. <br />
                        If not implemented, it will not be generated.
                    </Label>
                </div>
            )}
        </div>
    );
};
