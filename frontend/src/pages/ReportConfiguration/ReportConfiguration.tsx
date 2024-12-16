import { IconBoxMultiple, IconFileSearch, IconX } from "@tabler/icons-react";
import styles from "./ReportConfiguration.module.css"
import { Label } from "@fluentui/react";
import { useState } from "react";
import { DeleteRegular, EditRegular } from "@fluentui/react-icons";

const ReportConfiguration  = () => {

    const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
    const [searchItem, setSearchItem] = useState('');


    const handleSearchButton = () => {
        setIsSearchPanelOpen(!isSearchPanelOpen)


    };

     
    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Report Configuration</h1>
            </div>
            <div className={styles.card}>
                <IconBoxMultiple className={styles.iconLarge}/>
                <div className={styles.labelContainer}>
                    <Label className={styles.text}>Search Reports by Type</Label>
                </div>
                    <input className={styles.inputField} value={searchItem} onChange={(event) => setSearchItem(event.target.value)}></input>
                    <button className={styles.buttonPanel} onClick={handleSearchButton}>
                        <IconFileSearch className={styles.iconColor}/>
                    </button>
                    {isSearchPanelOpen && (
                        <div className={styles.modal}>  
                            <div className={styles.item}>
                                <Label className={styles.text}>Available Reports </Label>
                                <div className={styles.elementrow}>
                                    <button className={styles.closeButton} onClick={handleSearchButton}><IconX /></button>
                                    <span className={styles.info}>Hello I'm a default Report. 
                                    </span>
                                    <button className={styles.changebuttons} title="Edit Report" aria-label="Edit Report" onClick={() => {}}>
                                        <EditRegular />
                                    </button>
                                    <button className={styles.changebuttons} title="Delete Report" aria-label="Delete Report" onClick={() => {}}>
                                        <DeleteRegular />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
}

export default ReportConfiguration;