import { IconBoxMultiple, IconFileSearch, IconX } from "@tabler/icons-react";
import styles from "./ReportConfiguration.module.css"
import { Label, Spinner } from "@fluentui/react";
import { useEffect, useState } from "react";
import { EditRegular } from "@fluentui/react-icons";
import { getAllReports, getReportsByType, updateReport } from "../../api";


const ReportConfiguration  = () => {

    const [filteredReports, setFilteredReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirm, setIsConfirm] = useState(false);
    const [selectedReport, setSelectedReport] = useState({
        id: "",
        reportName: "",
        type: ""
    });
    const [selectedType, setSelectedType] = useState('')

    const handleAllReports = () => {
        const getReportList = async () => {
    
            setLoading(true);

            try {
                let reportList = await getAllReports();

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
    };
    
    const handleSummarizationType = async () => {
        setLoading(true);

        const getReportList = async () => {
            try{
                let reportList = await getReportsByType({type : "summarization"})
                if (!Array.isArray(reportList)) {
                    reportList = [];
                }
                setFilteredReports(reportList);
            } catch (error){
                console.error("Error fetching user list:", error);
                setFilteredReports([]);
            }finally{
                setLoading(false)
            }
        }
        getReportList();
    };

    const handleCurationType = () => {
        setLoading(true);

        const getReportList = async () => {
            try{
                let reportList = await getReportsByType({type : "curation"})
                if (!Array.isArray(reportList)) {
                    reportList = [];
                }

                setFilteredReports(reportList);
            } catch (error){
                console.error("Error fetching user list:", error);
                setFilteredReports([]);
            }finally{
                setLoading(false)
            }
        }
        getReportList();
    };

    const handleEditButton = (report: any) => {
        setIsEditModalOpen(!isEditModalOpen);
        setSelectedReport(report);
    }

    const handleConfirmBox = (newtype: string) => {
        setIsConfirm(!isConfirm);
        setSelectedType(newtype);
    }

    const handleCancelButton = () => {
        setIsConfirm(false)
        setIsEditModalOpen(false)
    }
    
    const handleEditType = async () => {
        setIsEditModalOpen(false);
        setIsConfirm(false);
        setLoading(true);

        try{
            await updateReport({
                reportId: selectedReport.id,
                updatedData: { type: selectedType }
            });
            handleAllReports();
        } catch (error){
            console.error("Error trying to update the type:", error);
        }finally{
            setLoading(false);
        }
        
    }

    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Report Configuration</h1>
            </div>
            <div className={styles.card}>
                <IconBoxMultiple className={styles.iconLarge}/>
                <div className={styles.labelContainer}>
                    <Label className={styles.text}>Available Reports</Label>
                </div>
                <div className={styles.buttonContainer}>
                    <button className={styles.button} title="Select All" aria-label="Select All" onClick={handleAllReports}>
                        All
                    </button>
                    <button className={styles.button} title="Select Summarization" aria-label="Select Summarization" onClick={handleSummarizationType}>
                        Summarization
                    </button>
                    <button className={styles.button} title="Select Curation" aria-label="Select Curation" onClick={handleCurationType}>
                        Curation
                    </button>
                </div>
                {loading ? (
                        <Spinner styles={{root: {marginTop: "50px"}}}/>
                    ) : (
                        <table className={styles.table}>
                            <thead className={styles.thead}>
                                <tr>
                                    <th className={styles.tableName}>Name</th>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>    
                                {filteredReports.length > 0 ? (
                                filteredReports.map((report, index) => (
                                    <tr className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                    <td key={report.reportName} className={styles.tableName}>
                                        {report.reportName}
                                    </td>
                                    <td key={report.id} className={styles.tableText}>
                                        {report.id}
                                    </td>
                                    <td>
                                        <div className={styles.tableTypeContainer}>   {/*Change the BackgroundColor and Color based in the type*/}
                                            <div key={report.type} className={`${report.type == 'summarization' ? styles.tableTypeBackground : styles.tableTypeBackgroundAlt}`}>
                                                {report.type}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {
                                            <div>
                                                <button className={styles.button} title="Edit Report" aria-label="Edit Report" onClick={() => {handleEditButton(report);}}>
                                                    <EditRegular />
                                                </button>
                                            </div>
                                        }
                                    </td>
                                </tr>
                                ))
                                ) : (
                                <Label className={styles.tableName}>Please select a Report Type.</Label>
                                )}
                            </tbody>
                        </table>
                    )}
            </div>
            {isEditModalOpen && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleEditButton}><IconX /></button>
                    <Label className={styles.text}>Please Select the new Type for the Report</Label>
                    <div className={styles.buttonContainer}>
                        <button className={styles.button} title="Select Summarization" aria-label="Select Summarization" onClick={() => {handleConfirmBox('summarization');}}>
                            Summarization
                        </button>
                        <button className={styles.button} title="Select Curation" aria-label="Select Curation" onClick={() => {handleConfirmBox('curation');}}>
                            Curation
                        </button>
                    </div>
                    {isConfirm && (
                        <div>
                            <Label className={styles.text}>Do you want to change the Type of this Report?</Label>
                            <div className={styles.buttonContainer}>
                            <button className={styles.button} title="Select Summarization" aria-label="Select Summarization" onClick={handleEditType}>
                                Confirm
                            </button>
                            <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelButton}>
                                Cancel
                            </button>
                    </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReportConfiguration;