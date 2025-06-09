import React, { useState } from "react";
import styles from "./CurationCreation.module.css";
import { IconArrowBack, IconX } from "@tabler/icons-react";
import { Dropdown, Label, ResponsiveMode } from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { createReport } from "../../../api";
import { CornerDownLeft } from "lucide-react";

const CurationCreation: React.FC = () => {
    const navigate = useNavigate();
    const [inputReportName, setinputReportName] = useState("");
    const curationReportOptions = [
        { key: "1", text: "Ecommerce" },
        { key: "2", text: "Weekly Economic" },
        { key: "3", text: "Monthly Economic" }
    ];
    const [categorySelection, setCategorySelection] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>("");
    const [isConfirm, setIsConfirm] = useState(false);
    const [isPopupActive, setIsPopupActive] = useState(false);

    const handleTypeDropdownChange = (event: any, selectedOption: any) => {
        setCategorySelection(selectedOption.text);
    };

    const handleInputName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setinputReportName(event.target.value);
    };

    const handleConfirmButton = () => {
        if (inputReportName == "") {
            setErrorMessage("Please type the Name of the Report");
            return;
        }
        if (categorySelection == "") {
            setErrorMessage("Please select the Report Category");
            return;
        }
        setIsConfirm(!isConfirm);
    };

    const handleCancelButton = () => {
        setIsConfirm(false);
        setinputReportName("");
        setErrorMessage(null);
    };

    const handleCreateReport = async () => {
        setIsConfirm(false);
        let timer: NodeJS.Timeout;

        try {
            await createReport({
                type: "curation",
                name: inputReportName,
                category: categorySelection,
                status: "archived"
            });

            setIsPopupActive(true);
            timer = setTimeout(() => {
                setIsPopupActive(false);
                navigate("/curation-reports");
            }, 3000);
        } catch (error) {
            console.error("Error trying to create the report: ", error);
        }
    };

    return (
        <div className={styles.page_container}>
            <div className={styles.labelContainer}>
                <button
                    className={styles.button}
                    title="Return to Curation Reports"
                    aria-label="Return to Curation Reports"
                    onClick={() => navigate("/curation-reports")}
                >
                    <CornerDownLeft className={styles.iconColor} />
                    <Label className={styles.textButton}>Return to Curation Reports</Label>
                </button>
            </div>
            <div className={styles.card}>
                <div>
                    <form>
                        <Label>
                            Report Name<span className={styles.fieldDisclaimer}> *</span>
                        </Label>
                        <input type="text" className={styles.input} onChange={handleInputName} value={inputReportName}></input>
                        <Label>
                            Curation Report Category<span className={styles.fieldDisclaimer}> *</span>
                        </Label>
                        <Dropdown
                            className={styles.responsiveDropdown}
                            placeholder="Select a Curation Report Category"
                            options={curationReportOptions}
                            onChange={handleTypeDropdownChange}
                            defaultValue={categorySelection}
                            responsiveMode={ResponsiveMode.unknown}
                        />
                        <span className={styles.fieldDisclaimer}>All fields are required (*)</span>
                    </form>
                </div>
                <div>
                    {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}
                    <div className={styles.buttonContainer}>
                        <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelButton}>
                            Cancel
                        </button>
                        <button className={styles.button} title="Confirm" aria-label="Confirm" onClick={handleConfirmButton}>
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
            {isConfirm && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCancelButton}>
                        <IconX />
                    </button>
                    <Label className={styles.text}>Are you sure you want to create the report "{inputReportName}" ?</Label>
                    <div className={styles.buttonModalContainer}>
                        <button className={styles.button} title="Cancel" aria-label="Cancel" onClick={handleCancelButton}>
                            Cancel
                        </button>
                        <button className={styles.button} title="Save" aria-label="Save" onClick={handleCreateReport}>
                            Save
                        </button>
                    </div>
                </div>
            )}
            {isPopupActive && (
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

export default CurationCreation;
