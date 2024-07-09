import styles from "./ButtonPaymentGateway.module.css";
import { Text } from "@fluentui/react";
import { GuestFilled  } from "@fluentui/react-icons";



export const ButtonPaymentGateway = () => {

    const handleRedirect = () => {
        window.location.href = "#/payment";
    };
    
    return (
        <button className={styles.container}  onClick={handleRedirect}>
             <GuestFilled   className={styles.button}/>
            <Text className={styles.buttonText}>Subscription</Text>
        </button>
    );
};