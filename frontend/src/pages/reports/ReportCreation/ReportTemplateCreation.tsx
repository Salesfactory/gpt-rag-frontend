import React from 'react';
import styles from './ReportTemplateCreation.module.css';
import { IconArrowBack } from '@tabler/icons-react';
import { Label, Dropdown } from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
export const TemplateCreation: React.FC = () => {

    const templateTypeOptions = [
        {key: '1', text: '10-K'},
        {key: '2', text: '10-Q'},
        {key: '3', text: '8-K'},
        {key: '4', text: 'DEF 14A'},
    ]
    const companyOptions = [
        {key: '1', text: 'LOW'},
        {key: '2', text: 'HD'},
        {key: '3', text: 'AMC'},
        {key: '4', text: 'AAPL'},
    ]
    const navigate = useNavigate()
    return (
            <div className={styles.page_container}>
                <div className={styles.labelContainer}>
                    <button className={styles.button} title="Return to Report Templates" aria-label="Return to Report Templates" onClick={() => navigate('/report-templates')}>
                        <IconArrowBack className={styles.iconColor}/>
                        <Label className={styles.textButton}>Return to Summarization Report Templates</Label>
                    </button>
                </div>
                <div id="options-row" className={styles.row}>
                    <h1 className={styles.title}>Summarization Report Template Creation</h1>
                </div>
                <div className={styles.card}>
                    <div>
                        <form>
                            <Label>Template type</Label>
                            <Dropdown placeholder="Select a Template Name" options={templateTypeOptions} onChange={() => {}} defaultValue={""}/>
                            <Label>Company</Label>
                            <Dropdown placeholder="Select a company" options={companyOptions} onChange={() => {}} defaultValue={""}/>
                            <Label>Description</Label>
                            <input type="text" className={styles.input}></input>
                        </form>
                    </div>
                </div>
            </div>
    );
};