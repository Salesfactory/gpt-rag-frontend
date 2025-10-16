// CloudStorageIndicator.tsx
import React from "react";
import styles from "./UploadResources.module.css";

type Scope = "organization" | "user";

interface Props {
    totalBytes: number;
    usedBytes: number;
    scope?: Scope;
    loading?: boolean;
}

const formatBytes = (bytes: number) => {
    if (!isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    const decimals = i >= 2 ? 1 : 0;
    return `${value.toFixed(decimals)} ${units[i]}`;
};

const CloudStorageIndicator: React.FC<Props> = ({ totalBytes, usedBytes, scope, loading }) => {
    const safeTotal = Math.max(0, totalBytes || 0);
    const safeUsed = Math.min(Math.max(0, usedBytes || 0), safeTotal || Number.MAX_SAFE_INTEGER);
    const pct = safeTotal > 0 ? Math.min(100, (safeUsed / safeTotal) * 100) : 0;
    const now = Number.isFinite(pct) ? Math.min(100, Math.max(0, Math.round(pct))) : 0;
    const progressMax = Math.max(1, safeTotal);
    const progressValue = Math.min(progressMax, safeTotal > 0 ? safeUsed : 0);
    const free = Math.max(0, safeTotal - safeUsed);

    return (
        <section className={styles.storageCard} aria-label="Cloud Storage">
            <div className={styles.storageTopRow}>
                <div>
                    <div className={styles.storageTitle}>Cloud Storage</div>
                    <div className={styles.storageSub}>
                        {safeTotal > 0 ? `${formatBytes(safeTotal)} Total Storage` : "—"}
                        {scope ? ` · ${scope === "organization" ? "Organization" : "User"}` : ""}
                    </div>
                </div>
                <div className={styles.storageRight}>
                    <span className={styles.storagePct}>{Math.round(pct)}%</span> used
                </div>
            </div>

            <div className={styles.storageBarWrapper}>
                {loading ? (
                    <div className={`${styles.storageBar} ${styles.isLoading}`} />
                ) : (
                    <>
                        <progress className={styles.srOnly} value={progressValue} max={progressMax} aria-label="Cloud storage used">
                            {now}%
                        </progress>
                        <div className={styles.storageBar} aria-hidden="true">
                            <div className={styles.storageBarFill} style={{ width: `${now}%` }} />
                        </div>
                    </>
                )}
            </div>

            <div className={styles.storageBottomRow}>
                <span>{formatBytes(safeUsed)} used</span>
                <span>{formatBytes(free)} free</span>
            </div>
        </section>
    );
};

export default CloudStorageIndicator;
