import React, { useEffect, useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import styles from "./OrganizationModal.module.css";
import { fetchUserOrganizations, fetchUserRoleForOrganization, getUsers } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import { toast, ToastContainer } from "react-toastify";

type Organization = {
    id: string;
    name: string;
    role: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

const roleDisplayNames: Record<string, string> = {
    platformadmin: "Platform Admin",
    admin: "Admin",
    user: "User"
};

const roleStyles: Record<string, string> = {
    platformadmin: styles.rolePlatformAdmin,
    admin: styles.roleAdmin,
    user: styles.roleUser
};

function setCookie(name: string, value: string | number | boolean, days: number) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}


const OrganizationModal = ({ isOpen, onClose }: Props) => {
    const { user } = useAppContext();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const userId = user?.id;
        if (userId) {
            const cookieValue = document.cookie
                .split("; ")
                .find(row => row.startsWith(`selectedOrg_${userId}=`))
                ?.split("=")[1];

            if (cookieValue) {
                setSelectedOrgId(decodeURIComponent(cookieValue));
            }
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const rawOrgs = await fetchUserOrganizations(user?.id || "");

                const detailedOrgs: Organization[] = await Promise.all(
                    rawOrgs.map(async (org: any) => {
                        const orgId = org.id || org.organization_id;
                        if (!orgId) {
                            console.warn("Organization ID is missing for:", org);
                            return null;
                        }
                        const role = await fetchUserRoleForOrganization(user?.id || "", org.id);
                        return {
                            id: org.id,
                            name: org.name,
                            role: role?.role ?? "Unknown"
                        };
                    })
                );

                setOrganizations(detailedOrgs.filter(Boolean));
            } catch (err) {
                console.error(err);
                setError("Failed to load organizations");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen]);

    const handleContinue = () => {
        const userId = user?.id;
        if (!selectedOrgId || !userId) return;

        const currentCookie = document.cookie
            .split("; ")
            .find(row => row.startsWith(`selectedOrg_${userId}=`))
            ?.split("=")[1];

        const currentOrgId = currentCookie ? decodeURIComponent(currentCookie) : null;

        if (currentOrgId === selectedOrgId) {
            toast.warning("You are already using this organization.", { autoClose: 3000 });
            return;
        }

        setCookie(`selectedOrg_${userId}`, selectedOrgId, 1);
        toast("Switching organizations. The window will restart in 2 seconds.", { type: "success" });
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <ToastContainer />
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2 className={styles.title}>Switch Organization</h2>
                        <button onClick={onClose} className={styles.closeButton}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    {loading && (
                        <div className={styles.loadingContainer}>
                            <Loader2 size={20} className={styles.loadingIcon} />
                            <span className={styles.loadingText}>Loading organizations...</span>
                        </div>
                    )}

                    {error && (
                        <div className={styles.errorContainer}>
                            <AlertCircle size={20} className={styles.errorIcon} />
                            <span className={styles.errorText}>{error}</span>
                        </div>
                    )}

                    {!loading && !error && organizations.length === 0 && (
                        <div className={styles.emptyState}>
                            <p className={styles.emptyText}>No organizations found</p>
                        </div>
                    )}

                    {!loading && !error && organizations.length > 0 && (
                        <div className={styles.orgList}>
                            {organizations.map(org => (
                                <div
                                    key={org.id}
                                    onClick={() => setSelectedOrgId(org.id)}
                                    className={`${styles.orgCard} ${selectedOrgId === org.id ? styles.selected : ""}`}
                                >
                                    <div className={styles.orgCardContent}>
                                        <div className={styles.orgIcon}>
                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.icon}>
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            
                                            <h3 className={styles.orgTitle}>{org.name}</h3>
                                            <div className={styles.orgDetails}>
                                                <span className={`${styles.roleBadge} ${roleStyles[org.role.toLowerCase()] || styles.roleUser}`}>
                                                    {roleDisplayNames[org.role.toLowerCase()] || org.role}
                                                </span>
                                            </div>
                                        </div>
                                     </div>
                                    {selectedOrgId === org.id && (
                                        <div className={styles.check}>
                                            <svg width="12" height="12" fill="white" viewBox="0 0 20 20">
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {!loading && (
                    <div className={styles.footer}>
                        <button onClick={handleContinue} disabled={!selectedOrgId} className={styles.closeModalBtn}>
                            Continue
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrganizationModal;
