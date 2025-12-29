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
    Decorator for Flask routes that requires a valid token in the Authorization header.
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
    Decorator factory that ensures an organization context is available, fetches
    the organization's usage and limits, and injects a summary into the decorated
    function's kwargs.
    Behavior when organization_id is missing:
    1. Attempts to extract organization_id from JSON body if request is JSON.
    2. If still missing, retrieves user's organizations using client principal ID
       from headers and selects the first organization.
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
    Decorator factory that ensures an organization context is available, fetches
    the organization's usage and limits, and checks if the organization has exceeded
    its conversation limits.
    Behavior when organization_id is missing:
    1. Attempts to extract organization_id from JSON body if request is JSON.
    2. If still missing, retrieves user's organizations using client principal ID
       from headers and selects the first organization.
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

                org_usage = get_organization_usage(organization_id)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])
                if (
                    org_usage["balance"]["currentUsed"]
                    > org_limits["quotas"]["totalCreditsAllocated"]
                ):
                    return create_error_response(
                        "Organization has exceeded its conversation limits", 403
                    )

                return f(*args, **kwargs)
            except Exception as e:
                logging.exception("An error occurred in require_conversation_limits")
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator


def require_user_conversation_limits():
    """
    Decorator factory that ensures an organization context is available, fetches
    the organization's usage and limits, and checks if the user has exceeded
    their conversation limits.
    Behavior when organization_id is missing:
    1. Attempts to extract organization_id from JSON body if request is JSON.
    2. If still missing, retrieves user's organizations using client principal ID
       from headers and selects the first organization.
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
                        "Unauthorized access to organization", 403
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
                    )
                if (
                    org_usage["balance"]["currentUsed"]
                    >= org_limits["quotas"]["totalCreditsAllocated"]
                ):
                    return create_error_response(
                        "Organization has exceeded its conversation limits", 403
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
    Decorator factory that ensures an organization context is available, fetches
    the organization's usage and limits, and checks if the organization is allowed
    to upload files.
    Behavior when organization_id is missing:
    1. Attempts to extract organization_id from JSON body if request is JSON.
    2. If still missing, retrieves user's organizations using client principal ID
       from headers and selects the first organization.
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
    Decorator factory that ensures an organization context is available, fetches
    the organization's usage and limits, and checks if the organization is allowed
    to upload files.
    Behavior when organization_id is missing:
    1. Attempts to extract organization_id from JSON body if request is JSON.
    2. If still missing, retrieves user's organizations using client principal ID
       from headers and selects the first organization.
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
                    "is_allowed_to_upload_files": org_limits["policy"][
                        "allowFileUploads"
                    ],
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
