import React from "react";
import styles from "./SessionExpiredModal.module.css";

interface SessionExpiredModalProps {
    isOpen: boolean;
    onRefresh: () => void;
    onLogout: () => void;
}

/**
 * Modal displayed when user session has expired
 *
 * Features:
 * - Blocking modal (backdrop click disabled)
 * - Clear messaging about session expiration
 * - Options to refresh session or logout
 */
export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ isOpen, onRefresh, onLogout }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={e => e.stopPropagation()}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="session-expired-title">
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2 id="session-expired-title" className={styles.title}>
                            Session Expired
                        </h2>
                        <div className={styles.iconContainer}>
                            <svg
                                className={styles.warningIcon}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className={styles.content}>
                    <div className={styles.messageContainer}>
                        <p className={styles.message}>
                            Your session has expired due to inactivity. To continue using the application, please refresh
                            your session.
                        </p>
                        <p className={styles.subMessage}>
                            Any unsaved work may be lost. Please save your work before refreshing if possible.
                        </p>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.secondaryButton} onClick={onLogout} aria-label="Logout">
                        Logout
                    </button>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={onRefresh}
                        aria-label="Refresh session"
                    >
                        Refresh Session
                    </button>
                </div>
            </div>
        </div>
    );
};
