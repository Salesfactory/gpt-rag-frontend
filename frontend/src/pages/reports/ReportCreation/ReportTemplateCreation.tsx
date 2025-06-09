import React, { useEffect, useState } from "react";
import styles from "./ReportTemplateCreation.module.css";
import { IconArrowBack, IconX } from "@tabler/icons-react";
import { Label, Dropdown, IDropdownOption, Spinner, ResponsiveMode } from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { createSummarizationReport, getCompanyData } from "../../../api";
import { CornerDownLeft } from "lucide-react";

export const TemplateCreation: React.FC = () => {
    const navigate = useNavigate();
    const [templateType, setTemplateType] = useState("");
    const [company, setCompany] = useState("");
    const [companyTicker, setCompanyTicker] = useState("");
    const [description, setDescription] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>("");
    const [isConfirm, setIsConfirm] = useState(false);
    const [isPopupActive, setIsPopupActive] = useState(false);
    const [companyOptions, setCompanyOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    const templateTypeOptions = [
        { key: "1", text: "10-K" },
        { key: "2", text: "10-Q" },
        { key: "3", text: "8-K" },
        { key: "4", text: "DEF 14A" }
    ];

    useEffect(() => {
        const getDropdownCompanies = async () => {
            setLoading(true);
            try {
                let data = await getCompanyData();
                console.log(data);
                setCompanyOptions(data);
                console.log(companyOptions);
            } catch {
                console.error("Error Fetching Company Data");
                setCompanyOptions([]);
            } finally {
                setLoading(false);
            }
        };
        getDropdownCompanies();
    }, []);

    const handleDropdownTemplate = (event: any, selectedOption: any) => {
        setTemplateType(selectedOption.text);
        // Reset error message when user makes a selection
        if (errorMessage) setErrorMessage(null);
    };

    const handleDropdownCompany = (event: any, selectedOption: any) => {
        setCompany(selectedOption.text);
        setCompanyTicker(selectedOption.value);
        // Reset error message when user makes a selection
        if (errorMessage) setErrorMessage(null);
    };

    const handleInputDescription = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDescription(event.target.value);
        // Reset error message when user starts typing
        if (errorMessage) setErrorMessage(null);
    };

    const handleConfirmButton = () => {
        if (templateType === "") {
            setErrorMessage("Please select a template type");
            return;
        }
        if (company === "") {
            setErrorMessage("Please select a company");
            return;
        }
        if (description === "") {
            setErrorMessage("Please enter a description");
            return;
        }
        setIsConfirm(!isConfirm);
    };

    const handleCancelButton = () => {
        setIsConfirm(false);
        setTemplateType("");
        setCompany("");
        setCompanyTicker("");
        setDescription("");
        setErrorMessage(null);
    };

    const handleCreateReport = async () => {
        setIsConfirm(false);
        let timer: NodeJS.Timeout;

        try {
            await createSummarizationReport({
                companyTicker: companyTicker,
                templateType: templateType,
                description: description,
                companyName: company
            });

            setIsPopupActive(true);
            timer = setTimeout(() => {
                setIsPopupActive(false);
                navigate("/report-templates");
            }, 3000);
        } catch (error) {
            console.error("Error trying to create the report: ", error);
        } finally {
            // Reset form after successful creation
            setTemplateType("");
            setCompany("");
            setCompanyTicker("");
            setDescription("");
        }
    };

    return (
        <div className={styles.page_container}>
            <div className={styles.labelContainer}>
                <button
                    className={styles.button}
                    title="Return to Report Templates"
                    aria-label="Return to Report Templates"
                    onClick={() => navigate("/report-templates")}
                >
                    <CornerDownLeft className={styles.iconColor} />
                    <Label className={styles.textButton}>Return to Summarization Report Templates</Label>
                </button>
            </div>
            <div className={styles.card}>
                {loading ? (
                    <Spinner styles={{ root: { marginTop: "50px", marginBottom: "50px", marginRight: "auto", marginLeft: "auto" } }} />
                ) : (
                    <div>
                        <form>
                            <Label>
                                Template type<span className={styles.fieldDisclaimer}> *</span>
                            </Label>
                            <Dropdown
                                className={styles.responsiveDropdown}
                                placeholder="Select a Template Name"
                                options={templateTypeOptions}
                                onChange={handleDropdownTemplate}
                                defaultValue={templateType}
                                responsiveMode={ResponsiveMode.unknown}
                            />

                            <Label>
                                Company<span className={styles.fieldDisclaimer}> *</span>
                            </Label>
                            <Dropdown
                                className={styles.responsiveDropdown}
                                placeholder="Select a company"
                                options={companyOptions}
                                onChange={handleDropdownCompany}
                                defaultValue={company}
                                responsiveMode={ResponsiveMode.unknown}
                            />

                            <Label>
                                Description<span className={styles.fieldDisclaimer}> *</span>
                            </Label>
                            <input
                                type="text"
                                placeholder="Enter description for the report template"
                                className={styles.input}
                                onChange={handleInputDescription}
                                value={description}
                            />

                            <span className={styles.fieldDisclaimer}>All fields are required (*)</span>
                        </form>
                    </div>
                )}

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
                        Are you sure you want to create the report template "{templateType}" for "{company}"?
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
                        The report template has been created successfully. <br />
                        Redirecting to Report Templates...
                    </Label>
                </div>
            )}
        </div>
    );
};
