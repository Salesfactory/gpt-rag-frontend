import styles from "./OrganizationSelectorPopup.module.css";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { toast } from "react-toastify";
import { Check, ChevronDown } from "lucide-react";
import { logOrganizationSession } from "../../api";

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
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function setCookie(name: any, value: string | number | boolean, days: number) {
        const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    }

    const handleContinue = async () => {
        if (!selectedOrgId) {
            toast.error("Please select an organization.");
            return;
        }

        const currentCookie = document.cookie
            .split("; ")
            .find(row => row.startsWith(`selectedOrg_${userId}=`))
            ?.split("=")[1];

        const currentOrgId = currentCookie ? decodeURIComponent(currentCookie) : null;

        if (currentOrgId === selectedOrgId) {
            toast.warning("You are already using this organization.");
            return;
        }

        try {
            await logOrganizationSession({
                userId,
                organizationId: selectedOrgId,
                metadata: {
                    source: "organization-selector-popup",
                    previousOrganizationId: currentOrgId
                }
            });
        } catch (logError) {
            console.error("Failed to log organization selection", logError);
            toast.warning("Unable to register the organization selection. Continuing anyway.");
        }

        setCookie(`selectedOrg_${userId}`, selectedOrgId || "", 1);
        sessionStorage.setItem(`selectedOrg_${userId}`, selectedOrgId);
        onOrganizationSelected(selectedOrgId);
    };

    const toggleDropdown = useCallback(() => {
        if (!sortedOrganizations.length) return;
        setIsOpen(prev => !prev);
    }, [sortedOrganizations.length]);

    const handleOptionSelect = useCallback((orgId: string) => {
        setSelectedOrgId(orgId);
        setIsOpen(false);
    }, []);

    const selectedOrgLabel = sortedOrganizations.find(org => org.id === selectedOrgId)?.name || "Select an organization";

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleDropdown();
        }

        if (event.key === "Escape") {
            setIsOpen(false);
        }
    };

    return (
        <div className={styles.body}>
            <h2 className={styles.title}>Select an Organization</h2>
            <div className={styles.dropdownWrapper} ref={dropdownRef}>
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    className={`${styles.customSelectTrigger} ${isOpen ? styles.open : ""}`}
                    onClick={toggleDropdown}
                    onKeyDown={handleTriggerKeyDown}
                >
                    <span>{selectedOrgLabel}</span>
                    <ChevronDown size={18} color={isOpen ? "#A0CB06" : "#666666"} />
                </button>

                {isOpen && (
                    <ul className={styles.customOptionsList} role="listbox" aria-activedescendant={selectedOrgId}>
                        {sortedOrganizations.map(org => {
                            const isSelected = org.id === selectedOrgId;
                            return (
                                <li
                                    key={org.id}
                                    id={org.id}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`${styles.customOption} ${isSelected ? styles.selectedOption : ""}`}
                                    onClick={() => handleOptionSelect(org.id)}
                                >
                                    {isSelected && <Check size={16} className={styles.checkIcon} />}
                                    <span className={styles.optionLabel}>{org.name}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className={styles.actions}>
                <button className={styles.continueButton} onClick={handleContinue} disabled={!selectedOrgId} aria-label="Continue">
                    Continue
                </button>
            </div>
        </div>
    );
};

export default OrganizationSelectorPopup;
