import React, { useEffect, useState } from "react";
import styles from "./RequestStudies.module.css"
import { monitorSession } from "../../api";

const RequestStudies: React.FC = () => {

    const [test, setTest] = useState(false)

    useEffect(()=>{
        (async () => {
            const context = await monitorSession();
            console.log("Session context:", context);
            setTest(false);
        })();
    }, [test])

    return (
        <div className={styles.page_container}>
            <h1>Request Studies</h1>
            <p>Welcome to the Request Studies page!</p>
            <button onClick={() => {setTest(true)}} >Monitor</button>
        </div>
    );
};

export default RequestStudies;
