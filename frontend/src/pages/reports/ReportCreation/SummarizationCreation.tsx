import React, { useState } from "react";
import styles from "./SummarizationCreation.module.css";
import { useNavigate } from "react-router-dom";
import { createReport } from "../../../api";
import { IconArrowBack, IconX } from "@tabler/icons-react";
import { Dropdown, Label, ResponsiveMode } from "@fluentui/react";
import { CornerDownLeft, FilePlus } from "lucide-react";

const SummarizationCreation: React.FC = () => {
    const navigate = useNavigate();
    const [inputReportTicker, setinputReportTicker] = useState("");
    const summarizationReportOptions = [
        { key: "1", text: "10-K" },
        { key: "2", text: "10-Q" },
        { key: "3", text: "8-K" },
        { key: "4", text: "DEF 14A" }
    ];
    const [typeSelection, setTypeSelection] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>("");
    const [isConfirm, setIsConfirm] = useState(false);
    const [isPopupActive, setIsPopupActive] = useState(false);

    const handleTypeDropdownChange = (event: any, selectedOption: any) => {
        setTypeSelection(selectedOption.text);
    };

    const handleInputName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setinputReportTicker(event.target.value);
    };

    const handleConfirmButton = () => {
        if (inputReportTicker == "") {
            setErrorMessage("Please type the Stock Ticker of the Report");
            return;
        }
        if (typeSelection == "") {
            setErrorMessage("Please select the Report Type");
            return;
        }
        setIsConfirm(!isConfirm);
    };

    const handleCancelButton = () => {
        setIsConfirm(false);
        setinputReportTicker("");
        setErrorMessage(null);
    };

    const handleCreateReport = async () => {
        setIsConfirm(false);
        let timer: NodeJS.Timeout;

        try {
            await createReport({
                type: "companySummarization",
                name: inputReportTicker + " + " + typeSelection,
                reportTemplate: typeSelection,
                companyTickers: inputReportTicker,
                status: "archived"
            });

            setIsPopupActive(true);
            timer = setTimeout(() => {
                setIsPopupActive(false);
                navigate("/summarization-reports");
            }, 3000);
        } catch (error) {
            console.error("Error trying to create the report: ", error);
        } finally {
            setinputReportTicker("");
        }
    };

    return (
        <div className={styles.page_container}>
            <div className={styles.labelContainer}>
                <button
                    className={styles.button}
                    title="Return to Summarization Reports"
                    aria-label="Return to Summarization Reports"
                    onClick={() => navigate("/summarization-reports")}
                >
                    <CornerDownLeft className={styles.iconColor} />
                    <Label className={styles.textButton}>Return to Summarization Reports</Label>
                </button>
            </div>
            <div className={styles.card}>
                <div>
                    <form>
                        <Label>
                            Stock Ticker<span className={styles.fieldDisclaimer}> *</span>
                        </Label>
                        <input type="text" placeholder="e.g., TGT, HD" className={styles.input} onChange={handleInputName} value={inputReportTicker}></input>
                        <Label>
                            Report Type<span className={styles.fieldDisclaimer}> *</span>
                        </Label>
                        <Dropdown
                            className={styles.responsiveDropdown}
                            placeholder="Select a Summarization Report Type"
                            options={summarizationReportOptions}
                            onChange={handleTypeDropdownChange}
                            defaultValue={typeSelection}
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
                    <Label className={styles.text}>
                        Are you sure you want to create the report "{inputReportTicker} + {typeSelection}" ?
                    </Label>
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

export default SummarizationCreation;
