# Organization Usage Decorators Documentation

This document provides comprehensive documentation for all organization usage decorators available in the GPT-RAG Frontend backend system.

## Overview

The organization usage decorators are designed to enforce usage limits, validate permissions, and provide usage context for API endpoints that interact with organization resources. These decorators handle authentication, authorization, and limit checking for various operations including conversations, file uploads, and storage management.

## Available Decorators

### 1. `@check_organization_limits()`

**Purpose**: Fetches organization usage and limits, injects usage summary into the decorated function's kwargs.

**Behavior**:
- Validates organization context and user permissions
- Retrieves organization usage data and subscription tier limits
- Injects `organization_usage` dictionary into function kwargs
- Does not enforce limits (only provides information)

**Usage Context**: Use when you need usage information but don't need to enforce limits.

**Injected Kwargs**:
```python
kwargs["organization_usage"] = {
    "limits": {
        "totalCreditsAllocated": int,
        "totalStorageAllocated": int,
        # ... other quota limits
    },
    "current_usage": {
        "currentUsed": int,
        "currentUsedStorage": float,
        # ... other usage metrics
    },
    "is_credits_exceeded": bool,
    "is_allowed_to_upload_files": bool
}
```

**Example Usage**:
```python
@bp.route("/api/organizations/<organization_id>/usage", methods=["GET"])
@check_organization_limits()
def getOrganizationUsage(organization_id, **kwargs):
    usage = kwargs["organization_usage"]
    return jsonify(usage)
```

**Error Responses**:
- `400`: Missing organization_id
- `401`: Unauthorized (missing client principal ID)
- `403`: Unauthorized access to organization
- `500`: Internal server error

---

### 2. `@require_conversation_limits()`

**Purpose**: Enforces organization-level conversation limits.

**Behavior**:
- Validates organization context and user permissions
- Checks if organization has exceeded its conversation credit limits
- Blocks access if limits are exceeded
- Does not inject any additional kwargs

**Usage Context**: Use for endpoints that consume conversation credits (chat, AI interactions).

**Example Usage**:
```python
@bp.route("/api/chat", methods=["POST"])
@require_conversation_limits()
def chat_endpoint():
    # Process chat request
    pass
```

**Error Responses**:
- `400`: Missing organization_id
- `401`: Unauthorized (missing client principal ID)
- `403`: Unauthorized access to organization OR Organization has exceeded its conversation limits
- `500`: Internal server error

---

### 3. `@require_user_conversation_limits()`

**Purpose**: Enforces user-level conversation limits within an organization.

**Behavior**:
- Validates organization context and user permissions
- Checks both user-level and organization-level conversation limits
- Auto-initializes user limits if not present
- Injects user limit information into kwargs

**Usage Context**: Use for endpoints that need to track individual user usage within organizations.

**Injected Kwargs**:
```python
kwargs["user_limits"] = {
    "user_limit": int,      # Total allocated to user
    "user_used": int        # Currently used by user
}
```

**Example Usage**:
```python
@bp.route("/api/users/usage", methods=["GET"])
@require_user_conversation_limits()
def getUserConversationUsage(**kwargs):
    user_limits = kwargs["user_limits"]
    return jsonify(user_limits)
```

**Error Responses**:
- `400`: Missing organization_id or user_id
- `401`: Unauthorized (missing client principal ID)
- `403`: Unauthorized access to organization OR User has exceeded their conversation limits OR Organization has exceeded its conversation limits
- `500`: Internal server error

**Special Behavior**:
- If user is not in `allowedUserIds`, automatically initializes user limits
- User limit allocation: `totalCreditsAllocated / maxSeats`
- Returns `nextPeriodStart` in error response when user limits are exceeded

---

### 4. `@check_organization_upload_limits()`

**Purpose**: Checks organization file upload permissions and storage limits (informational only).

**Behavior**:
- Validates organization context and user permissions
- Checks if organization is allowed to upload files
- Calculates storage usage statistics
- Injects upload limit information into kwargs
- Does not enforce limits (only provides information)

**Usage Context**: Use when you need upload/storage information but don't need to enforce limits.

**Injected Kwargs**:
```python
kwargs["upload_limits"] = {
    "storageCapacity": float,           # Total storage in GB
    "is_allowed_to_upload_files": bool,
    "isStorageLimitExceeded": bool,
    "usedStorage": float,               # Used storage in GB
    "freeStorage": float,               # Free storage in GB
    "percentageUsed": float,            # Usage percentage
    "pagesUsed": int,
    "spreadsheetsUsed": int,
    "spreadsheetLimit": int,
    "pagesLimit": int
}
```

**Example Usage**:
```python
@bp.route("/api/organizations/<organization_id>/storage-usage", methods=["GET"])
@check_organization_upload_limits()
def getOrganizationStorageCapacity(organization_id, **kwargs):
    return jsonify(kwargs["upload_limits"])
```

**Error Responses**:
- `400`: Missing organization_id
- `401`: Unauthorized (missing client principal ID)
- `403`: Unauthorized access to organization
- `500`: Internal server error

---

### 5. `@require_organization_storage_limits()`

**Purpose**: Enforces organization storage limits for file uploads.

**Behavior**:
- Validates organization context and user permissions
- Checks if organization is allowed to upload files
- Enforces storage capacity limits
- Blocks access if storage limits are exceeded or uploads not allowed
- Injects upload limit information into kwargs

**Usage Context**: Use for endpoints that actually upload files to storage.

**Injected Kwargs**: Same as `@check_organization_upload_limits()`

**Example Usage**:
```python
@bp.route("/api/upload", methods=["POST"])
@require_organization_storage_limits()
def upload_file(**kwargs):
    # Process file upload
    pass
```

**Error Responses**:
- `400`: Missing organization_id
- `401`: Unauthorized (missing client principal ID)
- `403`: Unauthorized access to organization OR Organization is not allowed to upload files OR Organization has exceeded its storage capacity OR Organization has no storage capacity allocated
- `500`: Internal server error

---

## Common Behavior Patterns

### Organization ID Resolution

All decorators follow the same pattern for resolving `organization_id`:

1. **First Priority**: Check if `organization_id` is passed in kwargs
2. **Second Priority**: Extract from request JSON body (if JSON request)
3. **Third Priority**: Extract from request query parameters or headers
4. **Error**: If none found, return 400 error

### Authentication & Authorization

All decorators perform these checks:

1. **Authentication**: Verify `X-MS-CLIENT-PRINCIPAL-ID` header is present
2. **Authorization**: Verify the authenticated user belongs to the target organization
3. **Logging**: Log unauthorized access attempts for security monitoring

### Error Handling

All decorators follow consistent error handling:

- **Structured Error Responses**: Use `create_error_response()` utility
- **Error Codes**: Include specific error codes for client handling
- **Logging**: Log exceptions with full stack traces
- **Graceful Degradation**: Return 500 for unexpected errors

## Implementation Details

### Dependencies

The decorators depend on these utilities from `utils.py`:

- `get_organization_id_from_request()`
- `get_organization_id_and_user_id_from_request()`
- `create_error_response()`
- `create_error_response_with_body()`
- Error constants (`ERROR_CODE_UNAUTHORIZED_ORG`, etc.)

And these from `shared/cosmo_db.py`:

- `get_user_organizations()`
- `get_organization_usage()`
- `get_subscription_tier_by_id()`
- `initalize_user_limits()`

### Performance Considerations

- **Database Calls**: Each decorator makes multiple database calls
- **Caching**: Consider adding caching for frequently accessed organization data
- **Batch Operations**: Multiple decorators on same endpoint will duplicate some calls

### Security Features

- **Access Control**: All decorators verify user belongs to target organization
- **Audit Logging**: Unauthorized access attempts are logged
- **Rate Limiting**: Built-in usage limit enforcement prevents abuse

## Usage Examples by Use Case

### Chat/AI Conversation Endpoints
```python
@bp.route("/api/chat", methods=["POST"])
@require_conversation_limits()  # Enforce org limits
def chat():
    pass

@bp.route("/api/user-chat", methods=["POST"])  
@require_user_conversation_limits()  # Enforce user limits
def user_chat(**kwargs):
    user_limits = kwargs["user_limits"]
    pass
```

### File Management Endpoints
```python
@bp.route("/api/files/upload", methods=["POST"])
@require_organization_storage_limits()  # Enforce storage limits
def upload_file(**kwargs):
    pass

@bp.route("/api/files/storage-info", methods=["GET"])
@check_organization_upload_limits()  # Just get info
def get_storage_info(**kwargs):
    return jsonify(kwargs["upload_limits"])
```

### Usage Reporting Endpoints
```python
@bp.route("/api/organizations/<org_id>/usage", methods=["GET"])
@check_organization_limits()  # Get org usage info
def get_org_usage(**kwargs):
    return jsonify(kwargs["organization_usage"])

@bp.route("/api/users/usage", methods=["GET"])
@require_user_conversation_limits()  # Get user usage info
def get_user_usage(**kwargs):
    return jsonify(kwargs["user_limits"])
```

## Testing

The decorators are thoroughly tested in `backend/tests/test_decorators.py` with test cases covering:

- Missing organization_id scenarios
- Unauthorized access attempts
- Limit exceeded scenarios
- Successful operations
- Error handling
- User initialization

## Migration Notes

When migrating endpoints to use these decorators:

1. **Remove Manual Checks**: Eliminate duplicate organization/usage validation code
2. **Update Function Signatures**: Add `**kwargs` to receive injected data
3. **Handle New Error Codes**: Update client code to handle specific error codes
4. **Test Thoroughly**: Verify all authorization and limit scenarios

## Best Practices

1. **Choose Right Decorator**: Use informational decorators for GET operations, enforcing decorators for POST/PUT operations
2. **Combine Carefully**: Avoid stacking multiple enforcing decorators on same endpoint
3. **Monitor Performance**: Watch for database performance with multiple decorators
4. **Log Usage**: Implement usage monitoring for business intelligence
5. **Handle Errors Gracefully**: Provide clear error messages to users

## Error Code Reference

- `ERROR_CODE_UNAUTHORIZED_ORG`: User not authorized for organization
- `ERROR_CODE_USER_LIMIT_EXCEEDED`: User exceeded conversation limits  
- `ERROR_CODE_ORG_LIMIT_EXCEEDED`: Organization exceeded conversation limits

These codes can be used by client applications to provide appropriate user experiences and messaging.
