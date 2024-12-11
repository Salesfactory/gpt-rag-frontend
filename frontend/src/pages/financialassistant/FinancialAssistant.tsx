import React, { useEffect, useState } from "react";
import { useAppContext } from "../../providers/AppProviders";
import { getFinancialAssistant, upgradeSubscription, removeFinancialAssistant } from "../../api"; // Asegúrate de importar la función
import { Spinner, PrimaryButton, DefaultButton, Dialog, DialogType, DialogFooter, MessageBar, MessageBarType } from "@fluentui/react";
import styles from "./FinancialAssistant.module.css";

const FinancialAssistant = () => {
    const { user, organization } = useAppContext();
    const [subscriptionStatus, setSubscriptionStatus] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
    const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                } else if (error.status === null) {
                    setError("Bad request: unable to retrieve subscription status.");
                } else {
                    setError("An error occurred while fetching subscription status.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [user, organization]);

    const handleSubscribe = async () => {
        try {
            setLoading(true);
            const userObj = user ? { id: user.id, name: user.name, organizationId: user.organizationId ?? "default-org-id" } : undefined;
            await upgradeSubscription({ user: userObj, subscriptionId: organization?.subscriptionId ?? "default-org-id" });
            setSubscriptionStatus(true);
            setShowSubscribeDialog(false);
            //This reloads the page so the financial assistant toggle appears after click
            window.location.reload();
        } catch {
            setError("An error occurred while subscribing to the Financial Assistant feature.");
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
            setShowUnsubscribeDialog(false);
            //This reloads the page so the financial assistant toggle disappears after click
            window.location.reload();
        } catch {
            setError("An error occurred while unsubscribing from the Financial Assistant feature.");
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return <div>Please log in to manage your subscription.</div>;
    }

    if (loading) {
        return (
            <div className={styles.spinnerContainer}>
                <Spinner className={styles.spinner} />
            </div>
        );
    }

    return (
        <div className={styles.page_container}>
            <h1 className={styles.title}>Financial Assistant Subscription</h1>

            {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}

            <div className={styles.row}>
                {subscriptionStatus ? (
                    <>
                        <MessageBar messageBarType={MessageBarType.success} className={styles.messageBarText}>
                            You are subscribed to the Financial Assistant feature.
                        </MessageBar>
                        <PrimaryButton text="Unsubscribe from Financial Assistant" onClick={() => setShowUnsubscribeDialog(true)} />
                    </>
                ) : (
                    <>
                        <MessageBar messageBarType={MessageBarType.warning} className={styles.messageBarText}>
                            You are not subscribed to the Financial Assistant feature.
                        </MessageBar>
                        <PrimaryButton text="Subscribe to Financial Assistant" onClick={() => setShowSubscribeDialog(true)} />
                    </>
                )}
            </div>

            <Dialog
                hidden={!showSubscribeDialog}
                onDismiss={() => setShowSubscribeDialog(false)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: "Subscribe to Financial Assistant",
                    subText: "Subscribing to the Financial Assistant feature will cost $29.99 per month."
                }}
            >
                <DialogFooter>
                    <PrimaryButton onClick={handleSubscribe} text="Confirm Subscription" />
                    <DefaultButton onClick={() => setShowSubscribeDialog(false)} text="Cancel" />
                </DialogFooter>
            </Dialog>

            <Dialog
                hidden={!showUnsubscribeDialog}
                onDismiss={() => setShowUnsubscribeDialog(false)}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: "Unsubscribe from Financial Assistant",
                    subText: "Are you sure you want to remove the Financial Assistant from your subscription?"
                }}
            >
                <DialogFooter>
                    <PrimaryButton onClick={handleUnsubscribe} text="Yes, Unsubscribe" />
                    <DefaultButton onClick={() => setShowUnsubscribeDialog(false)} text="Cancel" />
                </DialogFooter>
            </Dialog>
        </div>
    );
};

export default FinancialAssistant;
