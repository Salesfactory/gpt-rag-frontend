import React, { useState, useEffect } from "react";
import { Search, Plus, ChevronDown, CheckCircle, XCircle, Clock, RefreshCw, Edit, Trash2, Filter, X, Info, ShieldOff } from "lucide-react";
import styles from "./KnowledgeSources.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { getOrganizationUrls, deleteOrganizationUrl, updateOrganizationUrl, searchOrganizationUrls, scrapeUrls, scrapeUrlsMultipage } from "../../api";
import { toast, ToastContainer } from "react-toastify";

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
    isDeleting?: boolean;
    isDeleted?: boolean;
    feedbackMessage?: string;
    feedbackType?: "success" | "error" | "warning" | "deleted";
}

const KnowledgeSources: React.FC = () => {
    const { organization, user } = useAppContext();

    // State for search functionality - stores the current search query
    const [searchQuery, setSearchQuery] = useState("");

    // State for status filter dropdown - controls visibility and selected value
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState("all");

    // State for adding new URLs - stores input value and validation errors
    const [newUrl, setNewUrl] = useState("");
    const [urlError, setUrlError] = useState("");

    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Knowledge sources from the backend
    const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);

    // State for editing URLs
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingUrl, setEditingUrl] = useState("");
    const [editingError, setEditingError] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    // State for advanced web scrape mode
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);

    // State for advanced mode hint visibility
    const [showAdvancedHint, setShowAdvancedHint] = useState(false);

    // Load data on component mount and when organization changes
    useEffect(() => {
        if (organization?.id) {
            loadKnowledgeSources();
        }
    }, [organization?.id]);

    const transformKnowledgeSources = (data: any[]) =>
        data.map((item: any) => ({
            id: item.id,
            url: item.url,
            lastModified: new Date(item.lastModified)
                .toLocaleString("sv-SE", {
                    timeZone: "UTC",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                })
                .replace("T", " "),
            result: item.result || "Pending",
            status: item.status || "Processing",
            error: item.error,
            contentLength: item.contentLength,
            title: item.title,
            blobPath: item.blobPath,
            addedBy: item.addedBy
        }));

    // Function to load knowledge sources from the backend
    const loadKnowledgeSources = async () => {
        if (!organization?.id) return;

        try {
            setIsLoading(true);
            const response = await getOrganizationUrls(organization.id);

            // Transform backend data to match frontend interface
            const transformedData = transformKnowledgeSources(response.data);

            setKnowledgeSources(transformedData);
            return transformedData;
        } catch (error) {
            console.error("Error loading knowledge sources:", error);
            toast.error("Failed to load knowledge sources");
        } finally {
            setIsLoading(false);
        }
    };

    // URL validation function using native URL constructor
    // This ensures the URL is properly formatted and uses http/https protocol
    const validateUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === "http:" || urlObj.protocol === "https:";
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
            setUrlError("Please enter a valid URL (must start with http:// or https://)");
        } else {
            setUrlError("");
        }
    };

    // Helper function to parse multipage scraping response
    const parseMultipageResponse = (scrapingResult: any, targetUrl: string) => {
        if (!scrapingResult) return { status: "error", error: "No response received" };

        // Check the overall status first - handle both 'completed' and 'success' from orchestrator
        if (scrapingResult.status === "error" || scrapingResult.status === "failed") {
            return { status: "error", error: scrapingResult.message || "Scraping failed" };
        }

        // Accept both 'success' and 'completed' as valid success statuses
        const isOverallSuccess = scrapingResult.status === "success" || scrapingResult.status === "completed";
        if (!isOverallSuccess) {
            return { status: "error", error: `Unexpected status: ${scrapingResult.status}` };
        }

        // Check blob storage result first to determine if content was successfully saved
        const blobResult = scrapingResult.blob_storage_result;
        if (blobResult?.status === "error") {
            const errorMessage = blobResult.message || "Blob storage failed - content could not be saved";
            return { status: "error", error: errorMessage };
        }

        // If blob storage was successful, we can consider this a success
        // Check for both successful_count (fallback structure) and successful_uploads (orchestrator structure)
        const hasSuccessfulUploads = blobResult?.successful_uploads && blobResult.successful_uploads.length > 0;
        const hasSuccessfulCount = blobResult?.successful_count > 0;

        if (blobResult?.status === "success" || hasSuccessfulUploads || hasSuccessfulCount) {
            return { status: "success", error: null };
        }

        // Check individual results for this specific URL as fallback
        const results = scrapingResult.results || [];
        const urlResult = results.find((result: any) => result.url === targetUrl);

        if (urlResult) {
            // If we found the URL in results but blob storage info is unclear,
            // check if we have raw_content (indicates successful scraping)
            if (urlResult.raw_content) {
                return { status: "success", error: null };
            } else if (urlResult.status === "error" || urlResult.status === "failed") {
                return { status: "error", error: urlResult.error || "URL scraping failed" };
            }
        }

        // If we have results but unclear blob storage status, check if any content was scraped
        if (results.length > 0 && results.some((result: any) => result.raw_content)) {
            return { status: "success", error: null };
        }

        // Default case - if we can't determine status, assume error for safety
        return { status: "error", error: "Unable to determine scraping status or blob storage failed" };
    };

    // Add new URL to the knowledge sources list with web scraping
    // This will trigger web scraping and automatically save the results with blob links to Cosmos
    const handleAddUrl = async () => {
        const urlToAdd = newUrl.trim();

        if (!urlToAdd) {
            setUrlError("URL is required");
            return;
        }

        if (!validateUrl(urlToAdd)) {
            setUrlError("Please enter a valid URL");
            return;
        }

        if (!organization?.id) {
            toast.error("No organization selected");
            return;
        }

        // Check if URL already exists to prevent duplicates
        const urlExists = knowledgeSources.some(source => source.url === urlToAdd);
        if (urlExists) {
            setUrlError("This URL is already in your knowledge sources");
            return;
        }

        // Create temporary ID for optimistic UI
        const tempId = `temp-${Date.now()}`;
        const errorRemovalDelayMs = 3000;

        try {
            setIsAdding(true);

            // Add URL optimistically with pending state
            const tempSource: KnowledgeSource = {
                id: tempId,
                url: urlToAdd,
                lastModified: new Date().toLocaleString("sv-SE", {
                    timeZone: "UTC",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                }).replace("T", " "),
                result: "Pending",
                status: "Processing",
                addedBy: {
                    userId: user?.id || "",
                    userName: user?.name || "You",
                    dateAdded: new Date().toISOString()
                }
            };

            setKnowledgeSources(prev => [tempSource, ...prev]);

            // Clear form immediately
            setNewUrl("");
            setUrlError("");

            // Now start scraping in background
            const scrapingResult = await (isAdvancedMode ? scrapeUrlsMultipage(urlToAdd, organization.id, user) : scrapeUrls(urlToAdd, organization.id, user));

            // Check for top-level API errors (website blocked, network errors, etc.)
            if (scrapingResult?.error_type) {
                const messageMap: Record<string, { message: string; type: "error" | "warning" }> = {
                    website_blocked: {
                        message: "This website has restrictions that prevent scraping. Access denied.",
                        type: "warning"
                    },
                    network_error: {
                        message: "Failed to scrape this page. Connection error. Please try again later.",
                        type: "error"
                    },
                    system_error: {
                        message: "Failed to scrape this page. The server returned an error. Please try again later.",
                        type: "error"
                    }
                };

                const feedback = messageMap[scrapingResult.error_type] || messageMap.system_error;

                // Update with error message
                setKnowledgeSources(prev => prev.map(source =>
                    source.id === tempId
                        ? {
                            ...source,
                            result: "Failed",
                            status: "Error",
                            feedbackMessage: feedback.message,
                            feedbackType: feedback.type
                        }
                        : source
                ));

                // Remove row after 3 seconds for errors
                setTimeout(() => {
                    setKnowledgeSources(prev => prev.filter(s => s.id !== tempId));
                }, errorRemovalDelayMs);

                return;
            }

            let urlResult: any;

            if (isAdvancedMode) {
                urlResult = parseMultipageResponse(scrapingResult, urlToAdd);
            } else {
                const results = scrapingResult?.results || [];
                urlResult = results.find((result: any) => result.url === urlToAdd);

                if (urlResult && urlResult.status === "success") {
                    const blobStatus = scrapingResult?.blob_storage_result?.status;
                    if (blobStatus !== "success") {
                        urlResult = { ...urlResult, status: "error", error: "Blob storage failed" };
                    }
                }
            }

            if (urlResult?.status === "error") {
                setKnowledgeSources(prev => prev.map(source =>
                    source.id === tempId
                        ? {
                            ...source,
                            result: "Failed",
                            status: "Error",
                            feedbackMessage: urlResult.error || "Failed to process scraped content",
                            feedbackType: "error"
                        }
                        : source
                ));

                setTimeout(() => {
                    setKnowledgeSources(prev => prev.filter(s => s.id !== tempId));
                }, errorRemovalDelayMs);
                return;
            }

            const sourcesResponse = await getOrganizationUrls(organization.id);
            const transformedData = transformKnowledgeSources(sourcesResponse.data);
            const addedSource = sourcesResponse.data.find((item: any) => item.url === urlToAdd);

            if (!addedSource) {
                setKnowledgeSources(prev => prev.map(source =>
                    source.id === tempId
                        ? {
                            ...source,
                            result: "Failed",
                            status: "Error",
                            feedbackMessage: "Failed to save this URL. Please try again.",
                            feedbackType: "error"
                        }
                        : source
                ));

                setTimeout(() => {
                    setKnowledgeSources(prev => prev.filter(s => s.id !== tempId));
                }, errorRemovalDelayMs);
                return;
            }

            const addedId = addedSource.id;

            // Success
            setKnowledgeSources(
                transformedData.map(source =>
                    source.id === addedId
                        ? {
                            ...source,
                            feedbackMessage: "Content successfully scraped. It may take 2-5 minutes to become searchable.",
                            feedbackType: "success"
                        }
                        : source
                )
            );

            // Clear success message after 5 seconds
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s =>
                    s.id === addedId ? { ...s, feedbackMessage: undefined } : s
                ));
            }, 5000);
        } catch (error) {
            console.error("Error adding and scraping URL:", error);
            // Remove temp entry on error
            setKnowledgeSources(prev => prev.filter(s => s.id !== tempId));
            toast.error("Failed to add URL");
        } finally {
            setIsAdding(false);
        }
    };

    // Refresh a knowledge source by re-scraping its URL
    const handleRefresh = async (id: string) => {
        if (!organization?.id) {
            setKnowledgeSources(prev => prev.map(source =>
                source.id === id
                    ? { ...source, feedbackMessage: "No organization selected", feedbackType: "error" }
                    : source
            ));
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
            }, 3000);
            return;
        }

        const sourceToRefresh = knowledgeSources.find(source => source.id === id);
        if (!sourceToRefresh) {
            return;
        }

        try {
            // Update to show processing status
            setKnowledgeSources(prev => prev.map(source =>
                source.id === id
                    ? { ...source, status: "Processing", result: "Pending", feedbackMessage: undefined }
                    : source
            ));

            // Re-scrape the URL
            const scrapingResult = await (isAdvancedMode
                ? scrapeUrlsMultipage(sourceToRefresh.url, organization.id, user)
                : scrapeUrls(sourceToRefresh.url, organization.id, user));

            // Reload data
            await loadKnowledgeSources();

            // Check for API errors
            if (scrapingResult?.error_type) {
                const messageMap: Record<string, { message: string; type: "error" | "warning" }> = {
                    website_blocked: {
                        message: "This website has restrictions that prevent scraping. Access denied.",
                        type: "warning"
                    },
                    network_error: {
                        message: "Failed to scrape this page. Connection error. Please try again later.",
                        type: "error"
                    },
                    system_error: {
                        message: "Failed to scrape this page. The server returned an error. Please try again later.",
                        type: "error"
                    }
                };

                const feedback = messageMap[scrapingResult.error_type] || messageMap.system_error;

                setKnowledgeSources(prev => prev.map(source =>
                    source.id === id
                        ? {
                            ...source,
                            result: feedback.type === "warning" ? "Failed" : "Failed",
                            status: feedback.type === "warning" ? "Error" : "Error",
                            feedbackMessage: feedback.message,
                            feedbackType: feedback.type
                        }
                        : source
                ));

                // Clear message after 5 seconds
                setTimeout(() => {
                    setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
                }, 5000);
                return;
            }

            let urlResult: any;

            if (isAdvancedMode) {
                urlResult = parseMultipageResponse(scrapingResult, sourceToRefresh.url);
            } else {
                const results = scrapingResult?.results || [];
                urlResult = results.find((result: any) => result.url === sourceToRefresh.url);

                if (urlResult && urlResult.status === "success") {
                    const blobStatus = scrapingResult?.blob_storage_result?.status;
                    if (blobStatus !== "success") {
                        urlResult = { ...urlResult, status: "error", error: "Blob storage failed" };
                    }
                }
            }

            if (urlResult?.status === "error") {
                setKnowledgeSources(prev => prev.map(source =>
                    source.id === id
                        ? {
                            ...source,
                            result: "Failed",
                            status: "Error",
                            feedbackMessage: urlResult.error || "Failed to process scraped content",
                            feedbackType: "error"
                        }
                        : source
                ));

                setTimeout(() => {
                    setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
                }, 5000);
            } else {
                // Success
                setKnowledgeSources(prev => prev.map(source =>
                    source.id === id
                        ? {
                            ...source,
                            feedbackMessage: "Content refreshed. It may take 2-5 minutes to become searchable.",
                            feedbackType: "success"
                        }
                        : source
                ));

                setTimeout(() => {
                    setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
                }, 5000);
            }
        } catch (error) {
            setKnowledgeSources(prev => prev.map(source =>
                source.id === id
                    ? {
                        ...source,
                        feedbackMessage: "An unexpected error occurred",
                        feedbackType: "error"
                    }
                    : source
            ));

            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
            }, 5000);
        }
    };

    // Delete a knowledge source
    const handleDelete = async (id: string) => {
        if (!organization?.id) {
            // Show error inline
            setKnowledgeSources(knowledgeSources.map(source =>
                source.id === id
                    ? { ...source, feedbackMessage: "No organization selected", feedbackType: "error" }
                    : source
            ));
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
            }, 3000);
            return;
        }

        // Step 1: Mark as deleting (dims and shrinks)
        setKnowledgeSources(knowledgeSources.map(source =>
            source.id === id ? { ...source, isDeleting: true } : source
        ));

        try {
            await deleteOrganizationUrl(id, organization.id);

            // Step 2: After 300ms, mark as deleted and show message
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(source =>
                    source.id === id
                        ? {
                            ...source,
                            isDeleting: false,
                            isDeleted: true,
                            feedbackMessage: "This URL has been removed from your knowledge sources",
                            feedbackType: "deleted"
                        }
                        : source
                ));

                // Step 3: Remove from list after 3 seconds
                setTimeout(() => {
                    setKnowledgeSources(prev => prev.filter(source => source.id !== id));
                }, 3000);
            }, 300);

        } catch (error) {
            console.error("Error deleting URL:", error);
            // Show error and restore row
            setKnowledgeSources(prev => prev.map(source =>
                source.id === id
                    ? {
                        ...source,
                        isDeleting: false,
                        feedbackMessage: "Failed to delete URL. Please try again.",
                        feedbackType: "error"
                    }
                    : source
            ));
            // Clear error after 3s
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s => s.id === id ? { ...s, feedbackMessage: undefined } : s));
            }, 3000);
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
                    lastModified: new Date(item.lastModified)
                        .toLocaleString("sv-SE", {
                            timeZone: "UTC",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                        })
                        .replace("T", " "),
                    result: item.result || "Pending",
                    status: item.status || "Processing",
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
            console.error("Error searching URLs:", error);
            toast.error("Failed to search URLs");
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
        const matchesStatus = selectedStatus === "all" || source.status === selectedStatus;
        return matchesStatus;
    });

    // Get appropriate icon and styling based on result status
    const getStatusInfo = (result: string, feedbackType?: string) => {
        if (feedbackType === "warning") {
            return {
                icon: ShieldOff,
                color: styles.blockedText,
                bgColor: styles.blockedBg,
                label: "Blocked"
            };
        }
        if (feedbackType === "deleted") {
            return {
                icon: Clock,
                color: styles.deletedText,
                bgColor: styles.deletedBg,
                label: "Deleted"
            };
        }
        if (feedbackType === "error") {
            return {
                icon: XCircle,
                color: styles.errorText,
                bgColor: styles.errorBg,
                label: "Error"
            };
        }

        switch (result) {
            case "Success":
                return {
                    icon: CheckCircle,
                    color: styles.successText,
                    bgColor: styles.successBg,
                    label: "Success"
                };
            case "Failed":
                return {
                    icon: XCircle,
                    color: styles.errorText,
                    bgColor: styles.errorBg,
                    label: "Error"
                };
            case "Pending":
                return {
                    icon: Clock,
                    color: styles.pendingText,
                    bgColor: styles.pendingBg,
                    label: "Pending"
                };
            default:
                return {
                    icon: Clock,
                    color: styles.defaultText,
                    bgColor: styles.defaultBg,
                    label: "Pending"
                };
        }
    };

    // Start editing a URL
    const handleStartEdit = (source: KnowledgeSource) => {
        setEditingId(source.id);
        setEditingUrl(source.url);
        setEditingError("");
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingUrl("");
        setEditingError("");
    };

    // Handle editing URL input changes
    const handleEditingUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setEditingUrl(url);

        if (url && !validateUrl(url)) {
            setEditingError("Please enter a valid URL (must start with http:// or https://)");
        } else {
            setEditingError("");
        }
    };

    // Save edited URL
    const handleSaveEdit = async () => {
        if (!editingUrl.trim()) {
            setEditingError("URL is required");
            return;
        }

        if (!validateUrl(editingUrl)) {
            setEditingError("Please enter a valid URL");
            return;
        }

        if (!organization?.id || !editingId) {
            toast.error("Missing required information");
            return;
        }

        // Check if URL already exists (excluding the current one being edited)
        const urlExists = knowledgeSources.some(source => source.url === editingUrl && source.id !== editingId);
        if (urlExists) {
            setEditingError("This URL is already in your knowledge sources");
            return;
        }

        try {
            setIsUpdating(true);
            await updateOrganizationUrl(editingId, organization.id, editingUrl);

            // Update local state - reset scraping-related fields since URL changed
            setKnowledgeSources(
                knowledgeSources.map(source =>
                    source.id === editingId
                        ? {
                              ...source,
                              url: editingUrl,
                              lastModified: new Date()
                                  .toLocaleString("sv-SE", {
                                      timeZone: "UTC",
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                  })
                                  .replace("T", " "),
                              // Reset scraping-related fields since the URL has changed
                              status: "Processing",
                              result: "Pending",
                              error: undefined,
                              contentLength: undefined,
                              title: undefined,
                              blobPath: undefined
                          }
                        : source
                )
            );

            // Clear editing state
            handleCancelEdit();

            // Show inline success message
            setKnowledgeSources(prev => prev.map(source =>
                source.id === editingId
                    ? {
                        ...source,
                        feedbackMessage: "URL updated. Refresh the source to scrape the new page.",
                        feedbackType: "success"
                    }
                    : source
            ));

            // Clear after 5 seconds
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s =>
                    s.id === editingId ? { ...s, feedbackMessage: undefined } : s
                ));
            }, 5000);
        } catch (error) {
            console.error("Error updating URL:", error);
            // Show inline error
            setKnowledgeSources(prev => prev.map(source =>
                source.id === editingId
                    ? {
                        ...source,
                        feedbackMessage: "Failed to update URL",
                        feedbackType: "error"
                    }
                    : source
            ));

            // Clear after 5 seconds
            setTimeout(() => {
                setKnowledgeSources(prev => prev.map(s =>
                    s.id === editingId ? { ...s, feedbackMessage: undefined } : s
                ));
            }, 5000);
        } finally {
            setIsUpdating(false);
        }
    };

    if (!organization) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.emptyState}>Please select an organization to manage knowledge sources.</div>
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
                            className={`${styles.urlInput} ${urlError ? styles.inputError : ""}`}
                            disabled={isAdding}
                        />
                        {newUrl && (
                            <button
                                type="button"
                                className={styles.clearButton}
                                onClick={() => {
                                    setNewUrl("");
                                    setUrlError("");
                                }}
                                title="Clear URL"
                                disabled={isAdding}
                                aria-label="Clear URL"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {urlError && <p className={styles.errorText}>{urlError}</p>}
                </div>

                {/* Advanced Mode Toggle */}
                <div className={styles.advancedToggleContainer}>
                    <span className={styles.advancedToggleText}>Advanced</span>
                    <div className={styles.advancedToggleRow}>
                        <div className="form-check form-switch">
                            <input
                                className={`form-check-input ${styles.advancedToggle}`}
                                type="checkbox"
                                checked={isAdvancedMode}
                                onChange={e => setIsAdvancedMode(e.target.checked)}
                                disabled={isAdding}
                            />
                        </div>
                        <div className={styles.advancedHintWrapper}>
                            <button
                                onMouseEnter={() => setShowAdvancedHint(true)}
                                onMouseLeave={() => setShowAdvancedHint(false)}
                                onFocus={() => setShowAdvancedHint(true)}
                                onBlur={() => setShowAdvancedHint(false)}
                                className={styles.advancedHintButton}
                                aria-label="Advanced mode information"
                            >
                                <Info size={16} />
                            </button>
                            {showAdvancedHint && (
                                <div className={styles.advancedHintPopover}>
                                    <div className={styles.advancedHintPopoverInner}>
                                        <div className={styles.advancedHintPopoverArrow}></div>
                                        <p className={styles.advancedHintTitle}>Advanced Mode</p>
                                        <p className={styles.advancedHintText}>Crawls up to 20 subpages from each URL for deeper content extraction.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <button onClick={handleAddUrl} disabled={!newUrl.trim() || !!urlError || isAdding} className={styles.addButton} aria-label={isAdding ? "Adding" : "Add URL"}>
                    <Plus size={18} />
                    <span>{isAdding ? "Adding..." : "Add URL"}</span>
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
                        onChange={e => updateSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                    {searchQuery && (
                        <button type="button" className={styles.clearSearchButton} onClick={() => updateSearchQuery("")} title="Clear search" aria-label="Clear Search" >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Status Filter Dropdown */}
                <div className={styles.filterContainer}>
                    <button type="button" className={styles.filterButton} onClick={() => setShowStatusFilter(!showStatusFilter)} aria-label="Filter">
                        <Filter size={16} className={styles.filterIcon} />
                        {statusFilterOptions.find(opt => opt.value === selectedStatus)?.label || "Filter"}
                    </button>

                    {showStatusFilter && (
                        <div className={styles.filterDropdown}>
                            <div className={styles.dropdownContent}>
                                {statusFilterOptions.map(option => (
                                    <button
                                        aria-label={option.value}
                                        key={option.value}
                                        className={`${styles.dropdownItem} ${selectedStatus === option.value ? styles.dropdownItemActive : ""}`}
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
                                ({filteredSources.length} {filteredSources.length === 1 ? "result" : "results"})
                            </span>
                        )}
                    </span>
                    <span>Actions</span>
                </div>

                {/* Cards Container */}
                <div className={styles.cardsContainer}>
                    {isLoading ? (
                        <div className={styles.emptyState}>Loading knowledge sources...</div>
                    ) : filteredSources.length === 0 ? (
                        <div className={styles.emptyState}>
                            {searchQuery
                                ? "No knowledge sources found matching your search."
                                : "No knowledge sources found. Add your first URL above to get started."}
                        </div>
                    ) : (
                        filteredSources.map(source => {
                            const statusInfo = getStatusInfo(source.result, source.feedbackType);
                            const StatusIcon = statusInfo.icon;
                            const isPending = source.status === "Processing" || source.result === "Pending";
                            const showProcessingMessage = isPending && !source.feedbackMessage;

                            return (
                                <div key={source.id}>
                                <div
                                    className={`${styles.card} ${source.isDeleting ? styles.cardDeleting : ''} ${source.isDeleted ? styles.cardDeleted : ''}`}
                                >
                                    <div className={styles.cardContent}>
                                        <div className={styles.cardLeft}>
                                            {editingId === source.id ? (
                                                <div className={styles.editForm}>
                                                    <div className={styles.editInputWrapper}>
                                                        <input
                                                            type="url"
                                                            value={editingUrl}
                                                            onChange={handleEditingUrlChange}
                                                            className={`${styles.editInput} ${editingError ? styles.inputError : ""}`}
                                                            placeholder="Enter URL"
                                                            disabled={isUpdating}
                                                            autoFocus
                                                        />
                                                        {editingError && <p className={styles.errorText}>{editingError}</p>}
                                                    </div>
                                                    <div className={styles.editActions}>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            disabled={!editingUrl.trim() || !!editingError || isUpdating}
                                                            className={styles.saveButton}
                                                            title="Save URL changes. Previous scraped data will be removed."
                                                            aria-label={isUpdating ? "loading..." : "save"}
                                                        >
                                                            {isUpdating ? "Saving..." : "Save"}
                                                        </button>
                                                        <button onClick={handleCancelEdit} disabled={isUpdating} className={styles.cancelButton} aria-label="Cancel">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={`${styles.cardUrl} ${source.isDeleted ? styles.cardUrlDeleted : ''}`} title={source.url}>
                                                        {source.url}
                                                    </div>
                                                    <div className={styles.cardDetails}>
                                                        <div className={styles.cardStatus}>
                                                            <div className={`${styles.statusIcon} ${statusInfo.bgColor}`}>
                                                                <StatusIcon size={14} />
                                                            </div>
                                                            <span className={`${styles.statusText} ${statusInfo.color}`}>{statusInfo.label}</span>
                                                        </div>
                                                        <div className={styles.cardDate}>{source.lastModified}</div>
                                                        {source.addedBy && (
                                                            <div className={styles.cardAddedBy}>Added by: {source.addedBy.userName || "Unknown User"}</div>
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
                                                aria-label="Refresh"
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleStartEdit(source)}
                                                className={styles.actionButton}
                                                title="Edit source"
                                                disabled={editingId !== null}
                                                aria-label="Edit Source"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(source.id)}
                                                className={`${styles.actionButton} ${styles.deleteButton}`}
                                                title="Delete source"
                                                disabled={editingId === source.id}
                                                aria-label="Delete source"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Processing or Feedback Message */}
                                {showProcessingMessage && (
                                    <div className={`${styles.feedbackMessage} ${styles.feedbackProcessing}`}>
                                        <Clock size={14} className={styles.feedbackIcon} />
                                        Scraping in progress...
                                    </div>
                                )}
                                {source.feedbackMessage && (
                                    <div
                                        className={`${styles.feedbackMessage} ${
                                            source.feedbackType === "success"
                                                ? styles.feedbackSuccess
                                                : source.feedbackType === "warning"
                                                ? styles.feedbackWarning
                                                : source.feedbackType === "deleted"
                                                ? styles.feedbackDeleted
                                                : styles.feedbackError
                                        }`}
                                    >
                                        {source.feedbackType === "success" && <CheckCircle size={16} className={styles.feedbackIcon} />}
                                        {source.feedbackType === "warning" && <ShieldOff size={16} className={styles.feedbackIcon} />}
                                        {source.feedbackType === "error" && <XCircle size={16} className={styles.feedbackIcon} />}
                                        {source.feedbackType === "deleted" && <CheckCircle size={16} className={styles.feedbackIcon} />}
                                        {source.feedbackMessage}
                                    </div>
                                )}
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
