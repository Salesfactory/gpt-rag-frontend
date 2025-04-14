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
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

    const handleSelect = (orgId: string) => {
        setSelectedOrgId(orgId);
    };

    const handleContinue = () => {
        if (selectedOrgId) {
            localStorage.setItem(`selectedOrg_${userId}`, selectedOrgId); // Save selection
            onOrganizationSelected(selectedOrgId); // Notify parent component
        } else {
            toast.error("Organization not properly selected.");
        }
    };

    return (
        <div className={styles.body}>
            <h2 className={styles.title}>Select an Organization</h2>
            <ul className={styles.orgList}>
                {organizations.map((org) => (
                    <li
                        key={org.id}
                        className={`${styles.orgItem} ${selectedOrgId === org.id ? styles.selected : ""}`}
                        onClick={() => handleSelect(org.id)}
                    >
                        {org.name}
                    </li>
                ))}
            </ul>
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