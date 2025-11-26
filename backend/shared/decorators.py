import os
import logging
from flask import request, jsonify
from functools import wraps
from utils import get_azure_key_vault_secret

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


def require_conversation_limits(f):
    """
    Decorator that checks if an organization has conversation time remaining
    before allowing a chat message to be processed.

    Expects request headers or JSON data to contain:
    - X-MS-CLIENT-PRINCIPAL-ID (user_id)
    - organization_id (from request JSON or conversation lookup)

    Returns 429 (Too Many Requests) if limits are exceeded.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from shared.cosmo_db import check_organization_limits, get_user_organizations
        from subscription_tiers import format_time_remaining

        try:
            # Get user ID from headers
            user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
            if not user_id:
                logging.warning("No user ID found in headers for conversation limits check")
                # Allow request to proceed if we can't identify user
                return f(*args, **kwargs)

            # Try to get organization ID from request data
            data = request.get_json() if request.is_json else {}
            org_id = data.get("organization_id")

            # If not in request data, try to get user's primary organization
            if not org_id:
                try:
                    user_orgs = get_user_organizations(user_id)
                    if user_orgs and len(user_orgs) > 0:
                        org_id = user_orgs[0].get("id")
                except Exception as e:
                    logging.warning(f"Could not get user organizations: {e}")

            # If still no org_id, allow request (will default to free tier)
            if not org_id:
                logging.warning(f"No organization ID found for user {user_id}")
                return f(*args, **kwargs)

            # Check organization limits
            limits_check = check_organization_limits(org_id)

            # If not allowed, return 429
            if not limits_check.get("allowed", True):
                tier = limits_check.get("tier", "free")
                used_seconds = limits_check.get("used_seconds", 0)
                limit_seconds = limits_check.get("limit_seconds", 0)

                return jsonify({
                    "error": "Conversation time limit exceeded",
                    "error_type": "limit_exceeded",
                    "message": f"You have used all your conversation time for this month.",
                    "details": {
                        "tier": tier,
                        "used": format_time_remaining(used_seconds),
                        "limit": format_time_remaining(limit_seconds),
                        "percentage_used": limits_check.get("percentage_used", 100),
                        "period_end": None  # Could add from org usage data
                    },
                    "actions": {
                        "upgrade": True,
                        "message": "Upgrade to a higher tier for more conversation time."
                    }
                }), 429

            # Store limits check in kwargs for use in the route
            kwargs["_limits_check"] = limits_check
            kwargs["_org_id"] = org_id

            return f(*args, **kwargs)

        except Exception as e:
            logging.error(f"Error in require_conversation_limits decorator: {e}")
            # Allow request to proceed on error to avoid blocking users
            return f(*args, **kwargs)

    return decorated_function


def check_session_limits(f):
    """
    Decorator that checks if a specific conversation has exceeded its session time limit.

    Expects request JSON data to contain:
    - conversation_id
    - organization_id or will lookup from user

    Returns 429 if session limit is exceeded.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from utils import check_conversation_session_limit
        from subscription_tiers import format_time_remaining

        try:
            # Get conversation ID from request
            data = request.get_json() if request.is_json else {}
            conversation_id = data.get("conversation_id")

            if not conversation_id:
                # No conversation ID, skip check (might be new conversation)
                return f(*args, **kwargs)

            # Get user ID
            user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
            if not user_id:
                return f(*args, **kwargs)

            # Get org ID (from decorator chain or request)
            org_id = kwargs.get("_org_id") or data.get("organization_id")

            if not org_id:
                # Try to get from user's organizations
                from shared.cosmo_db import get_user_organizations
                user_orgs = get_user_organizations(user_id)
                if user_orgs and len(user_orgs) > 0:
                    org_id = user_orgs[0].get("id")

            if not org_id:
                return f(*args, **kwargs)

            # Check session limits
            session_check = check_conversation_session_limit(conversation_id, user_id, org_id)

            # If session exceeded, return 429
            if session_check.get("exceeded", False):
                duration_seconds = session_check.get("duration_seconds", 0)
                limit_seconds = session_check.get("limit_seconds", 0)

                return jsonify({
                    "error": "Session time limit exceeded",
                    "error_type": "session_limit_exceeded",
                    "message": f"This conversation has reached its maximum session duration.",
                    "details": {
                        "duration": format_time_remaining(duration_seconds),
                        "limit": format_time_remaining(limit_seconds),
                        "conversation_id": conversation_id
                    },
                    "actions": {
                        "create_new_conversation": True,
                        "message": "Please start a new conversation to continue."
                    }
                }), 429

            # Store session check in kwargs
            kwargs["_session_check"] = session_check

            return f(*args, **kwargs)

        except Exception as e:
            logging.error(f"Error in check_session_limits decorator: {e}")
            # Allow request to proceed on error
            return f(*args, **kwargs)

    return decorated_function
