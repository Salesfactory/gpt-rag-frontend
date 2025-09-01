export interface Brand {
    id: number;
    name: string;
    description: string;
    organization_id: string;
}

export interface Product {
    id: number;
    name: string;
    category: string;
    description: string;
    brandId?: string;
    organization_id: string;
}

export interface Competitor {
    id: string;
    name: string;
    industry: string;
    description: string;
    organization_id: string;
    brands: {
        brand_id: number;
    }[];
}

export interface ReportJob {
    id: number;
    type: string;
    target: string;
    status: "Completed" | "In Progress" | "Pending" | "Failed";
    progress: number;
    startDate: string | null;
    endDate: string | null;
}

export interface DeleteConfirmState {
    show: boolean;
    item: Brand | Product | Competitor | null;
    type: "brand" | "product" | "competitor" | "";
}

export interface ItemToDelete {
    products: Product[];
    competitors: [
        {
            brand_id: string;
            competitor_id: string;
        }
    ];
}
