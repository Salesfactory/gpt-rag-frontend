import styles from "./OrganizationSelectorPopup.module.css";
import { useState } from "react";
import { toast } from "react-toastify";

interface Organization {
    id: string;
    name: string;
}

interface OrganizationSelectorPopupProps {
    organizations: Organization[];
    userId: string;
    onOrganizationSelected: (orgId: string) => void;
    onCancel: () => void;
}

const OrganizationSelectorPopup: React.FC<OrganizationSelectorPopupProps> = ({
    organizations,
    userId,
    onOrganizationSelected,
    onCancel,
}) => {
    const [selectedOrgId, setSelectedOrgId] = useState<string>("");

    const handleContinue = () => {
        if (selectedOrgId) {
            localStorage.setItem(`selectedOrg_${userId}`, selectedOrgId);
            onOrganizationSelected(selectedOrgId);
        } else {
            toast.error("Please select an organization.");
        }
    };

    return (
        <div className={styles.body}>
            <h2 className={styles.title}>Select an Organization</h2>
            <div className={styles.dropdownWrapper}>
                <select
                    className={`${styles.dropdown} ${selectedOrgId ? styles.selected : ""}`}
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                >
                    {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                            {org.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className={styles.actions}>
                <button
                    className={styles.continueButton}
                    onClick={handleContinue}
                    disabled={!selectedOrgId}
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

export default OrganizationSelectorPopup;
