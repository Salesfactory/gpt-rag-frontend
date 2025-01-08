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
                console.log(templateList);
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
    }

    const handleCancelDelete = () => {
        setIsDeleteActive(false);
    }

    const handleConfirmDelete = async() => {
        setIsDeleteActive(false);
        try {
            await deleteSummarizationReportTemplate(deletedReportID);
            setDataLoad(!dataLoad);
        } catch (error) {
            console.error("Error trying to delete the report: ", error);
        } finally {
            setLoading(false);
        }
    }

    const navigate = useNavigate();
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
            </div>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Summarization Report Templates</h1>
            </div>
            <div className={styles.card}>
                <div className={styles.labelContainer}>
                    <button
                        className={styles.button}
                        title="Add a New Report"
                        aria-label="Add a New Report"
                        onClick={() => navigate("/create-template-report")}
                    >
                        <IconFilePlus className={styles.iconColor} />
                        <Label className={styles.textButton}>Add Template Report</Label>
                    </button>
                </div>
                {loading ? (
                    <Spinner styles={{ root: { marginTop: "50px" } }} />
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr className={styles.thead}>
                                <th className={styles.tableName}>Template Type</th>
                                <th>Company Name</th>
                                <th>Created At</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length > 0 ? (
                                data.map((report: any, index: number) => (
                                    <tr key={index} className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                        <td className={styles.tableName}>{report.templateType}</td>
                                        <td className={styles.tableText}>{report.companyName}</td>
                                        <td className={styles.tableText}>{new Date(report.createdAt).toLocaleString()}</td>
                                        <td className={styles.tableText}>{report.description}</td>
                                        <td>
                                        <div className={styles.tableStatusContainer}>
                                            <div className={`${report.status === 'active' ? styles.tableStatusActive : styles.tableStatusArchived}`}>
                                                {report.status}
                                            </div>
                                        </div>
                                        </td>
                                    <td>
                                        <div className={styles.tableText}>
                                            <button className={styles.button} title="Delete Report" aria-label="Delete Report" onClick={() => handleDeleteButton(report.id, report.templateType, report.companyName)}>
                                                <IconTrash className={styles.iconColor}/>
                                            </button>
                                        </div>
                                    </td>
                                    </tr>
                                ))
                            ) : (
                                <tr key='error'>
                                    <td>
                                    <Label className={styles.tableName}>No Reports available.</Label>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
                <div>
                {isDeleteActive && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCancelDelete}><IconX/></button>
                    <Label className={styles.text}>Are you sure you want to delete {deletedReportName}</Label>
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
            </div>
            {popUp && (
                    <div className={styles.modalPopup}>
                        <Label className={styles.text}>The report has been added. It needs to be implemented for generation. <br /> 
                    If not implemented, it will not be generated.</Label>
                    </div>
                )}
        </div>
    );
};
