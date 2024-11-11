import { Text } from "@fluentui/react";
import { PersonVoiceRegular } from "@fluentui/react-icons";
import React, { useState, useEffect } from 'react';
import { useAppContext } from "../../providers/AppProviders";
import styles from "./FinancialAssistantButton.module.css";
import { statusFinancialAssistant } from "../../api";




interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
    userId?: string;
    isActive?: boolean;
    suscriptionId?: string;
}

function persistFinancialAssistantState(userId: string | undefined, state: boolean) {
    localStorage.setItem(`financialAssistantActive_${userId}`, JSON.stringify(state));
}

function FinancialAssistantToggle({ className, disabled, userId, suscriptionId }: Props) {
    const { user, organization } = useAppContext();
    const [isActive, setIsActive] = useState(false);
    const [financialAssistantStatus, setFinancialAssistantStatus] = useState<boolean | null>(null); 

    useEffect(() => {

        const fetchFinancialAssistantStatus = async () => {
            const userObj = user ? { id: user.id, name: user.name, organizationId: user.organizationId ?? "default-org-id" } : undefined;
            const status = await statusFinancialAssistant({
                user: userObj ?? undefined,
                subscriptionId: organization?.subscriptionId ?? "default-org-id"
            });
            setFinancialAssistantStatus(status);  
        };

        fetchFinancialAssistantStatus();
    }, [userId, user, organization]);

    useEffect(() => {
        const savedState = localStorage.getItem(`financialAssistantActive_${userId}`);
        if (savedState !== null) {
            setIsActive(JSON.parse(savedState));
        }
        console.log("THIS IS THE CONSOLE LOG FOR THE savedState: ", savedState);
    }, [userId]);
    //Don't remove. Otherwise it will take nulls 
    if (!financialAssistantStatus) return <p>Loading...</p>;
    const handleToggle = () => {
        const newState = !isActive;
        setIsActive(newState);
        console.log("THIS IS THE CONSOLE LOG FOR THE NEWSTATE: ", newState);
        persistFinancialAssistantState(userId, newState);
    };
    const booltest = financialAssistantStatus
    console.log("THIS IS THE BOOLTEST: ", booltest)
    if (booltest === true){
        console.log("THIS IS FASTATUS: ", financialAssistantStatus)
        return (
            <button className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled}`} onClick={handleToggle}>
                <PersonVoiceRegular className={styles.button} />
                <Text className={styles.buttonText}>{isActive ? 'Disable' : 'Enable'} Financial Assistant</Text>
            </button>
        );   
    }else{
        return null
    }

    
}

export default FinancialAssistantToggle;
