import React, { useEffect, useState } from 'react';
import styles from './ReportTemplateCreation.module.css';
import { IconArrowBack, IconX } from '@tabler/icons-react';
import { Label, Dropdown, IDropdownOption, Spinner } from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { createSummarizationReport, getCompanyData } from '../../../api';

export const TemplateCreation: React.FC = () => {

    const [templateType, setTemplateType] = useState('')
    const [company, setCompany] = useState('')
    const [companyTicker, setCompanyTicker] = useState('')
    const [description, setDescription] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>("")
    const [isConfirm, setIsConfirm] = useState(false)
    const [companyOptions, setCompanyOptions] = useState([])
    const [loading, setLoading] = useState(false)

    const templateTypeOptions = [
        { key: '1', text: '10-K' },
        { key: '2', text: '10-Q' },
        { key: '3', text: '8-K' },
        { key: '4', text: 'DEF 14A' },
    ]
    // const companyOptions = [
    //     { key: '1', text: "The Home Depot", value: 'LOW' },
    //     { key: '2', text: "Lowe's Home Improvement", value: 'HD' },
    //     { key: '3', text: "Walmart", value: 'WMT' },
    //     { key: '4', text: "Ace Hardware", value: 'ACE' },
    //     { key: '5', text: "Amazon", value: 'AMZN' },
    //     { key: '7', text: "Costco", value: 'COST' },
    //     { key: '8', text: "Target", value: 'TGT' },
    // ]

    useEffect(() => {
        const getDropdownCompanies = async () => {
            setLoading(true)
            try {
                let data = await getCompanyData()
                console.log(data)
                setCompanyOptions(data)
                console.log(companyOptions)
            }
            catch {
                console.error("Error Fetching Company Data")
                setCompanyOptions([])
            }
            finally {
                setLoading(false)
            }
        }
        getDropdownCompanies()
    }, [])

    const handleDropdownTemplate = (event: any, selectedOption: any) => {
        setTemplateType(selectedOption.text)
    }

    const handleDropdownCompany = (event: any, selectedOption: any) => {
        setCompany(selectedOption.text)
        setCompanyTicker(selectedOption.value)
    }

    const handleInputDescription = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDescription(event.target.value)
    }

    const handleConfirmButton = () => {
        if (templateType == '') {
            setErrorMessage('Please select a template type')
            return
        }
        if (company == '') {
            setErrorMessage('Please select a company')
            return
        }
        if (description == '') {
            setErrorMessage('Please enter a description')
            return
        }
        setIsConfirm(!isConfirm)
    }

    const handleCancelButton = () => {
        setTemplateType('')
        setCompany('')
        setCompanyTicker('')
        setDescription('')
        setIsConfirm(!isConfirm)
    }

    const handleCreateReport = async () => {
        setIsConfirm(false)
        let timer: NodeJS.Timeout;
        try{
            await createSummarizationReport({
                companyTicker: companyTicker,
                templateType: templateType,
                description: description,
                companyName: company
            })
            timer = setTimeout(() => {
                navigate('/report-templates', {state: {popUp: true}})
            }, 10);
        } catch (error) {
            console.error("Error trying to create the report: ", error);
        }
    }   

    const navigate = useNavigate()
    return (
        <div className={styles.page_container}>
            <div className={styles.labelContainer}>
                <button className={styles.button} title="Return to Report Templates" aria-label="Return to Report Templates" onClick={() => navigate('/report-templates')}>
                    <IconArrowBack className={styles.iconColor} />
                    <Label className={styles.textButton}>Return to Summarization Report Templates</Label>
                </button>
            </div>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Summarization Report Template Creation</h1>
            </div>
            <div className={styles.card}>
                {loading ? (
                    <Spinner styles={{root: {marginTop: "50px", marginBottom: "50px", marginRight: "auto", marginLeft: 'auto'}}}/>
                ) : (<form>
                    <Label>Template type</Label>
                    <Dropdown placeholder="Select a Template Name" options={templateTypeOptions} onChange={handleDropdownTemplate} defaultValue={""} />
                    <Label>Company</Label>
                    <Dropdown placeholder="Select a company" options={companyOptions} onChange={handleDropdownCompany} defaultValue={""} />
                    <Label>Description</Label>
                    <input type="text" className={styles.input} onChange={handleInputDescription} value={description}></input>
                </form>)}
                
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
            {isConfirm && (
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={handleCancelButton}><IconX/></button>
                    <Label className={styles.text}>Are you sure you want to create the report {templateType} for {company} ?</Label>
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
        </div>
    );
};