import React, { useEffect, useState, useRef } from "react";
import styles from "./SubscriptionManagementcopy.module.css";
import { Label, Spinner, Dropdown, IconButton, SpinnerSize } from "@fluentui/react";
import { useAppContext } from "../../providers/AppProviders";
import {
    createCustomerPortalSession,
    getCustomerId,
    changeSubscription,
    getProductPrices,
    getLogs,
    getSubscriptionTierDetails,
    createCheckoutSession
} from "../../api";
import { IconX } from "@tabler/icons-react";
import { ChartPerson48Regular } from "@fluentui/react-icons";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Bell, Clock, CreditCard, Eye, Info } from "lucide-react";

const SubscriptionManagement: React.FC = () => {
    const { user, organization, organizationUsage, subscriptionTiers } = useAppContext();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isErrorModal, setIsErrorModal] = useState(false);
    const [isViewModal, setIsViewModal] = useState(false);
    const [subscriptionName, setSusbscriptionName] = useState("");
    const [prices, setPrices] = useState<any[]>([]);
    const [isConfirmationModal, setIsConfirmationModal] = useState(false);
    const [selectedSubscriptionName, setSelectedSubscriptionName] = useState("");
    const [selectedSubscriptionID, setSelectedSubscriptionID] = useState("");
    const [isRecentChangesModal, setIsRecentChangesModal] = useState<Boolean>(false);
    const [recentChangesLoading, setRecentChangesLoading] = useState<Boolean>(false);
    const [logsData, setLogsData] = useState<any>([]);
    const [filteredLogsData, setFilteredLogsData] = useState<any>();
    const [currentPage, setCurrentPage] = useState(1);
    const [paginatedLogs, setPaginatedLogs] = useState<any>();
    const expirationDate = new Date((organization?.subscriptionExpirationDate || 0) * 1000).toLocaleDateString();
    const organizationId = organization?.id || "";

    const rowsPerPage = 5;

    const FilterMapping = {
        "All actions": null,
        "Subscription Tier": "Subscription Tier Change",
        "Subscription Created": "Subscription Created"
    };

    const FilterOptions = [
        { key: "1", text: "All Actions" },
        { key: "2", text: "Subscription Tier" },
        { key: "3", text: "Subscription Created" }
    ];

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const options: Intl.DateTimeFormatOptions = {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        };
        return date.toLocaleString("en-US", options).replace(",", "");
    };

    const [dataLoad, setDataLoad] = useState(false);
    const [isSubscriptionChangeModal, setIsSubscriptionChangeModal] = useState(false);

    const msExpirationDate = new Date((organizationUsage?.currentPeriodEnds || 0) * 1000);
    const actualDate = new Date();
    const remainingTime = msExpirationDate.getTime() - actualDate.getTime();
    const daysRemaining = Math.ceil(remainingTime / (1000 * 3600 * 24));
    const [isLoading, setIsLoading] = useState(false);
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 700);
    const [mobilePage, setMobilePage] = useState(1);

    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            try {
                const tierDetails = await getSubscriptionTierDetails(organizationUsage?.policy.tierId || "");
                setSusbscriptionName(tierDetails.tier_name || "");
            } catch (error: any) {
                console.log(error);
                setError("An error occurred while fetching subscription status.");
                setIsErrorModal(true);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [dataLoad]);

    useEffect(() => {
        async function fetchPrices() {
            try {
                const data = await getProductPrices({ user });
                const sortedPrices = data.prices.sort((a: any, b: any) => a.unit_amount - b.unit_amount);
                setPrices(sortedPrices);
            } catch (err) {
                console.error("Failed to fetch product prices:", err);
                setError("Unable to fetch product prices. Please try again later.");
                setIsErrorModal(true);
            }
        }

        fetchPrices();
    }, [dataLoad]);

    const handleViewSubscription = () => {
        setIsViewModal(true);
    };

    const handleSelectedSubscription = (priceNickname: string, priceID: string) => {
        setSelectedSubscriptionName(priceNickname);
        setSelectedSubscriptionID(priceID);
        setIsConfirmationModal(true);
    };

    const handleRecentChangesModal = async () => {
        setIsRecentChangesModal(true);
        setRecentChangesLoading(true);
        try {
            const logs = await getLogs(organizationId);
            setLogsData(logs);
            setFilteredLogsData(logs);
            setPaginatedLogs(logs.slice(0, rowsPerPage));
            setCurrentPage(1);
        } catch (error) {
            console.error("Error trying to get logs: ", error);
            setError("Error trying to get logs: ");
            setIsErrorModal(true);
        } finally {
            setRecentChangesLoading(false);
        }
    };

    const handleFilterChange = (event: any, selectedOption: any) => {
        const actionFilter = FilterMapping[(selectedOption?.text as keyof typeof FilterMapping) || "All actions"];
        const filteredLogs = actionFilter ? logsData.filter((log: any) => log.action === actionFilter) : logsData;
        setFilteredLogsData(filteredLogs);
        setPaginatedLogs(filteredLogs.slice(0, rowsPerPage)); // Reset pagination
        setCurrentPage(1); // Reset pagination
    };

    const handlePagination = (page: number) => {
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        setPaginatedLogs(filteredLogsData.slice(startIndex, endIndex));
        setCurrentPage(page); // Update the current page
    };

    const handleCreateCustomerPortal = async () => {
        try {
            const customerId = await getCustomerId({
                subscriptionId: organization?.subscriptionId ?? ""
            });
            const { url } = await createCustomerPortalSession({
                customerId: customerId,
                subscription_id: organization?.subscriptionId ?? "",
                return_url: window.location.origin + "/#/subscription-management"
            });

            window.location.href = url;
        } catch (error) {
            toast("Failed to create the customer portal link. Please try again.", { type: "warning" });
        } finally {
            setIsConfirmationModal(false);
            setIsViewModal(false);
        }
    };

    const handleChangeSubscription = async (priceId: string) => {
        let timer: NodeJS.Timeout;
        setIsLoading(true);
        try {
            await changeSubscription({
                subscriptionId: organizationUsage?.subscriptionId || "",
                newPlanId: priceId,
                user,
                organizationId: organizationId
            });
        } catch (error) {
            console.error("Error trying to change the subscription: ", error);
            setError("Error trying to change the subscription: ");
        } finally {
            setLoading(false);
            setIsSubscriptionChangeModal(true);
            setDataLoad(!dataLoad);
            timer = setTimeout(() => {
                setIsSubscriptionChangeModal(false);
            }, 5000);
            window.location.reload();
        }
    };

    const handleFreeSubscriptionChange = async (priceId: string) => {
        try {
            const { url } = await createCheckoutSession({
                userId: user?.id ?? "",
                userName: user?.name ?? "",
                priceId: priceId,
                successUrl: window.location.origin + "#/success-payment",
                cancelUrl: window.location.origin + "/",
                organizationName: organization?.name ?? "",
                organizationId: organizationId,
                subscriptionTierId: priceId
            });
            window.location.href = url;
        } catch (error) {
            console.error("Error trying to change the subscription: ", error);
            toast("Failed to create the customer portal link. Please try again.", { type: "warning" });
        }
    };

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 957);
            setIsMobile(window.innerHeight <= 700);
            setMobilePage(1);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Pagination logic for mobile
    const logsToShow = React.useMemo(() => {
        if (!filteredLogsData) return [];
        if (isMobile) {
            const start = (mobilePage - 1) * 5;
            return filteredLogsData.slice(start, start + 5);
        }
        return filteredLogsData.slice(0, 10);
    }, [filteredLogsData, isMobile, mobilePage]);

    const totalMobilePages = filteredLogsData ? Math.ceil(filteredLogsData.length / 5) : 1;

    const recentChangesModalRef = useRef<HTMLDivElement>(null);
    const viewModalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (recentChangesModalRef.current && !recentChangesModalRef.current.contains(event.target as Node)) {
                setIsRecentChangesModal(false);
            }
        };

        if (isRecentChangesModal) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isRecentChangesModal]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (viewModalRef.current && !viewModalRef.current.contains(event.target as Node)) {
                setIsViewModal(false);
            }
        };

        if (isViewModal) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isViewModal]);

    return (
        <div className={styles.pageContainer}>
            <div id="options-row" className={styles.row}>
                <button className={styles.auditButton} onClick={handleRecentChangesModal} aria-label="Recent Changes">
                    <Clock className={styles.auditIcon} />
                    <Label className={styles.auditText}>Recent Changes</Label>
                </button>
            </div>
            <div>
                {loading ? (
                    <Spinner styles={{ root: { marginTop: "50px" } }} />
                ) : (
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr key="types">
                                <th className={styles.tableText}>Subscription Type</th>
                                <th className={styles.tableText}>Expiration Date</th>
                                <th className={styles.tableText}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={styles.tableBody}>
                            <tr key="subscription">
                                <td className={styles.tableText}>
                                    <div className={styles.tableSubscriptionInfo}>
                                        <div className={styles.iconCreditWrapper}>
                                            <CreditCard className={styles.tableCreditIcon} />
                                        </div>
                                        {subscriptionName}
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.tableExpirationWrapper}>
                                        <div className={styles.tableExpirationText}>{formatTimestamp(organizationUsage?.currentPeriodEnds || 0)}</div>
                                        <div className={styles.tableDaysText}>{daysRemaining} days remaining</div>
                                    </div>
                                </td>
                                <td>
                                    <div className={styles.tableTextView}>
                                        <button
                                            className={styles.button}
                                            title="View Subscription"
                                            aria-label="View Subscription"
                                            onClick={handleViewSubscription}
                                        >
                                            <Eye className={styles.tableViewIcon} />
                                            View
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
                {isRecentChangesModal && (
                    <div className={styles.modalOverlay}>
                        <div ref={recentChangesModalRef} className={styles.modalAudit}>
                            <div className={styles.modalHeader}>
                                <h1 className={styles.titleRecent}>Recent Changes</h1>
                                <button aria-label="Close" className={styles.closeButton} onClick={() => setIsRecentChangesModal(false)}>
                                    <IconX />
                                </button>
                            </div>
                            <div className={styles.auditFilter}>
                                <Label className={styles.modalText}>Filter by Action:</Label>
                                <Dropdown
                                    placeholder="Select action to filter"
                                    options={FilterOptions}
                                    onChange={handleFilterChange}
                                    styles={{
                                        title: { fontSize: "1rem" },
                                        dropdownItem: { fontSize: "1rem" },
                                        dropdownItemSelected: { fontSize: "1rem" },
                                        root: { fontSize: "1rem" }
                                    }}
                                />
                            </div>
                            {recentChangesLoading ? (
                                <Spinner styles={{ root: { marginTop: "50px" } }} />
                            ) : (
                                <div className={styles.row} style={{ overflowX: "auto", width: "100%" }}>
                                    <div style={{ width: "100%", minWidth: 320 }}>
                                        <table className={styles.table} style={{ width: "100%", minWidth: 320 }}>
                                            <thead className={styles.thead}>
                                                <tr key="types">
                                                    <th className={styles.tableName}>Date</th>
                                                    <th className={styles.tableName}>Action</th>
                                                    <th className={styles.tableName}>Modified by</th>
                                                    <th className={styles.tableName}>Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className={styles.auditBody}>
                                                {(logsToShow || []).map((data: any, index: number) => (
                                                    <tr className={styles.auditRow} key={index}>
                                                        {data.action === "Subscription Tier Change" && (
                                                            <>
                                                                <td className={styles.tableDate}>{formatTimestamp(data._ts)}</td>
                                                                <td className={styles.tableText2}>Subscription Tier Change</td>
                                                                <td className={styles.tableText2}>{data.modified_by_name}</td>
                                                                <td className={styles.tableText2}>
                                                                    {data.previous_plan} → {data.current_plan}
                                                                </td>
                                                            </>
                                                        )}

                                                        {data.action === "Subscription Created" && (
                                                            <>
                                                                <td className={styles.tableDate}>{formatTimestamp(data._ts)}</td>
                                                                <td className={styles.tableText2}>Subscription Created</td>
                                                                <td className={styles.tableText}>{data.modified_by_name}</td>
                                                                <td className={styles.tableText}>Status: Active</td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(filteredLogsData?.length === 0 || !filteredLogsData) && (
                                            <p style={{ textAlign: "center", marginTop: 16 }}>No logs found</p>
                                        )}
                                        {/* Mobile Pagination Controls */}
                                        {isMobile && filteredLogsData && filteredLogsData.length > 5 && (
                                            <div style={{ display: "flex", justifyContent: "center", marginTop: 12, gap: 8 }}>
                                                <button
                                                    className={styles.button}
                                                    onClick={() => setMobilePage(p => Math.max(1, p - 1))}
                                                    disabled={mobilePage === 1}
                                                    aria-label="Previous"
                                                >
                                                    Prev
                                                </button>
                                                <span style={{ alignSelf: "center" }}>
                                                    {mobilePage} / {totalMobilePages}
                                                </span>
                                                <button
                                                    className={styles.button}
                                                    onClick={() => setMobilePage(p => Math.min(totalMobilePages, p + 1))}
                                                    disabled={mobilePage === totalMobilePages}
                                                    aria-label="Next"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {isViewModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalSubscription} ref={viewModalRef}>
                            <button aria-label="Close" className={styles.closeButton} onClick={() => setIsViewModal(false)}>
                                <IconX />
                            </button>
                            {prices.map((price, index) => (
                                <div key={price.id} className={`${organizationUsage?.policy.tierId === price.id ? styles.activePlan : styles.plan}`}>
                                    <ChartPerson48Regular className={styles.planIcon} />
                                    <h2 className={styles.planName}>{price.nickname}</h2>
                                    <p className={styles.planDescription}>{price.description}</p>
                                    <p className={styles.planPrice}>
                                        ${(price.unit_amount / 100).toFixed(2)} {price.currency.toUpperCase()} per {price.recurring?.interval}
                                    </p>
                                    <button
                                        className={styles.planButton}
                                        onClick={() => handleSelectedSubscription(price.nickname, price.id)}
                                        role="button"
                                        aria-label={`Subscribe to ${price.nickname}`}
                                    >
                                        {organizationUsage?.policy.tierId === price.id ? "Modify" : "Subscribe"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {isConfirmationModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContainer}>
                            <div className={styles.modalContent}>
                                {selectedSubscriptionName === subscriptionName ? (
                                    <>
                                        <button className={styles.closeButtonNew} onClick={() => setIsConfirmationModal(false)} aria-label="Close">
                                            <IconX />
                                        </button>
                                        <span className={styles.modalTitle}>Payment Detail Change</span>
                                        <Label className={styles.modalText}>
                                            You are already subscribed to the {selectedSubscriptionName} plan. Confirming this action will change your payment
                                            information.
                                        </Label>
                                        <div className={styles.buttonContainerNew}>
                                            <button onClick={() => setIsConfirmationModal(false)} className={styles.cancelButton} aria-label="Cancel">
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleCreateCustomerPortal()}
                                                className={`${styles.confirmButton} ${styles.subscribeButton}`}
                                                aria-label="Confirm change"
                                            >
                                                Confirm Change
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <button className={styles.closeButtonNew} onClick={() => setIsConfirmationModal(false)} aria-label="Close">
                                            <IconX />
                                        </button>
                                        <Label className={styles.modalTitle}>Subscription Confirmation</Label>
                                        <Label className={styles.modalText}>
                                            Are you sure you want to subscribe to the {selectedSubscriptionName} plan? The subscription change will charge the
                                            new subscription fee.
                                        </Label>
                                        <div className={styles.buttonContainerNew}>
                                            <button onClick={() => setIsConfirmationModal(false)} className={styles.cancelButton} aria-label="Cancel">
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => organizationUsage?.policy.tierId === "tier_free" ? handleFreeSubscriptionChange(selectedSubscriptionID) : handleChangeSubscription(selectedSubscriptionID)}
                                                className={`${styles.confirmButton} ${styles.subscribeButton}`}
                                                disabled={isLoading}
                                                aria-label={isLoading ? "Loading..." : "Confirm Subscription"}
                                            >
                                                {isLoading ? <Spinner size={SpinnerSize.small} labelPosition="right" /> : "Confirm Subscription"}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isErrorModal && (
                    <div className={styles.modalOverlay}>
                        <div className={`${styles.modalContainer} ${styles.errorModal}`}>
                            <button className={styles.closeButtonNew} onClick={() => setIsErrorModal(false)} aria-label="Close">
                                <IconX />
                            </button>
                            <div className={styles.modalContent}>
                                <Label className={styles.modalTitle}>Error</Label>
                                <Label className={styles.modalText}>{error}</Label>
                            </div>
                        </div>
                    </div>
                )}
                {isSubscriptionChangeModal && (
                    <div className={styles.successModalOverlay}>
                        <div className={styles.successModalContainer}>
                            <div className={styles.successModalContent}>
                                <Label className={styles.successModalTitle}>Subscription Changed</Label>
                                <Label className={styles.successModalText}>Your subscription has been successfully changed</Label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionManagement;
