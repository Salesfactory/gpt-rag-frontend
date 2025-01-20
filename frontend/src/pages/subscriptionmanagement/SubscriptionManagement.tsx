import React, { useEffect, useState } from "react";
import styles from "./SubscriptionManagement.module.css";
import { DefaultButton, Dropdown, Label, MessageBar, MessageBarType, PrimaryButton, Spinner } from "@fluentui/react";
import { useAppContext } from "../../providers/AppProviders";
import { getFinancialAssistant, getProductPrices, removeFinancialAssistant, upgradeSubscription } from "../../api";
import { IconX } from "@tabler/icons-react";
import { ChartPerson48Regular } from "@fluentui/react-icons";

const SubscriptionManagement: React.FC = () => {
    const { user, organization, subscriptionTiers } = useAppContext();
    const [subscriptionStatus, setSubscriptionStatus] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isErrorModal, setIsErrorModal] = useState(false);
    const [isSubscriptionModal, setIsSubscriptionModal] = useState(false);
    const [isUnsubscriptionModal, setIsUnsubscriptionModal] = useState(false);
    const [isViewModal, setIsViewModal] = useState(false);
    const subscriptionName = subscriptionTiers[0] || "";
    const [prices, setPrices] = useState<any[]>([]);
    const [isConfirmationModal, setIsConfirmationModal] = useState(false);
    const [selectedSubscriptionName, setSelectedSubscriptionName] = useState("");
    const [selectedSubscriptionID, setSelectedSubscriptionID] = useState("");
    const [isRecentChangesModal, setIsRecentChangesModal] = useState<Boolean>(false);
    const [logsData, setlogsData] = useState<any>([])
    const [filteredLogsData, setFilteredLogsData] = useState<any>()

    const expirationDate = new Date((organization?.subscriptionExpirationDate || 0) * 1000).toLocaleDateString();

    const dummyData = [
        {
            id: "12a4b3c7-df12-4e34-9a56-5f78a1d2b3c4",
            organizationName: "DemoOrg",
            organizationOwner: "789ghi45-jkl6-7mno-pqrs-234tu567vwxy",
            subscriptionId: "sub_8Hk3nYRwT8aabNZX987654QP",
            action: "Financial Assistant Change",
            changeTime: "2025-01-18T16:10:12.345678",
            modified_by: "789ghi45-jkl6-7mno-pqrs-234tu567vwxy",
            modified_by_name: "JaneSmith01",
            status_financial_assistant: "active",
            _rid: "aknFAKdwoTNeAAAAAAAAAA==",
            _self: "dbs/aknFAA==/colls/aknFAKdwoTN=/docs/aknFAKdwoTNeAAAAAAAAAA==/",
            _etag: '"d2046752-0000-0300-0000-679bef340000"',
            _attachments: "attachments/",
            _ts: 1737154212
        },
        {
            id: "45c8e3f2-gh34-5i67-jk89-lmno4567pqrs",
            organizationName: "DemoOrg",
            organizationOwner: "789ghi45-jkl6-7mno-pqrs-234tu567vwxy",
            subscriptionId: "sub_8Hk3nYRwT8aabNZX987654QP",
            action: "Subscription Tier Change",
            changeTime: "2025-01-18T15:45:01.456789",
            previous_plan: "Pro",
            current_plan: "Enterprise",
            modified_by: "789ghi45-jkl6-7mno-pqrs-234tu567vwxy",
            modified_by_name: "JaneSmith01",
            _rid: "aknFAKdwoTNcAAAAAAAAAA==",
            _self: "dbs/aknFAA==/colls/aknFAKdwoTN=/docs/aknFAKdwoTNcAAAAAAAAAA==/",
            _etag: '"d2042348-0000-0300-0000-679bef110000"',
            _attachments: "attachments/",
            _ts: 1737153901
        },
        {
            id: "67f9g0h1-ij45-6k78-lm90-nopq5678qrst",
            organizationName: "TestCompany",
            organizationOwner: "234ghi78-jkl9-8mno-pqrs-456tu123vwxy",
            subscriptionId: "sub_1Kl2mNRyU9bcdLQW234567OP",
            action: "Financial Assistant Change",
            changeTime: "2025-01-18T14:22:33.789012",
            modified_by: "234ghi78-jkl9-8mno-pqrs-456tu123vwxy",
            modified_by_name: "MikeDeveloper",
            status_financial_assistant: "inactive",
            _rid: "vxnFAJeroUReAAAAAAAAAA==",
            _self: "dbs/vxnFAA==/colls/vxnFAJeroUR=/docs/vxnFAJeroUReAAAAAAAAAA==/",
            _etag: '"e3059856-0000-0400-0000-679adc760000"',
            _attachments: "attachments/",
            _ts: 1737150153
        },
        {
            id: "89g0h1i2-jk56-7l89-mn01-opqr6789stuv",
            organizationName: "TestCompany",
            organizationOwner: "234ghi78-jkl9-8mno-pqrs-456tu123vwxy",
            subscriptionId: "sub_1Kl2mNRyU9bcdLQW234567OP",
            action: "Subscription Tier Change",
            changeTime: "2025-01-18T13:50:22.012345",
            previous_plan: "Enterprise",
            current_plan: "Custom",
            modified_by: "234ghi78-jkl9-8mno-pqrs-456tu123vwxy",
            modified_by_name: "MikeDeveloper",
            _rid: "vxnFAJeroURcAAAAAAAAAA==",
            _self: "dbs/vxnFAA==/colls/vxnFAJeroUR=/docs/vxnFAJeroURcAAAAAAAAAA==/",
            _etag: '"e3053458-0000-0400-0000-679adc120000"',
            _attachments: "attachments/",
            _ts: 1737149422
        },
        {
            id: "01j2k3l4-mn56-8o90-pq12-rstu7890vwxy",
            organizationName: "AlphaSolutions",
            organizationOwner: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            subscriptionId: "sub_3Mn4oQRxV0cdeMRS345678XY",
            action: "Financial Assistant Change",
            changeTime: "2025-01-18T12:30:55.678901",
            modified_by: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            modified_by_name: "AliceManager",
            status_financial_assistant: "active",
            _rid: "wznFAKdwoVPeAAAAAAAAAA==",
            _self: "dbs/wznFAA==/colls/wznFAKdwoVP=/docs/wznFAKdwoVPeAAAAAAAAAA==/",
            _etag: '"f4061234-0000-0500-0000-679abd560000"',
            _attachments: "attachments/",
            _ts: 1737145855
        },
        {
            id: "01j2k3l4-mn56-8o90-pq12-rstu7890vwxy",
            organizationName: "AlphaSolutions",
            organizationOwner: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            subscriptionId: "sub_3Mn4oQRxV0cdeMRS345678XY",
            action: "Financial Assistant Change",
            changeTime: "2025-01-18T12:30:55.678901",
            modified_by: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            modified_by_name: "AliceManager",
            status_financial_assistant: "active",
            _rid: "wznFAKdwoVPeAAAAAAAAAA==",
            _self: "dbs/wznFAA==/colls/wznFAKdwoVP=/docs/wznFAKdwoVPeAAAAAAAAAA==/",
            _etag: '"f4061234-0000-0500-0000-679abd560000"',
            _attachments: "attachments/",
            _ts: 1737145855
        },
        {
            id: "01j2k3l4-mn56-8o90-pq12-rstu7890vwxy",
            organizationName: "AlphaSolutions",
            organizationOwner: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            subscriptionId: "sub_3Mn4oQRxV0cdeMRS345678XY",
            action: "Financial Assistant Change",
            changeTime: "2025-01-18T12:30:55.678901",
            modified_by: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            modified_by_name: "AliceManager",
            status_financial_assistant: "active",
            _rid: "wznFAKdwoVPeAAAAAAAAAA==",
            _self: "dbs/wznFAA==/colls/wznFAKdwoVP=/docs/wznFAKdwoVPeAAAAAAAAAA==/",
            _etag: '"f4061234-0000-0500-0000-679abd560000"',
            _attachments: "attachments/",
            _ts: 1737145855
        },
        {
            id: "01j2k3l4-mn56-8o90-pq12-rstu7890vwxy",
            organizationName: "AlphaSolutions",
            organizationOwner: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            subscriptionId: "sub_3Mn4oQRxV0cdeMRS345678XY",
            action: "Financial Assistant Change",
            changeTime: "2025-01-18T12:30:55.678901",
            modified_by: "345jkl89-mno1-2pqr-stuv-567wx890yz12",
            modified_by_name: "AliceManager",
            status_financial_assistant: "active",
            _rid: "wznFAKdwoVPeAAAAAAAAAA==",
            _self: "dbs/wznFAA==/colls/wznFAKdwoVP=/docs/wznFAKdwoVPeAAAAAAAAAA==/",
            _etag: '"f4061234-0000-0500-0000-679abd560000"',
            _attachments: "attachments/",
            _ts: 1737145855
        }
    ];

    const FilterOptions = [
        { key: "1", text: "All Actions"},
        { key: "2", text: "Financial Assistant" },
        { key: "3", text: "Subscription Tier" }
    ];

    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            try {
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
    }, [user, organization]);

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
    }, [user]);

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

    const handleCheckout = async (priceId: string) => {};

    const handleRecentChangesModal = () => {
        setIsRecentChangesModal(true);
    };

    const handleFilterChange = (event: any, selectedOption: any) => {}

    const FinancialAssistantText = subscriptionStatus ? "You are subscribed to the Financial Assistant feature." : "Subscribe to Financial Assistant";

    return (
        <div className={styles.pageContainer}>
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
                                <th className={styles.tableName}>Expiration Date</th>
                                <th className={styles.tableName}>Actions</th>
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
                                {dummyData.map((data, index) => (
                                    <tr className={styles.auditRow} key={index}>
                                        {data.action === "Subscription Tier Change" && (
                                            <>
                                                <td className={styles.tableDate}>
                                                    {new Date(data.changeTime)
                                                        .toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: false
                                                        })
                                                        .replaceAll(",", "")}
                                                </td>
                                                <td className={styles.tableText}>Subscription Tier change</td>
                                                <td className={styles.tableText}>{data.modified_by_name}</td>
                                                <td className={styles.tableText}>
                                                    {data.previous_plan} → {data.current_plan}
                                                </td>
                                            </>
                                        )}
                                        {data.action === "Financial Assistant Change" && (
                                            <>
                                                <td className={styles.tableDate}>
                                                    {new Date(data.changeTime)
                                                        .toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: false
                                                        })
                                                        .replaceAll(",", "")}
                                                </td>
                                                <td className={styles.tableText}>FA Add-On Toggled</td>
                                                <td className={styles.tableText}>{data.modified_by_name}</td>
                                                <td className={styles.tableText}>Status: {data.status_financial_assistant}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                    <div className={styles.modalAudit}>
                        <button className={styles.closeButton} onClick={() => setIsConfirmationModal(false)}>
                            <IconX />
                        </button>
                        {selectedSubscriptionName === subscriptionName ? (
                            <div>
                                <Label className={styles.modalTitle}>Payment Detail change</Label>
                                <Label className={styles.modalText}>
                                    You are already subscripted to the {selectedSubscriptionName} plan. Confirming this action will change your payment
                                    information.
                                </Label>
                                <div className={styles.buttonContainer}>
                                    <DefaultButton onClick={() => setIsConfirmationModal(false)} text="Cancel" />
                                    <PrimaryButton onClick={() => handleCheckout(selectedSubscriptionID)} text="Confirm change" />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Label className={styles.modalTitle}>Subscription Confirmation</Label>
                                <Label className={styles.modalText}>Are you sure you want to subscribe to the {selectedSubscriptionName} plan?</Label>
                                <div className={styles.buttonContainer}>
                                    <DefaultButton onClick={() => setIsConfirmationModal(false)} text="Cancel" />
                                    <PrimaryButton onClick={() => handleCheckout(selectedSubscriptionID)} text="Confirm Subscription" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {isSubscriptionModal && (
                    <div className={styles.modal}>
                        <button className={styles.closeButton} onClick={() => setSubscriptionStatus(false)}>
                            <IconX />
                        </button>
                        <Label className={styles.modalTitle}>Subscribe to Financial Assistant</Label>
                        <Label className={styles.modalText}>Subscribing to the Financial Assistant feature will cost $29.99 per month.</Label>
                        <div className={styles.buttonContainer}>
                            <DefaultButton onClick={() => setSubscriptionStatus(false)} text="Cancel" />
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
            </div>
        </div>
    );
};

export default SubscriptionManagement;
