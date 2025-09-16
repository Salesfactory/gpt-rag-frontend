// Import necessary modules for k6 testing
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 5 },   // Ramp up to 5 users over 30s
        { duration: '1m', target: 10 },   // Stay at 10 users for 1 minute
        { duration: '30s', target: 0 },   // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<9000'], // 95% of requests must complete below 9s
        errors: ['rate<0.1'], // Error rate must be below 10%
    },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// Mock data for testing
const testData = {
    userId: '00000000-0000-0000-0000-000000000000',
    organizationId: '',
    reportId: 'test-report-456',
    subscriptionId: '',
    email: 'test@gmail.com',
    blobName: 'test-document.pdf',
    searchQuery: 'test query'
};

// Headers for authenticated requests (mock headers)
const authHeaders = {
    'Content-Type': 'application/json',
    'X-MS-CLIENT-PRINCIPAL-ID': testData.userId,
    'X-MS-CLIENT-PRINCIPAL-NAME': 'Test User'
};

export default function () {
    // Test Group 1: Health and Basic Endpoints
    group('Health and Basic Endpoints', function () {
        // Health check
        let response = http.get(`${BASE_URL}/healthz`);
        check(response, {
            'Health check status is 200': (r) => r.status === 200
        }) || errorRate.add(1);

        // Get auth config
        response = http.get(`${BASE_URL}/api/auth/config`);
        check(response, {
            'Auth config status is 200': (r) => r.status === 200,
            'Auth config has clientId': (r) => JSON.parse(r.body).clientId !== undefined,
        }) || errorRate.add(1);

        // Get storage account info
        response = http.get(`${BASE_URL}/api/get-storage-account`);
        check(response, {
            'Storage account request completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        sleep(0.5);
    });

    // Test Group 2: User Management Endpoints
    group('User Management', function () {
        // Get user by ID
        let response = http.get(`${BASE_URL}/api/user/${testData.userId}`, {
            headers: authHeaders
        });
        check(response, {
            'Get user request completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        // Update user data (PATCH)
        const updateUserPayload = {
            name: 'Test',
            email: testData.email
        };
        response = http.patch(`${BASE_URL}/api/user/${testData.userId}`, 
            JSON.stringify(updateUserPayload), 
            { headers: authHeaders }
        );
        check(response, {
            'Update user request completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        sleep(0.3);
    });

    // Test Group 3: Organization Endpoints
    group('Organization Management', function () {
        // Get organization subscription
        let response = http.get(`${BASE_URL}/api/get-organization-subscription?organizationId=${testData.organizationId}`, {
            headers: authHeaders
        });
        check(response, {
            'Get organization subscription completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        // Get user organizations
        response = http.get(`${BASE_URL}/api/get-user-organizations`, {
            headers: authHeaders
        });
        check(response, {
            'Get user organizations completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        // Update organization info
        const orgUpdatePayload = {
            brandInformation: 'Updated brand info',
            industryInformation: 'Technology'
        };
        response = http.patch(`${BASE_URL}/api/organization/${testData.organizationId}`, 
            JSON.stringify(orgUpdatePayload), 
            { headers: authHeaders }
        );
        check(response, {
            'Update organization completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        sleep(0.3);
    });
    
    // Test Group 6: File and Storage Operations
    group('File Operations', function () {
        // Get source documents
        let response = http.get(`${BASE_URL}/api/get-source-documents?organization_id=${testData.organizationId}`, {
            headers: authHeaders
        });
        check(response, {
            'Get source documents completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        sleep(0.3);
    });

    // Test Group 9: Subscription Management
    group('Subscription Management', function () {
        // Get subscription details
        let response = http.get(`${BASE_URL}/api/subscriptions/${testData.subscriptionId}/tiers`, {
            headers: authHeaders
        });
        check(response, {
            'Get subscription details completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        // Check financial assistant status
        response = http.get(`${BASE_URL}/api/subscription/${testData.subscriptionId}/financialAssistant`, {
            headers: authHeaders
        });
        check(response, {
            'Get financial assistant status completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        // Get product prices
        response = http.get(`${BASE_URL}/api/prices`, {
            headers: authHeaders
        });
        check(response, {
            'Get product prices completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        sleep(0.3);
    });

    // Test Group 10: Gallery and Invitations
    group('Gallery and Invitations', function () {
        // Get gallery items
        let response = http.get(`${BASE_URL}/api/organization/${testData.organizationId}/gallery`, {
            headers: authHeaders
        });
        check(response, {
            'Get gallery items completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        // Get invitations
        response = http.get(`${BASE_URL}/api/getInvitations?organizationId=${testData.organizationId}`, {
            headers: authHeaders
        });
        check(response, {
            'Get invitations completed': (r) => r.status >= 200 && r.status < 500,
        }) || errorRate.add(1);

        sleep(0.3);
    });

    // Random sleep to simulate real user behavior
    sleep(Math.random() * 2 + 1);
}