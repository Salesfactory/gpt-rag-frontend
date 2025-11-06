type SessionStatus = "active" | "expired";

interface SessionContext {
    status: SessionStatus;
    expiresAt: number;
    lastCheckedAt: number;
}

