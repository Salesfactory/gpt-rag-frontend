import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import styles from "./PaymentGateway.module.css";

const stripePromise = loadStripe(import.meta.env.VITE_SOME_KEY);

export const SubscriptionPlans: React.FC = () => {
    const [plans, setPlans] = useState<any[]>([]);
    console.log(import.meta.env.VITE_SOME_KEY);
    console.log(stripePromise);
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
          name: 'Plus Plan',
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
        successUrl: window.location.origin + '/',
        cancelUrl: window.location.origin + '/',
      });
  
      if (error) {
        console.error('Error redirecting to checkout:', error);
      }
    };
  
    return (
      <div className={styles.subscriptionPlan}>
        <h1 className={styles.subscriptionPlanTitle}>Subscription Plans</h1>
        <div className={styles.planContainer}>
          {plans.map(plan => (
            <div key={plan.id} className={styles.plan}>
              <h2 className={styles.planName}>{plan.name}</h2>
              <p className={styles.planPrice}>${plan.price} per {plan.interval}</p>
              <p className={styles.planDescription}>{plan.description}</p>
              {plan.id !== 'free_plan' && (
                <button className={styles.planButton} onClick={() => handleCheckout(plan.id)}>Subscribe</button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  export const PaymentGateway: React.FC = () => {
    return (
      <Elements stripe={stripePromise}>
        <SubscriptionPlans />
      </Elements>
    );
  };