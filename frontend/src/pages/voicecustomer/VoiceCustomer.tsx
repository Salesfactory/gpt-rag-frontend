import React, { useState, useEffect, useMemo } from "react";
import { Search, PlusCircle, Edit, Trash2, X, Building, Package, Users, TrendingUp, CircleX, Circle, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import styles from "./VoiceCustomer.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAppContext } from "../../providers/AppProviders";
import {
    createBrand,
    updateBrand,
    getProductsByOrganization,
    createProduct,
    deleteProduct,
    updateProduct,
    getCompetitorsByOrganization,
    createCompetitor,
    updateCompetitor,
    deleteCompetitor,
    getIndustryByOrganization,
    upsertIndustry,
    createCategory,
    getCategory,
    getCategoriesByOrganization,
    deleteCategory,
    fetchReportJobs
} from "../../api/api";
import type { Category } from "../../api/models";

import { useBrands } from "./useBrands";

import type { BackendReportJobDoc } from "../../api/models";
import { toCanonical } from "../../utils/reportStatus";
import { statusIcon, statusClass, statusLabel, statusType } from "./reportStatusUi";

// Card Context Pattern
type CardCtx = {
    open: boolean;
    setOpen: (v: boolean) => void;
    toggle: () => void;
    count: number;
    setCount: (count: number) => void;
};

const CardContext = React.createContext<CardCtx | null>(null);

export const useCard = () => {
    const v = React.useContext(CardContext);
    if (!v) throw new Error("useCard must be used inside <Card>");
    return v;
};

// Card wrapper with isolated state per instance
export function Card({
    children,
    defaultOpen = false,
    icon,
    title,
    maxCount,
    disabled = false
}: {
    children: React.ReactNode;
    defaultOpen?: boolean;
    icon: React.ReactNode;
    title: string;
    maxCount: number;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(defaultOpen);
    const [count, setCount] = React.useState(0);
    const toggle = React.useCallback(() => setOpen(v => !v), []);
    const value = React.useMemo(() => ({ open, setOpen, toggle, count, setCount }), [open, toggle, count]);

    return (
        <CardContext.Provider value={value}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderTitle}>
                        {icon}
                        <h3 className={styles.cardTitle}>
                            {title} ({count}/{maxCount})
                        </h3>
                    </div>
                    <button
                        aria-label={`create-${title.toLowerCase()}-button`}
                        onClick={() => setOpen(true)}
                        disabled={disabled || count >= maxCount}
                        className={styles.headerAddButton}
                    >
                        <PlusCircle size={16} />
                    </button>
                </div>
                <div className={styles.cardBody}>{children}</div>
            </div>
        </CardContext.Provider>
    );
}

export function FormulaeCard({
    children,
    defaultOpen = false,
    title
}: {
    children: React.ReactNode;
    defaultOpen?: boolean;
    title: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(defaultOpen);
    const [count, setCount] = React.useState(0);
    const toggle = React.useCallback(() => setOpen(v => !v), []);
    const value = React.useMemo(() => ({ open, setOpen, toggle, count, setCount }), [open, toggle, count]);

    return (
        <CardContext.Provider value={value}>
            <div className={styles.card}>
                <div className={styles.cardFormulaeHeader}>
                    <div className={styles.cardHeaderTitle}>
                        <h3 className={styles.cardTitle}>{title}</h3>
                    </div>
                </div>
                <div className={styles.cardBody}>{children}</div>
            </div>
        </CardContext.Provider>
    );
}

interface Brand {
    id: number;
    name: string;
    description: string;
}

interface Product {
    id: number;
    name: string;
    category: string;
    description: string;
    brand_id: number;
}

interface Competitor {
    id: string;
    name: string;
    industry: string;
    description: string;
    brands: [
        {
            brand_id: number;
        }
    ];
}

interface ReportJob {
    id: number;
    type: string;
    target: string;
    status: "Completed" | "In Progress" | "Pending" | "Failed";
    progress: number;
    startDate: string | null;
    endDate: string | null;
}

function getStatusClass(status: string): string {
    switch (status) {
        case "Completed":
            return styles.Completed;
        case "In Progress":
            return styles.InProgress;
        case "Pending":
            return styles.Pending;
        case "Failed":
            return styles.Failed;
        default:
            return styles.Unknown;
    }
}

// Brands - Just displays the list and uses the hook
export function Brands({ onBrandsChange, onDataRefresh }: { onBrandsChange: (hasBrands: boolean) => void; onDataRefresh: () => void }) {
    const { user, organization } = useAppContext();
    const { setOpen, setCount } = useCard();
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

    const { brands, isLoading, error, refresh, remove } = useBrands({ organizationId: organization?.id, user });

    useEffect(() => {
        setCount(brands.length);
        onBrandsChange(brands.length > 0);
    }, [brands.length, onBrandsChange, setCount]);

    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand);
        setOpen(true);
    };

    const handleDelete = async (brand: Brand) => {
        if (!organization) return;
        if (window.confirm(`Are you sure you want to delete ${brand.name}?`)) {
            try {
                await remove(brand);
                toast.success("Brand deleted successfully");
                onDataRefresh(); // Trigger product refresh
            } catch (e) {
                console.error("Error deleting brand:", e);
                toast.error("Failed to delete brand. Please try again.");
            }
        }
    };

    return (
        <>
            {isLoading ? (
                <Spinner size={SpinnerSize.large} label="Loading brands..." />
            ) : error ? (
                <p className={styles.errorMessage}>{error}</p>
            ) : brands.length === 0 ? (
                <p className={styles.emptyStateText}>No brands added yet</p>
            ) : (
                <div className={styles.itemsList}>
                    {brands.map(brand => (
                        <div key={brand.id} className={styles.listItem}>
                            <div className={styles.itemContent}>
                                <h4 className={styles.itemName}>{brand.name}</h4>
                                {brand.description && <p className={styles.itemDescription}>{brand.description}</p>}
                            </div>
                            <div className={styles.itemActions}>
                                <button onClick={() => handleEdit(brand)} className={styles.iconButton}>
                                    <Edit size={16} />
                                </button>
                                <button onClick={() => handleDelete(brand)} className={`${styles.iconButton} ${styles.deleteButton}`}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ModalBrand
                editingBrand={editingBrand}
                onSuccess={() => {
                    setEditingBrand(null);
                    refresh(); // Refreshes brands in this component
                    onDataRefresh(); // Triggers refresh in other components
                }}
            />
        </>
    );
}

// ModalBrand - Just handles the form and uses the hook
export function ModalBrand({ editingBrand, onSuccess }: { editingBrand: Brand | null; onSuccess: () => void }) {
    const { user, organization } = useAppContext();
    const { open, setOpen } = useCard();
    const [formData, setFormData] = useState({ name: "", description: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        if (editingBrand && open) {
            setFormData({ name: editingBrand.name, description: editingBrand.description });
        } else if (open) {
            setFormData({ name: "", description: "" });
        }
        setError("");
    }, [editingBrand, open]);

    const handleSubmit = async () => {
        if (!organization) return;
        if (formData.name.trim().length === 0) {
            setError("Brand name is required");
            return;
        }

        try {
            setIsLoading(true);
            if (editingBrand) {
                await updateBrand({
                    brand_id: String(editingBrand.id),
                    brand_name: formData.name,
                    brand_description: formData.description,
                    organization_id: organization.id,
                    user
                });
                toast.success("Brand updated successfully");
            } else {
                await createBrand({
                    brand_name: formData.name,
                    brand_description: formData.description,
                    organization_id: organization.id,
                    user
                });
                toast.success("Brand added successfully");
            }

            setOpen(false);
            onSuccess();
        } catch (error) {
            const action = editingBrand ? "update" : "create";
            toast.error(`Failed to ${action} brand. Please try again.`);
            console.error(`Error ${action}ing brand:`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ name: "", description: "" });
        setError("");
        setOpen(false);
    };

    if (!open) return null;

    return (
        <div className={styles.modalContainer}>
            <div className={styles.modalOverlay} onClick={handleClose} />
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{editingBrand ? "Edit Brand" : "Add Brand to Track"}</h3>
                    <button onClick={handleClose} className={styles.modalCloseButton}>
                        <X size={24} />
                    </button>
                </div>
                <div className={styles.modalContent}>
                    <div className={styles.modalBody}>
                        <div>
                            <label className={styles.formLabel}>Brand Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => {
                                    setFormData({ ...formData, name: e.target.value });
                                    if (error) setError("");
                                }}
                                placeholder="Enter brand name"
                                className={styles.formInput}
                            />
                        </div>
                        <div>
                            <label className={styles.formLabel}>Description (Optional)</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of the brand"
                                rows={3}
                                className={styles.formTextarea}
                            />
                        </div>
                        {error && <p className={styles.errorMessage}>{error}</p>}
                    </div>
                    <div className={styles.modalActions}>
                        <button onClick={handleClose} className={`${styles.button} ${styles.buttonCancel}`}>
                            Cancel
                        </button>
                        <button
                            aria-label={editingBrand ? "update-brand-button" : "add-brand-button"}
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className={`${styles.button} ${styles.buttonConfirm}`}
                        >
                            {isLoading ? <Spinner size={SpinnerSize.small} /> : editingBrand ? "Update" : "Add"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Products - Just displays the list and uses the hook
// Products.tsx
export function Products({ refreshKey }: { refreshKey: number }) {
    const { user, organization } = useAppContext();
    const { setOpen, setCount } = useCard();

    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    // ⬇️ Pull brands via the custom hook
    const { brands, isLoading: isLoadingBrands, error: brandsError, refresh: refreshBrands } = useBrands({ organizationId: organization?.id, user });

    useEffect(() => {
        const fetchProductsAndCategories = async () => {
            if (!organization) return;
            try {
                setIsLoading(true);
                const [fetchedProducts, fetchedCategories] = await Promise.all([
                    getProductsByOrganization({
                        organization_id: organization.id,
                        user
                    }),
                    getCategoriesByOrganization({
                        organization_id: organization.id,
                        user
                    })
                ]);
                setProducts(fetchedProducts);
                setCategories(fetchedCategories);
                setCount(fetchedProducts.length);
            } catch (error) {
                console.error("Error fetching products or categories:", error);
                setProducts([]);
                setCategories([]);
                setCount(0);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProductsAndCategories();
        refreshBrands();
    }, [organization, user, setCount, refreshKey]);

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setOpen(true);
    };

    const handleDelete = async (product: Product) => {
        if (!organization) return;
        if (window.confirm(`Are you sure you want to delete ${product.name}?`)) {
            try {
                setIsLoading(true);
                await deleteProduct({
                    product_id: String(product.id),
                    user,
                    organization_id: organization.id
                });
                const updatedProducts = await getProductsByOrganization({
                    organization_id: organization.id,
                    user
                });
                setProducts(updatedProducts);
                setCount(updatedProducts.length);
                toast.success("Product deleted successfully");
            } catch (error) {
                console.error("Error deleting product:", error);
                toast.error("Failed to delete product. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const refreshProducts = async () => {
        if (!organization) return;
        try {
            const updatedProducts = await getProductsByOrganization({
                organization_id: organization.id,
                user
            });
            setProducts(updatedProducts);
            setCount(updatedProducts.length);
            // optionally also refresh brands if needed elsewhere
            // await refreshBrands();
        } catch (error) {
            console.error("Error refreshing products:", error);
        }
    };

    // Helpful: a memoized map for brand name lookup
    const brandNameById = React.useMemo(() => {
        const m = new Map<string, string>();
        for (const b of brands) m.set(String(b.id), b.name);
        return m;
    }, [brands]);

    return (
        <>
            {isLoading ? (
                <Spinner size={SpinnerSize.large} label="Loading products..." />
            ) : products.length === 0 ? (
                <p className={styles.emptyStateText}>No products added yet</p>
            ) : (
                <div className={styles.itemsList}>
                    {products.map(product => {
                        const brandId = product.brand_id ? String(product.brand_id) : undefined;
                        const brandName = brandId ? brandNameById.get(brandId) : undefined;
                        return (
                            <div key={product.id} className={styles.listItem}>
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <h4 className={styles.itemName}>{product.name}</h4>
                                        <span className={styles.itemCategory}>{product.category}</span>
                                        {brandName && <span className={styles.itemBrand}>{brandName}</span>}
                                    </div>
                                    {product.description && <p className={styles.itemDescription}>{product.description}</p>}
                                </div>
                                <div className={styles.itemActions}>
                                    <button onClick={() => handleEdit(product)} className={styles.iconButton}>
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(product)} className={`${styles.iconButton} ${styles.deleteButton}`}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Keep mounted so the + button works even with empty/loaded states */}
            <ModalProduct
                editingProduct={editingProduct}
                brands={brands}
                categories={categories}
                onSuccess={() => {
                    setEditingProduct(null);
                    refreshProducts();
                }}
            />
        </>
    );
}

// ModalProduct - Just handles the form and uses the hook
export function ModalProduct({
    editingProduct,
    brands,
    onSuccess,
    categories
}: {
    editingProduct: Product | null;
    brands: Brand[];
    onSuccess: () => void;
    categories: Category[];
}) {
    const { user, organization } = useAppContext();
    const { open, setOpen } = useCard();
    const [formData, setFormData] = useState({ name: "", description: "", brandId: "", category: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        if (editingProduct && open) {
            setFormData({
                name: editingProduct.name,
                description: editingProduct.description,
                brandId: String(editingProduct.brand_id) || (brands[0]?.id ? String(brands[0].id) : ""),
                category: editingProduct.category
            });
        } else if (open) {
            setFormData({ name: "", description: "", brandId: "", category: "" });
        }
        setError("");
    }, [editingProduct, open, brands]);

    const handleSubmit = async () => {
        if (!organization) return;
        if (formData.name.trim().length === 0 || !formData.brandId || !formData.category) {
            setError("All fields are required");
            return;
        }

        try {
            setIsLoading(true);
            if (editingProduct) {
                await updateProduct({
                    product_id: String(editingProduct.id),
                    product_name: formData.name,
                    product_description: formData.description,
                    brand_id: formData.brandId,
                    category: formData.category,
                    user,
                    organization_id: organization.id
                });
                toast.success("Product updated successfully");
            } else {
                await createProduct({
                    product_name: formData.name,
                    product_description: formData.description,
                    brand_id: formData.brandId,
                    category: formData.category,
                    organization_id: organization.id,
                    user
                });
                toast.success("Product added successfully");
            }

            setOpen(false);
            onSuccess();
        } catch (error) {
            const action = editingProduct ? "update" : "create";
            toast.error(`Failed to ${action} product. Please try again.`);
            console.error(`Error ${action}ing product:`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({ name: "", description: "", brandId: "", category: "" });
        setError("");
        setOpen(false);
    };

    if (!open) return null;

    return (
        <div className={styles.modalContainer}>
            <div className={styles.modalOverlay} onClick={handleClose} />
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{editingProduct ? "Edit Product" : "Add Product to Track"}</h3>
                    <button onClick={handleClose} className={styles.modalCloseButton}>
                        <X size={24} />
                    </button>
                </div>
                <div className={styles.modalContent}>
                    <div className={styles.modalBody}>
                        <div>
                            <label className={styles.formLabel}>Product Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => {
                                    setFormData({ ...formData, name: e.target.value });
                                    if (error) setError("");
                                }}
                                placeholder="Enter product name"
                                className={styles.formInput}
                            />
                        </div>
                        <div>
                            <label className={styles.formLabel}>Category</label>
                            <select
                                aria-label="category-select"
                                value={formData.category}
                                onChange={e => {
                                    setFormData({ ...formData, category: e.target.value });
                                    if (error) setError("");
                                }}
                                className={styles.formInput}
                                style={{ color: !formData.category ? "#9ca3af" : undefined }}
                            >
                                {!formData.category && (
                                    <option value="" disabled style={{ color: "#9ca3af" }}>
                                        Select a category
                                    </option>
                                )}
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name} style={{ color: "#111827" }}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={styles.formLabel}>Brand</label>
                            <select
                                aria-label="brand-select"
                                value={formData.brandId}
                                onChange={e => {
                                    setFormData({ ...formData, brandId: e.target.value });
                                    if (error) setError("");
                                }}
                                className={styles.formInput}
                                style={{ color: !formData.brandId ? "#9ca3af" : undefined }}
                            >
                                {!formData.brandId && (
                                    <option value="" disabled style={{ color: "#9ca3af" }}>
                                        Select a brand
                                    </option>
                                )}
                                {brands.map(brand => (
                                    <option key={brand.id} value={brand.id} style={{ color: "#111827" }}>
                                        {brand.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={styles.formLabel}>Description (Optional)</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of the product"
                                rows={3}
                                className={styles.formTextarea}
                            />
                        </div>
                        {error && <p className={styles.errorMessage}>{error}</p>}
                    </div>
                    <div className={styles.modalActions}>
                        <button onClick={handleClose} className={`${styles.button} ${styles.buttonCancel}`}>
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
                </div>
            </div>
        </div>
    );
}

// Competitors component
export function Competitors() {
    const { user, organization } = useAppContext();
    const { setOpen, setCount } = useCard();
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(true);
    const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);

    useEffect(() => {
        const fetchCompetitors = async () => {
            if (!organization) return;

            try {
                setIsLoadingCompetitors(true);
                const fetchedCompetitors = await getCompetitorsByOrganization({
                    organization_id: organization.id,
                    user
                });
                setCompetitors(fetchedCompetitors);
                setCount(fetchedCompetitors.length);
            } catch (error) {
                console.error("Error fetching competitors:", error);
                toast.error("Failed to fetch competitors. Please try again.");
            } finally {
                setIsLoadingCompetitors(false);
            }
        };

        fetchCompetitors();
    }, [organization, user, setCount]);

    const handleEdit = (competitor: Competitor) => {
        setEditingCompetitor(competitor);
        setOpen(true);
    };

    const handleDelete = async (competitor: Competitor) => {
        if (!organization) return;

        if (window.confirm(`Are you sure you want to delete ${competitor.name}?`)) {
            try {
                setIsLoadingCompetitors(true);
                await deleteCompetitor({
                    competitor_id: String(competitor.id),
                    user,
                    organization_id: organization.id
                });

                const updatedCompetitors = await getCompetitorsByOrganization({
                    organization_id: organization.id,
                    user
                });
                setCompetitors(updatedCompetitors);
                setCount(updatedCompetitors.length);

                toast.success("Competitor deleted successfully");
            } catch (error) {
                console.error("Error deleting competitor:", error);
                toast.error("Failed to delete competitor. Please try again.");
            } finally {
                setIsLoadingCompetitors(false);
            }
        }
    };

    const handleSuccess = async () => {
        if (!organization) return;
        try {
            const updatedCompetitors = await getCompetitorsByOrganization({
                organization_id: organization.id,
                user
            });
            setCompetitors(updatedCompetitors);
            setCount(updatedCompetitors.length);
            setEditingCompetitor(null);
        } catch (error) {
            console.error("Error refreshing competitors:", error);
        }
    };

    return (
        <>
            {isLoadingCompetitors ? (
                <Spinner size={SpinnerSize.large} label="Loading competitors..." />
            ) : competitors.length === 0 ? (
                <p className={styles.emptyStateText}>No competitors added yet</p>
            ) : (
                <div className={styles.itemsList}>
                    {competitors.map(c => {
                        return (
                            <div key={c.id} className={styles.listItem}>
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <h4 className={styles.itemName}>{c.name}</h4>
                                        <span className={styles.itemIndustry}>{c.industry}</span>
                                    </div>
                                    {c.description && <p className={styles.itemDescription}>{c.description}</p>}
                                </div>
                                <div className={styles.itemActions}>
                                    <button onClick={() => handleEdit(c)} className={styles.iconButton}>
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(c)} className={`${styles.iconButton} ${styles.deleteButton}`}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <ModalCompetitor editingCompetitor={editingCompetitor} onSuccess={handleSuccess} />
        </>
    );
}

export function ModalCompetitor({ editingCompetitor, onSuccess }: { editingCompetitor: Competitor | null; onSuccess: () => void }) {
    const { user, organization } = useAppContext();
    const { open, setOpen } = useCard();
    const [newCompetitor, setNewCompetitor] = useState<{ name: string; description: string; brandIds: number[] }>({
        name: "",
        description: "",
        brandIds: []
    });
    const [competitorError, setCompetitorError] = useState("");
    const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);

    useEffect(() => {
        if (editingCompetitor) {
            setNewCompetitor({
                name: editingCompetitor.name,
                description: editingCompetitor.description,
                brandIds: editingCompetitor.brands ? editingCompetitor.brands.map(b => b.brand_id) : []
            });
        } else {
            setNewCompetitor({ name: "", description: "", brandIds: [] });
        }
    }, [editingCompetitor, open]);

    const handleAddCompetitor = async () => {
        if (!organization) return;

        if (newCompetitor.name.trim().length === 0) {
            setCompetitorError("Competitor name is required");
            return;
        }

        try {
            setIsLoadingCompetitors(true);
            await createCompetitor({
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                brands_id: (newCompetitor.brandIds || []).map(String),
                organization_id: organization.id,
                user
            });

            toast.success("Competitor added successfully");
            setNewCompetitor({ name: "", description: "", brandIds: [] });
            setCompetitorError("");
            setOpen(false);
            onSuccess();
        } catch (error) {
            toast.error("Failed to create competitor. Please try again.");
            console.error("Error creating competitor:", error);
            setCompetitorError("Failed to create competitor. Please try again.");
        } finally {
            setIsLoadingCompetitors(false);
        }
    };

    const handleEditCompetitor = async () => {
        if (!organization || !editingCompetitor) return;

        if (newCompetitor.name.trim().length === 0) {
            setCompetitorError("Competitor name is required");
            return;
        }

        try {
            setIsLoadingCompetitors(true);
            await updateCompetitor({
                competitor_id: String(editingCompetitor.id),
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                user,
                organization_id: organization.id
            });

            toast.success("Competitor updated successfully");
            setNewCompetitor({ name: "", description: "", brandIds: [] });
            setCompetitorError("");
            setOpen(false);
            onSuccess();
        } catch (error) {
            toast.error("Failed to update competitor. Please try again.");
            console.error("Error updating competitor:", error);
        } finally {
            setIsLoadingCompetitors(false);
        }
    };

    if (!open) return null;

    return (
        <div className={styles.modalContainer}>
            <div
                className={styles.modalOverlay}
                onClick={() => {
                    setOpen(false);
                    setNewCompetitor({ name: "", description: "", brandIds: [] });
                    setCompetitorError("");
                }}
            />
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{editingCompetitor ? "Edit Competitor" : "Add Competitor to Track"}</h3>
                    <button
                        onClick={() => {
                            setOpen(false);
                            setNewCompetitor({ name: "", description: "", brandIds: [] });
                            setCompetitorError("");
                        }}
                        className={styles.modalCloseButton}
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className={styles.modalContent}>
                    <div className={styles.modalBody}>
                        <div>
                            <label className={styles.formLabel}>Competitor Name</label>
                            <input
                                type="text"
                                value={newCompetitor.name}
                                onChange={e => {
                                    setNewCompetitor({ ...newCompetitor, name: e.target.value });
                                    if (competitorError) setCompetitorError("");
                                }}
                                placeholder="Enter competitor name"
                                className={styles.formInput}
                            />
                        </div>
                        <div>
                            <label className={styles.formLabel}>Description (Optional)</label>
                            <textarea
                                value={newCompetitor.description}
                                onChange={e => setNewCompetitor({ ...newCompetitor, description: e.target.value })}
                                placeholder="Brief description of the competitor"
                                rows={3}
                                className={styles.formTextarea}
                            />
                        </div>
                        {competitorError && <p className={styles.errorMessage}>{competitorError}</p>}
                    </div>
                    <div className={styles.modalActions}>
                        <button
                            onClick={() => {
                                setOpen(false);
                                setNewCompetitor({ name: "", description: "", brandIds: [] });
                                setCompetitorError("");
                            }}
                            className={`${styles.button} ${styles.buttonCancel}`}
                        >
                            Cancel
                        </button>
                        <button
                            aria-label={editingCompetitor ? "update-competitor-button" : "add-competitor-button"}
                            onClick={editingCompetitor ? handleEditCompetitor : handleAddCompetitor}
                            disabled={isLoadingCompetitors}
                            className={`${styles.button} ${styles.buttonConfirm}`}
                        >
                            {isLoadingCompetitors ? <Spinner size={SpinnerSize.small} /> : editingCompetitor ? "Update" : "Add"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ReportJobs component
function ReportJobs() {
    const [searchQuery, setSearchQuery] = useState("");
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState("All Status");
    const [reportJobs] = useState<ReportJob[]>([
        { id: 1, type: "Brand Analysis", target: "Apple", status: "Completed", progress: 100, startDate: "2024-07-15", endDate: "2024-07-16" },
        { id: 2, type: "Product Analysis", target: "iPhone 15", status: "In Progress", progress: 65, startDate: "2024-07-16", endDate: null },
        { id: 3, type: "Competitive Analysis", target: "Samsung vs Apple", status: "Pending", progress: 0, startDate: null, endDate: null },
        { id: 4, type: "Brand Analysis", target: "Nike", status: "Failed", progress: 30, startDate: "2024-07-14", endDate: null },
        { id: 5, type: "Product Analysis", target: "MacBook Pro", status: "Completed", progress: 100, startDate: "2024-07-13", endDate: "2024-07-15" }
    ]);

    const filteredJobs = reportJobs.filter(job => {
        const matchesSearch = job.type.toLowerCase().includes(searchQuery.toLowerCase()) || job.target.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === "All Status" || job.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const jobsWithEndDate = filteredJobs.filter(job => job.endDate !== null);

    const sortedJobsWithEndDate = jobsWithEndDate.sort((a, b) => {
        const endDateA = new Date(a.endDate!).getTime();
        const endDateB = new Date(b.endDate!).getTime();
        return endDateB - endDateA;
    });

    const jobsWithoutEndDate = filteredJobs.filter(job => job.endDate === null);

    const jobsToDisplay = [...sortedJobsWithEndDate, ...jobsWithoutEndDate].slice(0, 10);

    const getStatusIcon = (status: ReportJob["status"]) => {
        if (status === "Completed") return <CheckCircle size={16} style={{ color: "#16a34a" }} />;
        if (status === "In Progress") return <Clock size={16} style={{ color: "#2563eb" }} />;
        if (status === "Failed") return <AlertCircle size={16} style={{ color: "#dc2626" }} />;
        return <Clock size={16} style={{ color: "#6b7280" }} />;
    };

    const { user, organization } = useAppContext();

    const [rawReportJobs, setRawReportJobs] = useState<BackendReportJobDoc[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [reportsError, setReportsError] = useState("");

    useEffect(() => {
        const fetchReports = async () => {
            if (!organization) return;
            try {
                setReportsError("");
                setIsLoadingReports(true);
                const data = await fetchReportJobs({ organization_id: organization.id, user, limit: 10 });
                setRawReportJobs(Array.isArray(data) ? data : []);
            } catch (e: any) {
                setReportsError(e?.message || "Failed to fetch report statuses.");
                toast.error("Failed to fetch report statuses. Please try again.");
                setRawReportJobs([]);
            } finally {
                setIsLoadingReports(false);
            }
        };
        fetchReports();
    }, [organization, user?.id]);

    return (
        <div className={styles.reportSection}>
            <div className={styles.reportHeader}>
                <TrendingUp size={20} />
                <h3 className={styles.reportTitle}>Report Generation Status</h3>
            </div>

            <div className={styles.filtersContainer}>
                <div className={styles.filtersContent}>
                    <div className={styles.searchContainer}>
                        <div className={styles.searchIcon}>
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className={styles.clearSearchButton}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div className={styles.filterDropdown}>
                        <button type="button" className={styles.filterButton} onClick={() => setShowStatusFilter(!showStatusFilter)}>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                />
                            </svg>
                            {selectedStatus}
                        </button>
                        {showStatusFilter && (
                            <div className={styles.filterMenu}>
                                <div className={styles.filterMenuItems}>
                                    {["All Status", "SUCCEEDED", "RUNNING", "QUEUED", "FAILED"].map(status => (
                                        <button
                                            key={status}
                                            className={`${styles.filterOption} ${selectedStatus === status ? styles.activeFilter : ""}`}
                                            onClick={() => {
                                                setSelectedStatus(status);
                                                setShowStatusFilter(false);
                                            }}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.tableContainer}>
                {isLoadingReports ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                        <Spinner data-testid="reports-loading" size={SpinnerSize.large} label="Loading report statuses..." />
                    </div>
                ) : reportsError ? (
                    <div data-testid="reports-error" className={styles.errorMessage} aria-live="polite">
                        <CircleX />
                        {reportsError}
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.tableTh}>Type</th>
                                <th className={styles.tableTh}>Status</th>
                                <th className={styles.tableTh}>Progress</th>
                                <th className={styles.tableTh}>Start Date</th>
                                <th className={styles.tableTh}>End Date</th>
                            </tr>
                        </thead>

                        <tbody className={styles.tableBody}>
                            {rawReportJobs.map(doc => {
                                const c = toCanonical(doc?.status);
                                const terminal = c === "SUCCEEDED" || c === "FAILED";
                                const progress = typeof doc?.progress === "number" ? doc.progress : c === "SUCCEEDED" ? 100 : undefined;
                                const endDate = terminal ? doc?.updated_at ?? null : null;
                                return (
                                    <tr key={String(doc?.id)} className={styles.tableRow}>
                                        <td className={styles.tableCell}>
                                            <span className={styles.jobType}>{statusType(doc?.report_key) ?? doc?.report_name ?? "Report"}</span>
                                        </td>
                                        <td className={styles.tableCell}>
                                            <div className={styles.statusCell}>
                                                {statusIcon(c)}
                                                <span className={`${styles.statusBadge} ${statusClass(c)}`}>{statusLabel(c)}</span>
                                            </div>
                                        </td>
                                        <td className={styles.tableCell}>{typeof progress === "number" ? `${Math.round(progress)}%` : "-"}</td>
                                        <td className={styles.tableCell}>{doc?.created_at ? doc.created_at.slice(0, 10) : "-"}</td>
                                        <td className={styles.tableCell}>{endDate ? endDate.slice(0, 10) : "-"}</td>
                                    </tr>
                                );
                            })}
                            {rawReportJobs.length === 0 && !isLoadingReports && !reportsError && (
                                <tr>
                                    <td className={styles.tableCell} colSpan={6} data-testid="reports-empty">
                                        No reports found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function IndustryDefinition({ onIndustryChange }: { onIndustryChange: (hasIndustry: boolean) => void }) {
    const { user, organization } = useAppContext();
    const [industryDefinition, setIndustryDefinition] = useState("");
    const [industryError, setIndustryError] = useState("");
    const [industrySaved, setIndustrySaved] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fetchIndustry = async () => {
            setIsLoading(true);
            try {
                if (organization) {
                    const data = await getIndustryByOrganization({ organization_id: organization.id, user });
                    if (!cancelled) {
                        const definition = data?.industry_description || "";
                        setIndustryDefinition(definition);
                        onIndustryChange(!!definition.trim());
                    }
                }
            } catch (err) {
                console.error("Error fetching industry definition:", err);
                toast.error("Failed to load industry definition");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchIndustry();
        return () => {
            cancelled = true;
        };
    }, [user, organization, onIndustryChange]);

    const saveIndustry = async () => {
        if (!organization?.id) return;
        if (!industryDefinition.trim()) {
            setIndustryError("Industry definition is required");
            setIndustrySaved(false);
            return;
        }
        setIndustryError("");
        setIsLoading(true);
        try {
            await upsertIndustry({ organization_id: organization.id, industry_description: industryDefinition.trim(), user });
            setIndustrySaved(true);
            onIndustryChange(true);
            toast.success("Industry definition saved successfully.");
        } catch (err) {
            console.error("Error saving industry:", err);
            toast.error("Failed to save industry. Please try again.");
            setIndustrySaved(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <p className={styles.title}>Industry</p>
            <p className={styles.description}>Define your industry in 2-5 words to help refine the content and analysis for brand and competitor reports.</p>
            <div className={styles.inputRow}>
                <div className={styles.inputWrap}>
                    <input
                        aria-label="industry-definition-input"
                        type="text"
                        value={industryDefinition}
                        onChange={e => {
                            setIndustryDefinition(e.target.value);
                            if (industryError) setIndustryError("");
                            setIndustrySaved(false);
                        }}
                        placeholder="e.g., Consumer Electronics, Athletic Footwear, B2B SaaS..."
                        className={styles.input}
                    />
                    {industryError && <p className={styles.error}>{industryError}</p>}
                </div>

                <button onClick={saveIndustry} disabled={!industryDefinition.trim() || isLoading} className={styles.saveButton}>
                    {isLoading ? (
                        <Spinner size={SpinnerSize.small} />
                    ) : industrySaved ? (
                        <>
                            <CheckCircle size={16} style={{ marginRight: 8 }} />
                            <span>Saved</span>
                        </>
                    ) : (
                        <span>Save</span>
                    )}
                </button>
            </div>
            <p className={styles.examples}>Examples: "Consumer Electronics", "Athletic Footwear", "Financial Services", "B2B SaaS"</p>
        </div>
    );
}

export function CategoriesDefinition({ onChange, onDataRefresh }: { onChange?: (hasCategories: boolean) => void; onDataRefresh: () => void }) {
    const { user, organization } = useAppContext();
    const MAX_CATEGORIES = 10;
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [usageByName, setUsageByName] = useState<Record<string, number>>({});

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!organization?.id) return;
            setIsLoading(true);
            try {
                const data = await getCategoriesByOrganization({
                    organization_id: organization.id,
                    user
                });
                if (!cancelled) {
                    setCategories(data);
                    setError(data.length === 0 ? "At least one category is required." : "");
                }
            } catch (e) {
                console.error("Error fetching categories:", e);
                toast.error("Failed to load categories");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [organization?.id, user]);

    useEffect(() => {
        (async () => {
            if (!organization?.id) return;
            try {
                const prods = await getProductsByOrganization({ organization_id: organization.id, user });
                const counts: Record<string, number> = {};
                (prods || []).forEach((p: any) => {
                    const name = p?.category?.toString().trim();
                    if (name) counts[name] = (counts[name] || 0) + 1;
                });
                setUsageByName(counts);
            } catch (e) {}
        })();
    }, [organization?.id, user]);

    useEffect(() => {
        onChange?.(categories.length > 0);
    }, [categories.length, onChange]);

    const canAddMore = categories.length < MAX_CATEGORIES;
    const normalized = (s: string) => s.replace(/\s+/g, " ").trim();

    const addCategory = async (raw: string) => {
        const value = normalized(raw);
        if (!value) return;
        if (!canAddMore) {
            setError(`You can add up to ${MAX_CATEGORIES} categories.`);
            return;
        }
        const exists = categories.some(c => c.name.toLowerCase() === value.toLowerCase());
        if (exists) {
            setError("That category already exists.");
            return;
        }
        setIsLoading(true);
        try {
            const created = await createCategory({ organization_id: organization!.id, name: value, user });
            setCategories(prev => [...prev, created]);
            setNewCategory("");
            setError("");
            toast.success("Category added.");
            onDataRefresh();
        } catch (e) {
            console.error("Error creating category:", e);
            toast.error("Failed to add category. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };


    const removeCategory = async (cat: Category) => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {

        const prods = await getProductsByOrganization({ organization_id: organization.id, user });
        const inUse = (prods || []).some(
        (p: any) => (p?.category ?? "").toString().trim().toLowerCase() === cat.name.trim().toLowerCase()
        );

        if (inUse) {
        toast.error("This category is assigned to one or more products. Reassign those products before deleting.");
        return;
        }

        await deleteCategory({ category_id: cat.id, organization_id: organization.id, user });
        setCategories(prev => prev.filter(c => c.id !== cat.id));
        if (categories.length - 1 === 0) setError("At least one category is required.");
        toast.success("Category removed.");
        onDataRefresh();
    } catch (e) {
        console.error("Error deleting category:", e);
        toast.error("Failed to remove category. Please try again.");
    } finally {
        setIsLoading(false);
    }
    };


    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
        if (e.key === "Enter") {
            e.preventDefault();
            addCategory(newCategory);
        }
    };

    const counter = useMemo(() => `Categories (${categories.length}/${MAX_CATEGORIES})`, [categories.length]);

    return (
        <div>
            <p className={styles.title}>{counter}</p>
            <p className={styles.description}>
                Add up to 10 categories to further refine your analysis. Press Enter to add each category.{" "}
                {error ? (
                    <span className={styles.error}>{error}</span>
                ) : categories.length === 0 ? (
                    <span className={styles.error}>At least one category is required.</span>
                ) : null}
            </p>
            <div className={styles.inputRow}>
                <div className={styles.inputWrap}>
                    <div className={styles.tagInput}>
                        <input
                            aria-label="category-input"
                            type="text"
                            value={newCategory}
                            onChange={e => {
                                setNewCategory(e.target.value);
                                if (error) setError("");
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a category and press Enter..."
                            className={styles.input}
                            disabled={isLoading || !canAddMore}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ marginLeft: 12 }}>
                        <Spinner size={SpinnerSize.small} />
                    </div>
                ) : null}
            </div>
            <div className={styles.tagContainer}>
            {categories.map(cat => {
                const assignedCount = usageByName[cat.name?.toString().trim()] || 0;
                return (
                <span key={cat.id} className={styles.tag}>
                    <span>{cat.name}</span>
                    <button
                    type="button"
                    className={styles.tagRemove}
                    onClick={() => removeCategory(cat)}
                    disabled={isLoading || assignedCount > 0}
                    aria-label={`Remove ${cat.name}`}
                    title={assignedCount > 0
                        ? `Cannot delete: ${assignedCount} product(s) assigned`
                        : "Remove"}
                    >
                    ×
                    </button>
                </span>
                );
            })}
            </div>

        </div>
    );
}

export default function VoiceCustomerPage() {
    const [hasBrands, setHasBrands] = useState(false);
    const [productRefreshKey, setProductRefreshKey] = useState(0);
    const [hasIndustry, setHasIndustry] = useState(false);

    const handleDataRefresh = () => {
        setProductRefreshKey(prev => prev + 1);
    };

    return (
        <div className={styles.pageContainer}>
            <ToastContainer />
            <main className={styles.mainContainer}>
                <div className={styles.cardsGrid}>
                    <FormulaeCard title="Industry and Category Definition">
                        <IndustryDefinition onIndustryChange={setHasIndustry} />
                        <CategoriesDefinition onDataRefresh={handleDataRefresh} />
                    </FormulaeCard>
                    <Card icon={<Building size={20} />} title="Brands" maxCount={3} disabled={!hasIndustry}>
                        <Brands onBrandsChange={setHasBrands} onDataRefresh={handleDataRefresh} />
                    </Card>
                    <Card icon={<Package size={20} />} title="Products" maxCount={10} disabled={!hasBrands || !hasIndustry}>
                        <Products refreshKey={productRefreshKey} />
                    </Card>
                    <Card icon={<Users size={20} />} title="Competitors" maxCount={5} disabled={!hasBrands || !hasIndustry}>
                        <Competitors />
                    </Card>
                </div>
                <ReportJobs />
            </main>
        </div>
    );
}
