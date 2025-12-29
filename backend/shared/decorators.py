import os
import logging
from flask import current_app, request, jsonify
from functools import wraps
from utils import (
    get_azure_key_vault_secret,
    get_organization_id_from_request,
    get_organization_id_and_user_id_from_request,
    create_error_response,
    create_error_response_with_body,
    ERROR_CODE_UNAUTHORIZED_ORG,
    ERROR_CODE_USER_LIMIT_EXCEEDED,
    ERROR_CODE_ORG_LIMIT_EXCEEDED,
    get_organization_tier_and_subscription,
)
from shared.cosmo_db import (
    get_user_organizations,
    get_organization_usage,
    get_subscription_tier_by_id,
    initalize_user_limits,
)

ORG_FILES_PREFIX = "organization_files"
BLOB_CONTAINER_NAME = "documents"


def validate_token():
    """
    Decorator for Flask routes that validates Bearer tokens against Azure Key Vault.
    
    This decorator ensures that requests contain a valid Authorization header with a
    Bearer token that matches the secret stored in Azure Key Vault. Used for API
    authentication and authorization.
    
    Expected Authorization Header Format:
        "Authorization: Bearer <token>"
    
    Returns:
        - 401: If secret not found in key vault, token missing, invalid format,
               or token doesn't match stored secret
        - Proceeds to decorated function if token is valid
    
    Example:
        @bp.route("/api/protected", methods=["GET"])
        @validate_token()
        def protected_endpoint():
            return jsonify({"message": "Access granted"})
    
    Note:
        The secret name "webbackend-token" is hardcoded and must exist in
        Azure Key Vault for this decorator to work properly.
    """

    secret = get_azure_key_vault_secret("webbackend-token")

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")

            if not secret:
                return jsonify({"error": "Secret not found in key vault"}), 401

            if not auth_header:
                return jsonify({"error": "Missing token"}), 401

            tokens = auth_header.split()

            if len(tokens) != 2:
                return jsonify({"error": "Invalid token"}), 401

            if tokens[0] != "Bearer":
                return jsonify({"error": "Invalid token"}), 401

            auth_token = tokens[1]  # Bearer token

            if auth_token != secret:
                return jsonify({"error": "Invalid token"}), 401

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def check_organization_limits():
    """
    Decorator factory that validates organization context and injects usage information.
    
    This decorator ensures an organization context is available, validates user permissions,
    fetches the organization's usage and limits, and injects a comprehensive usage summary
    into the decorated function's kwargs. Does NOT enforce any limits - only provides
    information for display or decision-making.
    
    Organization ID Resolution Priority:
        1. From kwargs["organization_id"] (if passed explicitly)
        2. From request JSON body (if request is JSON)
        3. From request query parameters or headers
    
    Injected Kwargs:
        kwargs["organization_usage"] = {
            "limits": {
                "totalCreditsAllocated": int,
                "totalStorageAllocated": int,
                "totalPagesAllocated": int,
                "totalSpreadsheets": int,
                # ... other quota limits from subscription tier
            },
            "current_usage": {
                "currentUsed": int,
                "currentUsedStorage": float,
                "currentPagesUsed": int,
                "spreadsheetsUsed": int,
                # ... other usage metrics from organization balance
            },
            "is_credits_exceeded": bool,  # True if currentUsed > totalCreditsAllocated
            "is_allowed_to_upload_files": bool  # From subscription tier policy
        }
    
    Returns:
        - 400: Missing organization_id parameter
        - 401: Missing X-MS-CLIENT-PRINCIPAL-ID header (unauthenticated)
        - 403: User not authorized for target organization
        - 500: Internal server error
    
    Example:
        @bp.route("/api/organizations/<org_id>/usage", methods=["GET"])
        @check_organization_limits()
        def get_organization_usage(org_id, **kwargs):
            usage = kwargs["organization_usage"]
            return jsonify(usage)
    
    Use Cases:
        - Usage reporting endpoints
        - Dashboard displays
        - Pre-flight checks before operations
        - Informational APIs
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                organization_id = kwargs.get("organization_id")

                if not organization_id:
                    organization_id = get_organization_id_from_request(request)
                    if not organization_id:
                        return create_error_response(
                            "Missing required parameters, organization_id", 400
                        )

                # Get authenticated user's ID
                client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                if not client_principal_id:
                    return create_error_response("Unauthorized", 401)

                # Verify user belongs to this organization
                user_orgs = get_user_organizations(client_principal_id)
                user_org_ids = [org["id"] for org in user_orgs]

                if organization_id not in user_org_ids:
                    logging.warning(
                        f"User {client_principal_id} attempted to access org {organization_id}"
                    )
                    return create_error_response(
                        "Unauthorized access to organization",
                        403,
                        ERROR_CODE_UNAUTHORIZED_ORG
                    )

                org_usage = get_organization_usage(organization_id)
                print(org_usage)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])
                print(org_limits)

                usage = {
                    "limits": org_limits["quotas"],
                    "current_usage": org_usage["balance"],
                    "is_credits_exceeded": org_usage["balance"]["currentUsed"]
                    > org_limits["quotas"]["totalCreditsAllocated"],
                    "is_allowed_to_upload_files": org_limits["policy"][
                        "allowFileUploads"
                    ],
                }

                kwargs["organization_usage"] = usage

                return f(*args, **kwargs)
            except Exception as e:
                logging.exception("An error occurred in check_organization_limits")
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator


def require_conversation_limits():
    """
    Decorator factory that enforces organization-level conversation limits.
    
    This decorator ensures an organization context is available, validates user permissions,
    and checks if the organization has exceeded its conversation credit limits. Blocks
    access if limits are exceeded. Does NOT inject any additional kwargs.
    
    Organization ID Resolution Priority:
        1. From kwargs["organization_id"] (if passed explicitly)
        2. From request JSON body (if request is JSON)
        3. From request query parameters or headers
    
    Limit Enforcement:
        - Checks if organization's currentUsed > totalCreditsAllocated
        - Blocks access if organization has exceeded conversation limits
        - Returns specific error code for client handling
    
    Returns:
        - 400: Missing organization_id parameter
        - 401: Missing X-MS-CLIENT-PRINCIPAL-ID header (unauthenticated)
        - 403: User not authorized OR Organization exceeded conversation limits
        - 500: Internal server error
    
    Example:
        @bp.route("/api/chat", methods=["POST"])
        @require_conversation_limits()
        def chat_endpoint():
            # Process chat request - organization has sufficient credits
            pass
    
    Use Cases:
        - Chat/AI conversation endpoints
        - Any operation that consumes conversation credits
        - API endpoints that should be blocked when org limits are exceeded
    
    Note:
        This decorator enforces limits but does not provide usage information.
        Use @check_organization_limits() if you need usage data for display.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                organization_id = kwargs.get("organization_id")

                if not organization_id:
                    organization_id = get_organization_id_from_request(request)
                    if not organization_id:
                        return create_error_response(
                            "Missing required parameters, organization_id", 400
                        )

                # Get authenticated user's ID
                client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                if not client_principal_id:
                    return create_error_response("Unauthorized", 401)

                # Verify user belongs to this organization
                user_orgs = get_user_organizations(client_principal_id)
                user_org_ids = [org["id"] for org in user_orgs]

                if organization_id not in user_org_ids:
                    logging.warning(
                        f"User {client_principal_id} attempted to access org {organization_id}"
                    )
                    return create_error_response(
                        "Unauthorized access to organization",
                        403,
                        ERROR_CODE_UNAUTHORIZED_ORG
                    )

                org_usage = get_organization_usage(organization_id)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])
                if (
                    org_usage["balance"]["currentUsed"]
                    > org_limits["quotas"]["totalCreditsAllocated"]
                ):
                    return create_error_response(
                        "Organization has exceeded its conversation limits",
                        403,
                        ERROR_CODE_ORG_LIMIT_EXCEEDED
                    )

                return f(*args, **kwargs)
            except Exception as e:
                logging.exception("An error occurred in require_conversation_limits")
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator


def require_user_conversation_limits():
    """
    Decorator factory that enforces user-level conversation limits within organizations.
    
    This decorator ensures both organization and user context are available, validates
    permissions, and checks both user-level and organization-level conversation limits.
    Auto-initializes user limits if the user is not already tracked. Injects user limit
    information into kwargs for the decorated function.
    
    ID Resolution:
        - organization_id and user_id extracted from request using
          get_organization_id_and_user_id_from_request()
    
    User Limit Auto-Initialization:
        - If user not found in allowedUserIds, automatically creates user limits
        - User allocation = totalCreditsAllocated / maxSeats (even distribution)
    
    Injected Kwargs:
        kwargs["user_limits"] = {
            "user_limit": int,    # Total credits allocated to this user
            "user_used": int      # Credits currently used by this user
        }
    
    Limit Enforcement (checked in order):
        1. User limits: currentUsed >= totalAllocated
        2. Organization limits: currentUsed >= totalCreditsAllocated
    
    Returns:
        - 400: Missing organization_id or user_id
        - 401: Missing X-MS-CLIENT-PRINCIPAL-ID header (unauthenticated)
        - 403: User not authorized OR User exceeded limits OR Organization exceeded limits
        - 500: Internal server error
    
    Error Response for User Limits:
        Returns additional body with nextPeriodStart timestamp:
        {"error": "User has exceeded their conversation limits", "nextPeriodStart": "2025-12-31"}
    
    Example:
        @bp.route("/api/user-chat", methods=["POST"])
        @require_user_conversation_limits()
        def user_chat(**kwargs):
            user_limits = kwargs["user_limits"]
            # Process chat request - user has sufficient credits
            pass
    
    Use Cases:
        - Per-user conversation tracking
        - Multi-tenant applications with individual user quotas
        - APIs that need to track and enforce individual usage
    
    Note:
        This decorator provides both enforcement (blocking) and information
        (user limits) for the decorated function.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                organization_id, user_id = get_organization_id_and_user_id_from_request(
                    request
                )
                if not organization_id or not user_id:
                    return create_error_response(
                        "Missing required parameters, organization_id or user_id", 400
                    )

                # Get authenticated user's ID
                client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                if not client_principal_id:
                    return create_error_response("Unauthorized", 401)

                # Verify user belongs to this organization
                user_orgs = get_user_organizations(client_principal_id)
                user_org_ids = [org["id"] for org in user_orgs]

                if organization_id not in user_org_ids:
                    logging.warning(
                        f"User {client_principal_id} attempted to access org {organization_id}"
                    )
                    return create_error_response(
                        "Unauthorized access to organization",
                        403,
                        ERROR_CODE_UNAUTHORIZED_ORG
                    )

                org_usage = get_organization_usage(organization_id)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])

                allowed_users = org_usage["policy"].get("allowedUserIds", [])
                user_limits = next(
                    (user for user in allowed_users if user["userId"] == user_id), None
                )
                if not user_limits:
                    user_limits = initalize_user_limits(
                        organization_id,
                        user_id,
                        (
                            org_limits["quotas"]["totalCreditsAllocated"]
                            / org_limits["policy"]["maxSeats"]
                        ),
                    )
                if user_limits["currentUsed"] >= user_limits["totalAllocated"]:
                    next_period_start = org_usage["currentPeriodEnds"]
                    return create_error_response_with_body(
                        "User has exceeded their conversation limits",
                        403,
                        {"nextPeriodStart": next_period_start},
                        ERROR_CODE_USER_LIMIT_EXCEEDED
                    )
                if (
                    org_usage["balance"]["currentUsed"]
                    >= org_limits["quotas"]["totalCreditsAllocated"]
                ):
                    return create_error_response(
                        "Organization has exceeded its conversation limits",
                        403,
                        ERROR_CODE_ORG_LIMIT_EXCEEDED
                    )

                kwargs["user_limits"] = {
                    "user_limit": user_limits["totalAllocated"],
                    "user_used": user_limits["currentUsed"],
                }

                return f(*args, **kwargs)

            except Exception as e:
                logging.exception(
                    "An error occurred in require_user_conversation_limits"
                )
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator


def check_organization_upload_limits():
    """
    Decorator factory that validates file upload permissions and provides storage metrics.
    
    This decorator ensures organization context is available, validates user permissions,
    checks if the organization is allowed to upload files, and provides comprehensive
    storage and upload metrics. Does NOT enforce storage limits - only provides
    information for display or pre-flight checks.
    
    Organization ID Resolution Priority:
        1. From kwargs["organization_id"] (if passed explicitly)
        2. From request JSON body (if request is JSON)
        3. From request query parameters or headers
    
    Permission Checks:
        - Verifies organization's subscription tier allows file uploads
        - Does NOT block if storage is exceeded (informational only)
    
    Injected Kwargs:
        kwargs["upload_limits"] = {
            "storageCapacity": float,           # Total storage allocated (GB)
            "is_allowed_to_upload_files": bool, # From subscription tier policy
            "isStorageLimitExceeded": bool,     # True if used >= capacity
            "usedStorage": float,               # Current storage used (GB)
            "freeStorage": float,               # Available storage (GB)
            "percentageUsed": float,            # Storage usage percentage
            "pagesUsed": int,                   # Pages currently used
            "spreadsheetsUsed": int,            # Spreadsheets currently used
            "spreadsheetLimit": int,            # Max spreadsheets allowed
            "pagesLimit": int                    # Max pages allowed
        }
    
    Returns:
        - 400: Missing organization_id parameter
        - 401: Missing X-MS-CLIENT-PRINCIPAL-ID header (unauthenticated)
        - 403: User not authorized for target organization
        - 403: Organization not allowed to upload files (policy restriction)
        - 403: Organization has no storage capacity allocated
        - 500: Internal server error
    
    Example:
        @bp.route("/api/organizations/<org_id>/storage-info", methods=["GET"])
        @check_organization_upload_limits()
        def get_storage_info(org_id, **kwargs):
            return jsonify(kwargs["upload_limits"])
    
    Use Cases:
        - Storage usage dashboards
        - Pre-flight upload checks
        - File upload UI components
        - Storage reporting endpoints
    
    Note:
        This decorator provides information but doesn't enforce storage limits.
        Use @require_organization_storage_limits() for actual upload blocking.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                organization_id = kwargs.get("organization_id")

                if not organization_id:
                    organization_id = get_organization_id_from_request(request)
                    if not organization_id:
                        return create_error_response(
                            "Missing required parameters, organization_id", 400
                        )

                # Get authenticated user's ID
                client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                if not client_principal_id:
                    return create_error_response("Unauthorized", 401)

                # Verify user belongs to this organization
                user_orgs = get_user_organizations(client_principal_id)
                user_org_ids = [org["id"] for org in user_orgs]

                if organization_id not in user_org_ids:
                    logging.warning(
                        f"User {client_principal_id} attempted to access org {organization_id}"
                    )
                    return create_error_response(
                        "Unauthorized access to organization", 403
                    )

                org_limits, org_usage = get_organization_tier_and_subscription(
                    organization_id
                )

                if org_limits["policy"]["allowFileUploads"] == False:
                    return create_error_response(
                        "Organization is not allowed to upload files", 403
                    )

                storage_capacity = org_limits["quotas"]["totalStorageAllocated"]
                used_storage_gib = org_usage["balance"]["currentUsedStorage"]

                if storage_capacity <= 0:
                    return create_error_response(
                        "Organization has no storage capacity allocated", 403
                    )
                free_storage_gib = storage_capacity - used_storage_gib
                percentage_used = (used_storage_gib / storage_capacity) * 100

                kwargs["upload_limits"] = {
                    "storageCapacity": storage_capacity,
                    "is_allowed_to_upload_files": org_limits["policy"][
                        "allowFileUploads"
                    ],
                    "isStorageLimitExceeded": storage_capacity <= used_storage_gib,
                    "usedStorage": used_storage_gib,
                    "freeStorage": free_storage_gib,
                    "percentageUsed": percentage_used,
                    "pagesUsed": org_usage["balance"]["currentPagesUsed"],
                    "spreadsheetsUsed": org_usage["balance"]["spreadsheetsUsed"],
                    "spreadsheetLimit": org_limits["quotas"]["totalSpreadsheets"],
                    "pagesLimit": org_limits["quotas"]["totalPagesAllocated"],
                }

                return f(*args, **kwargs)
            except Exception as e:
                logging.exception(
                    "An error occurred in check_organization_upload_limits"
                )
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator


def require_organization_storage_limits():
    """
    Decorator factory that enforces organization storage limits for file uploads.
    
    This decorator ensures organization context is available, validates user permissions,
    checks if the organization is allowed to upload files, and enforces storage capacity
    limits. Blocks access if storage limits are exceeded or uploads not permitted.
    Injects comprehensive storage metrics into kwargs.
    
    Organization ID Resolution Priority:
        1. From kwargs["organization_id"] (if passed explicitly)
        2. From request JSON body (if request is JSON)
        3. From request query parameters or headers
    
    Enforcement Checks (performed in order):
        1. Organization subscription tier allows file uploads
        2. Organization has storage capacity allocated (> 0)
        3. Organization has not exceeded storage capacity
    
    Injected Kwargs:
        kwargs["upload_limits"] = {
            "storageCapacity": float,           # Total storage allocated (GB)
            "is_allowed_to_upload_files": bool, # From subscription tier policy
            "isStorageLimitExceeded": bool,     # True if used >= capacity
            "usedStorage": float,               # Current storage used (GB)
            "freeStorage": float,               # Available storage (GB)
            "percentageUsed": float,            # Storage usage percentage
            "pagesUsed": int,                   # Pages currently used
            "spreadsheetsUsed": int,            # Spreadsheets currently used
            "spreadsheetLimit": int,            # Max spreadsheets allowed
            "pagesLimit": int                    # Max pages allowed
        }
    
    Returns:
        - 400: Missing organization_id parameter
        - 401: Missing X-MS-CLIENT-PRINCIPAL-ID header (unauthenticated)
        - 403: User not authorized for target organization
        - 403: Organization not allowed to upload files (policy restriction)
        - 403: Organization has exceeded its storage capacity
        - 403: Organization has no storage capacity allocated
        - 500: Internal server error
    
    Example:
        @bp.route("/api/files/upload", methods=["POST"])
        @require_organization_storage_limits()
        def upload_file(**kwargs):
            # Process file upload - storage limits validated
            limits = kwargs["upload_limits"]
            pass
    
    Use Cases:
        - File upload endpoints
        - Document processing APIs
        - Any operation that consumes storage
        - Content management systems
    
    Note:
        This decorator both enforces limits (blocking) and provides storage
        information for the decorated function to use during processing.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                organization_id = kwargs.get("organization_id", None)

                if not organization_id:
                    organization_id = get_organization_id_from_request(request)
                    if not organization_id:
                        return create_error_response(
                            "Missing required parameters, organization_id", 400
                        )

                # Get authenticated user's ID
                client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                if not client_principal_id:
                    return create_error_response("Unauthorized", 401)

                # Verify user belongs to this organization
                user_orgs = get_user_organizations(client_principal_id)
                user_org_ids = [org["id"] for org in user_orgs]

                if organization_id not in user_org_ids:
                    logging.warning(
                        f"User {client_principal_id} attempted to access org {organization_id}"
                    )
                    return create_error_response(
                        "Unauthorized access to organization", 403
                    )

                org_limits, org_usage = get_organization_tier_and_subscription(
                    organization_id
                )

                if not org_limits["policy"]["allowFileUploads"]:
                    return create_error_response(
                        "Organization is not allowed to upload files", 403
                    )

                storage_capacity = org_limits["quotas"]["totalStorageAllocated"]
                used_storage_gib = org_usage["balance"]["currentUsedStorage"]

                if storage_capacity <= used_storage_gib:
                    return create_error_response(
                        "Organization has exceeded its storage capacity", 403
                    )
                if storage_capacity <= 0:
                    return create_error_response(
                        "Organization has no storage capacity allocated", 403
                    )
                free_storage_gib = storage_capacity - used_storage_gib
                percentage_used = (used_storage_gib / storage_capacity) * 100

                kwargs["upload_limits"] = {
                    "storageCapacity": storage_capacity,
                    "is_allowed_to_upload_files": org_limits["policy"]["allowFileUploads"],
                    "isStorageLimitExceeded": storage_capacity <= used_storage_gib,
                    "usedStorage": used_storage_gib,
                    "freeStorage": free_storage_gib,
                    "percentageUsed": percentage_used,
                    "pagesUsed": org_usage["balance"]["currentPagesUsed"],
                    "spreadsheetsUsed": org_usage["balance"]["spreadsheetsUsed"],
                    "spreadsheetLimit": org_limits["quotas"]["totalSpreadsheets"],
                    "pagesLimit": org_limits["quotas"]["totalPagesAllocated"],
                }

                return f(*args, **kwargs)
            except Exception as e:
                logging.exception(
                    "An error occurred in require_organization_upload_limits"
                )
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator
