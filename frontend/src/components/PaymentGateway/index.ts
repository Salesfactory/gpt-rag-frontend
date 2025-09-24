// Lazy-loaded components for better bundle optimization
export {
  LazyPaymentGateway,
  LazySubscriptionPlans,
  loadStripeAsync,
  loadStripeElementsAsync
} from './LazyPaymentGateway';

// Original components still available for direct imports if needed
export {
  PaymentGateway,
  SubscriptionPlans
} from './PaymentGateway';
