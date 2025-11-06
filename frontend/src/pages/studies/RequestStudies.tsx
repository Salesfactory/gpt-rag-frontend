import React, { useEffect, useState } from "react";
import styles from "./RequestStudies.module.css"
import { monitorSessionKeepAlive } from "../../api";

const RequestStudies: React.FC = () => {
    return (
        <div className={styles.page_container}>
            <h1>Request Studies</h1>
            <p>Welcome to the Request Studies page!</p>
        </div>
    );
};

export default RequestStudies;
