from functools import wraps
import logging
from flask import request, jsonify
from http import HTTPStatus
from typing import Tuple, Dict, Any


# Response Formatting: Type hint for JSON responses
JsonResponse = Tuple[Dict[str, Any], int]


# Response Formatting: Standardized error response creation
def create_error_response(message: str, status_code: int) -> JsonResponse:
    """
    Create a standardized error response.
    Response Formatting: Ensures consistent error response structure.
    """
    return jsonify({"error": {"message": message, "status": status_code}}), status_code


# Response Formatting: Standardized success response creation
def create_success_response(data: Dict[str, Any]) -> JsonResponse:
    """
    Create a standardized success response.
    Response Formatting: Ensures consistent success response structure.
    """
    return jsonify({"data": data, "status": HTTPStatus.OK}), HTTPStatus.OK


# Error Handling: Custom exception hierarchy for subscription-specific errors
class SubscriptionError(Exception):
    """Base exception for subscription-related errors"""

    pass

class InvalidFinancialPriceError(SubscriptionError):
    """Raised when subscription modification fails"""

    pass

class InvalidSubscriptionError(SubscriptionError):
    """Raised when subscription modification fails"""

    pass



# Security: Decorator to ensure client principal ID is present
def require_client_principal(f):
    """
    Decorator that validates the presence of client principal ID in request headers.
    Security: Ensures proper authentication before processing requests.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not client_principal_id:
            # Logging: Warning for security-related events
            logging.warning("Attempted access without client principal ID")
            return create_error_response("Missing required client principal ID", HTTPStatus.UNAUTHORIZED)
        return f(*args, **kwargs)
    return decorated_function
