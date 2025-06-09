import styles from "./OrganizationSelectorPopup.module.css";
import { useEffect, useState } from "react";
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

const OrganizationSelectorPopup: React.FC<OrganizationSelectorPopupProps> = ({ organizations, userId, onOrganizationSelected, onCancel }) => {
    const [selectedOrgId, setSelectedOrgId] = useState<string>("");

    useEffect(() => {
        if (organizations.length > 0 && !selectedOrgId) {
            setSelectedOrgId(organizations[0].id);
        }
    }, [organizations, selectedOrgId]);

    function setCookie(name: any, value: string | number | boolean, days: number) {
        const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    }

    const handleContinue = () => {
        if (selectedOrgId) {
            setCookie(`selectedOrg_${userId}`, selectedOrgId || "", 1);
            sessionStorage.setItem(`selectedOrg_${userId}`, selectedOrgId);
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
                    onChange={e => setSelectedOrgId(e.target.value)}
                >
                    {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                            {org.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className={styles.actions}>
                <button className={styles.continueButton} onClick={handleContinue} disabled={!selectedOrgId}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default OrganizationSelectorPopup;
