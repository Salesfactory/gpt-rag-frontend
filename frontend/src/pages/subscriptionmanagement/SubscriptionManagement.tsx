import React, { useEffect, useState } from "react";
import styles from "./SubscriptionManagement.module.css"
import { DefaultButton, Label, MessageBar, MessageBarType, PrimaryButton, Spinner } from "@fluentui/react";
import { useAppContext } from "../../providers/AppProviders";
import { changeSubscription, getFinancialAssistant, getProductPrices, removeFinancialAssistant, upgradeSubscription } from "../../api";
import { IconX } from "@tabler/icons-react";
import { ChartPerson48Regular } from "@fluentui/react-icons";

const SubscriptionManagement: React.FC = () => {
    const { user, organization, subscriptionTiers, setIsFinancialAssistantActive} = useAppContext();
    const [subscriptionStatus, setSubscriptionStatus] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isErrorModal, setIsErrorModal] = useState(false)
    const [isSubscriptionModal, setIsSubscriptionModal] = useState(false)
    const [isUnsubscriptionModal, setIsUnsubscriptionModal] = useState(false)
    const [isViewModal, setIsViewModal] = useState(false)
    const [subscriptionName, setSusbscriptionName] = useState('')  
    const [prices, setPrices] = useState<any[]>([]);
    const [isConfirmationModal, setIsConfirmationModal] = useState(false)
    const [selectedSubscriptionName, setSelectedSubscriptionName] = useState('')
    const [selectedSubscriptionID, setSelectedSubscriptionID] = useState('')
    const [dataLoad, setDataLoad] = useState(false)
    const [isSubscriptionChangeModal, setIsSubscriptionChangeModal] = useState(false)

    const expirationDate = new Date((organization?.subscriptionExpirationDate || 0) * 1000).toLocaleDateString();



    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            try {
                setSusbscriptionName(subscriptionTiers[0] || '')
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
                    setIsErrorModal(true)
                } else if (error.status === null) {
                    setError("Bad request: unable to retrieve subscription status.");
                    setIsErrorModal(true)
                } else {
                    setError("An error occurred while fetching subscription status.");
                    setIsErrorModal(true)
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
                    setIsErrorModal(true)
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
            setIsErrorModal(true)
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
            setIsErrorModal(true)
        } finally {
            setLoading(false);
        }
    };

    const handleFinancialAssistantToggle = async () => {
        if(subscriptionStatus == true){
            setIsUnsubscriptionModal(true)
        }else{
            setIsSubscriptionModal(true)
        }
    }

    const handleViewSubscription = () =>{
        setIsViewModal(true)
    }

    const handleSelectedSubscription = (priceNickname: string, priceID: string) =>{
        setSelectedSubscriptionName(priceNickname)
        setSelectedSubscriptionID(priceID)
        setIsConfirmationModal(true)
    }

    const handleCheckout = async (priceId: string) => {
        setIsConfirmationModal(false);
        setIsViewModal(false)
        setLoading(true)
        let timer: NodeJS.Timeout;

        try{
            await changeSubscription({
                subscriptionId: organization?.subscriptionId ?? "",
                newPlanId: priceId
            });
        } catch(error){
            console.error("Error trying to change the subscription: ", error);
            setError("Error trying to change the subscription: ")
        } finally{
            setLoading(false)
            setIsSubscriptionChangeModal(true);
            timer = setTimeout(() => {
                setIsSubscriptionChangeModal(false);
            }, 5000);
            window.location.reload();
        }
        
        
    }

    const FinancialAssistantText = subscriptionStatus ? "You are subscribed to the Financial Assistant feature." : 
    "Subscribe to Financial Assistant"
    

    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Subscription Management</h1>
            </div>
            <div className={styles.card}>
                {loading ? (
                        <Spinner styles={{root: {marginTop: "50px"}}}/>
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
                                    <td className={styles.tableName}>
                                        {subscriptionName}
                                    </td>
                                    <td className={styles.tableText}>
                                        {expirationDate}
                                    </td>
                                    <td className={styles.tableText}>
                                    <div className={styles.tableText}>
                                            <button className={styles.button} title="View Subscription" aria-label="View Subscription"
                                            onClick={handleViewSubscription}>
                                                View
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                <div className={styles.group}>
                    <MessageBar messageBarType={subscriptionStatus ? MessageBarType.success : MessageBarType.warning} 
                    className={styles.messageBarText}>
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
                {isViewModal && (
                    <div className={styles.modalSubscription}>
                        <button className={styles.closeButton} onClick={() => setIsViewModal(false)}><IconX/></button>
                        {prices.map((price, index) => (
                            <div key={price.id} className={`${price.nickname === subscriptionName ? styles.activePlan : styles.plan}`}>
                                <ChartPerson48Regular className={styles.planIcon} />
                                <h2 className={styles.planName}>{price.nickname}</h2>
                                <p className={styles.planDescription}>{price.description}
                                </p>
                                
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
                        <button className={styles.closeButton} onClick={() => setIsConfirmationModal(false)}><IconX/></button>
                        {selectedSubscriptionName === subscriptionName ? (
                            <div>
                                <Label className={styles.modalTitle}>Payment Detail change</Label>
                                <Label className={styles.modalText}>You are already subscripted to the {selectedSubscriptionName} plan. Confirming this action will change
                                your payment information.
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
                        <button className={styles.closeButton} onClick={() => setIsSubscriptionModal(false)}><IconX/></button>
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
                        <button className={styles.closeButton} onClick={() => setIsUnsubscriptionModal(false)}><IconX/></button>
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
                        <button className={styles.closeButton} onClick={() => setIsErrorModal(false)}><IconX/></button>
                        <Label className={styles.modalTitle}>Error</Label>
                        <Label className={styles.modalText}>{error}</Label>
                    </div>
                )}
                {isSubscriptionChangeModal && (
                    <div className={styles.modal}>
                        <Label className={styles.modalTitle}>Subscription Changed</Label>
                        <Label className={styles.modalText}>Your Subscription has been successfully changed</Label>
                    </div>
                )}
            </div>
            
        </div>
    
    );
};

export default SubscriptionManagement;
