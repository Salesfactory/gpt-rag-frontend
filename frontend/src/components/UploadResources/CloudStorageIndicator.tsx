// CloudStorageIndicator.tsx
import React, { useEffect, useState } from "react";
import styles from "./UploadResources.module.css";
import { getStorageUsageByOrganization } from "../../api";
import { useAppContext } from "../../providers/AppProviders";
import { toast } from "react-toastify";

type StorageData = {
    freeStorage: number;
    percentageUsed: number;
    storageCapacity: number;
    usedStorage: number;
};

const formatBytes = (bytes: number, locale = "en-US") => {
    if (!isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    const min = i >= 2 ? 2 : 0;
    const max = i >= 2 ? 2 : 0;
    const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max });
    return `${nf.format(value)} ${units[i]}`;
};

const CloudStorageIndicator = ({ isLoading }: { isLoading: boolean }) => {
    const { user, organization } = useAppContext();

    const [storageData, setStorageData] = useState<StorageData | null>(null);

    const BYTES_PER_GB = 1024 ** 3;

    useEffect(() => {
        const fetchStorageData = async (organization_id: string, user: any) => {
            try {
                const response = await getStorageUsageByOrganization(organization_id, user);
                const data = response.data;
                setStorageData(data);
            } catch (error) {
                console.error("Error fetching storage data:", error);
                toast.error("Failed to load storage data.");
            }
        };

        fetchStorageData(organization?.id || "", user);
    }, [isLoading, organization?.id, user]);

    const totalBytes = (storageData?.storageCapacity || 0) * BYTES_PER_GB; //GB
    const usedBytes = (storageData?.usedStorage || 0) * BYTES_PER_GB; // GB -> Bytes
    const loading = false;

    const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
    const safeTotal = Math.max(0, totalBytes || 0);
    const safeUsed = Math.min(Math.max(0, usedBytes || 0), safeTotal || Number.MAX_SAFE_INTEGER);
    const pct = safeTotal > 0 ? Math.min(100, (safeUsed / safeTotal) * 100) : 0;
    const pctText = pct > 0 && pct < 0.01 ? "<0.01" : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pct);
    const hasUsed = safeUsed > 0;
    const progressMax = Math.max(1, safeTotal);
    const progressValue = Math.min(progressMax, safeTotal > 0 ? safeUsed : 0);
    const free = Math.max(0, safeTotal - safeUsed);

    return (
        <section className={styles.storageCard} aria-label="Cloud Storage">
            <div className={styles.storageTopRow}>
                <div>
                    <div className={styles.storageTitle}>Cloud Storage</div>
                    <div className={styles.storageSub}>{safeTotal > 0 ? `${formatBytes(safeTotal)} Total Storage` : "—"}</div>
                </div>
                <div className={styles.storageRight}>
                    <span className={styles.storagePct}>{pctText}%</span>
                    <div>used</div>
                </div>
            </div>

            <div className={styles.storageBarWrapper}>
                {loading ? (
                    <div className={`${styles.storageBar} ${styles.isLoading}`} />
                ) : (
                    <>
                        <progress className={styles.srOnly} value={progressValue} max={progressMax} aria-label="Cloud storage used">
                            {pctText}%
                        </progress>
                        <div className={styles.storageBar} aria-hidden="true">
                            <div className={styles.storageBarFill} data-has-used={hasUsed} style={{ width: `${pct}%` }} />
                        </div>
                    </>
                )}
            </div>

            <div className={styles.storageBottomRow}>
                <span>{formatBytes(safeUsed, locale)} used</span>
                <span>{formatBytes(free, locale)} free</span>
            </div>
        </section>
    );
};

export default CloudStorageIndicator;
