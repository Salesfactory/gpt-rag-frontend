// Mock Organization Service for Platform Admin Portal

import {
  Organization,
  OrganizationWithCosts,
  SubscriptionTier,
  initialOrganizations,
  mockDataStore,
  STORAGE_KEYS,
  generateId,
  simulateDelay
} from './mockData';

export interface CreateOrganizationInput {
  name: string;
  admin_email: string;
  subscription_tier: SubscriptionTier;
  expiration_date: string;
  description?: string;
}

export interface UpdateOrganizationInput {
  id: string;
  name: string;
  admin_email?: string;
  subscription_tier?: SubscriptionTier;
  storage_cost?: number;
  ingestion_cost?: number;
  tokens_cost?: number;
  description?: string;
}

interface TotalCosts {
  totalStorage: number;
  totalIngestion: number;
  totalTokens: number;
  grandTotal: number;
}

// Get organizations from localStorage or use initial data
function getOrganizationsFromStorage(): Organization[] {
  return mockDataStore.loadFromStorage(
    STORAGE_KEYS.ORGANIZATIONS,
    initialOrganizations
  );
}

// Save organizations to localStorage
function saveOrganizationsToStorage(organizations: Organization[]): void {
  mockDataStore.saveToStorage(STORAGE_KEYS.ORGANIZATIONS, organizations);
}

// Calculate total cost for an organization
function calculateTotalCost(org: Organization): number {
  return Number(org.storage_cost) + Number(org.ingestion_cost) + Number(org.tokens_cost);
}

// Convert Organization to OrganizationWithCosts
function addTotalCost(org: Organization): OrganizationWithCosts {
  return {
    ...org,
    total_cost: calculateTotalCost(org)
  };
}

export const organizationService = {
  // Get all organizations
  async getAll(): Promise<OrganizationWithCosts[]> {
    await simulateDelay();
    const organizations = getOrganizationsFromStorage();
    return organizations.map(addTotalCost);
  },

  // Get organization by ID
  async getById(id: string): Promise<OrganizationWithCosts | null> {
    await simulateDelay();
    const organizations = getOrganizationsFromStorage();
    const org = organizations.find(o => o.id === id);
    return org ? addTotalCost(org) : null;
  },

  // Create new organization
  async create(input: CreateOrganizationInput): Promise<Organization> {
    await simulateDelay();

    const newOrganization: Organization = {
      id: generateId(),
      name: input.name,
      description: input.description || '',
      admin_email: input.admin_email,
      storage_cost: 0,
      ingestion_cost: 0,
      tokens_cost: 0,
      subscription_tier: input.subscription_tier,
      expiration_date: input.expiration_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const organizations = getOrganizationsFromStorage();
    organizations.push(newOrganization);
    saveOrganizationsToStorage(organizations);

    return newOrganization;
  },

  // Update organization
  async update(input: UpdateOrganizationInput): Promise<Organization> {
    await simulateDelay();

    const organizations = getOrganizationsFromStorage();
    const index = organizations.findIndex(o => o.id === input.id);

    if (index === -1) {
      throw new Error(`Organization with id ${input.id} not found`);
    }

    const updatedOrganization: Organization = {
      ...organizations[index],
      name: input.name,
      admin_email: input.admin_email ?? organizations[index].admin_email,
      subscription_tier: input.subscription_tier ?? organizations[index].subscription_tier,
      storage_cost: input.storage_cost ?? organizations[index].storage_cost,
      ingestion_cost: input.ingestion_cost ?? organizations[index].ingestion_cost,
      tokens_cost: input.tokens_cost ?? organizations[index].tokens_cost,
      description: input.description ?? organizations[index].description,
      updated_at: new Date().toISOString()
    };

    organizations[index] = updatedOrganization;
    saveOrganizationsToStorage(organizations);

    return updatedOrganization;
  },

  // Delete organization
  async delete(id: string): Promise<void> {
    await simulateDelay();

    const organizations = getOrganizationsFromStorage();
    const filteredOrganizations = organizations.filter(o => o.id !== id);

    if (filteredOrganizations.length === organizations.length) {
      throw new Error(`Organization with id ${id} not found`);
    }

    saveOrganizationsToStorage(filteredOrganizations);
  },

  // Get total costs across all organizations
  async getTotalCosts(): Promise<TotalCosts> {
    await simulateDelay();

    const organizations = getOrganizationsFromStorage();

    const totalStorage = organizations.reduce((sum, org) => sum + Number(org.storage_cost), 0);
    const totalIngestion = organizations.reduce((sum, org) => sum + Number(org.ingestion_cost), 0);
    const totalTokens = organizations.reduce((sum, org) => sum + Number(org.tokens_cost), 0);
    const grandTotal = totalStorage + totalIngestion + totalTokens;

    return {
      totalStorage,
      totalIngestion,
      totalTokens,
      grandTotal
    };
  },

  // Reset to initial data (useful for testing)
  async reset(): Promise<void> {
    await simulateDelay();
    saveOrganizationsToStorage(initialOrganizations);
  }
};
