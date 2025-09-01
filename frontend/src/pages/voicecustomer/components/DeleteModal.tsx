import React, { useState } from "react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import { X } from "lucide-react";
import styles from "../VoiceCustomer.module.css";
import { Brand, Product, Competitor } from "../types";
import { deleteBrand, deleteProduct, deleteCompetitor } from "../../../api";
import { toast } from "react-toastify";
import { useAppContext } from "../../../providers/AppProviders";

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Brand | Product | Competitor | null;
    type: "brand" | "product" | "competitor" | "";
    onSuccess: (id: number | string, type: "brand" | "product" | "competitor") => void;
    isLoadingMarkedItems: boolean;
    itemsMarkedForDeletion: any[];
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, item, type, onSuccess, isLoadingMarkedItems, itemsMarkedForDeletion }) => {
    const { user, organization } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);

    const confirmDelete = async () => {
        if (!item || !organization) return;

        setIsLoading(true);
        try {
            if (type === "brand") {
                await deleteBrand({ brand_id: String(item.id), user, organization_id: organization.id });
                toast.success("Brand deleted successfully");
            } else if (type === "product") {
                await deleteProduct({ product_id: String(item.id), user, organization_id: organization.id });
                toast.success("Product deleted successfully");
            } else if (type === "competitor") {
                await deleteCompetitor({ competitor_id: String(item.id), user, organization_id: organization.id });
                toast.success("Competitor deleted successfully");
            }
            if (type === "brand" || type === "product" || type === "competitor") {
                onSuccess(item.id, type);
            }
            onClose();
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            toast.error(`Failed to delete ${type}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalContainer}>
            <div className={styles.modalOverlay} onClick={onClose} />
            <div className={styles.modal}>
                <div className={styles.modalContent}>
                    <div className={styles.deleteModalHeader}>
                        <h3 className={styles.deleteModalTitle}>Delete {type}</h3>
                        <button onClick={onClose} className={styles.modalCloseButton} style={{ color: "#9ca3af" }}>
                            <X size={24} />
                        </button>
                    </div>
                    <p className={styles.deleteModalText}>
                        Are you sure you want to remove <span>{item?.name}</span> from tracking?
                    </p>
                    {type === "brand" && (
                        <>
                            <p className={styles.deleteWarningText}>This will also delete all associated products and competitors.</p>
                            {isLoadingMarkedItems ? (
                                <Spinner size={SpinnerSize.medium} label="Loading associated items..." />
                            ) : (
                                itemsMarkedForDeletion.length > 0 && (
                                    <div className={styles.markedItemsList}>
                                        <h4>Items to be deleted:</h4>
                                        <ul>
                                            {itemsMarkedForDeletion.map((markedItem, index) => (
                                                <li key={index}>
                                                    {markedItem.name} ({markedItem.type})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            )}
                        </>
                    )}

                    <div className={styles.deleteModalActions}>
                        <button type="button" onClick={onClose} className={styles.buttonDeleteCancel}>
                            Cancel
                        </button>
                        <button type="button" onClick={confirmDelete} className={styles.buttonDelete} disabled={isLoading}>
                            {isLoading ? <Spinner size={SpinnerSize.small} /> : "Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
