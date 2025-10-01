import styles from "./OrganizationSelectorPopup.module.css";
import { useEffect, useMemo, useState } from "react";
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

    const sortedOrganizations = useMemo(() => {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
        return [...organizations].sort((a, b) => {
            const byName = collator.compare(a.name, b.name);
            return byName !== 0 ? byName : a.id.localeCompare(b.id);
        });
    }, [organizations]);

    useEffect(() => {
        if (sortedOrganizations.length === 0) return;
        const stillExists = sortedOrganizations.some(o => o.id === selectedOrgId);
        if (!selectedOrgId || !stillExists) {
            setSelectedOrgId(sortedOrganizations[0].id);
        }
    }, [sortedOrganizations, selectedOrgId]);

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
                    id="organizationSelect"
                    name="organization"
                    aria-label="Select an organization"
                    className={`${styles.dropdown} ${selectedOrgId ? styles.selected : ""}`}
                    value={selectedOrgId}
                    onChange={e => setSelectedOrgId(e.target.value)}
                >
                    {sortedOrganizations.map(org => (
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
