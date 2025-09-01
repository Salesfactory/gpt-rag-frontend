import React, { useState, useEffect } from "react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import { Modal } from "./Modal";
import styles from "../VoiceCustomer.module.css";
import { Brand } from "../types";
import { createBrand, updateBrand } from "../../../api";
import { toast } from "react-toastify";
import { useAppContext } from "../../../providers/AppProviders";

interface BrandModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingBrand: Brand | null;
    onSuccess: (item: Brand) => void;
}

export const BrandModal: React.FC<BrandModalProps> = ({ isOpen, onClose, editingBrand, onSuccess }) => {
    const { user, organization } = useAppContext();
    const [newBrand, setNewBrand] = useState({ name: "", description: "" });
    const [brandError, setBrandError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (editingBrand) {
            setNewBrand({ name: editingBrand.name, description: editingBrand.description });
        } else {
            setNewBrand({ name: "", description: "" });
        }
    }, [editingBrand, isOpen]);

    const handleSubmit = async () => {
        if (editingBrand) {
            await handleEditBrand();
        } else {
            await handleAddBrand();
        }
    };

    const handleAddBrand = async () => {
        if (!organization) return;
        if (newBrand.name.trim().length === 0) {
            setBrandError("Brand name is required");
            return;
        }

        setIsLoading(true);
        try {
            const createdBrandResponse = await createBrand({
                brand_name: newBrand.name,
                brand_description: newBrand.description,
                organization_id: organization.id,
                user
            });
            toast.success("Brand added successfully");

            const finalBrand: Brand = {
                id: createdBrandResponse.id,
                name: newBrand.name,
                description: newBrand.description,
                organization_id: organization.id
            };

            onSuccess(finalBrand);
            onClose();
        } catch (error) {
            toast.error("Failed to create brand. Please try again.");
            console.error("Error creating brand:", error);
            setBrandError("Failed to create brand. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditBrand = async () => {
        if (!organization || !editingBrand) return;
        if (newBrand.name.trim().length === 0) {
            setBrandError("Brand name is required");
            return;
        }

        setIsLoading(true);
        try {
            await updateBrand({
                brand_id: String(editingBrand.id),
                brand_name: newBrand.name,
                brand_description: newBrand.description,
                organization_id: organization.id,
                user
            });
            toast.success("Brand updated successfully");

            const updatedBrand: Brand = {
                ...editingBrand,
                name: newBrand.name,
                description: newBrand.description
            };

            onSuccess(updatedBrand);
            onClose();
        } catch (error) {
            toast.error("Failed to update brand. Please try again.");
            console.error("Error updating brand:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingBrand ? "Edit Brand" : "Add Brand to Track"}>
            <div className={styles.modalBody}>
                <div>
                    <label className={styles.formLabel}>Brand Name</label>
                    <input
                        type="text"
                        value={newBrand.name}
                        onChange={e => {
                            setNewBrand({ ...newBrand, name: e.target.value });
                            if (brandError) setBrandError("");
                        }}
                        placeholder="Enter brand name"
                        className={styles.formInput}
                    />
                </div>
                <div>
                    <label className={styles.formLabel}>Description (Optional)</label>
                    <textarea
                        value={newBrand.description}
                        onChange={e => setNewBrand({ ...newBrand, description: e.target.value })}
                        placeholder="Brief description of the brand"
                        rows={3}
                        className={styles.formTextarea}
                    />
                </div>
                {brandError && <p className={styles.errorMessage}>{brandError}</p>}
            </div>
            <div className={styles.modalActions}>
                <button onClick={onClose} className={`${styles.button} ${styles.buttonCancel}`}>
                    Cancel
                </button>
                <button
                    aria-label={editingBrand ? "update-brand-button" : "add-brand-button"}
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className={`${styles.button} ${styles.buttonConfirm}`}
                >
                    {isLoading ? <Spinner size={SpinnerSize.small} /> : editingBrand ? "Update" : "Add"}
                </button>
            </div>
        </Modal>
    );
};
