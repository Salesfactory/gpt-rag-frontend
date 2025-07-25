import React, { useState, useEffect } from "react";
import { Search, PlusCircle, Edit, Trash2, X, Building, Package, Users, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import styles from "./VoiceCustomer.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAppContext } from "../../providers/AppProviders";
import {
    getBrandsByOrganization,
    createBrand,
    deleteBrand,
    updateBrand,
    getProductsByOrganization,
    createProduct,
    deleteProduct,
    updateProduct,
    getCompetitorsByOrganization,
    createCompetitor,
    updateCompetitor,
    deleteCompetitor,
    getItemsToDeleteByBrand
} from "../../api/api";
import { get } from "cypress/types/lodash";

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
    id: number;
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

interface DeleteConfirmState {
    show: boolean;
    item: Brand | Product | Competitor | null;
    type: "brand" | "product" | "competitor" | "";
}

function generateNextId<T extends { id: number }>(items: T[]): number {
    return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
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

export default function VoiceCustomerPage() {
    const { user, organization } = useAppContext();

    const [searchQuery, setSearchQuery] = useState("");
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState("All Status");
    const [showBrandModal, setShowBrandModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCompetitorModal, setShowCompetitorModal] = useState(false);

    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);

    const [newBrand, setNewBrand] = useState({ name: "", description: "" });
    const [newProduct, setNewProduct] = useState({ name: "", category: "", description: "", brandId: "" });
    const [newCompetitor, setNewCompetitor] = useState<{ name: string; industry: string; description: string; brandIds: number[] }>({
        name: "",
        industry: "",
        description: "",
        brandIds: []
    });

    const [brandError, setBrandError] = useState("");
    const [productError, setProductError] = useState("");
    const [competitorError, setCompetitorError] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ show: false, item: null, type: "" });
    const [itemsMarkedForDeletion, setItemsMarkedForDeletion] = useState<any>();

    const [brands, setBrands] = useState<Brand[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [reportJobs, setReportJobs] = useState<ReportJob[]>([
        { id: 1, type: "Brand Analysis", target: "Apple", status: "Completed", progress: 100, startDate: "2024-07-15", endDate: "2024-07-16" },
        { id: 2, type: "Product Analysis", target: "iPhone 15", status: "In Progress", progress: 65, startDate: "2024-07-16", endDate: null },
        { id: 3, type: "Competitive Analysis", target: "Samsung vs Apple", status: "Pending", progress: 0, startDate: null, endDate: null },
        { id: 4, type: "Brand Analysis", target: "Nike", status: "Failed", progress: 30, startDate: "2024-07-14", endDate: null },
        { id: 5, type: "Product Analysis", target: "MacBook Pro", status: "Completed", progress: 100, startDate: "2024-07-13", endDate: "2024-07-15" }
    ]);

    const [isLoadingBrands, setIsLoadingBrands] = useState(true);
    const [isLoadingDelete, setIsLoadingDelete] = useState(false);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(true);

    useEffect(() => {
        const fetchBrands = async () => {
            if (!organization) return;
            try {
                setIsLoadingBrands(true);
                const fetchedBrands = await getBrandsByOrganization({
                    organization_id: organization?.id,
                    user
                });
                setBrands(Array.isArray(fetchedBrands) ? fetchedBrands : []);
            } catch (error) {
                console.error("Error fetching brands:", error);
                setBrands([]);
            } finally {
                setIsLoadingBrands(false);
            }
        };

        fetchBrands();
    }, [organization, user]);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!organization) return;
            try {
                setIsLoadingProducts(true);

                const fetchedProducts = await getProductsByOrganization({
                    organization_id: organization.id,
                    user
                });
                setProducts(fetchedProducts);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setIsLoadingProducts(false);
            }
        };

        fetchProducts();
    }, [organization, user]);

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
            } catch (error) {
                console.error("Error fetching competitors:", error);
                toast.error("Failed to fetch competitors. Please try again.");
            } finally {
                setIsLoadingCompetitors(false);
            }
        };

        fetchCompetitors();
    }, [organization, user]);

    // Uniqueness validation helpers
    const validateBrand = (name: string) => {
        if (name.trim().length === 0) return false;
        // If editing, allow the same name for the current brand
        const normalized = name.trim().toLowerCase();
        if (editingBrand) {
            return !brands.some(b => b.name.trim().toLowerCase() === normalized && b.id !== editingBrand.id);
        }
        return !brands.some(b => b.name.trim().toLowerCase() === normalized);
    };

    const validateProduct = (name: string, category: string) => {
        if (name.trim().length === 0 || category.trim().length === 0) return false;
        const normalized = name.trim().toLowerCase();
        if (editingProduct) {
            return !products.some(p => p.name.trim().toLowerCase() === normalized && p.id !== editingProduct.id);
        }
        return !products.some(p => p.name.trim().toLowerCase() === normalized);
    };

    const validateCompetitor = (name: string, industry: string) => {
        if (name.trim().length === 0 || industry.trim().length === 0) return false;
        const normalized = name.trim().toLowerCase();
        if (editingCompetitor) {
            return !competitors.some(c => c.name.trim().toLowerCase() === normalized && c.id !== editingCompetitor.id);
        }
        return !competitors.some(c => c.name.trim().toLowerCase() === normalized);
    };

    const handleAddBrand = async () => {
        if (!organization) return;
        if (newBrand.name.trim().length === 0) {
            setBrandError("Brand name is required");
            return;
        }

        try {
            setIsLoadingBrands(true);
            const createdBrand = await createBrand({
                brand_name: newBrand.name,
                brand_description: newBrand.description,
                organization_id: organization.id,
                user
            });

            // Reload brands from the backend to ensure the new brand is up-to-date
            const updatedBrands = await getBrandsByOrganization({
                organization_id: organization.id,
                user
            });
            setBrands(updatedBrands);

            // Show success notification
            toast.success("Brand added successfully");

            // Reset form state
            setNewBrand({ name: "", description: "" });
            setBrandError("");
            setShowBrandModal(false);
        } catch (error) {
            toast.error("Failed to create brand. Please try again.");
            console.error("Error creating brand:", error);
            setBrandError("Failed to create brand. Please try again.");
        } finally {
            setIsLoadingBrands(false);
        }
    };

    const handleEditBrand = async () => {
        if (!organization || !editingBrand) return;

        if (newBrand.name.trim().length === 0) {
            setBrandError("Brand name is required");
            return;
        }

        try {
            setIsLoadingBrands(true);
            await updateBrand({
                brand_id: String(editingBrand.id),
                brand_name: newBrand.name,
                brand_description: newBrand.description,
                user
            });

            // Reload brands from the backend to ensure the updated brand is reflected
            const updatedBrands = await getBrandsByOrganization({
                organization_id: organization.id,
                user
            });
            setBrands(updatedBrands);

            // Show success notification
            toast.success("Brand updated successfully");

            // Reset form state
            setNewBrand({ name: "", description: "" });
            setBrandError("");
            setEditingBrand(null);
            setShowBrandModal(false);
        } catch (error) {
            toast.error("Failed to update brand. Please try again.");
            console.error("Error updating brand:", error);
        } finally {
            setIsLoadingBrands(false);
        }
    };

    const handleAddProduct = async () => {
        if (!organization) return;

        if (newProduct.name.trim().length === 0 || newProduct.category.trim().length === 0 || !newProduct.brandId) {
            setProductError("All fields are required");
            return;
        }

        try {
            setIsLoadingProducts(true);
            const createdProduct = await createProduct({
                product_name: newProduct.name,
                product_description: newProduct.description,
                brand_id: newProduct.brandId,
                organization_id: organization.id,
                category: newProduct.category,
                user
            });

            // Reload products from the backend to ensure the new product is up-to-date
            const updatedProducts = await getProductsByOrganization({
                organization_id: organization.id,
                user
            });
            setProducts(updatedProducts);

            // Show success notification
            toast.success("Product added successfully");

            // Reset form state
            setNewProduct({ name: "", category: "", description: "", brandId: "" });
            setProductError("");
            setShowProductModal(false);
        } catch (error) {
            toast.error("Failed to create product. Please try again.");
            console.error("Error creating product:", error);
            setProductError("Failed to create product. Please try again.");
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const handleEditProduct = async () => {
        if (!organization || !editingProduct) return;

        if (newProduct.name.trim().length === 0 || newProduct.category.trim().length === 0 || !newProduct.brandId) {
            setProductError("All fields are required");
            return;
        }

        try {
            setIsLoadingProducts(true);
            await updateProduct({
                product_id: String(editingProduct.id),
                product_name: newProduct.name,
                product_description: newProduct.description,
                category: newProduct.category,
                brand_id: newProduct.brandId,
                user
            });

            // Reload products from the backend to ensure the updated product is reflected
            const updatedProducts = await getProductsByOrganization({
                organization_id: organization.id,
                user
            });
            setProducts(updatedProducts);

            // Show success notification
            toast.success("Product updated successfully");

            // Reset form state
            setNewProduct({ name: "", category: "", description: "", brandId: "" });
            setProductError("");
            setEditingProduct(null);
            setShowProductModal(false);
        } catch (error) {
            toast.error("Failed to update product. Please try again.");
            console.error("Error updating product:", error);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const handleAddCompetitor = async () => {
        if (!organization) return;

        if (newCompetitor.name.trim().length === 0 || newCompetitor.industry.trim().length === 0 || newCompetitor.brandIds.length === 0) {
            setCompetitorError("Competitor name, industry, and brand are required");
            return;
        }

        try {
            setIsLoadingCompetitors(true);
            const createdCompetitor = await createCompetitor({
                competitor_name: newCompetitor.name,
                competitor_description: newCompetitor.description,
                industry: newCompetitor.industry,
                brands_id: (newCompetitor.brandIds || []).map(String),
                organization_id: organization.id,
                user
            });

            // Reload competitors from the backend to ensure the new competitor is up-to-date
            const updatedCompetitors = await getCompetitorsByOrganization({
                organization_id: organization.id,
                user
            });
            setCompetitors(updatedCompetitors);

            // Show success notification
            toast.success("Competitor added successfully");

            // Reset form state
            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
            setCompetitorError("");
            setShowCompetitorModal(false);
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
                user
            });

            // Reload competitors from the backend to ensure the updated competitor is reflected
            const updatedCompetitors = await getCompetitorsByOrganization({
                organization_id: organization.id,
                user
            });
            setCompetitors(updatedCompetitors);

            // Show success notification
            toast.success("Competitor updated successfully");

            // Reset form state
            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
            setCompetitorError("");
            setEditingCompetitor(null);
            setShowCompetitorModal(false);
        } catch (error) {
            toast.error("Failed to update competitor. Please try again.");
            console.error("Error updating competitor:", error);
        } finally {
            setIsLoadingCompetitors(false);
        }
    };

    const handleEdit = (item: Brand | Product | Competitor, type: "brand" | "product" | "competitor") => {
        if (type === "brand") {
            setNewBrand({ name: item.name, description: item.description });
            setEditingBrand(item as Brand);
            setShowBrandModal(true);
        } else if (type === "product") {
            setNewProduct({
                name: (item as any).name,
                category: (item as any).category,
                description: item.description,
                brandId: (item as any).brandId || (brands[0]?.id ? String(brands[0].id) : "")
            });
            setEditingProduct(item as Product);
            setShowProductModal(true);
        } else if (type === "competitor") {
            setNewCompetitor({ name: (item as Competitor).name, industry: (item as Competitor).industry, description: item.description, brandIds: [] });
            setEditingCompetitor(item as Competitor);
            setShowCompetitorModal(true);
        }
    };

    const handleDelete = (item: Brand | Product | Competitor, type: "brand" | "product" | "competitor") => {
        setDeleteConfirm({ show: true, item, type });
        if (type === "brand") {
            const items =  getItemsToDeleteByBrand({
                brand_id: String(item.id),
                user
            });
            setItemsMarkedForDeletion(items);
            console.log("Items marked for deletion:", items);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm.item) return;

        setIsLoadingDelete(true); // Start spinner

        const { item, type } = deleteConfirm;
        try {
            if (type === "brand") {
                await handleDeleteBrand(String(item.id));
            } else if (type === "product") {
                await handleDeleteProduct(String(item.id));
            } else if (type === "competitor") {
                await handleDeleteCompetitor(String(item.id));
            }
        } catch (error) {
            console.error("Error during deletion:", error);
        } finally {
            setDeleteConfirm({ show: false, item: null, type: "" });
            setIsLoadingDelete(false); // Stop spinner
        }
    };

    const handleDeleteBrand = async (brandId: string) => {
        if (!organization) return;

        try {
            setIsLoadingBrands(true);
            await deleteBrand({
                brand_id: brandId,
                user
            });

            // Reload brands from the backend to ensure the list is up-to-date
            const updatedBrands = await getBrandsByOrganization({
                organization_id: organization.id,
                user
            });
            setBrands(updatedBrands);

            // Show success notification
            toast.success("Brand deleted successfully");
        } catch (error) {
            console.error("Error deleting brand:", error);
            toast.error("Failed to delete brand. Please try again.");
        } finally {
            setIsLoadingBrands(false);
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!organization) return;

        try {
            setIsLoadingProducts(true);
            await deleteProduct({
                product_id: productId,
                user
            });

            // Reload products from the backend to ensure the list is up-to-date
            const updatedProducts = await getProductsByOrganization({
                organization_id: organization.id,
                user
            });
            setProducts(updatedProducts);

            // Show success notification
            toast.success("Product deleted successfully");
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("Failed to delete product. Please try again.");
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const handleDeleteCompetitor = async (competitorId: string) => {
        if (!organization) return;

        try {
            setIsLoadingCompetitors(true);
            await deleteCompetitor({
                competitor_id: competitorId,
                user
            });

            // Reload competitors from the backend to ensure the list is up-to-date
            const updatedCompetitors = await getCompetitorsByOrganization({
                organization_id: organization.id,
                user
            });
            setCompetitors(updatedCompetitors);

            // Show success notification
            toast.success("Competitor deleted successfully");
        } catch (error) {
            console.error("Error deleting competitor:", error);
            toast.error("Failed to delete competitor. Please try again.");
        } finally {
            setIsLoadingCompetitors(false);
        }
    };

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

    const get_brands = (competitor: Competitor) => {
        const brands_c = competitor.brands.map(b => b.brand_id);
        const brands_names = brands.filter(b => brands_c.includes(b.id)).map(b => b.name);
        return brands_names;
    };

    useEffect(() => {
        if (editingCompetitor) {
            setNewCompetitor({
                name: editingCompetitor.name,
                industry: editingCompetitor.industry,
                description: editingCompetitor.description,
                brandIds: editingCompetitor.brands ? editingCompetitor.brands.map(b => b.brand_id) : []
            });
        }
    }, [editingCompetitor]);

    return (
        <div className={styles.pageContainer}>
            <ToastContainer />
            <main className={styles.mainContainer}>
                <div className={styles.cardsGrid}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <Building size={20} />
                                <h3 className={styles.cardTitle}>Brands ({brands.length}/3)</h3>
                            </div>
                            <button onClick={() => setShowBrandModal(true)} disabled={brands.length >= 3} className={styles.headerAddButton}>
                                <PlusCircle size={16} />
                            </button>
                        </div>
                        <div className={styles.cardBody}>
                            {isLoadingBrands ? (
                                <Spinner size={SpinnerSize.large} label="Loading brands..." />
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
                                                <button onClick={() => handleEdit(brand, "brand")} className={styles.iconButton}>
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(brand, "brand")} className={`${styles.iconButton} ${styles.deleteButton}`}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <Package size={20} />
                                <h3 className={styles.cardTitle}>Products ({products.length}/10)</h3>
                            </div>
                            <button
                                onClick={() => setShowProductModal(true)}
                                disabled={products.length >= 10 || brands.length === 0}
                                className={styles.headerAddButton}
                            >
                                <PlusCircle size={16} />
                            </button>
                        </div>
                        <div className={styles.cardBody}>
                            {isLoadingProducts ? (
                                <Spinner size={SpinnerSize.large} label="Loading products..." />
                            ) : products.length === 0 ? (
                                <p className={styles.emptyStateText}>No products added yet</p>
                            ) : (
                                <div className={styles.itemsList}>
                                    {products.map(product => {
                                        const brandName = (product as any).brandId
                                            ? brands.find(b => String(b.id) === String((product as any).brandId))?.name
                                            : undefined;
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
                                                    <button onClick={() => handleEdit(product, "product")} className={styles.iconButton}>
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(product, "product")}
                                                        className={`${styles.iconButton} ${styles.deleteButton}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderTitle}>
                                <Users size={20} />
                                <h3 className={styles.cardTitle}>Competitors ({competitors.length}/5)</h3>
                            </div>
                            <button
                                onClick={() => setShowCompetitorModal(true)}
                                disabled={competitors.length >= 5 || brands.length === 0}
                                className={styles.headerAddButton}
                            >
                                <PlusCircle size={16} />
                            </button>
                        </div>
                        <div className={styles.cardBody}>
                            {isLoadingCompetitors ? (
                                <Spinner size={SpinnerSize.large} label="Loading competitors..." />
                            ) : competitors.length === 0 ? (
                                <p className={styles.emptyStateText}>No competitors added yet</p>
                            ) : (
                                <div className={styles.itemsList}>
                                    {competitors.map(c => {
                                        const brandNames = get_brands(c);
                                        return (
                                            <div key={c.id} className={styles.listItem}>
                                                <div className={styles.itemContent}>
                                                    <div className={styles.itemHeader}>
                                                        <h4 className={styles.itemName}>{c.name}</h4>
                                                        <span className={styles.itemIndustry}>{c.industry}</span>
                                                        {brandNames.length > 0 &&
                                                            brandNames.map((name, index) => (
                                                                <span key={index} className={styles.itemBrand}>
                                                                    {name}
                                                                    {index < brandNames.length - 1 ? " " : ""}
                                                                </span>
                                                            ))}
                                                    </div>
                                                    {c.description && <p className={styles.itemDescription}>{c.description}</p>}
                                                </div>
                                                <div className={styles.itemActions}>
                                                    <button onClick={() => handleEdit(c, "competitor")} className={styles.iconButton}>
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c, "competitor")}
                                                        className={`${styles.iconButton} ${styles.deleteButton}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

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
            </main>

            {showBrandModal && (
                <div className={styles.modalContainer}>
                    <div
                        className={styles.modalOverlay}
                        onClick={() => {
                            setShowBrandModal(false);
                            setNewBrand({ name: "", description: "" });
                            setBrandError("");
                            setEditingBrand(null);
                        }}
                    />
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>{editingBrand ? "Edit Brand" : "Add Brand to Track"}</h3>
                            <button
                                onClick={() => {
                                    setShowBrandModal(false);
                                    setNewBrand({ name: "", description: "" });
                                    setBrandError("");
                                    setEditingBrand(null);
                                }}
                                className={styles.modalCloseButton}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.modalBody}>
                                <div>
                                    <label className={styles.formLabel}>Brand Name</label>
                                    <input
                                        type="text"
                                        value={newBrand.name}
                                        onChange={e => {
                                            setNewBrand({ ...newBrand, name: e.target.value });
                                            if (brandError) setBrandError("");
                                        }}
                                        placeholder="Enter brand name"
                                        className={styles.formInput}
                                    />
                                </div>
                                <div>
                                    <label className={styles.formLabel}>Description (Optional)</label>
                                    <textarea
                                        value={newBrand.description}
                                        onChange={e => setNewBrand({ ...newBrand, description: e.target.value })}
                                        placeholder="Brief description of the brand"
                                        rows={3}
                                        className={styles.formTextarea}
                                    />
                                </div>
                                {brandError && <p className={styles.errorMessage}>{brandError}</p>}
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    onClick={() => {
                                        setShowBrandModal(false);
                                        setNewBrand({ name: "", description: "" });
                                        setBrandError("");
                                        setEditingBrand(null);
                                    }}
                                    className={`${styles.button} ${styles.buttonCancel}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={editingBrand ? handleEditBrand : handleAddBrand}
                                    disabled={isLoadingBrands}
                                    className={`${styles.button} ${styles.buttonConfirm}`}
                                >
                                    {isLoadingBrands ? <Spinner size={SpinnerSize.small} /> : editingBrand ? "Update" : "Add"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showProductModal && (
                <div className={styles.modalContainer}>
                    <div
                        className={styles.modalOverlay}
                        onClick={() => {
                            setShowProductModal(false);
                            setNewProduct({ name: "", category: "", description: "", brandId: "" });
                            setProductError("");
                            setEditingProduct(null);
                        }}
                    />
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>{editingProduct ? "Edit Product" : "Add Product to Track"}</h3>
                            <button
                                onClick={() => {
                                    setShowProductModal(false);
                                    setNewProduct({ name: "", category: "", description: "", brandId: "" });
                                    setProductError("");
                                    setEditingProduct(null);
                                }}
                                className={styles.modalCloseButton}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className={styles.modalContent}>
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
                                        value={newProduct.brandId}
                                        onChange={e => {
                                            setNewProduct({ ...newProduct, brandId: e.target.value });
                                            if (productError) setProductError("");
                                        }}
                                        className={styles.formInput}
                                        style={{ color: !newProduct.brandId ? "#9ca3af" : undefined }}
                                    >
                                        {!newProduct.brandId && (
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
                                <button
                                    onClick={() => {
                                        setShowProductModal(false);
                                        setNewProduct({ name: "", category: "", description: "", brandId: "" });
                                        setProductError("");
                                        setEditingProduct(null);
                                    }}
                                    className={`${styles.button} ${styles.buttonCancel}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={editingProduct ? handleEditProduct : handleAddProduct}
                                    disabled={isLoadingProducts}
                                    className={`${styles.button} ${styles.buttonConfirm}`}
                                >
                                    {isLoadingProducts ? <Spinner size={SpinnerSize.small} /> : editingProduct ? "Update" : "Add"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCompetitorModal && (
                <div className={styles.modalContainer}>
                    <div
                        className={styles.modalOverlay}
                        onClick={() => {
                            setShowCompetitorModal(false);
                            setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
                            setCompetitorError("");
                            setEditingCompetitor(null);
                        }}
                    />
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>{editingCompetitor ? "Edit Competitor" : "Add Competitor to Track"}</h3>
                            <button
                                onClick={() => {
                                    setShowCompetitorModal(false);
                                    setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
                                    setCompetitorError("");
                                    setEditingCompetitor(null);
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
                                    <label className={styles.formLabel}>Brands</label>
                                    <div className={styles.multiSelectContainer}>
                                        {brands.map(brand => (
                                            <div key={brand.id} className={styles.multiSelectItem}>
                                                <label htmlFor={`brand-${brand.id}`} className={styles.multiSelectLabel}>
                                                    <input
                                                        type="checkbox"
                                                        id={`brand-${brand.id}`}
                                                        value={brand.id}
                                                        checked={newCompetitor.brandIds?.includes(brand.id) || false}
                                                        onChange={e => {
                                                            const selectedBrandIds = newCompetitor.brandIds || [];
                                                            if (e.target.checked) {
                                                                setNewCompetitor({
                                                                    ...newCompetitor,
                                                                    brandIds: [...selectedBrandIds, brand.id]
                                                                });
                                                            } else {
                                                                setNewCompetitor({
                                                                    ...newCompetitor,
                                                                    brandIds: selectedBrandIds.filter(id => id !== brand.id)
                                                                });
                                                            }
                                                            if (competitorError) setCompetitorError("");
                                                        }}
                                                        style={{ accentColor: "#4caf50" }}
                                                    />
                                                    <span className={styles.brandName}>{"   " + brand.name}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
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
                                        setShowCompetitorModal(false);
                                        setNewCompetitor({ name: "", industry: "", description: "", brandIds: [] });
                                        setCompetitorError("");
                                        setEditingCompetitor(null);
                                    }}
                                    className={`${styles.button} ${styles.buttonCancel}`}
                                >
                                    Cancel
                                </button>
                                <button
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
            )}

            {deleteConfirm.show && (
                <div className={styles.modalContainer}>
                    <div className={styles.modalOverlay} onClick={() => setDeleteConfirm({ show: false, item: null, type: "" })} />
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                            <div className={styles.deleteModalHeader}>
                                <h3 className={styles.deleteModalTitle}>Delete {deleteConfirm.type}</h3>
                                <button
                                    onClick={() => setDeleteConfirm({ show: false, item: null, type: "" })}
                                    className={styles.modalCloseButton}
                                    style={{ color: "#9ca3af" }}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <p className={styles.deleteModalText}>
                                Are you sure you want to remove <span>{deleteConfirm.item?.name}</span> from tracking?
                            </p>
                            { deleteConfirm.type === "brand" && (
                                <p className={styles.deleteModalText}>
                                    This will also remove all associated products and competitors:∂                        
                                </p>
                            )}

                            <div className={styles.deleteModalActions}>
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirm({ show: false, item: null, type: "" })}
                                    className={styles.buttonDeleteCancel}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    className={styles.buttonDelete}
                                    disabled={isLoadingDelete} // Disable button while loading
                                >
                                    {isLoadingDelete ? <Spinner size={SpinnerSize.small} /> : "Yes, Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
