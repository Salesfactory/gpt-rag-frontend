import React, { useEffect, useState } from "react";
import styles from "./SubscriptionManagement.module.css";
import { DefaultButton, Label, MessageBar, MessageBarType, PrimaryButton, Spinner, Dropdown, IconButton, Stack } from "@fluentui/react";
import { useAppContext } from "../../providers/AppProviders";
import {
    createCustomerPortalSession,
    getCustomerId,
    changeSubscription,
    getFinancialAssistant,
    getProductPrices,
    removeFinancialAssistant,
    upgradeSubscription,
    getLogs
} from "../../api";
import { IconX } from "@tabler/icons-react";
import { ChartPerson48Regular } from "@fluentui/react-icons";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SubscriptionManagement: React.FC = () => {
    const { user, organization, subscriptionTiers, setIsFinancialAssistantActive } = useAppContext();
    const [subscriptionStatus, setSubscriptionStatus] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isErrorModal, setIsErrorModal] = useState(false);
    const [isSubscriptionModal, setIsSubscriptionModal] = useState(false);
    const [isUnsubscriptionModal, setIsUnsubscriptionModal] = useState(false);
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
        "Financial Assistant": "Financial Assistant Change",
        "Subscription Tier": "Subscription Tier Change",
        "Subscription created": "Subscription created"
    }

    const FilterOptions = [
        { key: "1", text: "All Actions" },
        { key: "2", text: "Financial Assistant" },
        { key: "3", text: "Subscription Tier" },
        { key: "4", text: "Subscription created" }
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
        return date.toLocaleString("en-US", options).replace(',', '');
    };

    const [dataLoad, setDataLoad] = useState(false);
    const [isSubscriptionChangeModal, setIsSubscriptionChangeModal] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            try {
                setSusbscriptionName(subscriptionTiers[0] || "");
                if (!user?.organizationId) {
                    throw new Error("Organization ID is required");
                }
                const { financial_assistant_active } = await getFinancialAssistant({
                    user: {
                        ...user,
                        organizationId: user.organizationId
                    },
                    subscriptionId: organization?.subscriptionId ?? "default-org-id"
                });
                setSubscriptionStatus(financial_assistant_active);
            } catch (error: any) {
                console.log(error);
                if (error.status === false) {
                    setSubscriptionStatus(false);
                    setError("Financial Assistant feature is not present in this subscription.");
                    setIsErrorModal(true);
                } else if (error.status === null) {
                    setError("Bad request: unable to retrieve subscription status.");
                    setIsErrorModal(true);
                } else {
                    setError("An error occurred while fetching subscription status.");
                    setIsErrorModal(true);
                }
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
                setPrices(data.prices);
            } catch (err) {
                console.error("Failed to fetch product prices:", err);
                setError("Unable to fetch product prices. Please try again later.");
                setIsErrorModal(true);
            }
        }

        fetchPrices();
    }, [dataLoad]);

    const handleSubscribe = async () => {
        try {
            setLoading(true);
            const userObj = user ? { id: user.id, name: user.name, organizationId: user.organizationId ?? "default-org-id" } : undefined;
            await upgradeSubscription({ user: userObj, subscriptionId: organization?.subscriptionId ?? "default-org-id" });
            setSubscriptionStatus(true);
            setIsSubscriptionModal(false);
            //This reloads the page so the financial assistant toggle appears after click
            window.location.reload();
        } catch {
            setError("An error occurred while subscribing to the Financial Assistant feature.");
            setIsSubscriptionModal(false);
            setIsErrorModal(true);
        } finally {
            setLoading(false);
        }
    };

    const handleUnsubscribe = async () => {
        try {
            setLoading(true);
            const userObj = user ? { id: user.id, name: user.name, organizationId: user.organizationId ?? "default-org-id" } : undefined;
            await removeFinancialAssistant({ user: userObj, subscriptionId: organization?.subscriptionId ?? "default-org-id" });
            setSubscriptionStatus(false);
            setIsUnsubscriptionModal(false);
            setIsFinancialAssistantActive(false);
            //This reloads the page so the financial assistant toggle disappears after click
            window.location.reload();
        } catch {
            setError("An error occurred while unsubscribing from the Financial Assistant feature.");
            setIsUnsubscriptionModal(false);
            setIsErrorModal(true);
        } finally {
            setLoading(false);
        }
    };

    const handleFinancialAssistantToggle = async () => {
        if (subscriptionStatus == true) {
            setIsUnsubscriptionModal(true);
        } else {
            setIsSubscriptionModal(true);
        }
    };

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
            console.log(logs);
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
        const actionFilter = FilterMapping[selectedOption?.text as keyof typeof FilterMapping || "All actions"]
        const filteredLogs = actionFilter
            ? logsData.filter((log: any) => log.action === actionFilter)
            : logsData;
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

        try {
            await changeSubscription({
                subscriptionId: organization?.subscriptionId ?? "",
                newPlanId: priceId,
                user
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

    const FinancialAssistantText = subscriptionStatus ? "You are subscribed to the Financial Assistant feature." : "Subscribe to Financial Assistant";

    return (
        <div className={styles.pageContainer}>
            <ToastContainer />
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Subscription Management</h1>
            </div>
            <div className={styles.card}>
                <button className={styles.auditButton} onClick={handleRecentChangesModal}>
                    <Label className={styles.auditText}>Recent Changes</Label>
                </button>
                {loading ? (
                    <Spinner styles={{ root: { marginTop: "50px" } }} />
                ) : (
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr key="types">
                                <th className={styles.tableName}>Subscription Name</th>
                                <th>Expiration Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr key="subscription">
                                <td className={styles.tableName}>{subscriptionName}</td>
                                <td className={styles.tableText}>{expirationDate}</td>
                                <td className={styles.tableText}>
                                    <div className={styles.tableText}>
                                        <button
                                            className={styles.button}
                                            title="View Subscription"
                                            aria-label="View Subscription"
                                            onClick={handleViewSubscription}
                                        >
                                            View
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
                <div className={styles.group}>
                    <MessageBar messageBarType={subscriptionStatus ? MessageBarType.success : MessageBarType.warning} className={styles.messageBarText}>
                        {FinancialAssistantText}
                    </MessageBar>
                    <div className="form-check form-switch">
                        <input
                            className={`form-check-input ${styles.financialToggle}`}
                            type="checkbox"
                            checked={subscriptionStatus}
                            onChange={handleFinancialAssistantToggle}
                        />
                        <span className={`form-check-label ${styles.financialToggleText}`}>Financial Assistant</span>
                    </div>
                </div>
                {isRecentChangesModal && (
                    <>
                        <div className={styles.modalAudit}>
                            <div className={styles.modalHeader}>
                                <h1 className={styles.row}>Recent Changes</h1>
                                <button className={styles.closeButton} onClick={() => setIsRecentChangesModal(false)}>
                                    <IconX />
                                </button>
                            </div>
                            <div className={styles.auditFilter}>
                                <Label className={styles.modalText}>Filter by Action:</Label>
                                <Dropdown placeholder="Select Action to filter" options={FilterOptions} onChange={handleFilterChange} />
                            </div>
                            {recentChangesLoading ? (
                                <Spinner styles={{ root: { marginTop: "50px" } }} />
                            ) : (
                                <>
                                    <div className={styles.row}>
                                        <table className={styles.table}>
                                            <thead className={styles.thead}>
                                                <tr key="types">
                                                    <th className={styles.tableName}>Date</th>
                                                    <th>Action</th>
                                                    <th>Modified by</th>
                                                    <th>Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className={styles.auditBody}>
                                                {paginatedLogs.map((data: any, index: number) => (
                                                    <tr className={styles.auditRow} key={index}>
                                                        {data.action === "Subscription Tier Change" && (
                                                            <React.Fragment key={index}>
                                                                <td className={styles.tableDate}>
                                                                    {formatTimestamp(data._ts)}
                                                                </td>
                                                                <td className={styles.tableText}>Subscription Tier change</td>
                                                                <td className={styles.tableText}>{data.modified_by_name}</td>
                                                                <td className={styles.tableText}>
                                                                    {data.previous_plan} → {data.current_plan}
                                                                </td>
                                                            </React.Fragment>
                                                        )}
                                                        {data.action === "Financial Assistant Change" && (
                                                            <React.Fragment>
                                                                <td className={styles.tableDate}>
                                                                    {formatTimestamp(data._ts)}
                                                                </td>
                                                                <td className={styles.tableText}>FA Add-On Toggled</td>
                                                                <td className={styles.tableText}>{data.modified_by_name}</td>
                                                                <td className={styles.tableText}>Status: {data.status_financial_assistant}</td>
                                                            </React.Fragment>
                                                        )}
                                                        {data.action === "Subscription created" && (
                                                            <React.Fragment>
                                                                <td className={styles.tableDate}>
                                                                    {formatTimestamp(data._ts)}
                                                                </td>
                                                                <td className={styles.tableText}>Subscription created</td>
                                                                <td className={styles.tableText}>{data.modified_by_name}</td>
                                                                <td className={styles.tableText}>Status: Active</td>
                                                            </React.Fragment>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ display: "flex", marginTop: "20px" }}>
                                        {paginatedLogs.length === 0 ? (
                                            <p>No logs found</p>
                                        ) : (
                                            <p>
                                                Page {currentPage} of {Math.ceil((filteredLogsData?.length || 0) / rowsPerPage)}
                                            </p>
                                        )}
                                        <div style={{ marginLeft: "auto" }}>
                                            <IconButton
                                                iconProps={{ iconName: "ChevronLeft" }}
                                                ariaLabel="Previous page"
                                                onClick={() => handlePagination(currentPage - 1)}
                                                disabled={currentPage == 1}
                                            />
                                            <IconButton
                                                iconProps={{ iconName: "ChevronRight" }}
                                                disabled={currentPage === Math.ceil((filteredLogsData?.length || 0) / rowsPerPage)}
                                                ariaLabel="Next page"
                                                onClick={() => {
                                                    handlePagination(currentPage + 1);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
                {isViewModal && (
                    <div className={styles.modalSubscription}>
                        <button className={styles.closeButton} onClick={() => setIsViewModal(false)}>
                            <IconX />
                        </button>
                        {prices.map((price, index) => (
                            <div key={price.id} className={`${price.nickname === subscriptionName ? styles.activePlan : styles.plan}`}>
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
                                    {organization?.subscriptionId && organization.subscriptionStatus === "inactive"
                                        ? "Reactivate subscription"
                                        : organization?.subscriptionStatus === "active" && price.nickname === subscriptionName
                                            ? "Change payment information"
                                            : "Subscribe"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {isConfirmationModal && (
                    <div className={styles.modal}>
                        <button className={styles.closeButton} onClick={() => setIsConfirmationModal(false)}>
                            <IconX />
                        </button>
                        {selectedSubscriptionName === subscriptionName ? (
                            <div>
                                <Label className={styles.modalTitle}>Payment Detail change</Label>
                                <Label className={styles.modalText}>
                                    You are already subscribed to the {selectedSubscriptionName} plan. Confirming this action will change your payment
                                    information.
                                </Label>
                                <div className={styles.buttonContainer}>
                                    <DefaultButton onClick={() => setIsConfirmationModal(false)} text="Cancel" />
                                    <PrimaryButton onClick={() => handleCreateCustomerPortal()} text="Confirm change" />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Label className={styles.modalTitle}>Subscription Confirmation</Label>
                                <Label className={styles.modalText}>
                                    Are you sure you want to subscribe to the {selectedSubscriptionName} plan? The subscription change will charge the new
                                    subscription fee
                                </Label>
                                <div className={styles.buttonContainer}>
                                    <DefaultButton onClick={() => setIsConfirmationModal(false)} text="Cancel" />
                                    <PrimaryButton onClick={() => handleChangeSubscription(selectedSubscriptionID)} text="Confirm Subscription" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {isSubscriptionModal && (
                    <div className={styles.modal}>
                        <button className={styles.closeButton} onClick={() => setIsSubscriptionModal(false)}>
                            <IconX />
                        </button>
                        <Label className={styles.modalTitle}>Subscribe to Financial Assistant</Label>
                        <Label className={styles.modalText}>Subscribing to the Financial Assistant feature will cost $29.99 per month.</Label>
                        <div className={styles.buttonContainer}>
                            <DefaultButton onClick={() => setIsSubscriptionModal(false)} text="Cancel" />
                            <PrimaryButton onClick={handleSubscribe} text="Confirm Subscription" />
                        </div>
                    </div>
                )}
                {isUnsubscriptionModal && (
                    <div className={styles.modal}>
                        <button className={styles.closeButton} onClick={() => setIsUnsubscriptionModal(false)}>
                            <IconX />
                        </button>
                        <Label className={styles.modalTitle}>Unsubscribe from Financial Assistant</Label>
                        <Label className={styles.modalText}>Are you sure you want to remove the Financial Assistant from your subscription?</Label>
                        <div className={styles.buttonContainer}>
                            <DefaultButton onClick={() => setIsUnsubscriptionModal(false)} text="Cancel" />
                            <PrimaryButton onClick={handleUnsubscribe} text="Yes, Unsubscribe" />
                        </div>
                    </div>
                )}
                {isErrorModal && (
                    <div className={styles.modal}>
                        <button className={styles.closeButton} onClick={() => setIsErrorModal(false)}>
                            <IconX />
                        </button>
                        <Label className={styles.modalTitle}>Error</Label>
                        <Label className={styles.modalText}>{error}</Label>
                    </div>
                )}
                {isSubscriptionChangeModal && (
                    <div className={styles.modalSubscriptionChange}>
                        <Label className={styles.modalTitle}>Subscription Changed</Label>
                        <Label className={styles.modalSubscriptionChangeText}>Your subscription has been successfully changed</Label>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionManagement;
