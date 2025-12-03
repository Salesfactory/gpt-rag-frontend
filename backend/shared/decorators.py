import os
from flask import request, jsonify
from functools import wraps
from utils import get_azure_key_vault_secret
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
            organization_id = kwargs.get("organization_id")

            if not organization_id and request.is_json:
                data = request.get_json()
                organization_id = data.get("organization_id")

            if not organization_id:
                 client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                 if not client_principal_id:
                     return jsonify({"error": "Missing required parameters, client_principal_id"}), 400
                 organizations = get_user_organizations(client_principal_id)
                 if not organizations:
                     return jsonify({"error": "User does not belong to any organization"}), 403
                 organization_id = organizations[0] 

            
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

        return decorated_function

    return decorator

def check_conversation_limits():
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
            organization_id = kwargs.get("organization_id")

            if not organization_id and request.is_json:
                data = request.get_json()
                organization_id = data.get("organization_id")

            if not organization_id:
                 client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
                 organizations = get_user_organizations(client_principal_id)
                 if not organizations:
                     return jsonify({"error": "User does not belong to any organization"}), 403
                 organization_id = organizations[0] 

            
            org_usage = get_organization_usage(organization_id)
            org_limits = get_subscription_tier_by_id(org_usage["policy"]["tierId"])

            if org_usage["balance"]["currentCreditsUsed"] > org_limits["quotas"]["totalCreditsAllocated"]:
                return jsonify({"error": "Organization has exceeded its conversation limits"}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator