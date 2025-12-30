import React, { useState, useEffect } from 'react';
import { creditsService, UpdateCreditConfigInput } from '../../../services/platform-admin/creditsService.mock';
import { CreditConfiguration } from '../../../services/platform-admin/mockData';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

export const CreditsManagement: React.FC = () => {
  const [config, setConfig] = useState<CreditConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [formData, setFormData] = useState<UpdateCreditConfigInput>({
    monthly_limit: 0,
    mode_agentic_search: 0,
    mode_analyst_agent: 0,
    mode_chat_with_file: 0,
    mode_chat_with_website: 0,
    mode_no_mode: 0,
    tool_general: 0,
    tool_marketing_plan: 0,
    tool_creative_brief: 0,
    tool_creative_copywriter: 0,
    tool_brand_positioning_statement: 0,
    tool_help_desk: 0
  });

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const data = await creditsService.getCreditConfiguration();
      setConfig(data);
      setFormDataFromConfig(data);
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to load credit configuration' });
    } finally {
      setIsLoading(false);
    }
  };

  const setFormDataFromConfig = (data: CreditConfiguration) => {
    setFormData({
      monthly_limit: data.monthly_limit,
      mode_agentic_search: data.mode_agentic_search,
      mode_analyst_agent: data.mode_analyst_agent,
      mode_chat_with_file: data.mode_chat_with_file,
      mode_chat_with_website: data.mode_chat_with_website,
      mode_no_mode: data.mode_no_mode,
      tool_general: data.tool_general,
      tool_marketing_plan: data.tool_marketing_plan,
      tool_creative_brief: data.tool_creative_brief,
      tool_creative_copywriter: data.tool_creative_copywriter,
      tool_brand_positioning_statement: data.tool_brand_positioning_statement,
      tool_help_desk: data.tool_help_desk
    });
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      const updated = await creditsService.updateCreditConfiguration(config.id, formData);
      setConfig(updated);
      setIsEditing(false);
      setToast({ type: 'success', message: 'Credit configuration updated successfully' });
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to update credit configuration' });
    }
  };

  const handleCancel = () => {
    if (config) {
      setFormDataFromConfig(config);
    }
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const InputField: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
  }> = ({ label, value, onChange, disabled = false }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        min="0"
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading credit configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load credit configuration</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Credits Configuration</h1>
            <p className="text-gray-600 mt-1">Manage credit costs for modes and tools</p>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {formatDate(config.updated_at)}
            </p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Configuration
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white mb-6">
        <div className="text-sm opacity-90">Monthly Credit Limit</div>
        <div className="text-4xl font-bold mt-2">{config.monthly_limit.toLocaleString()}</div>
        <div className="text-sm opacity-90 mt-1">credits per month</div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* General Settings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
            General Settings
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <InputField
              label="Monthly Credit Limit"
              value={formData.monthly_limit}
              onChange={(val) => setFormData({ ...formData, monthly_limit: val })}
              disabled={!isEditing}
            />
          </div>
        </div>

        {/* Mode-Based Credits */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
            Mode-Based Credit Costs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Agentic Search"
              value={formData.mode_agentic_search}
              onChange={(val) => setFormData({ ...formData, mode_agentic_search: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Analyst Agent"
              value={formData.mode_analyst_agent}
              onChange={(val) => setFormData({ ...formData, mode_analyst_agent: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Chat with File"
              value={formData.mode_chat_with_file}
              onChange={(val) => setFormData({ ...formData, mode_chat_with_file: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Chat with Website"
              value={formData.mode_chat_with_website}
              onChange={(val) => setFormData({ ...formData, mode_chat_with_website: val })}
              disabled={!isEditing}
            />
            <InputField
              label="No Mode"
              value={formData.mode_no_mode}
              onChange={(val) => setFormData({ ...formData, mode_no_mode: val })}
              disabled={!isEditing}
            />
          </div>
        </div>

        {/* Tool-Based Credits */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
            Tool-Based Credit Costs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="General"
              value={formData.tool_general}
              onChange={(val) => setFormData({ ...formData, tool_general: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Marketing Plan"
              value={formData.tool_marketing_plan}
              onChange={(val) => setFormData({ ...formData, tool_marketing_plan: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Creative Brief"
              value={formData.tool_creative_brief}
              onChange={(val) => setFormData({ ...formData, tool_creative_brief: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Creative Copywriter"
              value={formData.tool_creative_copywriter}
              onChange={(val) => setFormData({ ...formData, tool_creative_copywriter: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Brand Positioning Statement"
              value={formData.tool_brand_positioning_statement}
              onChange={(val) => setFormData({ ...formData, tool_brand_positioning_statement: val })}
              disabled={!isEditing}
            />
            <InputField
              label="Help Desk"
              value={formData.tool_help_desk}
              onChange={(val) => setFormData({ ...formData, tool_help_desk: val })}
              disabled={!isEditing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
