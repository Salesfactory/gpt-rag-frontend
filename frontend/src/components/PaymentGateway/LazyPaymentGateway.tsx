import React, { lazy, Suspense } from 'react';
import { Spinner } from '@fluentui/react';

// Lazy load the PaymentGateway components
const PaymentGateway = lazy(() => 
  import('./PaymentGateway').then(module => ({ 
    default: module.PaymentGateway 
  }))
);

const SubscriptionPlans = lazy(() => 
  import('./PaymentGateway').then(module => ({ 
    default: module.SubscriptionPlans 
  }))
);

// Loading fallback component
const LoadingFallback: React.FC<{ label?: string }> = ({ label = "Loading payment gateway..." }) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: '40px',
    minHeight: '200px'
  }}>
    <Spinner label={label} size={3} />
  </div>
);

// Lazy wrapper components
export const LazyPaymentGateway: React.FC = () => (
  <Suspense fallback={<LoadingFallback label="Loading payment gateway..." />}>
    <PaymentGateway />
  </Suspense>
);

export const LazySubscriptionPlans: React.FC<{ stripePromise: Promise<any> }> = (props) => (
  <Suspense fallback={<LoadingFallback label="Loading subscription plans..." />}>
    <SubscriptionPlans {...props} />
  </Suspense>
);

// Also lazy load Stripe-related imports to further optimize bundle
export const loadStripeAsync = async () => {
  const { loadStripe } = await import('@stripe/stripe-js');
  return loadStripe;
};

export const loadStripeElementsAsync = async () => {
  const { Elements } = await import('@stripe/react-stripe-js');
  return Elements;
};
