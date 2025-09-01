import React, { useState, useEffect } from "react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import { Modal } from "./Modal";
import styles from "../VoiceCustomer.module.css";
import { Product, Brand } from "../types";
import { createProduct, updateProduct } from "../../../api";
import { toast } from "react-toastify";
import { useAppContext } from "../../../providers/AppProviders";

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: Product | null;
    brands: Brand[];
    onSuccess: (item: Product) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, editingProduct, brands, onSuccess }) => {
    const { user, organization } = useAppContext();
    const [newProduct, setNewProduct] = useState({ name: "", description: "", brandId: "", category: "" });
    const [productError, setProductError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (editingProduct) {
            setNewProduct({
                name: editingProduct.name,
                description: editingProduct.description,
                brandId: editingProduct.brandId || (brands[0]?.id ? String(brands[0].id) : ""),
                category: editingProduct.category
            });
        } else {
            setNewProduct({ name: "", description: "", brandId: brands[0]?.id ? String(brands[0].id) : "", category: "" });
        }
    }, [editingProduct, isOpen, brands]);

    const handleSubmit = async () => {
        if (editingProduct) {
            await handleEditProduct();
        } else {
            await handleAddProduct();
        }
    };

    const handleAddProduct = async () => {
        if (!organization) return;
        if (newProduct.name.trim().length === 0 || !newProduct.brandId || !newProduct.category) {
            setProductError("All fields are required");
            return;
        }

        setIsLoading(true);
        try {
            const createdProductResponse = await createProduct({
                product_name: newProduct.name,
                product_description: newProduct.description,
                brand_id: newProduct.brandId,
                category: newProduct.category,
                organization_id: organization.id,
                user
            });
            toast.success("Product added successfully");

            const finalProduct: Product = {
                id: createdProductResponse.id,
                name: newProduct.name,
                description: newProduct.description,
                category: newProduct.category,
                brandId: newProduct.brandId,
                organization_id: organization.id
            };

            onSuccess(finalProduct);
            onClose();
        } catch (error) {
            toast.error("Failed to create product. Please try again.");
            console.error("Error creating product:", error);
            setProductError("Failed to create product. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditProduct = async () => {
        if (!organization || !editingProduct) return;
        if (newProduct.name.trim().length === 0 || newProduct.category.trim().length === 0 || !newProduct.brandId) {
            setProductError("All fields are required");
            return;
        }

        setIsLoading(true);
        try {
            await updateProduct({
                product_id: String(editingProduct.id),
                product_name: newProduct.name,
                product_description: newProduct.description,
                brand_id: newProduct.brandId,
                category: newProduct.category,
                user,
                organization_id: organization.id
            });
            toast.success("Product updated successfully");

            const updatedProduct: Product = {
                ...editingProduct,
                name: newProduct.name,
                description: newProduct.description,
                brandId: newProduct.brandId,
                category: newProduct.category
            };

            onSuccess(updatedProduct);
            onClose();
        } catch (error) {
            toast.error("Failed to update product. Please try again.");
            console.error("Error updating product:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingProduct ? "Edit Product" : "Add Product to Track"}>
            <div className={styles.modalBody}>
                <div>
                    <label className={styles.formLabel}>Product Name</label>
                    <input
                        type="text"
                        value={newProduct.name}
                        onChange={e => {
                            setNewProduct({ ...newProduct, name: e.target.value });
                            if (productError) setProductError("");
                        }}
                        placeholder="Enter product name"
                        className={styles.formInput}
                    />
                </div>
                <div>
                    <label className={styles.formLabel}>Category</label>
                    <input
                        type="text"
                        value={newProduct.category}
                        onChange={e => {
                            setNewProduct({ ...newProduct, category: e.target.value });
                            if (productError) setProductError("");
                        }}
                        placeholder="Enter product category"
                        className={styles.formInput}
                    />
                </div>
                <div>
                    <label className={styles.formLabel}>Brand</label>
                    <select
                        aria-label="brand-select"
                        value={newProduct.brandId}
                        onChange={e => setNewProduct({ ...newProduct, brandId: e.target.value })}
                        className={styles.formInput}
                        style={{ color: !newProduct.brandId ? "#9ca3af" : undefined }}
                    >
                        <option value="" disabled>
                            Select a brand
                        </option>
                        {brands.map(brand => (
                            <option key={brand.id} value={brand.id}>
                                {brand.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={styles.formLabel}>Description (Optional)</label>
                    <textarea
                        value={newProduct.description}
                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                        placeholder="Brief description of the product"
                        rows={3}
                        className={styles.formTextarea}
                    />
                </div>
                {productError && <p className={styles.errorMessage}>{productError}</p>}
            </div>
            <div className={styles.modalActions}>
                <button onClick={onClose} className={`${styles.button} ${styles.buttonCancel}`}>
                    Cancel
                </button>
                <button
                    aria-label={editingProduct ? "update-product-button" : "add-product-button"}
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className={`${styles.button} ${styles.buttonConfirm}`}
                >
                    {isLoading ? <Spinner size={SpinnerSize.small} /> : editingProduct ? "Update" : "Add"}
                </button>
            </div>
        </Modal>
    );
};
