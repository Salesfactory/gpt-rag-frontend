import React, { useState, useEffect, useRef } from 'react';
import { CreatePulseDataInput } from '../../../services/platform-admin/pulseDataService.mock';
import { Upload, Calendar, Plus, X } from 'lucide-react';
import { uploadGlobalIngestData } from '../../../api';
import { useAppContext } from '../../../providers/AppProviders';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

export const DataIngestion: React.FC = () => {

  const { user } = useAppContext();

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [metadataFields, setMetadataFields] = useState<Array<{ key: string; value: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({
      filename: '',
      document_date: new Date().toISOString().split('T')[0],
      consumer_type: 'Pro',
      metadata_notes: '',
      user_email: ''
    });
    setMetadataFields([]);
  };

  const [formData, setFormData] = useState<CreatePulseDataInput>({
    filename: '',
    document_date: new Date().toISOString().split('T')[0],
    consumer_type: 'Pro',
    metadata_notes: '',
    user_email: ''
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleIngestion = async () => {
    if (!formData.filename) {
      setToast({ type: 'error', message: 'Filename is required' });
      return;
    }

    const hasEmptyMetadata = metadataFields.some(field => !field.key.trim() || !field.value.trim());
    if (hasEmptyMetadata) {
      setToast({ type: 'error', message: 'All metadata fields must have both key and value filled out' });
      return;
    }

    if (!selectedFile) {
      setToast({ type: 'error', message: 'File is required' });
      return;
    }

    try {
      await uploadGlobalIngestData(user, selectedFile, metadataFields);
      setToast({ type: 'success', message: 'Data ingestion completed successfully' });
      resetForm();
      setSelectedFile(null);
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to complete data ingestion' });
    }
  };

  const handleAddMetadataField = () => {
    setMetadataFields([...metadataFields, { key: '', value: '' }]);
  };

  const handleMetadataFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    const newFields = [...metadataFields];
    newFields[index][field] = value;
    setMetadataFields(newFields);
  };

  const handleRemoveMetadataField = (index: number) => {
    const newFields = [...metadataFields];
    newFields.splice(index, 1);
    setMetadataFields(newFields);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setFormData({ ...formData, filename: file.name });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pulse Data Ingestion</h1>
        <p className="text-gray-500 mt-1">Ingest data into Freddaid</p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Data Ingestion</h2>
        </div>

        {/* Card Content */}
        <div className="p-6">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-6 ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : selectedFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <Upload className={`w-10 h-10 mx-auto mb-3 ${selectedFile ? 'text-green-500' : 'text-gray-400'
              }`} />
            {selectedFile ? (
              <>
                <p className="text-gray-700 font-medium">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">Click or drag to replace</p>
              </>
            ) : (
              <>
                <p className="text-gray-700">Drag and drop a file here, or click to select</p>
                <p className="text-sm text-gray-500 mt-1">File will be ingested into Freddaid</p>
              </>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Select File
            </button>
          </div>

          {/* Form Fields Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Filename */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filename <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.filename}
                onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                placeholder="Enter filename"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Document Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Document Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.document_date}
                onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Consumer Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consumer Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.consumer_type}
                onChange={(e) => setFormData({ ...formData, consumer_type: e.target.value as 'Pro' | 'Consumer' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="Pro">Pro</option>
                <option value="Consumer">Consumer</option>
              </select>
            </div>
          </div>

          {/* Metadata Fields */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Metadata Fields
              </label>
              <button
                type="button"
                onClick={handleAddMetadataField}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            </div>

            {metadataFields.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No metadata fields added. Click "Add Field" to add key-value pairs.</p>
            ) : (
              <div className="space-y-2">
                {metadataFields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Key"
                      value={field.key}
                      onChange={(e) => handleMetadataFieldChange(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => handleMetadataFieldChange(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMetadataField(index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleIngestion}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Ingest Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
