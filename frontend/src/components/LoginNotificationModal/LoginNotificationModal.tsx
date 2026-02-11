import React from "react";
import { Dialog, DialogFooter, DialogType, Icon, PrimaryButton, Text } from "@fluentui/react";
import styles from "./LoginNotificationModal.module.css";

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    created_at?: string;
    createdAt?: string;
    enabled?: boolean;
    is_enabled?: boolean;
    start_at?: string;
    startAt?: string;
    end_at?: string;
    endAt?: string;
    acknowledgedBy?: string[];
    acknowledged_by?: string[];
}

interface LoginNotificationModalProps {
    notification: NotificationItem | null;
    isOpen: boolean;
    onAcknowledge: () => void;
}

const formatNotificationDate = (dateValue?: string) => {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

export const LoginNotificationModal: React.FC<LoginNotificationModalProps> = ({ notification, isOpen, onAcknowledge }) => {
    return (
        <Dialog
            hidden={!isOpen || !notification}
            onDismiss={onAcknowledge}
            dialogContentProps={{
                showCloseButton: false,
                className: styles.dialogContent
            }}
            modalProps={{
                isBlocking: true,
                className: styles.modal,
                styles: {
                    main: {
                        width: 400,
                        minWidth: 400,
                        maxWidth: 400,
                        borderRadius: 16
                    }
                }
            }}
        >
            {notification && (
                <div className={styles.body}>
                    <div className={styles.BellandText}>
                        <div className={styles.bellWrapper}>
                            <Icon iconName="Ringer" styles={{ root: { fontSize: 24, color: "#A0CB06" } }} />
                        </div>
                        <div className={styles.headerText}>New Notification</div>
                    </div>
                    <div className={styles.title}>{notification.title}</div>
                    <div className={styles.message}>{notification.message}</div>
                    <div className={styles.timestamp}>{formatNotificationDate(notification.created_at || notification.createdAt)}</div>
                </div>
            )}
            <DialogFooter
                styles={{
                    actions: {
                        display: "flex",
                        justifyContent: "center"
                    }
                }}
            >
                <PrimaryButton
                    text="Got it"
                    onClick={onAcknowledge}
                    styles={{
                        root: {
                            background: "#A0CB06",
                            borderColor: "#A0CB06",
                            borderRadius: 8,
                            transition: "transform 120ms ease, background-color 120ms ease, border-color 120ms ease"
                        },
                        rootHovered: {
                            background: "#A0CB06",
                            borderColor: "#A0CB06",
                            borderRadius: 8,
                            transform: "scale(1.08)"
                        },
                        rootPressed: {
                            background: "#7a9804",
                            borderColor: "#7a9804",
                            borderRadius: 8
                        }
                    }}
                />
            </DialogFooter>
        </Dialog>
    );
};
