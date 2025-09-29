# User Documents API Endpoints

## Overview
Manage per-user, per-conversation documents in the `user-documents` container, organized as `organization_id/user_id/conversation_id/`. Original filenames are preserved in blob metadata; saved filenames append a millisecond timestamp to the base name.

## Authentication
All endpoints require `X-MS-CLIENT-PRINCIPAL-ID` (user ID). Provide `X-MS-CLIENT-PRINCIPAL-ORGANIZATION` to scope organization; if a client also supplies `organization_id` in form/query/body, it must match the header or the request is rejected (403). `X-MS-CLIENT-PRINCIPAL-NAME` is optional.

## Endpoints

### 1) Upload User Document
POST `/api/upload-user-document`

- Content-Type: `multipart/form-data`
- Form fields:
  - `file`: PDF file (max 10MB)
  - `conversation_id`: Conversation UUID

Response:
```json
{
  "data": {
    "blob_url": "https://.../user-documents/{org}/{user}/{conv}/MyReport_1759018841485.pdf",
    "blob_name": "{org}/{user}/{conv}/MyReport_1759018841485.pdf",
    "saved_filename": "MyReport_1759018841485.pdf",
    "original_filename": "MyReport.pdf"
  },
  "status": 200
}
```

Notes: Only `.pdf` is allowed; filenames are saved as `{base}_{timestampMs}{ext}`. Blob metadata includes `original_filename`. If `X-MS-CLIENT-PRINCIPAL-ORGANIZATION` is present, it is used and any provided `organization_id` must match.

### 2) List User Documents
GET `/api/list-user-documents`

- Query params: `conversation_id`

Response:
```json
{
  "data": {
    "files": [
      {
        "blob_name": "{org}/{user}/{conv}/MyReport_1759018841485.pdf",
        "saved_filename": "MyReport_1759018841485.pdf",
        "original_filename": "MyReport.pdf",
        "size": 1048576,
        "uploaded_at": "2024-01-01T12:00:00Z"
      }
    ]
  },
  "status": 200
}
```

### 3) Delete User Document
DELETE `/api/delete-user-document`

- Content-Type: `application/json`
- Body (recommend using `blob_name`):
```json
{
  "blob_name": "{org}/{user}/{conv}/MyReport_1759018841485.pdf",
  "conversation_id": "{conv}"
}
```

Response:
```json
{ "data": { "message": "File 'MyReport_1759018841485.pdf' deleted successfully" }, "status": 200 }
```

Notes: Alternatively, provide `filename` (the saved filename only, not the original) instead of `blob_name`. Organization is taken from header when available and must match the body value if provided.

## Error Responses
All errors follow:
```json
{ "error": { "message": "Error description", "status": 400 } }
```

Common status codes: 400 (validation), 401 (auth), 413 (size), 500 (server).

## Security & Validation
- Path components sanitized; conversation IDs must be valid UUIDs.
- Only PDF files up to 10MB.
- Temporary local file cleaned up after upload.

## Storage Layout
```
user-documents/
└── {organization_id}/{user_id}/{conversation_uuid}/SavedName_1759018841485.pdf
```
