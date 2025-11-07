import React, { useEffect } from "react";
import { toast } from "react-toastify";


export function installFetchUnauthorizedListener(): void {
    if ((window as any).__fetchUnauthorizedInstalled) return;
    (window as any).__fetchUnauthorizedInstalled = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
        const res = await originalFetch(...args);
        if (res.status === 401) {
            // dispatch a global event so React can react to unauthorized responses
            window.dispatchEvent(new CustomEvent('api-unauthorized', { detail: { url: args[0] } }));
        }
        return res;
    };
}

export default function SessionMonitorProvider({ children }: { children: React.ReactNode }) {

    useEffect(() => {
        const sessionExpiredToast = (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>The session has expired.</div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        aria-label="Refresh Page"
                        onClick={() => {
                            window.location.reload();
                        }}
                        style={{
                            padding: "4px 8px",
                            background: "#0078d4",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                        }}
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );

        const onUnauthorized = (ev: Event) => {
            if (toast.isActive((window as any).__sessionExpiredToastId)) return;
            (window as any).__sessionExpiredToastId = toast(sessionExpiredToast, {
                type: "error",
                autoClose: 8000,
                closeOnClick: false
            });
        };

        window.addEventListener('api-unauthorized', onUnauthorized);
        return () => window.removeEventListener('api-unauthorized', onUnauthorized);
    }, []);

    return (
        <>
            {children}
        </>
    );
}