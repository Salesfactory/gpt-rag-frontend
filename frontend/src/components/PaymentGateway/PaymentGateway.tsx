import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import styles from "./PaymentGateway.module.css";
import { getApiKeyPayment } from "../../api";
import { AppContext } from "../../providers/AppProviders";
import { useContext } from "react";
import { Spinner } from "@fluentui/react";

const fetchApiKey = async () => {
    const apiKey = await getApiKeyPayment();
    return apiKey;
};

export const SubscriptionPlans: React.FC<{ stripePromise: Promise<Stripe | null> }> = ({ stripePromise }) => {
    const [plans, setPlans] = useState<any[]>([]);
    const {user} = useContext(AppContext);

    useEffect(() => {
        setPlans([
            {
                id: 'free_plan',
                name: 'Current Plan',
                description: 'Access to basic features for free.',
                price: '0.00',
                interval: 'month'
            },
            {
                id: 'price_1PYvHVEpF6ccgZLwn6uq6d4J',
                name: 'Enterprise Plan',
                description: 'Access to all features including premium support.',
                price: '30.00',
                interval: 'month'
            }
        ]);
    }, []);

    const handleCheckout = async (priceId: string) => {
        const stripe = await stripePromise;
        const { error } = await stripe!.redirectToCheckout({
            lineItems: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            customerEmail: user.email!,
            successUrl: window.location.origin + '/',
            cancelUrl: window.location.origin + '/',
        });

        if (error) {
            console.error('Error redirecting to checkout:', error);
        }
    };

    return (
        <div className={styles.subscriptionPlan} aria-labelledby="subscription-plans-title">
            <h1 className={styles.subscriptionPlanTitle}>Subscription Plans</h1>
            <div className={styles.planContainer}>
                {plans.map(plan => (
                    <div key={plan.id} className={styles.plan}>
                        <h2 className={styles.planName}>{plan.name}</h2>
                        <p className={styles.planPrice}>${plan.price} per {plan.interval}</p>
                        <p className={styles.planDescription}>{plan.description}</p>
                        {plan.id !== 'free_plan' && (
                            <button 
                                className={styles.planButton} 
                                onClick={() => handleCheckout(plan.id)}  
                                role="button" 
                                aria-label={`Subscribe to ${plan.name}`} 
                            >
                                Subscribe
                            </button>
                        )}
                    </div>
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
