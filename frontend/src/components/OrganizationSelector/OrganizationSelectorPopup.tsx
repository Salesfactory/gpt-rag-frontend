import styles from "./OrganizationSelectorPopup.module.css";
import { useState } from "react";

const mockOrganizations = [
    { id: "org1", name: "Microsoft" },
    { id: "org2", name: "Blizzard" },
    { id: "org3", name: "Bethesda" },
];

const OrganizationSelectorPopup = () => {
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

    const handleSelect = (orgId: string) => {
        setSelectedOrgId(orgId);
    };

    const handleContinue = () => {
        if (selectedOrgId) {
            console.log("Selected Organization:", selectedOrgId);
            alert(`Redirecting to app with org: ${selectedOrgId}`);
        }
    };

    return (
        <div className={styles.body}>
            <h2 className={styles.title}>Select an Organization</h2>
            <ul className={styles.orgList}>
                {mockOrganizations.map((org) => (
                    <li
                        key={org.id}
                        className={`${styles.orgItem} ${selectedOrgId === org.id ? styles.selected : ""}`}
                        onClick={() => handleSelect(org.id)}
                    >
                        {org.name}
                    </li>
                ))}
            </ul>
            <button
                className={styles.continueButton}
                onClick={handleContinue}
                disabled={!selectedOrgId}
            >
                Continue
            </button>
        </div>
    );
};

export default OrganizationSelectorPopup;
