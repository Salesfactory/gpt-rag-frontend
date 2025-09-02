import { useEffect, useMemo, useState, useCallback } from "react";
import { getBrandsByOrganization, createBrand, updateBrand, deleteBrand } from "../../api/api";

type UseBrandsArgs = {
    organizationId?: string;
    user: any;
};
type Brand = {
    id: number;
    name: string;
    description: string;
};

export function useBrands({ organizationId, user }: UseBrandsArgs) {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");

    const canFetch = useMemo(() => Boolean(organizationId && user), [organizationId, user]);

    const fetchBrands = useCallback(
        async (signal?: AbortSignal) => {
            if (!canFetch) return;
            try {
                setIsLoading(true);
                setError("");
                const res = await getBrandsByOrganization({ organization_id: organizationId!, user});
                setBrands(Array.isArray(res) ? res : []);
            } catch (e: any) {
                if (e?.name === "AbortError") return;
                console.error("Error fetching brands:", e);
                setError(e?.message || "Failed to fetch brands.");
                setBrands([]);
            } finally {
                setIsLoading(false);
            }
        },
        [canFetch, organizationId, user]
    );

    // initial + reactive fetch with abort
    useEffect(() => {
        const ac = new AbortController();
        fetchBrands(ac.signal);
        return () => ac.abort();
    }, [fetchBrands]);

    // mutations (keep them here so UI stays thin)
    const create = useCallback(
        async (payload: { name: string; description: string }) => {
            if (!organizationId) return;
            await createBrand({
                brand_name: payload.name,
                brand_description: payload.description,
                organization_id: organizationId,
                user
            });
            await fetchBrands();
        },
        [organizationId, user, fetchBrands]
    );

    const update = useCallback(
        async (brand: Brand, payload: { name: string; description: string }) => {
            if (!organizationId) return;
            await updateBrand({
                brand_id: String(brand.id),
                brand_name: payload.name,
                brand_description: payload.description,
                organization_id: organizationId,
                user
            });
            await fetchBrands();
        },
        [organizationId, user, fetchBrands]
    );

    const remove = useCallback(
        async (brand: Brand) => {
            if (!organizationId) return;
            await deleteBrand({
                brand_id: String(brand.id),
                organization_id: organizationId,
                user
            });
            await fetchBrands();
        },
        [organizationId, user, fetchBrands]
    );

    return {
        brands,
        isLoading,
        error,
        refresh: fetchBrands, // expose for manual refresh
        create,
        update,
        remove,
        setBrands // optional, if UI needs to adjust locally
    };
}
