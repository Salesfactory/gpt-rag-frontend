import React, { useEffect, useState } from "react";
import styles from "./RequestStudies.module.css"
import { monitorSessionKeepAlive } from "../../api";

const RequestStudies: React.FC = () => {

    const [test, setTest] = useState(false)

    useEffect(()=>{
        if (test) {
            const interval = setInterval(() => {
                monitorSessionKeepAlive();
            }, 10000); // 10 seconds

            return () => clearInterval(interval);
        }
    }, [test])

    return (
        <div className={styles.page_container}>
            <h1>Request Studies</h1>
            <p>Welcome to the Request Studies page!</p>
            <button onClick={() => {setTest(!test)}} >Monitor</button>
        </div>
    );
};

export default RequestStudies;
