import React, { useState, useEffect } from 'react';
import { subscriptionService, UpdateTierSettingsInput } from '../../../services/platform-admin/subscriptionService.mock';
import { SubscriptionTierSettings } from '../../../services/platform-admin/mockData';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

export const SubscriptionSettings: React.FC = () => {
  const [tiers, setTiers] = useState<SubscriptionTierSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [formData, setFormData] = useState<UpdateTierSettingsInput>({
    tier: 'basic',
    upload_pages_limit: 0,
    max_excel_files: 0,
    credits_per_month: 0,
    storage_capacity_gb: 0,
    max_users: 0
  });

  useEffect(() => {
    loadTiers();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadTiers = async () => {
    try {
      setIsLoading(true);
      const data = await subscriptionService.getAll();
      setTiers(data);
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to load subscription tiers' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (tier: SubscriptionTierSettings) => {
    setEditingTier(tier.tier);
    setFormData({
      tier: tier.tier,
      upload_pages_limit: tier.upload_pages_limit,
      max_excel_files: tier.max_excel_files,
      credits_per_month: tier.credits_per_month,
      storage_capacity_gb: tier.storage_capacity_gb,
      max_users: tier.max_users
    });
  };

  const handleSave = async () => {
    try {
      await subscriptionService.update(formData);
      setToast({ type: 'success', message: `${formData.tier.charAt(0).toUpperCase() + formData.tier.slice(1)} tier updated successfully` });
      setEditingTier(null);
      loadTiers();
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to update subscription tier' });
    }
  };

  const handleCancel = () => {
    setEditingTier(null);
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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'from-blue-500 to-blue-600';
      case 'premium':
        return 'from-purple-500 to-purple-600';
      case 'custom':
        return 'from-orange-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'bg-blue-100 text-blue-800';
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      case 'custom':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading subscription tiers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
        <h1 className="text-2xl font-bold text-gray-900">Subscription Tiers</h1>
        <p className="text-gray-600 mt-1">Configure limits and features for each subscription tier</p>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <div key={tier.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${getTierColor(tier.tier)} p-6 text-white`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold capitalize">{tier.tier}</h2>
                  <p className="text-sm opacity-90 mt-1">Subscription Tier</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTierBadgeColor(tier.tier)} bg-white bg-opacity-90`}>
                  {tier.tier.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-6">
              {editingTier === tier.tier ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Upload Pages Limit
                    </label>
                    <input
                      type="number"
                      value={formData.upload_pages_limit}
                      onChange={(e) => setFormData({ ...formData, upload_pages_limit: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Max Excel Files
                    </label>
                    <input
                      type="number"
                      value={formData.max_excel_files}
                      onChange={(e) => setFormData({ ...formData, max_excel_files: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Credits per Month
                    </label>
                    <input
                      type="number"
                      value={formData.credits_per_month}
                      onChange={(e) => setFormData({ ...formData, credits_per_month: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Storage Capacity (GB)
                    </label>
                    <input
                      type="number"
                      value={formData.storage_capacity_gb}
                      onChange={(e) => setFormData({ ...formData, storage_capacity_gb: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Max Users
                    </label>
                    <input
                      type="number"
                      value={formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Upload Pages</span>
                    <span className="font-semibold text-gray-900">{tier.upload_pages_limit.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Excel Files</span>
                    <span className="font-semibold text-gray-900">{tier.max_excel_files}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Credits/Month</span>
                    <span className="font-semibold text-gray-900">{tier.credits_per_month.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Storage</span>
                    <span className="font-semibold text-gray-900">{tier.storage_capacity_gb} GB</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Max Users</span>
                    <span className="font-semibold text-gray-900">{tier.max_users}</span>
                  </div>

                  <div className="pt-2 pb-1">
                    <p className="text-xs text-gray-500">
                      Last updated: {formatDate(tier.updated_at)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleEdit(tier)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Edit Tier
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
