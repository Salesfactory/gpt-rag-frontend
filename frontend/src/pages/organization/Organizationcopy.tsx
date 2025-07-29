import React, { useContext, useEffect, useRef, useState } from "react";
import { Label } from "@fluentui/react";
import { useAppContext } from "../../providers/AppProviders";
import styles from "./Organizationcopy.module.css";
import { updateOrganizationInfo } from "../../api";
import { ToastContainer, toast } from "react-toastify";
import { Spinner, SpinnerSize } from "@fluentui/react";
import { Globe, Save, Search, X, Plus } from "lucide-react";
import { scrapeUrls } from "../../api";

const Organization = () => {
    const { organization, setOrganization, user } = useAppContext();
    const expirationDate = new Date((organization?.subscriptionExpirationDate || 0) * 1000).toLocaleDateString();
    const [brandInformation, setBrandInformation] = useState(organization?.brandInformation || "");
    const [segmentSynonyms, setSegmentSynonyms] = useState(organization?.segmentSynonyms || "");
    const [industryInformation, setIndustryInformation] = useState(organization?.industryInformation || "");
    const [additionalInstructions, setAdditionalInstructions] = useState(organization?.additionalInstructions || "");
    const [isLoading, setIsLoading] = useState(false);
    
    // Web Indexing state 
    const [urlsToScrape, setUrlsToScrape] = useState<string[]>([]);
    const [currentUrl, setCurrentUrl] = useState("");
    const [isScraping, setIsScraping] = useState(false);

    const brandRef = useRef<HTMLTextAreaElement>(null);
    const industryRef = useRef<HTMLTextAreaElement>(null);
    const synonymRef = useRef<HTMLTextAreaElement>(null);
    const additionRef = useRef<HTMLTextAreaElement>(null);

    if (!organization) {
        return (
            <div>
                <p>No Organization</p>
            </div>
        );
    }

    const handleSaveChanges = async () => {
        setIsLoading(true);

        const patchData: any = {};
        patchData.brandInformation = brandInformation;
        patchData.industryInformation = industryInformation;
        patchData.segmentSynonyms = segmentSynonyms;
        patchData.additionalInstructions = additionalInstructions;
        try {
            await updateOrganizationInfo({ orgId: organization.id, patchData });
            toast("Changes saved correctly", { type: "success" });

            // Update the organization context with the new values
            if (organization && setOrganization) {
                setOrganization({
                    ...organization,
                    brandInformation: brandInformation,
                    industryInformation: industryInformation,
                    segmentSynonyms: segmentSynonyms,
                    additionalInstructions: additionalInstructions
                });
            }
        } catch (err: any) {
            toast("Error saving changes", { type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const addUrl = () => {
        const trimmedUrl = currentUrl.trim();
        
        if (!trimmedUrl) {
            toast("Please enter a URL", { type: "warning" });
            return;
        }

        // Validate URL format
        try {
            new URL(trimmedUrl);
        } catch {
            toast("Please enter a valid URL", { type: "error" });
            return;
        }

        // Check for duplicates
        if (urlsToScrape.includes(trimmedUrl)) {
            toast("URL already added", { type: "warning" });
            return;
        }

        setUrlsToScrape([...urlsToScrape, trimmedUrl]);
        setCurrentUrl("");
    };

    const removeUrl = (urlToRemove: string) => {
        setUrlsToScrape(urlsToScrape.filter(url => url !== urlToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addUrl();
        }
    };

    const handleScrapeUrls = async () => {
        if (urlsToScrape.length === 0) {
            toast("Please add at least one URL to scrape", { type: "warning" });
            return;
        }

        setIsScraping(true);

        try {
            // Process URLs individually since the API now handles single URLs
            const results = [];
            let successCount = 0;
            let failureCount = 0;

            for (const url of urlsToScrape) {
                try {
                    const result = await scrapeUrls(url, organization?.id, user);
                    results.push({ url, result, status: 'success' });
                    successCount++;
                } catch (error) {
                    console.error(`Error scraping ${url}:`, error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({ url, error: errorMessage, status: 'error' });
                    failureCount++;
                }
            }
            
            // Debug: Log the aggregated results
            console.log('Scraping results:', results);
            
            // Create a summary similar to the old format for consistency
            const scrapingData = {
                summary: {
                    total_urls: urlsToScrape.length,
                    successful_scrapes: successCount,
                    failed_scrapes: failureCount
                },
                results: results
            };
            
            // Track failed URLs for retry functionality
            const failedUrls: string[] = [];

            console.log('Scraping Summary:', {
                total: scrapingData.summary.total_urls,
                successful: successCount,
                failed: failureCount,
                summaryObject: scrapingData.summary
            });

            // Process individual results for detailed error reporting and failed URL tracking
            if (scrapingData?.results && Array.isArray(scrapingData.results)) {
                console.log('Processing individual results:', scrapingData.results);
                scrapingData.results.forEach((urlResult: any, index: number) => {
                    const url = urlResult.url;
                    console.log(`Result ${index + 1}:`, urlResult);
                    
                    if (urlResult.status === "error") {
                        // Add to failed URLs list for retry
                        if (!failedUrls.includes(url)) {
                            failedUrls.push(url);
                        }
                        
                        // Show individual error message
                        const errorMessage = urlResult.error || 'Unknown error';
                        toast(`Failed to scrape: ${url} - ${errorMessage}`, { 
                            type: "error",
                            autoClose: 8000,
                            position: "top-right"
                        });
                    }
                });
            } else {
                console.log('No individual results available or not an array');
            }

            // Fallback: if no summary data available, count from individual results
            if (!scrapingData?.summary && scrapingData?.results) {
                console.log('Using fallback counting from individual results');
                successCount = 0;
                failureCount = 0;
                
                scrapingData.results.forEach((urlResult: any) => {
                    if (urlResult.status === "success" || urlResult.status === "completed") {
                        successCount++;
                    } else if (urlResult.status === "error") {
                        failureCount++;
                    }
                });
                
                console.log('Fallback counts - Success:', successCount, 'Failed:', failureCount);
            }

            // Debug: Log final counts before deciding on message
            console.log('Final counts before message decision:', {
                successCount,
                failureCount,
                failedUrls,
                totalOriginalUrls: urlsToScrape.length
            });

            // Show overall summary based on actual results
            if (successCount > 0 && failureCount === 0) {
                console.log('Case: All successful');
                toast(`Successfully scraped all ${successCount} URL(s)`, { type: "success" });
                // Clear the URLs after successful scraping
                setUrlsToScrape([]);
            } else if (successCount > 0 && failureCount > 0) {
                console.log('Case: Mixed results');
                toast(`Scraped ${successCount} URL(s) successfully, ${failureCount} failed`, { 
                    type: "warning",
                    autoClose: 6000
                });
                // Keep only the failed URLs for retry
                setUrlsToScrape(failedUrls);
            } else if (failureCount > 0) {
                console.log('Case: All failed');
                toast(`All ${failureCount} URL(s) failed to scrape`, { type: "error" });
                // Keep failed URLs in the list for retry
                setUrlsToScrape(failedUrls);
            } else {
                console.log('Case: Unexpected - no clear success or failure');
                // Edge case: no clear success or failure data
                toast("Scraping completed, but unable to determine results", { type: "warning" });
                console.warn('Unexpected scraping result:', scrapingData);
            }
            
        } catch (err: any) {
            console.error('Scraping error:', err);
            toast(`Error scraping URLs: ${err.message}`, { type: "error" });
        } finally {
            setIsScraping(false);
        }
    };

    const autoResize = (ref: React.RefObject<HTMLTextAreaElement>) => {
        if (ref.current) {
            ref.current.style.height = "auto";
            ref.current.style.height = `${ref.current.scrollHeight}px`;
        }
    };

    useEffect(() => {
        autoResize(brandRef);
    }, [brandInformation]);

    useEffect(() => {
        autoResize(industryRef);
    }, [industryInformation]);

    useEffect(() => {
        autoResize(synonymRef);
    }, [segmentSynonyms]);

    useEffect(() => {
        autoResize(additionRef);
    }, [additionalInstructions]);

    return (
        <div className={styles.page_container}>
            <ToastContainer />
            <div className={styles.center}>
                <div className={styles.cardContainer}>
                    <div className={styles.title}>
                        <span>Organization</span> <Globe />
                    </div>
                    <div className={styles.card}>
                        <div className={styles.infoContainer}>
                            <div className={styles.infoItem}>
                                <Label className={styles.labelStyle}>Organization ID</Label>
                                <span className={styles.info}>{organization?.id} </span>
                            </div>
                        </div>
                        <div className={styles.infoContainer}>
                            <div className={styles.infoItem}>
                                <Label className={styles.labelStyle}>Organization Name</Label>
                                <span className={styles.info}>{organization?.name} </span>
                            </div>
                            <div className={styles.infoItem}>
                                <Label className={styles.labelStyle}>Organization Owner</Label>
                                <span className={styles.info}>{organization?.owner} </span>
                            </div>
                        </div>
                        <div className={styles.infoContainer}>
                            <div className={styles.infoItem}>
                                <Label className={styles.labelStyle}>Subscription ID</Label>
                                <span className={styles.info}>{organization?.subscriptionId} </span>
                            </div>
                        </div>
                        <div className={styles.infoContainer}>
                            <div className={styles.infoItem}>
                                <Label className={styles.labelStyle}>Subscription Status</Label>
                                <span className={styles.info}>
                                    <span className={styles.statusDotWrapper}>
                                        {organization?.subscriptionStatus}
                                        <span className={organization?.subscriptionStatus === "active" ? styles.statusDotActive : styles.statusDotInactive} />
                                    </span>
                                </span>
                            </div>
                            <div className={styles.infoItem}>
                                <Label className={styles.labelStyle}>Subscription Expiration</Label>
                                <span className={styles.info}>{expirationDate} </span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.cardContainer2}>
                        <div className={styles.title}>
                            <span>Business Information</span>
                        </div>
                        <div className={styles.card2}>
                            <div className={styles.editableContainer}>
                                <div className={styles.infoItem}>
                                    <Label className={styles.labelStyle}>Brand Description</Label>
                                    <textarea
                                        ref={brandRef}
                                        className={styles.textArea}
                                        placeholder="Describe your brand's identity, target audience, and unique value proposition. What makes your brand stand out?"
                                        value={brandInformation}
                                        onChange={e => setBrandInformation(e.target.value)}
                                    />
                                </div>
                                <div className={styles.infoItem}>
                                    <Label className={styles.labelStyle}>Business Description</Label>
                                    <textarea
                                        ref={industryRef}
                                        className={styles.textArea}
                                        placeholder="Describe your business's core services, industry, and target market."
                                        value={industryInformation}
                                        onChange={e => setIndustryInformation(e.target.value)}
                                    />
                                </div>
                                <div className={styles.infoItem}>
                                    <Label className={styles.labelStyle}>Additional Instructions</Label>
                                    <textarea
                                        ref={additionRef}
                                        className={styles.textArea}
                                        placeholder=""
                                        value={additionalInstructions}
                                        onChange={e => setAdditionalInstructions(e.target.value)}
                                    />
                                </div>
                                <div className={styles.infoItem}>
                                    <Label className={styles.labelStyle}>Segment Aliases</Label>
                                    <textarea
                                        ref={synonymRef}
                                        className={styles.textArea}
                                        placeholder="List synonyms or alternative names for your customer segments (e.g., 'Budget-Conscious Shoppers' -> 'Efficiency-Driven Decision Makers')."
                                        value={segmentSynonyms}
                                        onChange={e => setSegmentSynonyms(e.target.value)}
                                    />
                                </div>
                                <button className={styles.saveButton} onClick={handleSaveChanges} disabled={isLoading}>
                                    {isLoading ? (
                                        <Spinner size={SpinnerSize.small} label="Saving..." labelPosition="right" />
                                    ) : (
                                        <>
                                            <Save className={styles.icon} />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Organization;
