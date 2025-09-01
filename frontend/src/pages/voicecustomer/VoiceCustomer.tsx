import React, { useState, useEffect, useCallback } from "react";
import { Search, Building, Package, Users, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Spinner, SpinnerSize } from "@fluentui/react";
import styles from "./VoiceCustomer.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAppContext } from "../../providers/AppProviders";
import { getBrandsByOrganization, getProductsByOrganization, getCompetitorsByOrganization, getItemsToDeleteByBrand } from "../../api/api";
import { Brand, Product, Competitor, ReportJob, DeleteConfirmState, ItemToDelete } from "./types";
import { InfoCard } from "./components/InfoCard";
import { BrandItem } from "./components/BrandItem";
import { ProductItem } from "./components/ProductItem";
import { CompetitorItem } from "./components/CompetitorItem";
import { BrandModal } from "./components/BrandModal";
import { ProductModal } from "./components/ProductModal";
import { CompetitorModal } from "./components/CompetitorModal";
import { DeleteModal } from "./components/DeleteModal";

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

    const [brands, setBrands] = useState<Brand[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);

    const [isLoadingBrands, setIsLoadingBrands] = useState(true);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(true);

    const [showBrandModal, setShowBrandModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCompetitorModal, setShowCompetitorModal] = useState(false);

    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);

    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ show: false, item: null, type: "" });
    const [itemsMarkedForDeletion, setItemsMarkedForDeletion] = useState<any[]>([]);
    const [isLoadingMarkedItems, setIsLoadingMarkedItems] = useState(false);

    const [reportJobs, setReportJobs] = useState<ReportJob[]>([
        { id: 1, type: "Brand Analysis", target: "Apple", status: "Completed", progress: 100, startDate: "2024-07-15", endDate: "2024-07-16" },
        { id: 2, type: "Product Analysis", target: "iPhone 15", status: "In Progress", progress: 65, startDate: "2024-07-16", endDate: null },
        { id: 3, type: "Competitive Analysis", target: "Samsung vs Apple", status: "Pending", progress: 0, startDate: null, endDate: null },
        { id: 4, type: "Brand Analysis", target: "Nike", status: "Failed", progress: 30, startDate: "2024-07-14", endDate: null },
        { id: 5, type: "Product Analysis", target: "MacBook Pro", status: "Completed", progress: 100, startDate: "2024-07-13", endDate: "2024-07-15" }
    ]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState("All Status");

    const fetchAllData = useCallback(async () => {
        if (!organization) return;

        setIsLoadingBrands(true);
        setIsLoadingProducts(true);
        setIsLoadingCompetitors(true);

        try {
            const [brandsData, productsData, competitorsData] = await Promise.all([
                getBrandsByOrganization({ organization_id: organization.id, user }),
                getProductsByOrganization({ organization_id: organization.id, user }),
                getCompetitorsByOrganization({ organization_id: organization.id, user })
            ]);
            setBrands(Array.isArray(brandsData) ? brandsData : []);
            setProducts(productsData);
            setCompetitors(competitorsData);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load data. Please refresh the page.");
        } finally {
            setIsLoadingBrands(false);
            setIsLoadingProducts(false);
            setIsLoadingCompetitors(false);
        }
    }, [organization, user]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleEdit = (item: Brand | Product | Competitor, type: "brand" | "product" | "competitor") => {
        if (type === "brand") {
            setEditingBrand(item as Brand);
            setShowBrandModal(true);
        } else if (type === "product") {
            setEditingProduct(item as Product);
            setShowProductModal(true);
        } else if (type === "competitor") {
            setEditingCompetitor(item as Competitor);
            setShowCompetitorModal(true);
        }
    };

    const handleDelete = async (item: Brand | Product | Competitor, type: "brand" | "product" | "competitor") => {
        if (!organization) return;
        setDeleteConfirm({ show: true, item, type });

        if (type === "brand") {
            setIsLoadingMarkedItems(true);
            try {
                const items: ItemToDelete = await getItemsToDeleteByBrand({
                    brand_id: String(item.id),
                    user,
                    organization_id: organization.id
                });

                const markedForDeletion = [];
                if (items.products && items.products.length > 0) {
                    markedForDeletion.push(...items.products.map(product => ({ ...product, type: "product" })));
                }
                if (items.competitors && items.competitors.length > 0) {
                    const competitorDetails = competitors.filter(c => items.competitors.some(ic => ic.competitor_id === c.id));
                    markedForDeletion.push(...competitorDetails.map(c => ({ ...c, type: "competitor" })));
                }
                setItemsMarkedForDeletion(markedForDeletion);
            } catch (error) {
                console.error("Error fetching items to delete:", error);
                toast.error("Could not retrieve associated items for deletion.");
            } finally {
                setIsLoadingMarkedItems(false);
            }
        }
    };

    const handleSuccess = (item: Brand | Product | Competitor, type: "brand" | "product" | "competitor") => {
        if (type === "brand") {
            setBrands(prevBrands => {
                const index = prevBrands.findIndex(b => b.id === item.id);
                if (index > -1) {
                    // Edit
                    const newBrands = [...prevBrands];
                    newBrands[index] = item as Brand;
                    return newBrands;
                } else {
                    // Add
                    return [...prevBrands, item as Brand];
                }
            });
        } else if (type === "product") {
            setProducts(prevProducts => {
                const index = prevProducts.findIndex(p => p.id === item.id);
                if (index > -1) {
                    const newProducts = [...prevProducts];
                    newProducts[index] = item as Product;
                    return newProducts;
                } else {
                    return [...prevProducts, item as Product];
                }
            });
        } else if (type === "competitor") {
            setCompetitors(prevCompetitors => {
                const index = prevCompetitors.findIndex(c => c.id === item.id);
                if (index > -1) {
                    const newCompetitors = [...prevCompetitors];
                    newCompetitors[index] = item as Competitor;
                    return newCompetitors;
                } else {
                    return [...prevCompetitors, item as Competitor];
                }
            });
        }
    };

    const handleDeleteSuccess = (id: number | string, type: "brand" | "product" | "competitor") => {
        if (type === "brand") {
            fetchAllData();
            return;
        }

        if (type === "product") {
            setProducts(prevProducts => prevProducts.filter(p => p.id !== id));
        } else if (type === "competitor") {
            setCompetitors(prevCompetitors => prevCompetitors.filter(c => c.id !== id));
        }
    };

    const filteredJobs = reportJobs.filter(job => {
        const matchesSearch = job.type.toLowerCase().includes(searchQuery.toLowerCase()) || job.target.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === "All Status" || job.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    const jobsWithEndDate = filteredJobs.filter(job => job.endDate !== null);
    const sortedJobsWithEndDate = jobsWithEndDate.sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime());
    const jobsWithoutEndDate = filteredJobs.filter(job => job.endDate === null);
    const jobsToDisplay = [...sortedJobsWithEndDate, ...jobsWithoutEndDate].slice(0, 10);

    const getStatusIcon = (status: ReportJob["status"]) => {
        if (status === "Completed") return <CheckCircle size={16} style={{ color: "#16a34a" }} />;
        if (status === "In Progress") return <Clock size={16} style={{ color: "#2563eb" }} />;
        if (status === "Failed") return <AlertCircle size={16} style={{ color: "#dc2626" }} />;
        return <Clock size={16} style={{ color: "#6b7280" }} />;
    };

    return (
        <div className={styles.pageContainer}>
            <ToastContainer />
            <main className={styles.mainContainer}>
                <div className={styles.cardsGrid}>
                    <InfoCard
                        title="Brands"
                        icon={<Building size={20} />}
                        items={brands}
                        itemLimit={3}
                        isLoading={isLoadingBrands}
                        onAdd={() => {
                            setEditingBrand(null);
                            setShowBrandModal(true);
                        }}
                        onEdit={item => handleEdit(item, "brand")}
                        onDelete={item => handleDelete(item, "brand")}
                        renderItem={brand => <BrandItem brand={brand} />}
                        entityType="brand"
                    />

                    <InfoCard
                        title="Products"
                        icon={<Package size={20} />}
                        items={products}
                        itemLimit={10}
                        isLoading={isLoadingProducts}
                        onAdd={() => {
                            setEditingProduct(null);
                            setShowProductModal(true);
                        }}
                        onEdit={item => handleEdit(item, "product")}
                        onDelete={item => handleDelete(item, "product")}
                        renderItem={product => <ProductItem product={product as Product & { brandId?: string }} brands={brands} />}
                        entityType="product"
                        addDisabled={brands.length === 0}
                    />

                    <InfoCard
                        title="Competitors"
                        icon={<Users size={20} />}
                        items={competitors}
                        itemLimit={5}
                        isLoading={isLoadingCompetitors}
                        onAdd={() => {
                            setEditingCompetitor(null);
                            setShowCompetitorModal(true);
                        }}
                        onEdit={item => handleEdit(item, "competitor")}
                        onDelete={item => handleDelete(item, "competitor")}
                        renderItem={competitor => <CompetitorItem competitor={competitor} />}
                        entityType="competitor"
                        addDisabled={brands.length === 0}
                    />
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
                            </div>
                            <div className={styles.filterDropdown}>
                                <button type="button" className={styles.filterButton} onClick={() => setShowStatusFilter(!showStatusFilter)}>
                                    {selectedStatus}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Target</th>
                                    <th>Status</th>
                                    <th>Progress</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                                {jobsToDisplay.map(job => (
                                    <tr key={job.id}>
                                        <td>{job.type}</td>
                                        <td>{job.target}</td>
                                        <td>
                                            <div className={`${styles.statusCell} ${getStatusClass(job.status)}`}>
                                                {getStatusIcon(job.status)}
                                                <span>{job.status}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.progressContainer}>
                                                <div className={styles.progressBar} style={{ width: `${job.progress}%` }} />
                                            </div>
                                            <span className={styles.progressText}>{job.progress}%</span>
                                        </td>
                                        <td>{job.startDate || "N/A"}</td>
                                        <td>{job.endDate || "N/A"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <BrandModal
                isOpen={showBrandModal}
                onClose={() => {
                    setShowBrandModal(false);
                    setEditingBrand(null);
                }}
                editingBrand={editingBrand}
                onSuccess={item => handleSuccess(item, "brand")}
            />

            <ProductModal
                isOpen={showProductModal}
                onClose={() => {
                    setShowProductModal(false);
                    setEditingProduct(null);
                }}
                editingProduct={editingProduct}
                brands={brands}
                onSuccess={item => handleSuccess(item, "product")}
            />

            <CompetitorModal
                isOpen={showCompetitorModal}
                onClose={() => {
                    setShowCompetitorModal(false);
                    setEditingCompetitor(null);
                }}
                editingCompetitor={editingCompetitor}
                onSuccess={item => handleSuccess(item, "competitor")}
            />

            <DeleteModal
                isOpen={deleteConfirm.show}
                onClose={() => setDeleteConfirm({ show: false, item: null, type: "" })}
                item={deleteConfirm.item}
                type={deleteConfirm.type}
                onSuccess={handleDeleteSuccess}
                isLoadingMarkedItems={isLoadingMarkedItems}
                itemsMarkedForDeletion={itemsMarkedForDeletion}
            />
        </div>
    );
}
