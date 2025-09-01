import React from "react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import styles from "../VoiceCustomer.module.css";

interface Item {
    id: number | string;
    name: string;
    [key: string]: any;
}

interface InfoCardProps<T extends Item> {
    title: string;
    icon: React.ReactNode;
    items: T[];
    itemLimit: number;
    isLoading: boolean;
    onAdd: () => void;
    onEdit: (item: T) => void;
    onDelete: (item: T) => void;
    renderItem: (item: T) => React.ReactNode;
    entityType: "brand" | "product" | "competitor";
    addDisabled?: boolean;
}

export function InfoCard<T extends Item>({
    title,
    icon,
    items,
    itemLimit,
    isLoading,
    onAdd,
    onEdit,
    onDelete,
    renderItem,
    entityType,
    addDisabled = false
}: InfoCardProps<T>) {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <div className={styles.cardHeaderTitle}>
                    {icon}
                    <h3 className={styles.cardTitle}>
                        {title} ({items.length}/{itemLimit})
                    </h3>
                </div>
                <button
                    aria-label={`create-${entityType}-button`}
                    onClick={onAdd}
                    disabled={items.length >= itemLimit || addDisabled}
                    className={styles.headerAddButton}
                >
                    <PlusCircle size={16} />
                </button>
            </div>
            <div className={styles.cardBody}>
                {isLoading ? (
                    <Spinner size={SpinnerSize.large} label={`Loading ${title.toLowerCase()}...`} />
                ) : items.length === 0 ? (
                    <p className={styles.emptyStateText}>No {title.toLowerCase()} added yet</p>
                ) : (
                    <div className={styles.itemsList}>
                        {items.map(item => (
                            <div key={item.id} className={styles.listItem}>
                                <div className={styles.itemContent}>{renderItem(item)}</div>
                                <div className={styles.itemActions}>
                                    <button onClick={() => onEdit(item)} className={styles.iconButton}>
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => onDelete(item)} className={`${styles.iconButton} ${styles.deleteButton}`}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
