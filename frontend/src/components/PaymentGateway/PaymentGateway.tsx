import React, { useState, useEffect, useContext } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import styles from "./PaymentGateway.module.css";
import { getApiKeyPayment, createCheckoutSession } from "../../api";
import { AppContext } from "../../providers/AppProviders";
import { Spinner } from "@fluentui/react";

const fetchApiKey = async () => {
    const apiKey = await getApiKeyPayment();
    return apiKey;
};

export const SubscriptionPlans: React.FC<{ stripePromise: Promise<Stripe | null> }> = ({ stripePromise }) => {
    const { user, organization } = useContext(AppContext);

    const [plans, setPlans] = useState<any[]>([]);
    const [currentPlan, setCurrentPlan] = useState(organization.subscriptionId ? 1 : 0);

    useEffect(() => {
        setPlans([
            {
                id: "free_plan",
                name: "Free Plan",
                description: "Access to basic features for free.",
                price: "0.00",
                interval: "month"
            },
            {
                id: "price_1PYvHVEpF6ccgZLwn6uq6d4J",
                name: "Enterprise Plan",
                description: "Access to all features including premium support.",
                price: "30.00",
                interval: "month"
            }
        ]);
    }, []);

    const handleCheckout = async (priceId: string) => {
        const { url } = await createCheckoutSession({
            userId: user.id,
            priceId,
            successUrl: window.location.origin + "#/success-payment",
            cancelUrl: window.location.origin + "/",
            organizationId: user.organizationId || ""

        });
        console.log(url);
        window.location.href = url;
    };

    return (
        <div className={styles.subscriptionPlan} aria-labelledby="subscription-plans-title">
            <h1 className={styles.subscriptionPlanTitle}>Subscription Plans</h1>
            <div className={styles.planContainer}>
                {plans.map((plan, index) => (
                    <>
                        <div key={plan.id} className={styles.plan}>
                            {currentPlan === index && <div className={styles.currentIndicator}>Current Plan</div>}
                            <h2 className={styles.planName}>{plan.name}</h2>
                            <p className={styles.planPrice}>
                                ${plan.price} per {plan.interval}
                            </p>
                            <p className={styles.planDescription}>{plan.description}</p>
                            {plan.id !== "free_plan" && (
                                <button
                                className={styles.planButton}
                                    onClick={() => handleCheckout(plan.id)}
                                    role="button"
                                    aria-label={`Subscribe to ${plan.name}`}
                                >
                                    {organization.subscriptionId && organization.subscriptionStatus === "inactive"
                                        ? "Reactivate subscription"
                                        : organization.subscriptionStatus === "active"
                                        ? "Edit payment information"
                                        : "Subscribe"}
                                </button>
                            )}
                        </div>
                    </>
                ))}
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
