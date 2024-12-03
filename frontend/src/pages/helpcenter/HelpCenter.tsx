import React from "react";
import styles from "./HelpCenter.module.css"

const HelpCenter: React.FC = () => {
    return (
        <div className={styles.page_container}>
            <h1>Help Center</h1>
            <p>Welcome to the Help Center page!</p>
        </div>
    );
};

export default HelpCenter;
