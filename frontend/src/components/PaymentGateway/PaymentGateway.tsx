import React, { useState, useEffect, useContext } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import styles from "./PaymentGateway.module.css";
import { getApiKeyPayment, createCheckoutSession, getProductPrices } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import { Spinner } from "@fluentui/react";
import { Check } from "lucide-react";
import subscription from "../../img/subscription_image.png";

const fetchApiKey = async () => {
    const apiKey = await getApiKeyPayment();
    return apiKey;
};

export const SubscriptionPlans: React.FC<{ stripePromise: Promise<Stripe | null> }> = ({ stripePromise }) => {
    const { user, organization } = useAppContext();

    const [prices, setPrices] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedTabs, setSelectedTabs] = useState<{ [priceId: string]: "features" | "faq" }>({});
    useEffect(() => {
        // Fetch product prices when the component mounts
        async function fetchPrices() {
            try {
                const data = await getProductPrices({ user });
                const sortedPrices = data.prices.sort((a: any, b: any) => a.unit_amount - b.unit_amount);
                setPrices(sortedPrices);

                const initialTabs = Object.fromEntries(sortedPrices.map((price: any) => [price.id, "features"]));
                setSelectedTabs(initialTabs);
            } catch (err) {
                console.error("Failed to fetch product prices:", err);
                setError("Unable to fetch product prices. Please try again later.");
            }
        }

        fetchPrices();
    }, [user]);

    if (error) {
        return <div>{error}</div>;
    }

    const handleCheckout = async (priceId: string) => {
        if (!user) {
            // Handle the case when user is null
            // You might redirect to a login page or show an error message
            console.error("User is not authenticated.");
            // Optionally, you can redirect the user or display a notification
            return;
        }

        const { url } = await createCheckoutSession({
            userId: user.id,
            userName: user.name,
            priceId,
            successUrl: window.location.origin + "#/success-payment",
            cancelUrl: window.location.origin + "/",
            organizationName: organization?.name,
            organizationId: user.organizationId || ""
        });
        window.location.href = url;
    };

    return (
        <div className={styles.subscriptionPlan} aria-labelledby="subscription-plans-title">
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
                <div className={styles["green-overlay"]} />
                <h1 className={styles.title3}>Subscription Plans</h1>
                <div className={styles.planContainer}>
                    <div className={styles.planIntro}>
                        <p className={styles.text3}>Select the perfect subscription plan to supercharge your experiences:</p>
                    </div>
                    {prices.map((price, index) => {
                        return (
                            <div key={price.id} className={styles.plan}>
                                <div className={styles.namepriceContainer}>
                                    <h2 className={styles.planName}>{price.nickname}</h2>
                                    <p className={styles.planPrice}>
                                        ${(price.unit_amount / 100).toFixed(2)} {price.currency.toUpperCase()}
                                    </p>
                                </div>
                                <div className={styles.optionContainer}>
                                    <div
                                        className={`${styles.optionSelector} ${selectedTabs[price.id] === "features" ? styles.optionSelectorActive : ""}`}
                                        onClick={() => setSelectedTabs(prev => ({ ...prev, [price.id]: "features" }))}
                                    >
                                        Features
                                    </div>
                                    <div
                                        className={`${styles.optionSelector} ${selectedTabs[price.id] === "faq" ? styles.optionSelectorActive : ""}`}
                                        onClick={() => setSelectedTabs(prev => ({ ...prev, [price.id]: "faq" }))}
                                    >
                                        FAQ
                                    </div>
                                </div>

                                {/* Contenido dinámico */}
                                {selectedTabs[price.id] === "features" && (
                                    <ul className={styles.featureList}>
                                        {price.metadata.features?.split(",").map((feature: string, idx: number) => (
                                            <li key={idx} className={styles.featureItem}>
                                                <Check className={styles.checkIcon} />
                                                {feature.trim()}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {selectedTabs[price.id] === "faq" && (
                                    <ul className={styles.faqList}>
                                        {price.metadata.FAQ?.split("*")
                                            .filter(Boolean)
                                            .map((entry: string, idx: number) => {
                                                const isQuestion = idx % 2 === 0;
                                                return (
                                                    <li key={idx} className={isQuestion ? styles.faqQuestion : styles.faqAnswer}>
                                                        {isQuestion ? <p>{entry.trim()}</p> : entry.trim()}
                                                    </li>
                                                );
                                            })}
                                    </ul>
                                )}

                                <div className={styles.planButtonContainer}>
                                    <button
                                        className={styles.planButton}
                                        onClick={() => handleCheckout(price.id)}
                                        role="button"
                                        aria-label={`Subscribe to ${price.nickname}`}
                                    >
                                        {organization?.subscriptionId && organization.subscriptionStatus === "inactive"
                                            ? "Reactivate subscription"
                                            : organization?.subscriptionStatus === "active"
                                            ? "Edit payment information"
                                            : "Subscribe"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const PaymentGateway: React.FC = () => {
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

    useEffect(() => {
        const fetchAndSetStripe = async () => {
            const apiKey = await fetchApiKey();
            if (apiKey) {
                setStripePromise(loadStripe(apiKey));
            }
        };

        fetchAndSetStripe();
    }, []);

    if (!stripePromise) {
        return (
            <div className={styles.spinnerContainer} role="alert">
                <Spinner size={3} />
                <div className={styles.loadingText}>Loading...</div>
            </div>
        );
    }

    return (
        <Elements stripe={stripePromise}>
            <SubscriptionPlans stripePromise={stripePromise} />
        </Elements>
    );
};
