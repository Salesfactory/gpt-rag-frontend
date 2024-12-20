import React, { useState } from "react";
import styles from "./CurationReports.module.css"
import { Label, Spinner } from "@fluentui/react";
import { IconX } from "@tabler/icons-react";

const CurationReports  = () => {

    const [filteredReports, setFilteredReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isConfirm, setIsConfirm] = useState(false);
    

    const handleCreateButton = () => {
        setIsCreateModalOpen(!isCreateModalOpen);

    }

    const handleConfirmBox = () => {
        setIsConfirm(!isConfirm);
        
    }

    const handleCancelButton = () => {
        setIsConfirm(false)
        setIsCreateModalOpen(false)
    }
    

    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Curation Reports</h1>
            </div>
            <div className={styles.card}>
                <div className={styles.labelContainer}>
                    <Label className={styles.text}>Add a New Report</Label>
                </div>
                <div className={styles.buttonContainer}>
                    <button className={styles.button} title="Add a New Report" aria-label="Add a New Report" onClick={handleCreateButton}>
                        Im an Icon
                    </button>
                </div>
                {loading ? (
                        <Spinner styles={{root: {marginTop: "50px"}}}/>
                    ) : (
                        <table className={styles.table}>
                            <thead className={styles.thead}>
                                <tr>
                                    <th className={styles.tableName}>Name</th>
                                    <th>Category</th>
                                    <th>Created At</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>    
                                {filteredReports.length > 0 ? (
                                filteredReports.map((report, index) => (
                                    <tr className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                    <td key={report.name} className={styles.tableName}>
                                        {report.name}
                                    </td>
                                    <td key={report.category} className={styles.tableText}>
                                        {report.category}
                                    </td>
                                    <td>
                                        <div className={styles.tableTypeContainer}> 
                                            <div key={report.createdat} className={`${report.type == 'summarization' ? styles.tableTypeBackground : styles.tableTypeBackgroundAlt}`}>
                                                {report.createdat}
                                            </div>
                                        </div>
                                    </td>
                                    <td key={report.status} className={styles.tableText}>
                                        {report.status}
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
            {isCreateModalOpen && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCreateButton}><IconX /></button>
                    <Label className={styles.text}>Curation Report Creation</Label>
                    <div></div>
                    {isConfirm && (
                        <div>
                            <Label className={styles.text}>Are you sure you want to create this Report?</Label>
                            <div className={styles.buttonContainer}>
                            <button className={styles.button} title="Select Confirm" aria-label="Select Confirm">
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


export default CurationReports;
