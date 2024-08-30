import React, { useState } from "react";
import salesLogo from "../../img/logo.png";
import styles from "./Onboarding.module.css";
import { ChevronRightRegular, ChevronLeftRegular, ContactCardRibbon48Regular, MoneySettingsRegular } from "@fluentui/react-icons";

const Onboarding: React.FC = () => {
    const [organization, setOrganization] = useState("");
    const [step, setStep] = useState(0);
    const maxSteps = 2;

    const handleOrganizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setOrganization(event.target.value);
    };

    const handleNextClick = () => {
        if (step < maxSteps) {
            setStep(prevStep => prevStep + 1);
        }
    };

    const handlePreviousClick = () => {
        if (step > 0) {
            setStep(prevStep => prevStep - 1);
        }
    };

    const handleSubscriptionRedirect = () => {
        window.location.href = "#/payment";
    };

    return (
        <div className={styles.container}>
            <div className={`${styles.card} ${styles.carousel}`}>
                {step === 0 && (
                    <div className={styles.containerStep}>
                        <div className={styles.logo}>
                            <img src={salesLogo} alt="Sales Factory logo" />
                        </div>
                        <h1>Welcome to Freddaid!</h1>
                        <p>Let's get started with onboarding.</p>
                    </div>
                )}
                {step === 1 && (
                    <div className={styles.containerStep}>
                        <ContactCardRibbon48Regular />
                        <h3>Before we begin, let's create an organization for your new account.</h3>
                        <input type="text" value={organization} onChange={handleOrganizationChange} placeholder="Organization Name" className={styles.input} />
                    </div>
                )}
                {step === 2 && (
                    <div className={styles.containerStep}>
                        <MoneySettingsRegular className={styles.iconMoney} />
                        <h1>Get a subscription</h1>
                        <button className={styles.button} style={{ width: "auto", padding: "10px 15px" }} onClick={handleSubscriptionRedirect}>
                            Subscribe Now!
                        </button>
                    </div>
                )}
                <div className={step > 0 ? styles.buttonContainer : `${styles.buttonContainer} ${styles.singleButtonContainer}`}>
                    {step > 0 && (
                        <button className={styles.buttonPrev} type="button" onClick={handlePreviousClick}>
                            <ChevronLeftRegular className={styles.icon} /> Previous
                        </button>
                    )}
                    {step < maxSteps && (
                        <button className={styles.button} type="button" onClick={handleNextClick}>
                            Next <ChevronRightRegular className={styles.icon} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
