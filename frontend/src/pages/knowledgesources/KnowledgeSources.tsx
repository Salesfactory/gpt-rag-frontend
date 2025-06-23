import React, { useState } from 'react';
import { Search, Plus, ChevronDown, CheckCircle, XCircle, Clock, RefreshCw, Edit, Trash2, Filter } from 'lucide-react';
import styles from './KnowledgeSources.module.css';

const statusFilterOptions = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Processing", value: "Processing" },
  { label: "Error", value: "Error" }
];

const KnowledgeSources: React.FC = () => {
  // State for search functionality - stores the current search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for status filter dropdown - controls visibility and selected value
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // State for adding new URLs - stores input value and validation errors
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  
  // Mock data representing knowledge sources with different statuses
  // In a real app, this would come from an API or global state management
  const [knowledgeSources, setKnowledgeSources] = useState([
    { 
      id: 1, 
      url: 'https://docs.anthropic.com/claude/docs', 
      lastUpdate: '2025-06-18 09:30', 
      result: 'Success',
      status: 'Active'
    },
    { 
      id: 2, 
      url: 'https://react.dev/learn', 
      lastUpdate: '2025-06-18 08:15', 
      result: 'Success',
      status: 'Active'
    },
    { 
      id: 3, 
      url: 'https://tailwindcss.com/docs', 
      lastUpdate: '2025-06-17 14:22', 
      result: 'Failed',
      status: 'Error'
    },
    { 
      id: 4, 
      url: 'https://nextjs.org/docs', 
      lastUpdate: '2025-06-17 11:45', 
      result: 'Success',
      status: 'Active'
    }
  ]);
  
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
  
  // Add new URL to the knowledge sources list
  // Includes validation and duplicate checking
  const handleAddUrl = () => {
    if (!newUrl.trim()) {
      setUrlError('URL is required');
      return;
    }
    
    if (!validateUrl(newUrl)) {
      setUrlError('Please enter a valid URL');
      return;
    }
    
    // Check if URL already exists to prevent duplicates
    const urlExists = knowledgeSources.some(source => source.url === newUrl);
    if (urlExists) {
      setUrlError('This URL is already in your knowledge sources');
      return;
    }
    
    // Create new source object with current timestamp
    const newSource = {
      id: Date.now(), // Simple ID generation using timestamp
      url: newUrl,
      lastUpdate: new Date().toLocaleString('sv-SE', { 
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace('T', ' '),
      result: 'Pending',
      status: 'Processing'
    };
    
    // Add to beginning of array and clear form
    setKnowledgeSources([newSource, ...knowledgeSources]);
    setNewUrl('');
    setUrlError('');
  };
  
  // Simulate refreshing a knowledge source
  // In a real app, this would trigger an API call to re-crawl the URL
  const handleRefresh = (id: number) => {
    // First, set status to processing
    setKnowledgeSources(prevSources => 
      prevSources.map(source => 
        source.id === id 
          ? {
              ...source,
              lastUpdate: new Date().toLocaleString('sv-SE', { 
                timeZone: 'UTC',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }).replace('T', ' '),
              result: 'Pending',
              status: 'Processing'
            }
          : source
      )
    );
    
    // Simulate processing time with random result
    setTimeout(() => {
      setKnowledgeSources(prevSources => 
        prevSources.map(source => 
          source.id === id 
            ? {
                ...source,
                result: Math.random() > 0.2 ? 'Success' : 'Failed',
                status: Math.random() > 0.2 ? 'Active' : 'Error'
              }
            : source
        )
      );
    }, 2000);
  };
  
  // Delete a knowledge source by filtering it out of the array
  const handleDelete = (id: number) => {
    setKnowledgeSources(knowledgeSources.filter(source => source.id !== id));
  };
  
  // Filter knowledge sources based on search query and selected status
  // This enables real-time filtering without API calls
  const filteredSources = knowledgeSources.filter(source => {
    const matchesSearch = source.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || source.status === selectedStatus;
    return matchesSearch && matchesStatus;
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

  return (
    <div className={styles.pageContainer}>
        {/* Add URL Section */}
        <div className={styles.addUrlSection}>
          <div className={styles.inputContainer}>
            <input
              type="url"
              placeholder="Enter website URL (e.g., https://example.com)"
              value={newUrl}
              onChange={handleUrlChange}
              className={`${styles.urlInput} ${urlError ? styles.inputError : ''}`}
            />
            {urlError && (
              <p className={styles.errorText}>{urlError}</p>
            )}
          </div>
          <button
            onClick={handleAddUrl}
            disabled={!newUrl.trim() || !!urlError}
            className={styles.addButton}
          >
            <Plus size={18} />
            <span>Add URL</span>
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
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
        
        {/* Knowledge Sources Table */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.tableHeader}>URL</th>
                <th className={styles.tableHeader}>Last Update</th>
                <th className={styles.tableHeader}>Result</th>
                <th className={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((source, index) => {
                const statusInfo = getStatusInfo(source.result, source.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <tr 
                    key={source.id} 
                    className={`${styles.tableRow} ${index % 2 === 0 ? styles.evenRow : styles.oddRow}`}
                  >
                    <td className={styles.tableCell}>
                      <div className={styles.urlText} title={source.url}>
                        {source.url}
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.dateText}>{source.lastUpdate}</div>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.statusContainer}>
                        <div className={`${styles.statusIcon} ${statusInfo.bgColor}`}>
                          <StatusIcon />
                        </div>
                        <span className={`${styles.statusText} ${statusInfo.color}`}>
                          {source.result}
                        </span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.actionsContainer}>
                        <button 
                          onClick={() => handleRefresh(source.id)}
                          className={styles.actionButton}
                          title="Refresh source"
                        >
                          <RefreshCw size={18} />
                        </button>
                        <button 
                          className={styles.actionButton}
                          title="Edit source"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(source.id)}
                          className={`${styles.actionButton} ${styles.deleteButton}`}
                          title="Delete source"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredSources.length === 0 && (
            <div className={styles.emptyState}>
              No knowledge sources found. Add your first URL above to get started.
            </div>
          )}
        </div>
    </div>
  );
};

export default KnowledgeSources; 