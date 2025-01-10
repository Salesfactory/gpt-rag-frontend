# Nam Endpoint Documentation


# 1. Get financial data

An API endpoint that processes and uploads financial documents from SEC EDGAR. This function handles the downloading, processing, and uploading of SEC filings for specified companies.


GET /api/SECEdgar/financialdocuments 


Request Body JSON payload with the following parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| equity_id | string | Yes | Stock symbol/ticker (e.g., 'AAPL', 'MSFT') |
| filing_type | string | Yes | Type of SEC filing (Currently supports 10-K, 10-Q, 8-K, DEF 14A) |
| after_date | string | No | Optional date filter in YYYY-MM-DD format |


## Example Request

```bash
{
    "equity_id": "AAPL",
    "filing_type": "10-K",
    "after_date": "2023-01-01"
}
```

## Response 

### Success Response
Returns a JSON object with the processing results:

```bash
{
    "status": "success",
    "code": 200,
    "message": "Document processed successfully",
    "results": {
        "<equity_id>": {
            "<filing_type>": {
                "blob_path": "financial/<filing_type>/<equity_id>.pdf",
                "blob_url": "https://<storage_url>/documents/financial/<filing_type>/<equity_id>.pdf",
                "metadata": {
                    "equity_id": "<equity_id>",
                    "filing_type": "<filing_type>",
                    "source": "SEC EDGAR",
                    "uploaded_date": "YYYY-MM-DD"
                },
                "status": "success"
            }
        }
    }
}
```

### Error Response 


**404 Not Found**

No document found for the given equity_id and filing_type **after the given date**

```bash
{
    "code": 404,
    "message": "No 10-Q found after <date> for <equity_id>",
    "status": "not_found"   
}
```

**500 Internal Server Error**

Returned when server-side processing fails 

```bash
{
    "status": "error",
    "message": "<error description>",
    "code": 500
}
```

Dependencies 
- Requires **wkhtmltopdf** to be installed on the system

**400 Bad Request**
Returned when the request is invalid or missing required parameters

```bash
{
    "code": 400,
    "message": "<error description>",
    "status": "bad_request"
}
```

# 2. Summarization

Endpoint to generate a summary of financial documents 

POST /api/SECEdgar/financialdocuments/summary

Request Body JSON payload with the following parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| equity_name | string | Yes | Stock symbol/ticker (e.g., 'AAPL', 'MSFT') |
| financial_type | string | Yes | Type of SEC filing (Currently supports 10-K, 10-Q, 8-K, DEF 14A) |


### Example Request

```bash
{
    "equity_name": "<stock_symbol>",
    "financial_type": "<filing_type>" # 10-K, 10-Q, 8-K, DEF 14A
}
```

## Response 

### Success Response 


```bash
{
    "status": "success",
    "equity_name": "<equity_name>",
    "financial_type": "<filing_type>",
    "blob_path": "financial/<filing_type>/<equity_name>_summary.pdf",
    "remote_blob_url": "https://<storage_url>/documents/financial/<filing_type>/<equity_name>_summary.pdf",
    "summary": "<generated_summary_text>"
}
```

### Error Response 

```bash
# 1. Request Validation Errors (400)
# Invalid JSON
return jsonify({
    'error': 'Invalid request',
    'details': 'Request body is requred and must be a valid JSON object'
}), 400

# Missing fields
return jsonify({
    'error': 'Missing required fields',
    'details': 'equity_name and financial_type are required'
}), 400

# Invalid types
return jsonify({
    'error': 'Invalid input type',
    'details': 'equity_name and financial_type must be strings'
}), 400

# 2. Service Errors (503)
# Connection issues
return jsonify({
    'error': 'Connection error',
    'details': 'Failed to connect to storage service'
}), 503

# 3. Internal Server Errors (500)
# Service initialization
return jsonify({
    'error': 'Service initialization failed',
    'details': str(e)
}), 500

# Directory management
return jsonify({
    'error': 'Cleanup failed',
    'details': 'Failed to clean up directories to prepare for processing'
}), 500

# Generic unexpected errors
return jsonify({
    'error': 'Internal server error',
    'details': str(e)
}), 500

```

# 3. Process and Summarize Edgar Financial Documents
Endpoint to process and generate summaries for SEC Edgar financial documents in a single request.

POST /api/SECEdgar/financialdocuments/process-and-summarize

### Example Request 

```json
{
"equity_id": "AAPL", // Stock symbol/ticker
"filing_type": "10-K", // SEC filing type
"after_date": "2023-01-01" // Optional, format: YYYY-MM-DD
}
```

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| equity_id | string | Stock symbol/ticker (e.g., 'AAPL') |
| filing_type | string | Type of SEC filing (must be one of FILING_TYPES) |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| after_date | string | Filter for filings after this date (YYYY-MM-DD format) |

## Processing Steps
1. Document Processing: Downloads and processes SEC Edgar document (it uses the financialdocuments endpoint)
2. Summary Generation: Creates a summary of the processed document (it uses the summary endpoint)

## Responses

### Success Response  

Returns a JSON object containing both the document processing and summary results:

```json
{
    "status": "success",
    "edgar_data_process": {
        "code": 200,
        "message": "Document processed successfully",
        "status": "success",
        "results": {
            "<equity_id>": {
                "<filing_type>": {
                    "blob_path": "financial/<filing_type>/<equity_id>.pdf",
                    "blob_url": "https://<storage_url>/documents/financial/<filing_type>/<equity_id>.pdf",
                    "metadata": {
                        "equity_id": "<equity_id>",
                        "filing_type": "<filing_type>",
                        "source": "SEC EDGAR",
                        "uploaded_date": "YYYY-MM-DD"
                    },
                    "status": "success"
                }
            }
        }
    },
    "summary_process": {
        "status": "success",
        "equity_name": "<equity_id>",
        "financial_type": "<filing_type>",
        "blob_path": "financial/<filing_type>/<equity_id>_summary.pdf",
        "remote_blob_url": "https://<storage_url>/documents/financial/<filing_type>/<equity_id>_summary.pdf",
        "summary": "<generated_summary_text>"
    }
}
```

#### Response Fields

##### Top Level
| Field | Type | Description |
|-------|------|-------------|
| status | string | Overall processing status |
| edgar_data_process | object | Results from document processing |
| summary_process | object | Results from summary generation |

##### Edgar Data Process
| Field | Type | Description |
|-------|------|-------------|
| code | number | HTTP status code (200 for success) |
| message | string | Processing status message |
| status | string | Processing status |
| results | object | Document processing results by equity |

##### Summary Process
| Field | Type | Description |
|-------|------|-------------|
| status | string | Summary generation status |
| equity_name | string | Stock symbol/ticker |
| financial_type | string | Type of SEC filing |
| blob_path | string | Path to summary file in storage |
| remote_blob_url | string | Full URL to access summary |
| summary | string | Generated text summary |



### Error Responses

#### 1. Bad Request (400)
Returned for request validation errors:

```json
{
    "status": "error",
    "error": "<error_type>",
    "details": "<error_description>",
    "timestamp": "<UTC_timestamp>"
}
```

Common 400 error scenarios:
```json
// Missing JSON body
{
    "status": "error",
    "error": "Invalid request",
    "details": "Request body is required and must be a valid JSON object",
    "timestamp": "2024-01-10T12:00:00Z"
}

// Missing required fields
{
    "status": "error",
    "error": "Missing required fields",
    "details": "Missing required fields: equity_id, filing_type",
    "timestamp": "2024-01-10T12:00:00Z"
}

// Invalid filing type
{
    "status": "error",
    "error": "Invalid filing type",
    "details": "Invalid filing type. Must be one of: 10-K, 10-Q, 8-K, DEF 14A",
    "timestamp": "2024-01-10T12:00:00Z"
}

// Invalid date format
{
    "status": "error",
    "error": "Invalid date format",
    "details": "Use YYYY-MM-DD",
    "timestamp": "2024-01-10T12:00:00Z"
}
```

#### 2. Not Found (404)
Returned when the requested document cannot be found:

```json
{
    "status": "not_found",
    "error": "No document found for the specified criteria",
    "code": 404,
    "timestamp": "<UTC_timestamp>"
}
```

#### 3. Internal Server Error (500)
Returned for processing failures:

```json
{
    "status": "error",
    "error": "<error_message>",
    "details": "<error_details>",
    "timestamp": "<UTC_timestamp>"
}
```

Common 500 error scenarios:
```json
// Document processing failure
{
    "status": "error",
    "error": "Document processing failed",
    "details": "Failed to process SEC Edgar document",
    "timestamp": "2024-01-10T12:00:00Z"
}

// Summary generation failure
{
    "status": "error",
    "error": "Summary generation failed",
    "details": "Failed to generate document summary",
    "timestamp": "2024-01-10T12:00:00Z"
}

// Unexpected error
{
    "status": "error",
    "error": "An unexpected error occurred while processing the document",
    "details": "<specific_error_message>",
    "timestamp": "2024-01-10T12:00:00Z"
}
```

# 4. Curation Report 

Endpoint to generate curated reports based on a specific topic 

POST /api/SECEdgar/financialdocuments/curation

### Example Request 

```bash
{
    "report_topic": "<report_type>" # Monthly_Economics, Weekly_Economics, Ecommerce
}
```

## Response 

### Success Response 

```json
{
    "status": "success",
    "message": "Report generated for <report_topic>",
    "report_url": "https://<storage_url>/documents/Reports/Curation_Reports/<report_topic>/<Month_Year>/Week_<N>.html"
}
```
#### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| status | string | Processing status ("success") |
| message | string | Confirmation message including the report type |
| report_url | string | Full URL to access the generated report |

#### URL Structure
The `report_url` follows this pattern:
- Weekly reports: `.../Reports/Curation_Reports/<topic>/<Month_Year>/Week_<N>.html`
- Monthly reports: `.../Reports/Curation_Reports/<topic>/<Month_Year>.html`

### Error Response 

**Missing required fields**

```json
{
    "error": "report_topic is required"
}
```

**Invalid report type**

```json
{
"error": "Invalid report type. Please choose from: [<allowed_report_types>]"
}
```

**Internal Server Error**

```json
{
"error": "An unexpected error occurred while generating the report"
}
```

# 5. Send Email Endpoint 

Endpoint to send HTML-formatted emails with optional attachments and storage capabilities.

POST /api/reports/email

### Example Request 

```json
{
    "subject": "Email subject",
    "html_content": "HTML formatted content",
    "recipients": ["email1@domain.com", "email2@domain.com"],
    "attachment_path": "path/to/attachment.pdf", // Optional
    "save_email": "yes" // Optional, default: "no"
}

```
### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| subject | string | Email subject line |
| html_content | string | HTML-formatted email body |
| recipients | array | List of recipient email addresses |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| attachment_path | string | Path to attachment file (use forward slashes) |
| save_email | string | Whether to save email to blob storage ("yes"/"no") |

## Responses

### Success Response 

```json
    {
    "status": "success",
    "message": "Email sent successfully",
    "blob_name": "<blob_path>" // Only if save_email="yes", if not then return null
    }
```

### Error Response 

Returned for validation errors:

```json
{
"status": "error",
"message": "<error_description>"
}
```


Common 400 error messages:
- "No JSON data provided"
- "Missing required fields: subject, html_content, recipients"
- "Recipients must be provided as a list"
- "At least one recipient is required"
- "Attachment file not found: <path>"

Internal Server Error 

```json
{
"status": "error",
"message": "An unexpected error occurred while processing the request"
}
```


Common 500 error messages:
- "Email service configuration error"
- "Failed to send email: <details>"
- "Email has been sent, but failed to upload to blob storage: <details>"
- "An unexpected error occurred: <details>"

## Notes
- Attachments must be accessible from the server's file system
- Windows-style paths are automatically converted to proper format
- Email configuration is managed through environment variables
- Emails can optionally be saved to blob storage
- All operations are logged for debugging purposes


# 6. Process and Email Report Digest 

Endpoint to process a report from a blob storage and send it via email

POST /api/reports/digest

### Example Request 
```json
{
"blob_link": "https://storage.com/path/to/report", // Required: URL to the report
"recipients": ["email1@domain.com"], // Required: Array of email addresses
"attachment_path": "path/to/attachment.pdf", // Optional: Custom attachment path
"email_subject": "Custom Report Subject", // Optional: Email subject line
"save_email": "yes" // Optional: Save email to storage (default: "yes")
}
```


### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| blob_link | string | Full URL to the report in blob storage |
| recipients | array | List of recipient email addresses |

### Optional Fields
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| attachment_path | string | blob document | Path to custom attachment (use forward slashes) |
| email_subject | string | auto-generated | Custom email subject line |
| save_email | string | "yes" | Whether to save email to blob storage ("yes"/"no") |

**IMPORTANT**

By default, the email will include a PDF version of the report from the provided blob link as an attachment.


## Responses

### Success Response

```json
{
"status": "success",
"message": "Report processed and email sent successfully"
}
```

### Error Response

```json
{
"status": "error",
"message": "<error_description>"
}
```


Common 400 error messages:
- "No JSON data provided"
- "Missing required fields: blob_link and recipients"

#### Internal Server Error (500)

Common 500 error messages:
- "Failed to process report and send email"
- Specific error messages from processing/sending attempts

## Notes
- By default, the report from the blob_link is attached to the email
- Use attachment_path="no" to disable automatic attachment
- Custom attachments must be accessible from the server
- Emails can be automatically saved to blob storage
