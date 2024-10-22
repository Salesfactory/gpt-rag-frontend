import { useContext } from "react";
import styles from "./ButtonPaymentGateway.module.css";
import { Text } from "@fluentui/react";
import { GuestFilled } from "@fluentui/react-icons";

import { AppContext } from "../../providers/AppProviders";

export const ButtonPaymentGateway = () => {
    const { user, organization } = useContext(AppContext);

    const handleRedirect = () => {
        if (organization.subscriptionId) {
            window.location.href = "https://dashboard.stripe.com/dashboard";
        } else window.location.href = "#/payment";
    };

    return (
        <>
            {user.role === "admin" && (
                <button className={styles.container} onClick={handleRedirect}>
                    <GuestFilled className={styles.button} />
                    <Text className={styles.buttonText}>Subscription</Text>
                </button>
            )}
        </>
    );
};
