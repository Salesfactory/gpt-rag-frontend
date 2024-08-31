import React, { useContext, useState } from "react";
import salesLogo from "../../img/logo.png";
import styles from "./Onboarding.module.css";
import { ChevronRightRegular, ChevronLeftRegular, ContactCardRibbon48Regular, MoneySettingsRegular } from "@fluentui/react-icons";
import { Spinner } from "@fluentui/react";

import { createOrganization, getOrganizationSubscription } from "../../api";
import { AppContext } from "../../providers/AppProviders";

const Onboarding: React.FC = () => {
    const { user, setUser, organization, setOrganization } = useContext(AppContext);

    const [organizationName, setOrganizationName] = useState("");
    const [step, setStep] = useState(0);
    const [isLoadingStep, setIsLoadingStep] = useState(false);
    const maxSteps = 2;

    const handleOrganizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setOrganizationName(event.target.value);
    };

    const handleCreateOrganization = async () => {
        const newOrganization = await createOrganization({ userId: user.id, organizationName: organizationName });
        if (newOrganization.id) {
            setOrganization(newOrganization);
            setUser({ ...user, organizationId: newOrganization.id });
        }
    };

    const handleNextClick = async () => {
        if (step < maxSteps) {
            setIsLoadingStep(true);
            if (step === 1) {
                await handleCreateOrganization();
            }
            setStep(prevStep => prevStep + 1);
            setIsLoadingStep(false);
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
                        <h3>Before we begin, let's create an organizationName for your new account.</h3>
                        <input
                            type="text"
                            value={organizationName}
                            onChange={handleOrganizationChange}
                            placeholder="Organization Name"
                            className={styles.input}
                        />
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
                {isLoadingStep && (
                    <div className={styles.loaderContainer}>
                        <Spinner size={3} />
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
