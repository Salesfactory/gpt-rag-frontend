import { fetchReportJobs } from "../api";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockUser = {
    id: "12345678-1234-1234-1234-123456789012",
    name: "Test User"
};

const mockReportJobs = [
    {
        id: "job-1",
        organization_id: "org-123",
        status: "completed",
        created_at: "2024-01-01T00:00:00Z"
    },
    {
        id: "job-2",
        organization_id: "org-123",
        status: "pending",
        created_at: "2024-01-02T00:00:00Z"
    }
];

describe("fetchReportJobs", () => {
    beforeEach(() => {
        mockFetch.mockClear();
    });

    it("makes GET request with correct URL and headers", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockReportJobs)
        });

        await fetchReportJobs({
            organization_id: "org-123",
            user: mockUser,
            limit: 10
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/report-jobs?organization_id=org-123&limit=10", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": "12345678-1234-1234-1234-123456789012",
                "X-MS-CLIENT-PRINCIPAL-NAME": "Test User"
            }
        });
    });

    it("includes status parameter when provided", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockReportJobs)
        });

        await fetchReportJobs({
            organization_id: "org-123",
            user: mockUser,
            status: "COMPLETED"
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/report-jobs?organization_id=org-123&limit=10&status=COMPLETED", expect.any(Object));
    });

    it("uses default values when user is null", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockReportJobs)
        });

        await fetchReportJobs({
            organization_id: "org-123",
            user: null
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "X-MS-CLIENT-PRINCIPAL-ID": "00000000-0000-0000-0000-000000000000",
                    "X-MS-CLIENT-PRINCIPAL-NAME": "anonymous"
                })
            })
        );
    });

    it("uses default limit of 10 when not provided", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockReportJobs)
        });

        await fetchReportJobs({
            organization_id: "org-123",
            user: mockUser
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/report-jobs?organization_id=org-123&limit=10", expect.any(Object));
    });

    it("returns data array when response is ok", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockReportJobs)
        });

        const result = await fetchReportJobs({
            organization_id: "org-123",
            user: mockUser
        });

        expect(result).toEqual(mockReportJobs);
    });

    it("returns empty array when data is not array", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({ message: "success" })
        });

        const result = await fetchReportJobs({
            organization_id: "org-123",
            user: mockUser
        });

        expect(result).toEqual([]);
    });

    it("throws error when response is not ok with message from data", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: jest.fn().mockResolvedValue({ message: "Invalid request" })
        });

        await expect(
            fetchReportJobs({
                organization_id: "org-123",
                user: mockUser
            })
        ).rejects.toThrow("Invalid request");
    });

    it("throws error when response is not ok with error from data", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: jest.fn().mockResolvedValue({ error: "Internal server error" })
        });

        await expect(
            fetchReportJobs({
                organization_id: "org-123",
                user: mockUser
            })
        ).rejects.toThrow("Internal server error");
    });

    it("throws default error when response is not ok and no data message", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: jest.fn().mockResolvedValue({})
        });

        await expect(
            fetchReportJobs({
                organization_id: "org-123",
                user: mockUser
            })
        ).rejects.toThrow("Failed to fetch report jobs (404)");
    });

    it("handles json parsing failure gracefully", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: jest.fn().mockRejectedValue(new Error("Invalid JSON"))
        });

        await expect(
            fetchReportJobs({
                organization_id: "org-123",
                user: mockUser
            })
        ).rejects.toThrow("Failed to fetch report jobs (500)");
    });

    it("returns empty array when json parsing fails for successful response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockRejectedValue(new Error("Invalid JSON"))
        });

        const result = await fetchReportJobs({
            organization_id: "org-123",
            user: mockUser
        });

        expect(result).toEqual([]);
    });
});
