import React from "react";
import styles from "../VoiceCustomer.module.css";
import { Product, Brand } from "../types";

interface ProductItemProps {
    product: Product & { brandId?: string };
    brands: Brand[];
}

export const ProductItem: React.FC<ProductItemProps> = ({ product, brands }) => {
    const brandName = product.brandId ? brands.find(b => String(b.id) === String(product.brandId))?.name : undefined;

    return (
        <>
            <div className={styles.itemHeader}>
                <h4 className={styles.itemName} style={{ display: "inline", marginRight: 8 }}>
                    {product.name}
                </h4>
                <span className={styles.itemCategory}>{product.category}</span>
                {brandName && <span className={styles.itemBrand}>{brandName}</span>}
            </div>
            {product.description && <p className={styles.itemDescription}>{product.description}</p>}
        </>
    );
};
