import React, { useState, useEffect, useContext } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import styles from "./PaymentGateway.module.css";
import { getApiKeyPayment, createCheckoutSession, getProductPrices } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import { Spinner } from "@fluentui/react";
import { ChartPerson48Regular } from "@fluentui/react-icons";

const fetchApiKey = async () => {
    const apiKey = await getApiKeyPayment();
    return apiKey;
};

export const SubscriptionPlans: React.FC<{ stripePromise: Promise<Stripe | null> }> = ({ stripePromise }) => {
    const { user, organization } = useAppContext();

    const [prices, setPrices] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fetch product prices when the component mounts
        async function fetchPrices() {
            try {
                const data = await getProductPrices({ user });
                setPrices(data.prices.sort((a: any, b: any) => a.unit_amount - b.unit_amount));
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
            priceId,
            successUrl: window.location.origin + "#/success-payment",
            cancelUrl: window.location.origin + "/",
            organizationId: user.organizationId || ""
        });
        window.location.href = url;
    };

    return (
        <div className={styles.subscriptionPlan} aria-labelledby="subscription-plans-title">
            <div id="options-row" className={styles.row}>
                <h1 className={styles.subscriptionPlanTitle}>Subscription Plans</h1>
            </div>
            <div className={styles.planContainer}>
                {prices.map((price, index) => {
                    return (
                        <>
                            <div key={price.id} className={styles.plan}>
                                <ChartPerson48Regular className={styles.planIcon} />
                                <h2 className={styles.planName}>{price.nickname}</h2>
                                <p className={styles.planPrice}>
                                    ${(price.unit_amount / 100).toFixed(2)} {price.currency.toUpperCase()} per {price.recurring?.interval}
                                </p>
                                <p className={styles.planDescription}>{price.description}</p>
                                {price.id !== "free_plan" && (
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
                                )}
                            </div>
                        </>
                    );
                })}
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
