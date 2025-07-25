import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, CheckCircle, XCircle, Clock, RefreshCw, Edit, Trash2, Filter, X } from 'lucide-react';
import styles from './KnowledgeSources.module.css';
import { useAppContext } from '../../providers/AppProviders';
import { 
  getOrganizationUrls, 
  deleteOrganizationUrl, 
  updateOrganizationUrl, 
  searchOrganizationUrls,
  scrapeUrls 
} from '../../api';
import { toast, ToastContainer } from 'react-toastify';

const statusFilterOptions = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Processing", value: "Processing" },
  { label: "Error", value: "Error" }
];

interface KnowledgeSource {
  id: string;
  url: string;
  lastModified: string;
  result: string;
  status: string;
  error?: string;
  contentLength?: number;
  title?: string;
  blobPath?: string;
  addedBy?: {
    userId: string;
    userName: string;
    dateAdded: string;
  };
}

const KnowledgeSources: React.FC = () => {
  const { organization, user } = useAppContext();
  
  // State for search functionality - stores the current search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for status filter dropdown - controls visibility and selected value
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // State for adding new URLs - stores input value and validation errors
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Knowledge sources from the backend
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  
  // State for editing URLs
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState('');
  const [editingError, setEditingError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // State for advanced web scrape mode
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  
  // Load data on component mount and when organization changes
  useEffect(() => {
    if (organization?.id) {
      loadKnowledgeSources();
    }
  }, [organization?.id]);
  
  // Function to load knowledge sources from the backend
  const loadKnowledgeSources = async () => {
    if (!organization?.id) return;
    
    try {
      setIsLoading(true);
      const response = await getOrganizationUrls(organization.id);
      
              // Transform backend data to match frontend interface
        const transformedData = response.data.map((item: any) => ({
          id: item.id,
          url: item.url,
          lastModified: new Date(item.lastModified).toLocaleString('sv-SE', { 
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }).replace('T', ' '),
          result: item.result || 'Pending',
          status: item.status || 'Processing',
          error: item.error,
          contentLength: item.contentLength,
          title: item.title,
          blobPath: item.blobPath,
          addedBy: item.addedBy
        }));
      
      setKnowledgeSources(transformedData);
    } catch (error) {
      console.error('Error loading knowledge sources:', error);
      toast.error('Failed to load knowledge sources');
    } finally {
      setIsLoading(false);
    }
  };
  
  // URL validation function using native URL constructor
  // This ensures the URL is properly formatted and uses http/https protocol
  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  };
  
  // Handle URL input changes with real-time validation
  // This provides immediate feedback to users as they type
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setNewUrl(url);
    
    if (url && !validateUrl(url)) {
      setUrlError('Please enter a valid URL (must start with http:// or https://)');
    } else {
      setUrlError('');
    }
  };
  
  // Add new URL to the knowledge sources list with web scraping
  // This will trigger web scraping and automatically save the results with blob links to Cosmos
  const handleAddUrl = async () => {
    if (!newUrl.trim()) {
      setUrlError('URL is required');
      return;
    }
    
    if (!validateUrl(newUrl)) {
      setUrlError('Please enter a valid URL');
      return;
    }
    
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }
    
    // Check if URL already exists to prevent duplicates
    const urlExists = knowledgeSources.some(source => source.url === newUrl);
    if (urlExists) {
      setUrlError('This URL is already in your knowledge sources');
      return;
    }
    
    try {
      setIsAdding(true);
      
      // Use the scraping endpoint to scrape and save the URL
      const scrapingResult = await scrapeUrls([newUrl], organization.id, user);
      
      // Extract results array for easier access
      const results = scrapingResult?.data?.result?.results || [];
      const urlResult = results.find((result: any) => result.url === newUrl);
      
      if (urlResult?.status === 'error') {
        // Scraping failed, show error and keep form
        toast.error('⚠️ Scraping is disabled for this site due to its content policy');
        setUrlError(urlResult.error || 'Scraping failed');
        loadKnowledgeSources(); // still reload the data to show the record on the URL table
        return;
      } else if (urlResult?.status === 'success') {
        // Scraping was successful
        toast.success('URL added and content successfully scraped. Please allow 2–5 minutes for the data to become searchable.');
      } else {
        // No specific result found, show generic success
        toast.success('URL added successfully');
      }
      
      // Clear form and reload data (only reached if no error occurred)
      setNewUrl('');
      setUrlError('');
      
      
      // Reload the data to get the new entry with scraping results
      await loadKnowledgeSources();
    } catch (error) {
      console.error('Error adding and scraping URL:', error);
      toast.error('Failed to add URL and initiate scraping');
    } finally {
      setIsAdding(false);
    }
  };
  
  // Refresh a knowledge source by re-scraping its URL
  const handleRefresh = async (id: string) => {
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }

    // Find the knowledge source to get its URL
    const sourceToRefresh = knowledgeSources.find(source => source.id === id);
    if (!sourceToRefresh) {
      toast.error('Knowledge source not found');
      return;
    }

    try {
      // Update local state to show processing status immediately
      setKnowledgeSources(knowledgeSources.map(source => 
        source.id === id 
          ? { ...source, status: 'Processing', result: 'Pending' }
          : source
      ));
      
      // Re-scrape the URL and update the existing record
      const scrapingResult = await scrapeUrls([sourceToRefresh.url], organization.id, user);
      
      // Extract results array for easier access
      const results = scrapingResult?.data?.result?.results || [];
      const urlResult = results.find((result: any) => result.url === sourceToRefresh.url);
      
      if (urlResult?.status === 'error') {
        // Scraping failed, show error message
        toast.error('⚠️ Scraping is disabled for this site due to its content policy');
      } else if (urlResult?.status === 'success') {
        // Scraping was successful
        toast.success('URL refreshed and content successfully scraped. Please allow 2–5 minutes for the data to become searchable.');
      } else {
        // No specific result found, show generic success
        toast.success('URL refresh completed');
      }
      
      // Reload the data to get the updated scraping results
      await loadKnowledgeSources();
      
    } catch (error) {
      toast.error('Failed to refresh URL');
      
      // Reload data to restore original state if scraping failed
      await loadKnowledgeSources();
    }
  };
  
  // Delete a knowledge source
  const handleDelete = async (id: string) => {
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }
    
    try {
      await deleteOrganizationUrl(id, organization.id);
      toast.success('URL deleted successfully');
      
      // Remove from local state immediately
      setKnowledgeSources(knowledgeSources.filter(source => source.id !== id));
    } catch (error) {
      console.error('Error deleting URL:', error);
      toast.error('Failed to delete URL');
    }
  };
  
  // Handle search functionality
  const handleSearch = async (query: string) => {
    if (!organization?.id) return;
    
    try {
      if (query.trim()) {
        const response = await searchOrganizationUrls(organization.id, query);
        
                  // Transform search results
          const transformedData = response.data.map((item: any) => ({
            id: item.id,
            url: item.url,
            lastModified: new Date(item.lastModified).toLocaleString('sv-SE', { 
              timeZone: 'UTC',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }).replace('T', ' '),
            result: item.result || 'Pending',
            status: item.status || 'Processing',
            error: item.error,
            contentLength: item.contentLength,
            title: item.title,
            blobPath: item.blobPath,
            addedBy: item.addedBy
          }));
        
        setKnowledgeSources(transformedData);
      } else {
        // If search is cleared, reload all data
        await loadKnowledgeSources();
      }
    } catch (error) {
      console.error('Error searching URLs:', error);
      toast.error('Failed to search URLs');
    }
  };
  
  // Update search query and trigger search
  const updateSearchQuery = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };
  
  // Filter knowledge sources based on selected status
  // This enables real-time filtering without API calls
  const filteredSources = knowledgeSources.filter(source => {
    const matchesStatus = selectedStatus === 'all' || source.status === selectedStatus;
    return matchesStatus;
  });
  
  // Get appropriate icon and styling based on result status
  // This provides visual feedback for different states
  const getStatusInfo = (result: string, status: string) => {
    switch (result) {
      case 'Success':
        return { 
          icon: CheckCircle, 
          color: styles.successText, 
          bgColor: styles.successBg 
        };
      case 'Failed':
        return { 
          icon: XCircle, 
          color: styles.errorText, 
          bgColor: styles.errorBg 
        };
      case 'Pending':
        return { 
          icon: Clock, 
          color: styles.pendingText, 
          bgColor: styles.pendingBg 
        };
      default:
        return { 
          icon: Clock, 
          color: styles.defaultText, 
          bgColor: styles.defaultBg 
        };
    }
  };

  // Start editing a URL
  const handleStartEdit = (source: KnowledgeSource) => {
    setEditingId(source.id);
    setEditingUrl(source.url);
    setEditingError('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingUrl('');
    setEditingError('');
  };

  // Handle editing URL input changes
  const handleEditingUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setEditingUrl(url);
    
    if (url && !validateUrl(url)) {
      setEditingError('Please enter a valid URL (must start with http:// or https://)');
    } else {
      setEditingError('');
    }
  };

  // Save edited URL
  const handleSaveEdit = async () => {
    if (!editingUrl.trim()) {
      setEditingError('URL is required');
      return;
    }
    
    if (!validateUrl(editingUrl)) {
      setEditingError('Please enter a valid URL');
      return;
    }
    
    if (!organization?.id || !editingId) {
      toast.error('Missing required information');
      return;
    }
    
    // Check if URL already exists (excluding the current one being edited)
    const urlExists = knowledgeSources.some(source => 
      source.url === editingUrl && source.id !== editingId
    );
    if (urlExists) {
      setEditingError('This URL is already in your knowledge sources');
      return;
    }
    
    try {
      setIsUpdating(true);
      await updateOrganizationUrl(editingId, organization.id, editingUrl);
      
      toast.success('URL updated successfully. Previous scraped data has been removed. Please refresh source to scrape the new page.');
      
      // Update local state - reset scraping-related fields since URL changed
      setKnowledgeSources(knowledgeSources.map(source => 
        source.id === editingId 
          ? { 
              ...source, 
              url: editingUrl, 
              lastModified: new Date().toLocaleString('sv-SE', { 
                timeZone: 'UTC',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }).replace('T', ' '),
              // Reset scraping-related fields since the URL has changed
              status: 'Processing',
              result: 'Pending',
              error: undefined,
              contentLength: undefined,
              title: undefined,
              blobPath: undefined
            }
          : source
      ));
      
      // Clear editing state
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating URL:', error);
      toast.error('Failed to update URL');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!organization) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.emptyState}>
          Please select an organization to manage knowledge sources.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <ToastContainer position="top-right" autoClose={3000} />
      
        {/* Add URL Section */}
        <div className={styles.addUrlSection}>
          <div className={styles.inputContainer}>
            <div className={styles.inputWrapper}>
              <input
                type="url"
                placeholder="Enter website URL to scrape (e.g., https://example.com)"
                value={newUrl}
                onChange={handleUrlChange}
                className={`${styles.urlInput} ${urlError ? styles.inputError : ''}`}
                disabled={isAdding}
              />
              {newUrl && (
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={() => {
                    setNewUrl('');
                    setUrlError('');
                  }}
                  title="Clear URL"
                  disabled={isAdding}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {urlError && (
              <p className={styles.errorText}>{urlError}</p>
            )}
          </div>
          
          {/* Advanced Mode Toggle */}
          <div className={styles.advancedToggleContainer}>
            <span className={styles.advancedToggleText}>Advanced Mode</span>
            <div className="form-check form-switch">
              <input
                className={`form-check-input ${styles.advancedToggle}`}
                type="checkbox"
                checked={isAdvancedMode}
                onChange={(e) => setIsAdvancedMode(e.target.checked)}
                disabled={isAdding}
              />
            </div>
          </div>
          
          <button
            onClick={handleAddUrl}
            disabled={!newUrl.trim() || !!urlError || isAdding}
            className={styles.addButton}
          >
            <Plus size={18} />
            <span>{isAdding ? 'Adding...' : 'Add URL'}</span>
          </button>
        </div>
        
        {/* Search and Filter Bar */}
        <div className={styles.searchFilterBar}>
          {/* Search Input */}
          <div className={styles.searchContainer}>
            <div className={styles.searchIcon}>
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search knowledge sources..."
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchButton}
                onClick={() => updateSearchQuery('')}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Status Filter Dropdown */}
          <div className={styles.filterContainer}>
            <button
              type="button"
              className={styles.filterButton}
              onClick={() => setShowStatusFilter(!showStatusFilter)}
            >
              <Filter size={16} className={styles.filterIcon} />
              {statusFilterOptions.find(opt => opt.value === selectedStatus)?.label || "Filter"}
            </button>

            {showStatusFilter && (
              <div className={styles.filterDropdown}>
                <div className={styles.dropdownContent}>
                  {statusFilterOptions.map(option => (
                    <button
                      key={option.value}
                      className={`${styles.dropdownItem} ${
                        selectedStatus === option.value ? styles.dropdownItemActive : ''
                      }`}
                      onClick={() => {
                        setSelectedStatus(option.value);
                        setShowStatusFilter(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Knowledge Sources */}
        <div className={styles.tableContainer}>
          {/* Header with Results Count */}
          <div className={styles.cardHeader}>
            <span>
              URL 
              {!isLoading && (
                <span className={styles.resultsCount}>
                  ({filteredSources.length} {filteredSources.length === 1 ? 'result' : 'results'})
                </span>
              )}
            </span>
            <span>Actions</span>
          </div>
          
          {/* Cards Container */}
          <div className={styles.cardsContainer}>
            {isLoading ? (
              <div className={styles.emptyState}>
                Loading knowledge sources...
              </div>
            ) : filteredSources.length === 0 ? (
              <div className={styles.emptyState}>
                {searchQuery ? 'No knowledge sources found matching your search.' : 'No knowledge sources found. Add your first URL above to get started.'}
              </div>
            ) : (
              filteredSources.map((source) => {
                const statusInfo = getStatusInfo(source.result, source.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div key={source.id} className={styles.card}>
                    <div className={styles.cardContent}>
                      <div className={styles.cardLeft}>
                        {editingId === source.id ? (
                          <div className={styles.editForm}>
                            <div className={styles.editInputWrapper}>
                              <input
                                type="url"
                                value={editingUrl}
                                onChange={handleEditingUrlChange}
                                className={`${styles.editInput} ${editingError ? styles.inputError : ''}`}
                                placeholder="Enter URL"
                                disabled={isUpdating}
                                autoFocus
                              />
                              {editingError && (
                                <p className={styles.errorText}>{editingError}</p>
                              )}
                            </div>
                            <div className={styles.editActions}>
                              <button
                                onClick={handleSaveEdit}
                                disabled={!editingUrl.trim() || !!editingError || isUpdating}
                                className={styles.saveButton}
                                title="Save URL changes. Previous scraped data will be removed."
                              >
                                {isUpdating ? 'Saving...' : 'Save'} 
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isUpdating}
                                className={styles.cancelButton}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={styles.cardUrl} title={source.url}>
                              {source.url}
                            </div>
                            <div className={styles.cardDetails}>
                              <div className={styles.cardStatus}>
                                <div className={`${styles.statusIcon} ${statusInfo.bgColor}`}>
                                  <StatusIcon size={14} />
                                </div>
                                <span className={`${styles.statusText} ${statusInfo.color}`}>
                                  {source.result}
                                </span>
                              </div>
                              <div className={styles.cardDate}>
                                {source.lastModified}
                              </div>
                              {source.addedBy && (
                                <div className={styles.cardAddedBy}>
                                  Added by: {source.addedBy.userName || 'Unknown User'}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className={styles.cardActions}>
                        <button 
                          onClick={() => handleRefresh(source.id)}
                          className={styles.actionButton}
                          title="Refresh source"
                          disabled={editingId === source.id}
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button 
                          onClick={() => handleStartEdit(source)}
                          className={styles.actionButton}
                          title="Edit source"
                          disabled={editingId !== null}
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(source.id)}
                          className={`${styles.actionButton} ${styles.deleteButton}`}
                          title="Delete source"
                          disabled={editingId === source.id}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
    </div>
  );
};

export default KnowledgeSources; 