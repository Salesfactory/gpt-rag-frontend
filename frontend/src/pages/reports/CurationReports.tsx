import React, { useEffect, useState } from "react";
import styles from "./CurationReports.module.css"
import { Dropdown, Label, ResponsiveMode, Spinner } from "@fluentui/react";
import { IconFilePlus, IconTrash, IconX } from "@tabler/icons-react";
import { createReport, deleteReport, getFilteredReports } from "../../api";

const CurationReports  = () => {

    const [dataLoad, setDataLoad] = useState(false)
    const [filteredReports, setFilteredReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isConfirm, setIsConfirm] = useState(false);
    const [inputReportName, setinputReportName] = useState('')
    const curationReportOptions = [
        { key: "1", text: "Ecommerce" },
        { key: "2", text: "Weekly Economic" },
        { key: "3", text: "Monthly Economic" },
    ];
    const [categorySelection, setCategorySelection] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>("");
    const [isPopupActive, setIsPopupActive] = useState(false)
    const [isDeleteActive, setIsDeleteActive] = useState(false)
    const [deletedReportID, setdeletedReportID] = useState('');
    const [deletedReportName, setdeletedReportName] = useState('');

    useEffect(() => {
        const getReportList = async () => {

            setLoading(true);

            try {
                let reportList = await getFilteredReports('curation')

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

    const handleCreateButton = () => {
        setIsCreateModalOpen(!isCreateModalOpen);
        setCategorySelection('')
        setinputReportName('')
        setErrorMessage(null)
    }

    const handleConfirmButton = () => {

        if(inputReportName == ('')){
            setErrorMessage('Please type the Name of the Report')
            return;
        }
        if(categorySelection == ('')){
            setErrorMessage('Please select the Report Category')
            return;
        }
        setIsCreateModalOpen(false);
        setIsConfirm(!isConfirm);
    }

    const handleCancelButton = () => {
        setIsConfirm(false)
        setIsCreateModalOpen(false)
        setCategorySelection('')
        setinputReportName('')
        setErrorMessage(null)
    }

    const handleTypeDropdownChange = (event: any, selectedOption: any) => {
        setCategorySelection(selectedOption.text)
    }

    const handleInputName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setinputReportName(event.target.value)
    }
    
    const handleCreateReport = async () => {
        setIsConfirm(false)
        setIsCreateModalOpen(false)
        let timer: NodeJS.Timeout;

        try{
            await createReport({ 
                type: "curation",
                name: inputReportName,
                category: categorySelection,
                status: "archived"
            });
            setDataLoad(!dataLoad)

            setIsPopupActive(true)
            timer = setTimeout(() => {
                setIsPopupActive(false);
            }, 3000);

        } catch (error){
            console.error("Error trying to create the report: ", error);
        }finally{
            setLoading(false);
        }
    }

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
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Curation Reports</h1>
            </div>
            <div className={styles.card}>
                <div className={styles.labelContainer}>
                    <Label className={styles.text}>Add a New Curation Report</Label>
                </div>
                <div className={styles.buttonContainer}>
                    <button className={styles.button} title="Add a New Report" aria-label="Add a New Report" onClick={handleCreateButton}>
                        <IconFilePlus className={styles.iconLarge}/>
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
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>    
                                {filteredReports.length > 0 ? (
                                filteredReports.map((report, index) => (
                                    <tr key={index} className={`${index % 2 === 0 ? styles.tableBackgroundAlt : styles.tableBackground}`}>
                                    <td className={styles.tableName}>
                                        {report.name}
                                    </td>
                                    <td className={styles.tableText}>
                                        {report.category}
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
            {isCreateModalOpen && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCreateButton}><IconX /></button>
                    <Label className={styles.text}>Create a Curation Report</Label>
                    <div>
                        <form>
                            <Label>Report Name</Label>
                            <input type="text" className={styles.input} onChange={handleInputName} value={inputReportName}></input>
                            <Label>Curation Report Category</Label>
                            <Dropdown placeholder="Select a Curation Report Category" options={curationReportOptions} onChange={handleTypeDropdownChange} defaultValue={categorySelection} responsiveMode={ResponsiveMode.unknown}/>
                        </form>
                    </div>
                        <div>
                            {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}
                            <div className={styles.buttonContainer}>
                                <button className={styles.button} title="Confirm" aria-label="Confirm" onClick={handleConfirmButton}>
                                    Confirm
                                </button>
                                <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelButton}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                </div>
                
            )}
            {isConfirm && (
                <div className={styles.modal}>
                    <Label className={styles.text}>Are you sure you want to create the report {inputReportName} ?</Label>
                    <div className={styles.buttonContainer}>
                        <button className={styles.button} title="Confirm" aria-label="Confirm" onClick={handleCreateReport}>
                            Confirm
                        </button>
                        <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelButton}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {isPopupActive && (
                <div className={styles.modal}>
                    <Label className={styles.text}>The report has been added. It needs to be implemented for generation. <br /> 
                    If not implemented, it will not be generated.</Label>
                </div>
            )}
            {isDeleteActive && (
                <div className={styles.modal}>
                    <Label className={styles.text}>Are you sure you want to delete {deletedReportName}</Label>
                    <div className={styles.buttonContainer}>
                        <button className={styles.button} title="Confirm" aria-label="Confirm" onClick={handleConfirmDelete}>
                                Confirm
                        </button>
                        <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelDelete}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


export default CurationReports;
