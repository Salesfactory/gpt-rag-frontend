// Mock Pulse Data Service for Platform Admin Portal

import {
  PulseDataIngestion,
  PulseDataWithOrganization,
  initialPulseData,
  mockDataStore,
  STORAGE_KEYS,
  generateId,
  simulateDelay
} from './mockData';
import { organizationService } from './organizationService.mock';

export interface CreatePulseDataInput {
  filename: string;
  document_date: string;
  consumer_type: 'Pro' | 'Consumer';
  metadata_notes: string;
  user_email: string;
}

// Get pulse data from localStorage or use initial data
function getPulseDataFromStorage(): PulseDataIngestion[] {
  return mockDataStore.loadFromStorage(
    STORAGE_KEYS.PULSE_DATA,
    initialPulseData
  );
}

// Save pulse data to localStorage
function savePulseDataToStorage(data: PulseDataIngestion[]): void {
  mockDataStore.saveToStorage(STORAGE_KEYS.PULSE_DATA, data);
}

export const pulseDataService = {
  // Get all pulse data records
  async getAll(): Promise<PulseDataWithOrganization[]> {
    await simulateDelay();

    const pulseData = getPulseDataFromStorage();
    const organizations = await organizationService.getAll();

    // Enrich pulse data with organization names
    return pulseData.map(data => {
      const org = organizations.find(o => o.id === data.organization_id);
      return {
        ...data,
        organization_name: org?.name || 'Unknown Organization'
      };
    });
  },

  // Get pulse data by ID
  async getById(id: string): Promise<PulseDataWithOrganization | null> {
    await simulateDelay();

    const pulseData = getPulseDataFromStorage();
    const data = pulseData.find(d => d.id === id);

    if (!data) {
      return null;
    }

    const organizations = await organizationService.getAll();
    const org = organizations.find(o => o.id === data.organization_id);

    return {
      ...data,
      organization_name: org?.name || 'Unknown Organization'
    };
  },

  // Create new pulse data record
  async create(input: CreatePulseDataInput): Promise<PulseDataIngestion> {
    await simulateDelay();

    // For mock purposes, use the first organization or create a default one
    const organizations = await organizationService.getAll();
    const defaultOrgId = organizations.length > 0 ? organizations[0].id : '1';

    const newPulseData: PulseDataIngestion = {
      id: generateId(),
      filename: input.filename,
      document_date: input.document_date,
      consumer_type: input.consumer_type,
      organization_id: defaultOrgId,
      metadata_notes: input.metadata_notes,
      user_email: input.user_email,
      created_at: new Date().toISOString()
    };

    const pulseData = getPulseDataFromStorage();
    pulseData.push(newPulseData);
    savePulseDataToStorage(pulseData);

    return newPulseData;
  },

  // Delete pulse data record
  async delete(id: string): Promise<void> {
    await simulateDelay();

    const pulseData = getPulseDataFromStorage();
    const filteredData = pulseData.filter(d => d.id !== id);

    if (filteredData.length === pulseData.length) {
      throw new Error(`Pulse data record with id ${id} not found`);
    }

    savePulseDataToStorage(filteredData);
  },

  // Reset to initial data (useful for testing)
  async reset(): Promise<void> {
    await simulateDelay();
    savePulseDataToStorage(initialPulseData);
  }
};
