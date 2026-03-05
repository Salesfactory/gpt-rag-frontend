import React, { useEffect, useId, useRef } from "react";
import { Trash2 } from "lucide-react";
import styles from "./DeleteConfirmModal.module.css";

interface DeleteConfirmModalProps {
    isOpen: boolean;
    itemType: string;
    itemName: string;
    onCancel: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    warningMessage?: string;
    confirmLabel?: string;
    isDeleting?: boolean;
}

const getFocusableElements = (root: HTMLElement | null): HTMLElement[] => {
    if (!root) return [];

    const selector = [
        "button:not([disabled])",
        "[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])'
    ].join(",");

    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(el => !el.hasAttribute("disabled") && el.tabIndex !== -1);
};

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    isOpen,
    itemType,
    itemName,
    onCancel,
    onConfirm,
    title,
    message,
    warningMessage,
    confirmLabel,
    isDeleting = false
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
        cancelButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isDeleting) {
                event.preventDefault();
                onCancel();
                return;
            }

            if (event.key !== "Tab") return;

            const focusable = getFocusableElements(modalRef.current);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement as HTMLElement | null;

            if (event.shiftKey) {
                if (active === first) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previouslyFocusedElementRef.current?.focus();
        };
    }, [isOpen, isDeleting, onCancel]);

    if (!isOpen) return null;

    const normalizedType = itemType.trim().toLowerCase();
    const computedTitle = title ?? `Delete ${itemType}`;
    const computedMessage = message ?? `Are you sure you want to delete this ${normalizedType}?`;
    const computedConfirmLabel = confirmLabel ?? `Delete ${itemType}`;

    return (
        <div
            className={styles.overlay}
            onMouseDown={event => {
                if (!isDeleting && event.target === event.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerIcon}>
                            <Trash2 size={20} color="#dc2626" />
                        </div>
                        <h2 id={titleId} className={styles.title}>
                            {computedTitle}
                        </h2>
                    </div>
                </div>

                <div className={styles.content}>
                    <p id={descriptionId} className={styles.message}>
                        {computedMessage}
                    </p>
                    <div className={styles.nameContainer}>
                        <span className={styles.name}>{itemName}</span>
                    </div>
                    {warningMessage ? <p className={styles.warning}>{warningMessage}</p> : null}
                </div>

                <div className={styles.footer}>
                    <button ref={cancelButtonRef} type="button" onClick={onCancel} className={styles.cancelButton} disabled={isDeleting}>
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} className={styles.deleteButton} disabled={isDeleting}>
                        {isDeleting ? "Deleting..." : computedConfirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmModal;
