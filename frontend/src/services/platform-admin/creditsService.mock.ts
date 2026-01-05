// Mock Credits Service for Platform Admin Portal

import {
  CreditConfiguration,
  initialCreditConfig,
  mockDataStore,
  STORAGE_KEYS,
  simulateDelay
} from './mockData';

export interface UpdateCreditConfigInput {
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
}

// Get credit configuration from localStorage or use initial data
function getCreditConfigFromStorage(): CreditConfiguration {
  return mockDataStore.loadFromStorage(
    STORAGE_KEYS.CREDITS,
    initialCreditConfig
  );
}

// Save credit configuration to localStorage
function saveCreditConfigToStorage(config: CreditConfiguration): void {
  mockDataStore.saveToStorage(STORAGE_KEYS.CREDITS, config);
}

export const creditsService = {
  // Get credit configuration
  async getCreditConfiguration(): Promise<CreditConfiguration> {
    await simulateDelay();
    return getCreditConfigFromStorage();
  },

  // Update credit configuration
  async updateCreditConfiguration(
    id: string,
    input: UpdateCreditConfigInput
  ): Promise<CreditConfiguration> {
    await simulateDelay();

    const config = getCreditConfigFromStorage();

    if (config.id !== id) {
      throw new Error(`Credit configuration with id ${id} not found`);
    }

    const updatedConfig: CreditConfiguration = {
      ...config,
      monthly_limit: input.monthly_limit,
      mode_agentic_search: input.mode_agentic_search,
      mode_analyst_agent: input.mode_analyst_agent,
      mode_chat_with_file: input.mode_chat_with_file,
      mode_chat_with_website: input.mode_chat_with_website,
      mode_no_mode: input.mode_no_mode,
      tool_general: input.tool_general,
      tool_marketing_plan: input.tool_marketing_plan,
      tool_creative_brief: input.tool_creative_brief,
      tool_creative_copywriter: input.tool_creative_copywriter,
      tool_brand_positioning_statement: input.tool_brand_positioning_statement,
      tool_help_desk: input.tool_help_desk,
      updated_at: new Date().toISOString()
    };

    saveCreditConfigToStorage(updatedConfig);

    return updatedConfig;
  },

  // Reset to initial data (useful for testing)
  async reset(): Promise<void> {
    await simulateDelay();
    saveCreditConfigToStorage(initialCreditConfig);
  }
};
