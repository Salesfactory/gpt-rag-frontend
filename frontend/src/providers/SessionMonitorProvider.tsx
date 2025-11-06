import React, { useEffect, createContext, useState } from "react";
import { monitorSessionKeepAlive } from "../api";
import { toast } from "react-toastify";

type SessionStatus = "active" | "expired" | "offline";

interface SessionContext {
    status: SessionStatus;
    expiresAt: number; // Unix timestamp in milliseconds
    lastCheckedAt: number;
}

export const SessionMonitorContext = createContext<SessionContext>({
    status: "offline",
    expiresAt: 0,
    lastCheckedAt: 0,
});

export default function SessionMonitorProvider({ children }: { children: React.ReactNode }) {

    const [sessionData, setSessionData] = useState<SessionContext>({
        status: "offline",
        expiresAt: 0,
        lastCheckedAt: 0,
    });
    const [nextCheck, setNextCheck] = useState<number>(Date.now());

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

    useEffect(() => {
        const checkSession = async () => {
            const data = await monitorSessionKeepAlive();
            setSessionData(() => ({
                status: data.status,
                expiresAt: data.expires_at,
                lastCheckedAt: Date.now(),
            }));
            setNextCheck(data.expires_at);

            // TODO: Talk to the team to decide on appropriate intervals and UX for session expiration warnings
        };

        checkSession();
    }, []);

    useEffect(() => {
      const onUnauthorized = (ev: Event) => {
        setSessionData(prev => ({
          ...prev,
          status: 'expired',
          lastCheckedAt: Date.now(),
        }));
        toast(sessionExpiredToast, {
            type: "error",
            autoClose: 8000,
            closeOnClick: false
        });
      };

      window.addEventListener('api-unauthorized', onUnauthorized);
      return () => window.removeEventListener('api-unauthorized', onUnauthorized);
    }, []);

    console.log("Session Data:", sessionData);

    return (
        <SessionMonitorContext.Provider
            value={sessionData}
        >
            {children}
        </SessionMonitorContext.Provider>
    );
}

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