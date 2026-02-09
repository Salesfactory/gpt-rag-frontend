import React, { useState, useEffect } from "react";
import {
    Stack,
    Text,
    DetailsList,
    DetailsListLayoutMode,
    IColumn,
    SelectionMode,
    PrimaryButton,
    DefaultButton,
    IconButton,
    Spinner,
    SpinnerSize,
    Toggle,
    Icon,
    Dialog,
    DialogType,
    DialogFooter,
    TextField,
    Checkbox,
    useTheme
} from "@fluentui/react";
import { useAppContext } from "../../../providers/AppProviders";
import { getNotifications, createNotification, updateNotification, deleteNotification } from "../../../api/api";
import { ConfirmDialog } from "../../../components/platform-admin/ConfirmDialog/ConfirmDialog";
import styles from "./Notifications.module.css";

interface ToastMessage {
    type: "success" | "error";
    message: string;
}

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    created_at: string;
    enabled: boolean;
}

export const Notifications: React.FC = () => {
    const theme = useTheme();
    const { user } = useAppContext();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewNotification, setViewNotification] = useState<NotificationItem | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; notificationId: string | null }>({
        isOpen: false,
        notificationId: null
    });
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const [formData, setFormData] = useState({ title: "", message: "", enabled: false });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        loadNotifications();
    }, [user]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const loadNotifications = async () => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const response = await getNotifications({ user });
            const rawItems = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
            const normalized: NotificationItem[] = rawItems.map((item: any) => ({
                id: item.id,
                title: item.title,
                message: item.message,
                created_at: item.created_at || item.createdAt,
                enabled: item.enabled ?? item.is_enabled ?? false
            }));
            setNotifications(normalized);
        } catch {
            setToast({ type: "error", message: "Failed to load notifications" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleEnable = async (id: string) => {
        if (!user?.id) {
            setToast({ type: "error", message: "User session unavailable" });
            return;
        }
        const current = notifications.find(n => n.id === id);
        if (!current) return;
        try {
            await updateNotification({ user, notificationId: id, updates: { enabled: !current.enabled } });
            await loadNotifications();
            setToast({ type: "success", message: "Notification status updated" });
        } catch {
            setToast({ type: "error", message: "Failed to update notification status" });
        }
    };

    const handleCreate = async () => {
        if (!formData.title.trim() || !formData.message.trim()) return;
        if (!user?.id) {
            setToast({ type: "error", message: "User session unavailable" });
            return;
        }
        setIsSubmitting(true);
        try {
            await createNotification({ user, title: formData.title, message: formData.message, enabled: formData.enabled });
            setToast({ type: "success", message: "Notification created successfully" });
            setIsModalOpen(false);
            setFormData({ title: "", message: "", enabled: false });
            await loadNotifications();
        } catch {
            setToast({ type: "error", message: "Failed to create notification" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm.notificationId) return;
        if (!user?.id) {
            setToast({ type: "error", message: "User session unavailable" });
            return;
        }
        try {
            await deleteNotification({ user, notificationId: deleteConfirm.notificationId });
            setToast({ type: "success", message: "Notification deleted successfully" });
            await loadNotifications();
        } catch {
            setToast({ type: "error", message: "Failed to delete notification" });
        } finally {
            setDeleteConfirm({ isOpen: false, notificationId: null });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const columns: IColumn[] = [
        {
            key: "title",
            name: "Title",
            fieldName: "title",
            minWidth: 150,
            maxWidth: 250,
            isResizable: true,
            onRender: (item: NotificationItem) => (
                <Text
                    variant="medium"
                    styles={{
                        root: {
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block"
                        }
                    }}
                >
                    {item.title}
                </Text>
            )
        },
        {
            key: "message",
            name: "Message",
            fieldName: "message",
            minWidth: 200,
            maxWidth: 400,
            isResizable: true,
            onRender: (item: NotificationItem) => (
                <Text
                    variant="small"
                    styles={{
                        root: {
                            color: theme.palette.neutralSecondary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block"
                        }
                    }}
                >
                    {item.message}
                </Text>
            )
        },
        {
            key: "created_at",
            name: "Created",
            fieldName: "created_at",
            minWidth: 150,
            maxWidth: 200,
            isResizable: true,
            onRender: (item: NotificationItem) => (
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                    <Icon iconName="Calendar" styles={{ root: { color: theme.palette.neutralSecondary } }} />
                    <Text variant="small">{formatDate(item.created_at)}</Text>
                </Stack>
            )
        },
        {
            key: "actions",
            name: "Actions",
            minWidth: 180,
            maxWidth: 220,
            onRender: (item: NotificationItem) => (
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Toggle checked={item.enabled} onChange={() => handleToggleEnable(item.id)} styles={{ root: { marginBottom: 0 } }} />
                    <IconButton iconProps={{ iconName: "View" }} title="View details" onClick={() => setViewNotification(item)} />
                    <IconButton
                        iconProps={{ iconName: "Delete" }}
                        title="Delete"
                        onClick={() => setDeleteConfirm({ isOpen: true, notificationId: item.id })}
                        styles={{ root: { color: theme.palette.redDark } }}
                    />
                </Stack>
            )
        }
    ];

    return (
        <div className={styles.container}>
            {/* Toast Notification */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}
                >
                    {toast.message}
                </div>
            )}

            <Stack tokens={{ childrenGap: 24 }}>
                {/* Header */}
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="xxLarge" styles={{ root: { fontWeight: 600 } }}>
                            Notifications
                        </Text>
                        <Text variant="medium" styles={{ root: { color: theme.palette.neutralSecondary } }}>
                            Manage in-app notifications for users
                        </Text>
                    </Stack>
                    <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <DefaultButton text="Refresh" iconProps={{ iconName: "Refresh" }} onClick={loadNotifications} />
                        <PrimaryButton text="Create Notification" iconProps={{ iconName: "Add" }} onClick={() => setIsModalOpen(true)} />
                    </Stack>
                </Stack>

                {/* Data Table Card */}
                <Stack
                    styles={{
                        root: {
                            padding: 24,
                            backgroundColor: "white",
                            borderRadius: 8,
                            boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)"
                        }
                    }}
                >
                    {isLoading ? (
                        <Stack horizontalAlign="center" verticalAlign="center" styles={{ root: { padding: "60px 0" } }}>
                            <Spinner size={SpinnerSize.large} label="Loading notifications..." />
                        </Stack>
                    ) : notifications.length === 0 ? (
                        <Stack horizontalAlign="center" verticalAlign="center" tokens={{ childrenGap: 12 }} styles={{ root: { padding: "60px 0" } }}>
                            <Icon iconName="Ringer" styles={{ root: { fontSize: 48, color: theme.palette.neutralTertiary } }} />
                            <Text variant="large" styles={{ root: { color: theme.palette.neutralSecondary } }}>
                                No notifications found
                            </Text>
                            <Text variant="small" styles={{ root: { color: theme.palette.neutralTertiary } }}>
                                Create your first notification to get started
                            </Text>
                        </Stack>
                    ) : (
                        <DetailsList
                            items={notifications}
                            columns={columns}
                            layoutMode={DetailsListLayoutMode.justified}
                            selectionMode={SelectionMode.none}
                            isHeaderVisible={true}
                        />
                    )}
                </Stack>
            </Stack>

            {/* Create Modal */}
            <Dialog
                hidden={!isModalOpen}
                onDismiss={() => setIsModalOpen(false)}
                dialogContentProps={{
                    type: DialogType.largeHeader,
                    title: "Create Notification",
                    subText: "Create a new in-app notification for users."
                }}
                modalProps={{
                    isBlocking: true,
                    styles: { main: { maxWidth: 500 } }
                }}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                        label="Title"
                        required
                        value={formData.title}
                        onChange={(_, val) => setFormData({ ...formData, title: val || "" })}
                        placeholder="Important Update"
                    />
                    <TextField
                        label="Message"
                        required
                        multiline
                        rows={4}
                        value={formData.message}
                        onChange={(_, val) => setFormData({ ...formData, message: val || "" })}
                        placeholder="Enter the notification message here..."
                    />
                    <Checkbox
                        label="Enable immediately"
                        checked={formData.enabled}
                        onChange={(_, checked) => setFormData({ ...formData, enabled: !!checked })}
                    />
                </Stack>
                <DialogFooter>
                    <DefaultButton onClick={() => setIsModalOpen(false)} text="Cancel" />
                    <PrimaryButton
                        onClick={handleCreate}
                        text={isSubmitting ? "Creating..." : "Create"}
                        disabled={isSubmitting || !formData.title.trim() || !formData.message.trim()}
                    />
                </DialogFooter>
            </Dialog>

            {/* View Modal */}
            <Dialog
                hidden={!viewNotification}
                onDismiss={() => setViewNotification(null)}
                dialogContentProps={{
                    type: DialogType.largeHeader,
                    title: "Notification Details"
                }}
                modalProps={{
                    styles: { main: { maxWidth: 500 } }
                }}
            >
                {viewNotification && (
                    <Stack tokens={{ childrenGap: 16 }}>
                        <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary, fontWeight: 600 } }}>
                                Title
                            </Text>
                            <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                                {viewNotification.title}
                            </Text>
                        </Stack>

                        <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary, fontWeight: 600 } }}>
                                Message
                            </Text>
                            <Text variant="medium" styles={{ root: { whiteSpace: "pre-wrap" } }}>
                                {viewNotification.message}
                            </Text>
                        </Stack>

                        <Stack horizontal tokens={{ childrenGap: 24 }}>
                            <Stack tokens={{ childrenGap: 4 }}>
                                <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary, fontWeight: 600 } }}>
                                    Status
                                </Text>
                                <div
                                    style={{
                                        display: "inline-block",
                                        padding: "4px 12px",
                                        borderRadius: 12,
                                        backgroundColor: viewNotification.enabled ? "#dff6dd" : "#f3f2f1",
                                        color: viewNotification.enabled ? "#107c10" : "#605e5c",
                                        fontWeight: 600,
                                        fontSize: 12
                                    }}
                                >
                                    {viewNotification.enabled ? "Enabled" : "Disabled"}
                                </div>
                            </Stack>

                            <Stack tokens={{ childrenGap: 4 }}>
                                <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary, fontWeight: 600 } }}>
                                    Created
                                </Text>
                                <Text variant="medium">{formatDate(viewNotification.created_at)}</Text>
                            </Stack>
                        </Stack>
                    </Stack>
                )}
                <DialogFooter>
                    <DefaultButton onClick={() => setViewNotification(null)} text="Close" />
                </DialogFooter>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, notificationId: null })}
                onConfirm={handleDelete}
                title="Delete Notification"
                message="Are you sure you want to delete this notification? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
};
