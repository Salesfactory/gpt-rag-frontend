import styles from "./ButtonPaymentGateway.module.css";
import { Text } from "@fluentui/react";
import { AppContext } from "../../providers/AppProviders";
import { useContext } from "react";


export const ButtonPaymentGateway = () => {

    const handleRedirect = () => {
        window.location.href = "#/payment";
    };
    
    return (
        <button className={styles.container}  onClick={handleRedirect}>
            <Text className={styles.buttonText}>Payment</Text>
        </button>
    );
};