// Mock Data Types and Utilities for Platform Admin Portal

export type SubscriptionTier = 'Free' | 'Basic' | 'Premium' | 'Custom';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  admin_email?: string;
  storage_cost: number;
  ingestion_cost: number;
  tokens_cost: number;
  subscription_tier: SubscriptionTier;
  expiration_date?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithCosts extends Organization {
  total_cost: number;
}

export interface PulseDataIngestion {
  id: string;
  filename: string;
  document_date: string;
  consumer_type: 'Pro' | 'Consumer';
  organization_id: string;
  metadata_notes: string;
  user_email: string;
  created_at: string;
}

export interface PulseDataWithOrganization extends PulseDataIngestion {
  organization_name?: string;
}

export interface CreditConfiguration {
  id: string;
  monthly_limit: number;
  mode_agentic_search: number;
  mode_analyst_agent: number;
  mode_chat_with_file: number;
  mode_chat_with_website: number;
  mode_no_mode: number;
  tool_general: number;
  tool_marketing_plan: number;
  tool_creative_brief: number;
  tool_creative_copywriter: number;
  tool_brand_positioning_statement: number;
  tool_help_desk: number;
  updated_at: string;
}

export interface SubscriptionTierSettings {
  id: string;
  tier: 'basic' | 'custom' | 'premium';
  upload_pages_limit: number;
  max_excel_files: number;
  credits_per_month: number;
  storage_capacity_gb: number;
  max_users: number;
  updated_at: string;
}

// LocalStorage Keys
const STORAGE_KEYS = {
  ORGANIZATIONS: 'platform_admin_organizations',
  PULSE_DATA: 'platform_admin_pulse_data',
  CREDITS: 'platform_admin_credits',
  SUBSCRIPTION_TIERS: 'platform_admin_subscription_tiers',
  USER_ACTIVITIES: 'platform_admin_user_activities',
};

// Helper Functions for localStorage persistence
export const mockDataStore = {
  saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  },

  loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return defaultValue;
    }
  },

  clearStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },

  clearAllPlatformAdminData(): void {
    Object.values(STORAGE_KEYS).forEach(key => this.clearStorage(key));
  }
};

// Initial Mock Data

export const initialOrganizations: Organization[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    description: 'Enterprise customer',
    admin_email: 'admin@acme.com',
    storage_cost: 0,
    ingestion_cost: 0,
    tokens_cost: 0,
    subscription_tier: 'Premium',
    expiration_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date('2024-01-15').toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'TechStart Inc',
    description: 'Startup customer',
    admin_email: 'contact@techstart.io',
    storage_cost: 0,
    ingestion_cost: 0,
    tokens_cost: 0,
    subscription_tier: 'Basic',
    expiration_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date('2024-03-20').toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Global Solutions Ltd',
    description: 'Custom enterprise plan',
    admin_email: 'admin@globalsolutions.com',
    storage_cost: 0,
    ingestion_cost: 0,
    tokens_cost: 0,
    subscription_tier: 'Custom',
    expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date('2023-11-10').toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Community Project',
    description: 'Free tier user',
    admin_email: 'team@community.org',
    storage_cost: 0,
    ingestion_cost: 0,
    tokens_cost: 0,
    subscription_tier: 'Free',
    expiration_date: undefined,
    created_at: new Date('2024-06-01').toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const initialPulseData: PulseDataIngestion[] = [
  {
    id: '1',
    filename: 'customer_survey_q1_2024.pdf',
    document_date: new Date('2024-01-15').toISOString(),
    consumer_type: 'Pro',
    organization_id: '1',
    metadata_notes: 'Q1 customer satisfaction survey results',
    user_email: 'admin@acme.com',
    created_at: new Date('2024-01-20').toISOString(),
  },
  {
    id: '2',
    filename: 'market_analysis_tech.xlsx',
    document_date: new Date('2024-03-10').toISOString(),
    consumer_type: 'Consumer',
    organization_id: '2',
    metadata_notes: 'Technology market analysis for Q1',
    user_email: 'contact@techstart.io',
    created_at: new Date('2024-03-12').toISOString(),
  },
  {
    id: '3',
    filename: 'global_trends_report.pdf',
    document_date: new Date('2024-02-01').toISOString(),
    consumer_type: 'Pro',
    organization_id: '3',
    metadata_notes: 'Annual global market trends report',
    user_email: 'admin@globalsolutions.com',
    created_at: new Date('2024-02-05').toISOString(),
  }
];

export const initialCreditConfig: CreditConfiguration = {
  id: '1',
  monthly_limit: 1000,
  mode_agentic_search: 4,
  mode_analyst_agent: 20,
  mode_chat_with_file: 10,
  mode_chat_with_website: 8,
  mode_no_mode: 0,
  tool_general: 1,
  tool_marketing_plan: 2,
  tool_creative_brief: 2,
  tool_creative_copywriter: 2,
  tool_brand_positioning_statement: 2,
  tool_help_desk: 0,
  updated_at: new Date().toISOString(),
};

export const initialSubscriptionTiers: SubscriptionTierSettings[] = [
  {
    id: '1',
    tier: 'basic',
    upload_pages_limit: 100,
    max_excel_files: 5,
    credits_per_month: 500,
    storage_capacity_gb: 10,
    max_users: 5,
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    tier: 'custom',
    upload_pages_limit: 500,
    max_excel_files: 20,
    credits_per_month: 2000,
    storage_capacity_gb: 50,
    max_users: 20,
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    tier: 'premium',
    upload_pages_limit: 1000,
    max_excel_files: 50,
    credits_per_month: 5000,
    storage_capacity_gb: 100,
    max_users: 50,
    updated_at: new Date().toISOString(),
  }
];

// Utility function to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Simulate async delay
export function simulateDelay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { STORAGE_KEYS };
