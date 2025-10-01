import React from "react";
import styles from "./SuccessPayment.module.css";

const SuccessPayment: React.FC = () => {
    return (
        <div className={styles.planContainer} aria-labelledby="successful-payment-container">
            <div className={styles.textColumn}>
                <h1>Payment Successful!</h1>
                <h3>Thank you for subscribing to our service.</h3>
                <p>Your payment has been successfully processed.</p>
                <button
                    className={styles.planButton}
                    onClick={() => {
                        window.location.href = "/";
                    }}
                >
                    Go to Home
                </button>
            </div>
        </div>
    );
};

export default SuccessPayment;
