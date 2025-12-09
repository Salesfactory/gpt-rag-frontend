import os
import logging
from flask import request, jsonify
from functools import wraps
from utils import get_azure_key_vault_secret, get_organization_id_from_request, get_organization_id_and_user_id_from_request, create_error_response, create_success_response
from shared.cosmo_db import get_user_organizations, get_organization_usage, get_subscription_tier_by_id

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
                        return create_error_response("Missing required parameters, organization_id", 400)

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
                    return create_error_response("Unauthorized access to organization", 403)
                
                org_usage = get_organization_usage(organization_id)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])

                
                usage = {
                    "limits": org_limits["quotas"],
                    "current_usage": org_usage["balance"],
                    "is_storage_exceeded": org_usage["balance"]["currentStorageUsed"] > org_limits["quotas"]["totalStorageAllocated"],
                    "is_credits_exceeded": org_usage["balance"]["currentCreditsUsed"] > org_limits["quotas"]["totalCreditsAllocated"]
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
                        return create_error_response("Missing required parameters, organization_id", 400)

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
                    return create_error_response("Unauthorized access to organization", 403)
                
                org_usage = get_organization_usage(organization_id)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])

                if org_usage["balance"]["currentCreditsUsed"] > org_limits["quotas"]["totalCreditsAllocated"]:
                    return create_error_response("Organization has exceeded its conversation limits", 403)

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
                organization_id, user_id = get_organization_id_and_user_id_from_request(request)
                if not organization_id or not user_id:
                    return create_error_response("Missing required parameters, organization_id or user_id", 400)
                
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
                    return create_error_response("Unauthorized access to organization", 403)

                org_usage = get_organization_usage(organization_id)
                org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])

                allowed_users = org_usage["policy"].get("allowedUserIds", {})
                user_limits = allowed_users.get(user_id)
                if not user_limits:
                    return create_error_response("User is not authorized for this organization", 403)
                if user_limits["used"] >= user_limits["limit"]:
                    return create_error_response("User has exceeded their conversation limits", 403)    
                if org_usage["balance"]["currentCreditsUsed"] >= org_limits["quotas"]["totalCreditsAllocated"]:
                    return create_error_response("Organization has exceeded its conversation limits", 403)

                return f(*args, **kwargs)

            except Exception as e:
                logging.exception("An error occurred in require_user_conversation_limits")
                return create_error_response("Internal server error", 500)

        return decorated_function

    return decorator