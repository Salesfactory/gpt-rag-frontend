import React, { useEffect, useState } from "react";
import styles from "./SummarizationReports.module.css"
import { useNavigate } from "react-router-dom";
import { deleteReport, getFilteredReports } from "../../api";
import { IconArrowBack, IconFilePlus, IconTrash, IconX } from "@tabler/icons-react";
import { Label, Spinner } from "@fluentui/react";

const SummarizationReports: React.FC = () => {

    const navigate = useNavigate();
    const [dataLoad, setDataLoad] = useState(false)
    const [filteredReports, setFilteredReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleteActive, setIsDeleteActive] = useState(false)
    const [deletedReportID, setdeletedReportID] = useState('');
    const [deletedReportName, setdeletedReportName] = useState('');

    useEffect(() => {
        const getReportList = async () => {

            setLoading(true);

            try {
                let reportList = await getFilteredReports('companySummarization')

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
        setdeletedReportID(reportID)
        setdeletedReportName(reportName)
    }

    const handleConfirmDelete = async () => {
        setIsDeleteActive(!isDeleteActive)

        try{
            await deleteReport(deletedReportID)
            setDataLoad(!dataLoad)
        } catch (error){
            console.error("Error trying to delete the report: ", error)
        }finally{
            setLoading(false)
        }
    }

    const handleCancelDelete = () => {
        setIsDeleteActive(!isDeleteActive)
        setdeletedReportID('')
        setdeletedReportName('')
    }

    return (
    
        <div className={styles.page_container}>
            <div className={styles.labelContainer}>
                <button className={styles.button} title="Return to Report Management" aria-label="Return to Report Management" onClick={() => navigate('/view-manage-reports')}>
                    <IconArrowBack className={styles.iconColor}/>
                    <Label className={styles.textButton}>Return to Report Management</Label>
                </button>
            </div>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Summarization Reports</h1>
            </div>
            <div className={styles.card}>
                <div className={styles.labelContainer}>
                    <button className={styles.button} title="Create Custom Report" aria-label="Create Custom Report" onClick={() => navigate('/create-summarization-report')}>
                        <IconFilePlus className={styles.iconColor}/>
                        <Label className={styles.textButton}>Create Custom Report</Label>
                    </button>
                </div>
                {loading ? (
                        <Spinner styles={{root: {marginTop: "50px"}}}/>
                    ) : (
                        <table className={styles.table}>
                            <thead className={styles.thead}>
                                <tr>
                                    <th className={styles.tableName}>Ticker</th>
                                    <th>Report Type</th>
                                    <th>Created At</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>    
                                {filteredReports.length > 0 ? (
                                filteredReports.map((report, index) => (
                                    <tr key={index} className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                    <td className={styles.tableName}>
                                        {report.companyTickers}
                                    </td>
                                    <td className={styles.tableText}>
                                        {report.reportTemplate}
                                    </td>
                                    <td>
                                        <div className={styles.tableTypeContainer}> 
                                            <div className={styles.tableText}>
                                                {new Date(report.createAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.tableStatusContainer}>
                                            <div className={`${report.status === 'active' ? styles.tableStatusActive : styles.tableStatusArchived}`}>
                                                {report.status}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.tableText}>
                                            <button className={styles.button} title="Delete Report" aria-label="Delete Report" onClick={() => handleDeleteButton(report.id, report.name)}>
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
            </div>
            {isDeleteActive && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCancelDelete}><IconX/></button>
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
}

export default SummarizationReports;