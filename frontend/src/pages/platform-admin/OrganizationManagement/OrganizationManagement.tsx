import React, { useState, useEffect, useMemo } from "react";
import {
    Stack,
    Text,
    PrimaryButton,
    DetailsList,
    DetailsListLayoutMode,
    Selection,
    SelectionMode,
    IColumn,
    Dialog,
    DialogType,
    DialogFooter,
    DefaultButton,
    TextField,
    Dropdown,
    IDropdownOption,
    MessageBar,
    MessageBarType,
    Icon,
    IconButton,
    Spinner,
    SpinnerSize,
    useTheme
} from "@fluentui/react";
import { organizationService, CreateOrganizationInput, UpdateOrganizationInput } from "../../../services/platform-admin/organizationService.mock";
import {
    createOrganization,
    createOrganizationUsage,
    getPlatformOrganizations,
    getProductPrices,
    updatePlatformOrganization,
    deletePlatformOrganization
} from "../../../api/api";
import { useAppContext } from "../../../providers/AppProviders";
import { OrganizationWithCosts, SubscriptionTier } from "../../../services/platform-admin/mockData";
import { formatCurrency } from "../../../utils/currencyUtils";
import { ConfirmDialog } from "../../../components/platform-admin/ConfirmDialog/ConfirmDialog";
import styles from "./OrganizationManagement.module.css";

interface OrganizationFormData {
    name: string;
    admin_email: string;
    subscription_tier: SubscriptionTier;
    expiration_period: string;
}

interface ToastMessage {
    message: string;
    type: MessageBarType;
}

const getTierColor = (tier: string): string => {
    const defaultColor = "#8a8886"; // Free or Unknown
    const colors: Record<string, string> = {
        Free: "#8a8886",
        Basic: "#0078d4",
        Premium: "#8764b8",
        Custom: "#d83b01"
    };
    return colors[tier] || defaultColor;
};

export const OrganizationManagement: React.FC = () => {
    const { user } = useAppContext();
    const theme = useTheme();
    const [organizations, setOrganizations] = useState<OrganizationWithCosts[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<OrganizationWithCosts | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const [costSummary, setCostSummary] = useState({
        totalStorage: 0,
        totalIngestion: 0,
        totalTokens: 0,
        grandTotal: 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<OrganizationFormData>({
        name: "",
        admin_email: "",
        subscription_tier: "Free",
        expiration_period: "30d"
    });

    const [prices, setPrices] = useState<any[]>([]);

    useEffect(() => {
        loadOrganizations();
        fetchPrices();
    }, []);

    const fetchPrices = async () => {
        try {
            // Using user context from hook if needed, or passing empty/mock user as needed
            const data = await getProductPrices({ user });
            if (data && data.prices) {
                setPrices(data.prices);
            }
        } catch (error) {
            console.error("Failed to fetch product prices:", error);
        }
    };

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const loadOrganizations = async () => {
        try {
            setIsLoading(true);
            const [response, costs] = await Promise.all([getPlatformOrganizations(), organizationService.getTotalCosts()]);
            setOrganizations(response.data || []);
            setCostSummary(costs);
        } catch (error) {
            setToast({ message: "Failed to load organizations", type: MessageBarType.error });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (org?: OrganizationWithCosts) => {
        if (org) {
            setEditingOrg(org);
            setFormData({
                name: org.name,
                admin_email: org.admin_email || "",
                subscription_tier: org.subscription_tier,
                expiration_period: "30d"
            });
        } else {
            setEditingOrg(null);
            setFormData({
                name: "",
                admin_email: "",
                subscription_tier: "Free",
                expiration_period: "30d"
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOrg(null);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (editingOrg) {
                // Use real API for updates
                await updatePlatformOrganization({
                    orgId: editingOrg.id,
                    name: formData.name,
                    admin_email: formData.admin_email
                });

                setToast({ message: "Organization updated successfully", type: MessageBarType.success });
                handleCloseModal();
                loadOrganizations();
            } else {
                try {
                    // Create organization using real API
                    const newOrganization = await createOrganization({
                        userId: user?.id,
                        organizationName: formData.name,
                        admin_email: formData.admin_email
                    });

                    if (newOrganization && newOrganization.id) {
                        const tierMap: Record<string, string> = {
                            Free: "tier_free",
                            Basic: "tier_basic",
                            Premium: "tier_premium",
                            Custom: "tier_custom"
                        };
                        const tierId = tierMap[formData.subscription_tier] || "tier_free";

                        let periodEnds = new Date();
                        if (formData.expiration_period === "30d") {
                            periodEnds.setDate(periodEnds.getDate() + 30);
                        } else if (formData.expiration_period === "1y") {
                            periodEnds.setFullYear(periodEnds.getFullYear() + 1);
                        } else if (formData.expiration_period === "5y") {
                            periodEnds.setFullYear(periodEnds.getFullYear() + 5);
                        }

                        await createOrganizationUsage({
                            userId: user?.id,
                            organizationId: newOrganization.id,
                            subscriptionTierId: tierId,
                            currentPeriodEnds: periodEnds.getTime() / 1000
                        });

                        setToast({ message: "Organization created successfully", type: MessageBarType.success });
                        handleCloseModal();
                        loadOrganizations();
                    } else {
                        throw new Error("Failed to create organization");
                    }
                } catch (error) {
                    console.error("Error creating organization with real API:", error);
                    throw error; // Re-throw to be caught by the outer catch block
                }
            }
        } catch (error: any) {
            setToast({ message: error.message || "Failed to save organization", type: MessageBarType.error });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deletePlatformOrganization(id);
            setToast({ message: "Organization deleted successfully", type: MessageBarType.success });
            loadOrganizations();
            setDeleteConfirm(null);
        } catch (error) {
            setToast({ message: "Failed to delete organization", type: MessageBarType.error });
            console.error(error);
        }
    };

    const handleCancelSubscription = async (id: string) => {
        try {
            const org = organizations.find(o => o.id === id);
            if (!org) return;

            const input: UpdateOrganizationInput = {
                id: org.id,
                name: org.name,
                storage_cost: org.storage_cost,
                ingestion_cost: org.ingestion_cost,
                tokens_cost: org.tokens_cost,
                subscription_tier: "Free"
            };
            await organizationService.update(input);
            setToast({ message: "Subscription cancelled successfully", type: MessageBarType.success });
            loadOrganizations();
            setCancelConfirm(null);
        } catch (error) {
            setToast({ message: "Failed to cancel subscription", type: MessageBarType.error });
            console.error(error);
        }
    };

    const getTierDisplayName = (tier: string) => {
        if (!tier) return "Free";
        // If it looks like a stripe price ID (starts with "price_"), verify against loaded prices
        if (tier.startsWith("price_")) {
            const plan = prices.find(p => p.id === tier);
            return plan ? plan.nickname : tier;
        }
        return tier;
    };

    const columns: IColumn[] = [
        {
            key: "name",
            name: "Name",
            fieldName: "name",
            minWidth: 200,
            maxWidth: 300,
            isResizable: true,
            onRender: (item: OrganizationWithCosts) => {
                const displayTier = getTierDisplayName(item.subscription_tier);
                return (
                    <Stack>
                        <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                            {item.name}
                        </Text>
                        <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 4 } }}>
                            <div className={styles.badge} style={{ backgroundColor: "#e6f3e6" }}>
                                <Text variant="tiny" styles={{ root: { color: "#107c10" } }}>
                                    {new Date(item.created_at).toLocaleDateString()}
                                </Text>
                            </div>
                            <div className={styles.badge} style={{ backgroundColor: getTierColor(displayTier) + "20" }}>
                                <Text variant="tiny" styles={{ root: { color: getTierColor(displayTier) } }}>
                                    {displayTier}
                                </Text>
                            </div>
                        </Stack>
                    </Stack>
                );
            }
        },
        {
            key: "storage_cost",
            name: "Storage",
            fieldName: "storage_cost",
            minWidth: 100,
            maxWidth: 120,
            onRender: (item: OrganizationWithCosts) => <Text>{formatCurrency(Number(item.storage_cost))}</Text>
        },
        {
            key: "ingestion_cost",
            name: "Ingestion",
            fieldName: "ingestion_cost",
            minWidth: 100,
            maxWidth: 120,
            onRender: (item: OrganizationWithCosts) => <Text>{formatCurrency(Number(item.ingestion_cost))}</Text>
        },
        {
            key: "tokens_cost",
            name: "Tokens",
            fieldName: "tokens_cost",
            minWidth: 100,
            maxWidth: 120,
            onRender: (item: OrganizationWithCosts) => <Text>{formatCurrency(Number(item.tokens_cost))}</Text>
        },
        {
            key: "total_cost",
            name: "Total",
            fieldName: "total_cost",
            minWidth: 100,
            maxWidth: 120,
            onRender: (item: OrganizationWithCosts) => (
                <Text styles={{ root: { fontWeight: 600, color: theme.palette.themePrimary } }}>{formatCurrency(item.total_cost)}</Text>
            )
        },
        {
            key: "expiration_date",
            name: "Expiration",
            fieldName: "expiration_date",
            minWidth: 120,
            maxWidth: 150,
            onRender: (item: OrganizationWithCosts) => {
                if (!item.expiration_date) {
                    return <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>No expiration</Text>;
                }

                const expDate = new Date(item.expiration_date);
                const isExpired = expDate < new Date();
                const expiresWithin30Days = expDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

                return (
                    <Stack>
                        <Text>{expDate.toLocaleDateString()}</Text>
                        <Text
                            variant="tiny"
                            styles={{
                                root: {
                                    color: isExpired ? theme.palette.redDark : expiresWithin30Days ? theme.palette.orangeLight : theme.palette.neutralSecondary,
                                    fontWeight: isExpired ? 600 : 400
                                }
                            }}
                        >
                            {isExpired ? "Expired" : expiresWithin30Days ? "Expires soon" : "Active"}
                        </Text>
                    </Stack>
                );
            }
        },
        {
            key: "actions",
            name: "Actions",
            minWidth: 120,
            maxWidth: 150,
            onRender: (item: OrganizationWithCosts) => (
                <Stack horizontal tokens={{ childrenGap: 4 }}>
                    <IconButton iconProps={{ iconName: "Edit" }} title="Edit" onClick={() => handleOpenModal(item)} />
                    {item.subscription_tier !== "Free" && (
                        <IconButton
                            iconProps={{ iconName: "Cancel" }}
                            title="Cancel Subscription"
                            disabled={true}
                            onClick={() => setCancelConfirm(item.id)}
                            styles={{
                                root: { color: theme.palette.neutralTertiary },
                                rootDisabled: { backgroundColor: "transparent" }
                            }}
                        />
                    )}
                    <IconButton
                        iconProps={{ iconName: "Delete" }}
                        title="Delete"
                        onClick={() => setDeleteConfirm(item.id)}
                        styles={{ root: { color: theme.palette.redDark } }}
                    />
                </Stack>
            )
        }
    ];

    const tierOptions: IDropdownOption[] = [{ key: "Free", text: "Free" }];

    const expirationOptions: IDropdownOption[] = [
        { key: "30d", text: "30 Days" },
        { key: "1y", text: "1 Year" },
        { key: "5y", text: "5 Years" }
    ];

    if (isLoading) {
        return (
            <Stack horizontalAlign="center" verticalAlign="center" styles={{ root: { height: "100%", padding: 40 } }}>
                <Spinner size={SpinnerSize.large} label="Loading organizations..." />
            </Stack>
        );
    }

    return (
        <Stack tokens={{ childrenGap: 24 }}>
            {/* Toast */}
            {toast && (
                <MessageBar messageBarType={toast.type} isMultiline={false} onDismiss={() => setToast(null)} dismissButtonAriaLabel="Close">
                    {toast.message}
                </MessageBar>
            )}

            {/* Header */}
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Stack>
                    <Text variant="xxLarge" styles={{ root: { fontWeight: 600 } }}>
                        Organization Management
                    </Text>
                    <Text variant="medium" styles={{ root: { color: theme.palette.neutralSecondary } }}>
                        Manage organizations and their associated costs
                    </Text>
                </Stack>
                <PrimaryButton text="Create Organization" iconProps={{ iconName: "Add" }} onClick={() => handleOpenModal()} />
            </Stack>

            {/* Cost Summary Cards */}
            <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                <div className={styles.costCard} style={{ background: "linear-gradient(135deg, #0078d4 0%, #106ebe 100%)" }}>
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
                        <Icon iconName="Money" styles={{ root: { fontSize: 24, color: "#ffffff" } }} />
                        <Text variant="small" styles={{ root: { color: "rgba(255,255,255,0.9)", fontWeight: 500 } }}>
                            Storage Cost
                        </Text>
                    </Stack>
                    <Text variant="xxLarge" styles={{ root: { fontWeight: 700, color: "#ffffff", marginTop: 8 } }}>
                        {formatCurrency(costSummary.totalStorage)}
                    </Text>
                </div>

                <div className={styles.costCard} style={{ background: "linear-gradient(135deg, #107c10 0%, #0b6a0b 100%)" }}>
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
                        <Icon iconName="Money" styles={{ root: { fontSize: 24, color: "#ffffff" } }} />
                        <Text variant="small" styles={{ root: { color: "rgba(255,255,255,0.9)", fontWeight: 500 } }}>
                            Ingestion Cost
                        </Text>
                    </Stack>
                    <Text variant="xxLarge" styles={{ root: { fontWeight: 700, color: "#ffffff", marginTop: 8 } }}>
                        {formatCurrency(costSummary.totalIngestion)}
                    </Text>
                </div>

                <div className={styles.costCard} style={{ background: "linear-gradient(135deg, #8764b8 0%, #744da9 100%)" }}>
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
                        <Icon iconName="Money" styles={{ root: { fontSize: 24, color: "#ffffff" } }} />
                        <Text variant="small" styles={{ root: { color: "rgba(255,255,255,0.9)", fontWeight: 500 } }}>
                            Tokens Cost
                        </Text>
                    </Stack>
                    <Text variant="xxLarge" styles={{ root: { fontWeight: 700, color: "#ffffff", marginTop: 8 } }}>
                        {formatCurrency(costSummary.totalTokens)}
                    </Text>
                </div>

                <div className={styles.costCard} style={{ background: "linear-gradient(135deg, #323130 0%, #201f1e 100%)" }}>
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
                        <Icon iconName="Money" styles={{ root: { fontSize: 24, color: "#ffffff" } }} />
                        <Text variant="small" styles={{ root: { color: "rgba(255,255,255,0.9)", fontWeight: 500 } }}>
                            Total Cost
                        </Text>
                    </Stack>
                    <Text variant="xxLarge" styles={{ root: { fontWeight: 700, color: "#ffffff", marginTop: 8 } }}>
                        {formatCurrency(costSummary.grandTotal)}
                    </Text>
                </div>
            </Stack>

            {/* Organizations Table */}
            <Stack styles={{ root: { backgroundColor: "#ffffff", padding: 16, borderRadius: 8 } }}>
                <DetailsList
                    items={organizations}
                    columns={columns}
                    setKey="set"
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible={true}
                />
                {organizations.length === 0 && (
                    <Stack horizontalAlign="center" tokens={{ padding: 40 }}>
                        <Text styles={{ root: { color: theme.palette.neutralTertiary } }}>No organizations found. Create one to get started!</Text>
                    </Stack>
                )}
            </Stack>

            {/* Create/Edit Modal */}
            <Dialog
                hidden={!isModalOpen}
                onDismiss={handleCloseModal}
                dialogContentProps={{
                    type: DialogType.normal,
                    title: editingOrg ? "Edit Organization" : "Create Organization"
                }}
                modalProps={{
                    isBlocking: true,
                    styles: { main: { maxWidth: 500 } }
                }}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                        label="Organization Name"
                        required
                        value={formData.name}
                        onChange={(_, value) => setFormData({ ...formData, name: value || "" })}
                        placeholder="Enter organization name"
                    />

                    <TextField
                        label={editingOrg ? "Admin Email" : "Admin Email *"}
                        type="email"
                        required={!editingOrg}
                        value={formData.admin_email}
                        onChange={(_, value) => setFormData({ ...formData, admin_email: value || "" })}
                        placeholder="admin@example.com"
                    />

                    <Dropdown
                        label="Subscription Tier"
                        required
                        selectedKey={formData.subscription_tier}
                        options={tierOptions}
                        disabled={true}
                        onChange={(_, option) => setFormData({ ...formData, subscription_tier: option?.key as SubscriptionTier })}
                    />

                    {!editingOrg && (
                        <Dropdown
                            label="Expiration Period"
                            required
                            selectedKey={formData.expiration_period}
                            options={expirationOptions}
                            onChange={(_, option) => setFormData({ ...formData, expiration_period: option?.key as string })}
                        />
                    )}
                </Stack>

                <DialogFooter>
                    <DefaultButton onClick={handleCloseModal} text="Cancel" disabled={isSubmitting} />
                    {isSubmitting ? (
                        <Spinner size={SpinnerSize.medium} label={editingOrg ? "Updating..." : "Creating..."} ariaLive="assertive" labelPosition="right" />
                    ) : (
                        <PrimaryButton onClick={handleSubmit} text={editingOrg ? "Update" : "Create"} />
                    )}
                </DialogFooter>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={deleteConfirm !== null}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
                title="Delete Organization"
                message="Are you sure you want to delete this organization? This action cannot be undone and will also delete all associated pulse data ingestion records."
                confirmText="Delete"
                variant="danger"
            />

            {/* Cancel Subscription Confirmation */}
            <ConfirmDialog
                isOpen={cancelConfirm !== null}
                onClose={() => setCancelConfirm(null)}
                onConfirm={() => cancelConfirm && handleCancelSubscription(cancelConfirm)}
                title="Cancel Subscription"
                message="Are you sure you want to cancel this subscription? The organization will be downgraded to the Free tier."
                confirmText="Cancel Subscription"
                variant="danger"
            />
        </Stack>
    );
};
