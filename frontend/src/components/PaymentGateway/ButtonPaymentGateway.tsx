import styles from "./ButtonPaymentGateway.module.css";
import { Text } from "@fluentui/react";
import { GuestFilled } from "@fluentui/react-icons";

import { useAppContext } from "../../providers/AppProviders";

export const ButtonPaymentGateway = () => {
    const { user, organization } = useAppContext();

    const handleRedirect = () => {
        if (organization && organization.subscriptionId) {
            window.location.href = "https://dashboard.stripe.com/dashboard";
        } else {
            window.location.href = "#/payment";
        }
    };

    if (!user) {
        // User is not logged in; handle accordingly
        return null; // or display a message, e.g., <p>Please log in to manage subscriptions.</p>
    }

    return (
        <button className={styles.container} onClick={handleRedirect} aria-label="Subscription Button">
            <GuestFilled className={styles.button} />
            <Text className={styles.buttonText}>Subscription</Text>
        </button>
    );
};
