// Global blob cache to prevent redundant API calls
interface CachedBlob {
    blob: Blob;
    url: string;
    type: string;
    timestamp: number;
}

class BlobCache {
    private cache: Map<string, CachedBlob> = new Map();
    private maxAge: number = 1000 * 60 * 60; // 1 hour default

    set(key: string, blob: Blob, type: string): string {
        // Revoke old URL if exists
        const existing = this.cache.get(key);
        if (existing) {
            URL.revokeObjectURL(existing.url);
        }

        const url = URL.createObjectURL(blob);
        this.cache.set(key, {
            blob,
            url,
            type,
            timestamp: Date.now()
        });

        return url;
    }

    get(key: string): CachedBlob | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > this.maxAge) {
            this.delete(key);
            return null;
        }

        return cached;
    }

    has(key: string): boolean {
        const cached = this.cache.get(key);
        if (!cached) return false;

        // Check if expired
        if (Date.now() - cached.timestamp > this.maxAge) {
            this.delete(key);
            return false;
        }

        return true;
    }

    delete(key: string): void {
        const cached = this.cache.get(key);
        if (cached) {
            URL.revokeObjectURL(cached.url);
            this.cache.delete(key);
        }
    }

    clear(): void {
        this.cache.forEach(cached => {
            URL.revokeObjectURL(cached.url);
        });
        this.cache.clear();
    }

    // Cleanup expired entries
    cleanup(): void {
        const now = Date.now();
        this.cache.forEach((cached, key) => {
            if (now - cached.timestamp > this.maxAge) {
                this.delete(key);
            }
        });
    }
}

// Export singleton instance
export const blobCache = new BlobCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
    blobCache.cleanup();
}, 1000 * 60 * 5);

