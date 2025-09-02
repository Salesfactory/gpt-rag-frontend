import React, { useState, useEffect } from "react";
import { Search, PlusCircle, Edit, Trash2, X, Building, Package, Users, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
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
    upsertIndustry
} from "../../api/api";

import { useBrands } from "./useBrands";

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
    title,
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
                        <h3 className={styles.cardTitle}>
                            {title}
                        </h3>
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
export function Brands({ onBrandsChange }: { onBrandsChange: (hasBrands: boolean) => void }) {
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
                    refresh();
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
export function Products() {
    const { user, organization } = useAppContext();
    const { setOpen, setCount } = useCard();

    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // ⬇️ Pull brands via the custom hook
    const { brands, isLoading: isLoadingBrands, error: brandsError } = useBrands({ organizationId: organization?.id, user });

    useEffect(() => {
        const fetchProducts = async () => {
            if (!organization) return;
            try {
                setIsLoading(true);
                const fetchedProducts = await getProductsByOrganization({
                    organization_id: organization.id,
                    user
                });
                setProducts(fetchedProducts);
                setCount(fetchedProducts.length);
            } catch (error) {
                console.error("Error fetching products:", error);
                setProducts([]);
                setCount(0);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProducts();
    }, [organization, user, setCount]);

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
                        const brandId = (product as any).brandId ? String((product as any).brandId) : undefined;
                        const brandName = brandId ? brandNameById.get(brandId) : undefined;
                        return (
                            <div key={product.id} className={styles.listItem}>
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <h4 className={styles.itemName} style={{ display: "inline", marginRight: 8 }}>
                                            {product.name}
                                        </h4>
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
                onSuccess={() => {
                    setEditingProduct(null);
                    refreshProducts();
                }}
            />
        </>
    );
}

// ModalProduct - Just handles the form and uses the hook
export function ModalProduct({ editingProduct, brands, onSuccess }: { editingProduct: Product | null; brands: Brand[]; onSuccess: () => void }) {
    const { user, organization } = useAppContext();
    const { open, setOpen } = useCard();
    const [formData, setFormData] = useState({ name: "", description: "", brandId: "", category: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        if (editingProduct && open) {
            setFormData({
                name: (editingProduct as any).name,
                description: editingProduct.description,
                brandId: (editingProduct as any).brandId || (brands[0]?.id ? String(brands[0].id) : ""),
                category: (editingProduct as any).category
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
                            <input
                                type="text"
                                value={formData.category}
                                onChange={e => {
                                    setFormData({ ...formData, category: e.target.value });
                                    if (error) setError("");
                                }}
                                placeholder="Enter product category"
                                className={styles.formInput}
                            />
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
            <div className={styles.cardBody}>
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
            </div>
            <ModalCompetitor editingCompetitor={editingCompetitor} onSuccess={handleSuccess} />
        </>
    );
}

export function ModalCompetitor({ editingCompetitor, onSuccess }: { editingCompetitor: Competitor | null; onSuccess: () => void }) {
    const { user, organization } = useAppContext();
    const { open, setOpen } = useCard();
    const [newCompetitor, setNewCompetitor] = useState<{ name: string; industry: string; description: string; brandIds: number[] }>({
        name: "",
        industry: "",
        description: "",
        brandIds: []
    });
    const [competitorError, setCompetitorError] = useState("");
    const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);

    useEffect(() => {
        if (editingCompetitor) {
            setNewCompetitor({
                name: editingCompetitor.name,
                industry: editingCompetitor.industry,
                description: editingCompetitor.description,
                brandIds: editingCompetitor.brands ? editingCompetitor.brands.map(b => b.brand_id) : []
            });
        } else {
            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
        }
    }, [editingCompetitor, open]);

    const handleAddCompetitor = async () => {
        if (!organization) return;

        if (newCompetitor.name.trim().length === 0 || newCompetitor.industry.trim().length === 0) {
            setCompetitorError("Competitor name and industry are required");
            return;
        }

        try {
            setIsLoadingCompetitors(true);
            await createCompetitor({
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                industry: newCompetitor.industry,
                brands_id: (newCompetitor.brandIds || []).map(String),
                organization_id: organization.id,
                user
            });

            toast.success("Competitor added successfully");
            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
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

        if (newCompetitor.name.trim().length === 0 || newCompetitor.industry.trim().length === 0) {
            setCompetitorError("Competitor name and industry are required");
            return;
        }

        try {
            setIsLoadingCompetitors(true);
            await updateCompetitor({
                competitor_id: String(editingCompetitor.id),
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                industry: newCompetitor.industry,
                brands_id: (newCompetitor.brandIds || []).map(String),
                user,
                organization_id: organization.id
            });

            toast.success("Competitor updated successfully");
            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
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
                    setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
                    setCompetitorError("");
                }}
            />
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{editingCompetitor ? "Edit Competitor" : "Add Competitor to Track"}</h3>
                    <button
                        onClick={() => {
                            setOpen(false);
                            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
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
                            <label className={styles.formLabel}>Industry</label>
                            <input
                                type="text"
                                value={newCompetitor.industry}
                                onChange={e => {
                                    setNewCompetitor({ ...newCompetitor, industry: e.target.value });
                                    if (competitorError) setCompetitorError("");
                                }}
                                placeholder="Enter industry"
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
                                setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
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
                                    {["All Status", "Completed", "In Progress", "Pending", "Failed"].map(status => (
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
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.tableTh}>Type</th>
                            <th className={styles.tableTh}>End Date</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                        {jobsToDisplay.map(job => (
                            <tr key={job.id} className={styles.tableRow}>
                                <td className={styles.tableCell}>
                                    <div className={styles.statusCell}>
                                        {getStatusIcon(job.status)}
                                        <span className={styles.jobType}>{job.type}</span>
                                        <span className={`${styles.statusBadge} ${getStatusClass(job.status)}`}>{job.status}</span>
                                    </div>
                                </td>
                                <td className={styles.tableCell}>{job.endDate || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function IndustryDefinition() {
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
                        setIndustryDefinition(data?.industry_description || "");
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
    }, [user]);

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
                <p className={styles.description}>
                    Define your industry in 2-5 words to help refine the content and analysis for brand and competitor reports.
                </p>
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

export default function VoiceCustomerPage() {
    const [hasBrands, setHasBrands] = useState(false);

    return (
        <div className={styles.pageContainer}>
            <ToastContainer />
            <main className={styles.mainContainer}>
                <div className={styles.cardsGrid}>
                    <FormulaeCard title="Industry and Category Definition">
                        <IndustryDefinition />
                    </FormulaeCard>
                    <Card icon={<Building size={20} />} title="Brands" maxCount={3}>
                        <Brands onBrandsChange={setHasBrands} />
                    </Card>
                    <Card icon={<Package size={20} />} title="Products" maxCount={10} disabled={!hasBrands}>
                        <Products />
                    </Card>
                    <Card icon={<Users size={20} />} title="Competitors" maxCount={5} disabled={!hasBrands}>
                        <Competitors />
                    </Card>
                </div>
                <ReportJobs />
            </main>
        </div>
    );
}

