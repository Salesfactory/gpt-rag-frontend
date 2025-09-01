import React from "react";
import styles from "../VoiceCustomer.module.css";
import { Competitor } from "../types";

interface CompetitorItemProps {
    competitor: Competitor;
}

export const CompetitorItem: React.FC<CompetitorItemProps> = ({ competitor }) => {
    return (
        <>
            <div className={styles.itemHeader}>
                <h4 className={styles.itemName}>{competitor.name}</h4>
                <span className={styles.itemIndustry}>{competitor.industry}</span>
            </div>
            {competitor.description && <p className={styles.itemDescription}>{competitor.description}</p>}
        </>
    );
};
