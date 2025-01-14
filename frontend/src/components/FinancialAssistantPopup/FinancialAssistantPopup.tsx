import styles from "./FinancialAssistantPopup.module.css";
import { useEffect, useState } from "react";
import { useAppContext } from "../../providers/AppProviders";

const FinancialPopup = () => {
    const { isFinancialAssistantActive} = useAppContext();
    const [isPopupVisible, setIsPopupVisible] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (isFinancialAssistantActive || !isFinancialAssistantActive) {

            setIsPopupVisible(true)
            timer = setTimeout(() => {
                setIsPopupVisible(false);
            }, 1500);
        }

        return () => {
            clearTimeout(timer);
        };
    }, [isFinancialAssistantActive]);
    const popupContent = isFinancialAssistantActive ? "activated" : "deactivated";
    const historyDisclaimer = isFinancialAssistantActive ? "financial" : "consumer";

    return (
        <div>
            {isPopupVisible && (
                <div className={styles.body}>
                    <p className="mb-0 fs-5">The Financial Assistant has been {popupContent}</p>
                    <p className={styles.chatHistoryText}>Chat History has been set to {historyDisclaimer} mode</p>
            </div>
            )}
        </div>
    );
};

export default FinancialPopup;