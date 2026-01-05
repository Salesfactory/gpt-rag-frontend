// Mock Subscription Service for Platform Admin Portal

import {
  SubscriptionTierSettings,
  initialSubscriptionTiers,
  mockDataStore,
  STORAGE_KEYS,
  simulateDelay
} from './mockData';

export interface UpdateTierSettingsInput {
  tier: 'basic' | 'custom' | 'premium';
  upload_pages_limit: number;
  max_excel_files: number;
  credits_per_month: number;
  storage_capacity_gb: number;
  max_users: number;
}

// Get subscription tiers from localStorage or use initial data
function getSubscriptionTiersFromStorage(): SubscriptionTierSettings[] {
  return mockDataStore.loadFromStorage(
    STORAGE_KEYS.SUBSCRIPTION_TIERS,
    initialSubscriptionTiers
  );
}

// Save subscription tiers to localStorage
function saveSubscriptionTiersToStorage(tiers: SubscriptionTierSettings[]): void {
  mockDataStore.saveToStorage(STORAGE_KEYS.SUBSCRIPTION_TIERS, tiers);
}

export const subscriptionService = {
  // Get all subscription tier settings
  async getAll(): Promise<SubscriptionTierSettings[]> {
    await simulateDelay();
    return getSubscriptionTiersFromStorage();
  },

  // Get subscription tier by tier name
  async getByTier(tier: 'basic' | 'custom' | 'premium'): Promise<SubscriptionTierSettings | null> {
    await simulateDelay();

    const tiers = getSubscriptionTiersFromStorage();
    return tiers.find(t => t.tier === tier) || null;
  },

  // Update subscription tier settings
  async update(input: UpdateTierSettingsInput): Promise<SubscriptionTierSettings> {
    await simulateDelay();

    const tiers = getSubscriptionTiersFromStorage();
    const index = tiers.findIndex(t => t.tier === input.tier);

    if (index === -1) {
      throw new Error(`Subscription tier "${input.tier}" not found`);
    }

    const updatedTier: SubscriptionTierSettings = {
      ...tiers[index],
      upload_pages_limit: input.upload_pages_limit,
      max_excel_files: input.max_excel_files,
      credits_per_month: input.credits_per_month,
      storage_capacity_gb: input.storage_capacity_gb,
      max_users: input.max_users,
      updated_at: new Date().toISOString()
    };

    tiers[index] = updatedTier;
    saveSubscriptionTiersToStorage(tiers);

    return updatedTier;
  },

  // Reset to initial data (useful for testing)
  async reset(): Promise<void> {
    await simulateDelay();
    saveSubscriptionTiersToStorage(initialSubscriptionTiers);
  }
};
