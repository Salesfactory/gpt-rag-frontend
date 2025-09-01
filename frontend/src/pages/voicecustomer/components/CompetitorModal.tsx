import React, { useState, useEffect } from "react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import { Modal } from "./Modal";
import styles from "../VoiceCustomer.module.css";
import { Competitor } from "../types";
import { createCompetitor, updateCompetitor } from "../../../api";
import { toast } from "react-toastify";
import { useAppContext } from "../../../providers/AppProviders";

interface CompetitorModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingCompetitor: Competitor | null;
    onSuccess: (item: Competitor) => void;
}

export const CompetitorModal: React.FC<CompetitorModalProps> = ({ isOpen, onClose, editingCompetitor, onSuccess }) => {
    const { user, organization } = useAppContext();
    const [newCompetitor, setNewCompetitor] = useState<{ name: string; industry: string; description: string; brandIds: number[] }>({
        name: "",
        industry: "",
        description: "",
        brandIds: []
    });
    const [competitorError, setCompetitorError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (editingCompetitor) {
            setNewCompetitor({
                name: editingCompetitor.name,
                industry: editingCompetitor.industry,
                description: editingCompetitor.description,
                brandIds: editingCompetitor.brands ? editingCompetitor.brands.map(b => b.brand_id) : []
            });
        } else {
            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
        }
    }, [editingCompetitor, isOpen]);

    const handleSubmit = async () => {
        if (editingCompetitor) {
            await handleEditCompetitor();
        } else {
            await handleAddCompetitor();
        }
    };

    const handleAddCompetitor = async () => {
        if (!organization) return;
        if (newCompetitor.name.trim().length === 0 || newCompetitor.industry.trim().length === 0) {
            setCompetitorError("Competitor name and industry are required");
            return;
        }

        setIsLoading(true);
        try {
            const createdCompetitorResponse = await createCompetitor({
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                industry: newCompetitor.industry,
                brands_id: (newCompetitor.brandIds || []).map(String),
                organization_id: organization.id,
                user
            });
            toast.success("Competitor added successfully");

            const finalCompetitor: Competitor = {
                id: createdCompetitorResponse.id,
                name: newCompetitor.name,
                description: newCompetitor.description,
                industry: newCompetitor.industry,
                organization_id: organization.id,
                brands: [] // Assuming brands are not returned on creation
            };

            onSuccess(finalCompetitor);
            onClose();
        } catch (error) {
            toast.error("Failed to create competitor. Please try again.");
            console.error("Error creating competitor:", error);
            setCompetitorError("Failed to create competitor. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditCompetitor = async () => {
        if (!organization || !editingCompetitor) return;
        if (newCompetitor.name.trim().length === 0 || newCompetitor.industry.trim().length === 0) {
            setCompetitorError("Competitor name and industry are required");
            return;
        }

        setIsLoading(true);
        try {
            await updateCompetitor({
                competitor_id: String(editingCompetitor.id),
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                industry: newCompetitor.industry,
                brands_id: (newCompetitor.brandIds || []).map(String),
                user,
                organization_id: organization.id
            });
            toast.success("Competitor updated successfully");

            const updatedCompetitor: Competitor = {
                ...editingCompetitor,
                name: newCompetitor.name,
                description: newCompetitor.description,
                industry: newCompetitor.industry
            };

            onSuccess(updatedCompetitor);
            onClose();
        } catch (error) {
            toast.error("Failed to update competitor. Please try again.");
            console.error("Error updating competitor:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingCompetitor ? "Edit Competitor" : "Add Competitor to Track"}>
            <div className={styles.modalBody}>
                <div>
                    <label className={styles.formLabel}>Competitor Name</label>
                    <input
                        type="text"
                        value={newCompetitor.name}
                        onChange={e => {
                            setNewCompetitor({ ...newCompetitor, name: e.target.value });
                            if (competitorError) setCompetitorError("");
                        }}
                        placeholder="Enter competitor name"
                        className={styles.formInput}
                    />
                </div>
                <div>
                    <label className={styles.formLabel}>Industry</label>
                    <input
                        type="text"
                        value={newCompetitor.industry}
                        onChange={e => setNewCompetitor({ ...newCompetitor, industry: e.target.value })}
                        placeholder="Enter industry"
                        className={styles.formInput}
                    />
                </div>
                <div>
                    <label className={styles.formLabel}>Description (Optional)</label>
                    <textarea
                        value={newCompetitor.description}
                        onChange={e => setNewCompetitor({ ...newCompetitor, description: e.target.value })}
                        placeholder="Brief description of the competitor"
                        rows={3}
                        className={styles.formTextarea}
                    />
                </div>
                {competitorError && <p className={styles.errorMessage}>{competitorError}</p>}
            </div>
            <div className={styles.modalActions}>
                <button onClick={onClose} className={`${styles.button} ${styles.buttonCancel}`}>
                    Cancel
                </button>
                <button
                    aria-label={editingCompetitor ? "update-competitor-button" : "add-competitor-button"}
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className={`${styles.button} ${styles.buttonConfirm}`}
                >
                    {isLoading ? <Spinner size={SpinnerSize.small} /> : editingCompetitor ? "Update" : "Add"}
                </button>
            </div>
        </Modal>
    );
};
