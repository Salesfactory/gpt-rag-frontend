import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import salesLogo from "../../img/logo_white.png";
import styles from "./Onboarding.module.css";
import { ChevronRightRegular, ChevronLeftRegular, MoneySettingsRegular } from "@fluentui/react-icons";
import { Spinner } from "@fluentui/react";
import { createOrganization, createOrganizationUsage } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import backgroud from "../../img/background.png";
import mall from "../../img/welcome_image.png";
import office from "../../img/organization_name.png";
import subscription from "../../img/subscription_image.png";
import { toast } from "react-toastify";
const Onboarding: React.FC = () => {
    const { user, setUser, organization, setOrganization, partialUser } = useAppContext();
    const [organizationName, setOrganizationName] = useState("");
    const [step, setStep] = useState(() => {
        const savedStep = localStorage.getItem("onboardingStep");
        return savedStep ? Number(savedStep) : 0;
    });
    const [isLoadingStep, setIsLoadingStep] = useState(false);
    const maxSteps = 2;
    const [animatedStep, setAnimatedStep] = useState(0);

    const handleOrganizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setOrganizationName(event.target.value);
    };

    const handleCreateOrganization = async () => {
        if (!partialUser) {
            return null;
        }
        try {
        const newOrganization = await createOrganization({ userId: partialUser.id, organizationName: organizationName });
        await createOrganizationUsage({ userId: partialUser.id, organizationId: newOrganization.id, subscriptionTierId: "tier_free" });
        if (newOrganization.id) {
            setOrganization(newOrganization);
            setUser({ ...partialUser, organizationId: newOrganization.id });
            return newOrganization;
        }
        } catch (error) {
            console.error(error);
            //TODO: Delete the organization if it was created
            toast.error("Error creating organization");
            return null;
        }
    };

    const handleNextClick = async () => {
        if (user?.organizationId) {
            setStep(2);
            return;
        }
        if (step < maxSteps) {
            setIsLoadingStep(true);
            let organization = null;
            if (step === 1) {
                organization = await handleCreateOrganization();
                if (!organization) {
                    setIsLoadingStep(false);
                    return;
                }
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

    const handleLogOut = () => {
        window.location.href = "/#/logout";
    };

    const handleSubscriptionRedirect = () => {
        window.location.href = "#/payment";
    };

    const handleContinueAsFreeUser = () => {
        // Free users can proceed to the app without a paid subscription
        localStorage.removeItem("onboardingStep");
        window.location.href = "/#/";
    };

    // Allow navigation if user has organization (with or without paid subscription)
    if (user?.organizationId && (organization?.subscriptionId || organization?.id)) {
        // Clears the saved step at the end of onboarding
        localStorage.removeItem("onboardingStep");
        return <Navigate to="/" replace />;
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedStep(step);
        }, 100);

        return () => clearTimeout(timer);
    }, [step]);

    useEffect(() => {
        // Saves the step only if the user has not finished onboarding.
        // Free users complete onboarding with just an organization (no subscriptionId required)
        if (!(user?.organizationId && organization?.id)) {
            localStorage.setItem("onboardingStep", step.toString());
        }
    }, [step, user?.organizationId, organization?.id]);

    const renderProgressBar = () => (
        <div className={styles.progressContainer}>
            {[...Array(maxSteps + 1)].map((_, i) => (
                <div
                    key={i}
                    className={`${styles.progressDot} ${i === animatedStep ? styles.activeDot : i < animatedStep ? styles.completedDot : ""}`}
                    style={{
                        animationDelay: `${i * 0.1}s`,
                        transitionDelay: i <= animatedStep ? `${i * 0.1}s` : "0s"
                    }}
                />
            ))}
        </div>
    );

    return (
        <div
            className={styles.container}
            style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${backgroud})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat"
            }}
        >
            {isLoadingStep ? (
                <div className={styles.loaderContainer}>
                    <Spinner size={3} />
                </div>
            ) : (
                <div className={styles.stepWrapper}>
                    {/* Steps */}
                    {step === 0 && (
                        <div className={styles.card1}>
                            <div
                                className={styles.containerStep1}
                                style={{
                                    backgroundImage: `url(${mall})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat",
                                    position: "relative"
                                }}
                            >
                                <div className={styles.logo}>
                                    <img src={salesLogo} alt="Sales Factory logo" />
                                </div>
                                <h1 className={styles.title1}>Welcome to Freddaid!</h1>
                                {renderProgressBar()}
                                <div className={styles["green-overlay"]} />
                            </div>
                            <p className={styles.text1}>Let's set up your new organization so Freddaid can help grow your business.</p>

                            {/* Buttons Step 0 */}
                            <div className={styles.buttonContainer}>
                                <button className={styles.buttonPrev} type="button" onClick={handleLogOut} aria-label="Cancel">
                                    <ChevronLeftRegular className={`${styles.icon} ${styles.iconLeft}`} /> Cancel
                                </button>
                                <button className={styles.button} type="button" onClick={handleNextClick} disabled={isLoadingStep} aria-label="Next">
                                    Next <ChevronRightRegular className={`${styles.icon} ${styles.iconRight}`} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className={styles.card2}>
                            <div
                                className={styles.containerStep2}
                                style={{
                                    backgroundImage: `url(${office})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat",
                                    position: "relative"
                                }}
                            >
                                <h2 className={styles.title2}>Organization Name</h2>
                                {renderProgressBar()}
                                <div className={styles["green-overlay"]} />
                            </div>
                            <p className={styles.text2}>How do you want to name your organization?</p>
                            <input
                                type="text"
                                value={organizationName}
                                onChange={handleOrganizationChange}
                                placeholder="Organization Name"
                                className={styles.input}
                            />

                            {/* Buttons Step 1 */}
                            <div className={styles.buttonContainer}>
                                <button className={styles.buttonPrev} type="button" onClick={handlePreviousClick} disabled={isLoadingStep} aria-label="Previous">
                                    <ChevronLeftRegular className={`${styles.icon} ${styles.iconLeft}`} /> Previous
                                </button>
                                <button
                                    className={styles.button}
                                    type="button"
                                    onClick={handleNextClick}
                                    disabled={isLoadingStep || organizationName.trim() === ""}
                                    aria-label="Next"
                                >
                                    Next <ChevronRightRegular className={`${styles.icon} ${styles.iconRight}`} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className={styles.card3}>
                            <div
                                className={styles.containerStep3}
                                style={{
                                    backgroundImage: `url(${subscription})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat",
                                    position: "relative"
                                }}
                            >
                                <MoneySettingsRegular className={styles.iconMoney} />
                                <h1 className={styles.title3}>Get a subscription</h1>
                                <div className={styles["green-overlay"]} />
                                {renderProgressBar()}
                            </div>

                            {/* Buttons Step 2 */}
                            <div className={styles.buttonContainer}>
                                <button className={styles.buttonPrev} type="button" onClick={handlePreviousClick} disabled={isLoadingStep} aria-label="Previous">
                                    <ChevronLeftRegular className={`${styles.icon} ${styles.iconLeft}`} /> Previous
                                </button>
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button 
                                        className={styles.button} 
                                        style={{ width: "auto", padding: "10px 15px", background: "#6c757d" }} 
                                        onClick={handleContinueAsFreeUser} 
                                        aria-label="Continue as Free User"
                                    >
                                        Continue as Free User
                                    </button>
                                    <button 
                                        className={styles.button} 
                                        style={{ width: "auto", padding: "10px 15px" }} 
                                        onClick={handleSubscriptionRedirect} 
                                        aria-label="Subscribe Now"
                                    >
                                        Subscribe Now!
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Onboarding;
