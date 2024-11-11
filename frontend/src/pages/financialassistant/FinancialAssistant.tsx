import React, { useEffect, useState, useContext } from "react";
import { useAppContext } from "../../providers/AppProviders";
import { upgradeSubscription, removeFinancialAssistant } from "../../api";
import { Spinner, PrimaryButton, DefaultButton, Dialog, DialogType, DialogFooter, MessageBar, MessageBarType } from "@fluentui/react";

const FinancialAssistant = () => {
    const { user, organization } = useAppContext();
    const [subscriptionStatus, setSubscriptionStatus] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
    const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        if (user?.role !== "admin") {
            return;
        }

        const fetchStatus = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/subscription/${organization?.subscriptionId}/financialAssistant/status`, {
                    headers: { "X-MS-CLIENT-PRINCIPAL-ID": user.id }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSubscriptionStatus(data.data.financial_assistant_active);
                } else {
                    setError("Failed to fetch subscription status");
                }
            } catch (error) {
                setError("An error occurred while fetching subscription status");
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [user]);

    const handleSubscribe = async () => {
        try {
            setLoading(true);
            const userObj = user ? { id: user.id, name: user.name, organizationId: user.organizationId ?? "default-org-id" } : undefined;
            await upgradeSubscription({ user: userObj ?? undefined, subscriptionId: organization?.subscriptionId ?? "default-org-id"});
            setSubscriptionStatus(true);
            setShowSubscribeDialog(false);
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
            await removeFinancialAssistant({ user: userObj ?? undefined, subscriptionId: organization?.subscriptionId ?? "default-org-id"});
            setSubscriptionStatus(false);
            setShowUnsubscribeDialog(false);
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
        return <Spinner label="Loading subscription details..." />;
    }

    return (
        <div>
            <h1>Financial Assistant Subscription</h1>

            {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}

            {subscriptionStatus ? (
                <>
                    <MessageBar messageBarType={MessageBarType.success}>You are subscribed to the Financial Assistant feature.</MessageBar>
                    <PrimaryButton text="Unsubscribe from Financial Assistant" onClick={() => setShowUnsubscribeDialog(true)} />
                </>
            ) : (
                <>
                    <MessageBar messageBarType={MessageBarType.warning}>You are not subscribed to the Financial Assistant feature.</MessageBar>
                    <PrimaryButton text="Subscribe to Financial Assistant" onClick={() => setShowSubscribeDialog(true)} />
                </>
            )}

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
