import os
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
