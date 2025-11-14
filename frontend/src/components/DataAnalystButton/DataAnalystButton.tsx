import styles from "./DataAnalystButton.module.css";

type DataAnalystButtonProps = {
    isEnabled: boolean;
    isActive: boolean;
    ariaLabel?: string;
    className?: string;
    onChange?: (isActive: boolean) => void;
};

const DataAnalystButton = ({ isEnabled, isActive, ariaLabel = "Data analyst mode", className, onChange }: DataAnalystButtonProps) => {
    const handleClick = () => {
        if (!isEnabled) return;
        const newState = !isActive;
        onChange?.(newState);
    };

    return (
        <div className={styles.tooltipContainer}>
            <button
                type="button"
                onClick={handleClick}
                disabled={!isEnabled}
                className={isActive ? styles.dataAnalystButtonActive : (isEnabled ? styles.dataAnalystButton : styles.dataAnalystButtonDisabled)}
                aria-label={ariaLabel}
                title="Data analyst mode"
                data-testid="data-analyst-button"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                        d="M3 3v18h18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M7 16l4-4 3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle
                        cx="7"
                        cy="16"
                        r="1.5"
                        fill="currentColor"
                    />
                    <circle
                        cx="11"
                        cy="12"
                        r="1.5"
                        fill="currentColor"
                    />
                    <circle
                        cx="14"
                        cy="15"
                        r="1.5"
                        fill="currentColor"
                    />
                    <circle
                        cx="19"
                        cy="10"
                        r="1.5"
                        fill="currentColor"
                    />
                </svg>
            </button>

            <span className={styles.tooltipText}>Data analyst mode</span>
        </div>
    );
};

export default DataAnalystButton;
