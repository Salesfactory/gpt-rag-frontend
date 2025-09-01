import React from "react";
import styles from "../VoiceCustomer.module.css";
import { Brand } from "../types";

interface BrandItemProps {
    brand: Brand;
}

export const BrandItem: React.FC<BrandItemProps> = ({ brand }) => {
    return (
        <>
            <h4 className={styles.itemName}>{brand.name}</h4>
            {brand.description && <p className={styles.itemDescription}>{brand.description}</p>}
        </>
    );
};
