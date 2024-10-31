from flask import request, jsonify
from functools import wraps
import jwt
import json
import requests
from datetime import datetime
from jwt import PyJWTError
import os
from cachetools import TTLCache
from cryptography.x509 import load_pem_x509_certificate
from cryptography.hazmat.backends import default_backend
import base64

# Cache for storing JWKS (JSON Web Key Set)
jwks_cache = TTLCache(maxsize=1, ttl=86400)


class AuthConfig:
    def __init__(self):
        self.tenant_name = os.getenv("AAD_TENANT_NAME")
        self.client_id = os.getenv("AAD_CLIENT_ID")
        self.policy_name = os.getenv("AAD_POLICY_NAME", "B2C_1_signupsignin")

        # Build the authority and JWKS URLs
        self.authority = f"https://{self.tenant_name}.b2clogin.com/{self.tenant_name}.onmicrosoft.com/{self.policy_name}"
        self.jwks_url = f"{self.authority}/discovery/v2.0/keys"
        self.issuer = f"https://{self.tenant_name}.b2clogin.com/{os.getenv('AAD_TENANT_ID')}/v2.0/"


auth_config = AuthConfig()


class AuthError(Exception):
    """Custom exception for authentication errors"""

    pass


def get_jwks():
    """Fetch and cache the JSON Web Key Set from Azure AD B2C"""
    if "keys" not in jwks_cache:
        try:
            response = requests.get(auth_config.jwks_url)
            response.raise_for_status()
            jwks_cache["keys"] = response.json()["keys"]
        except requests.exceptions.RequestException as e:
            print(f"Error fetching JWKS: {e}")
            raise
    return jwks_cache["keys"]


def get_key_by_kid(kid):
    """Get the public key matching the key ID from the JWKS"""
    keys = get_jwks()
    for key_data in keys:
        if key_data["kid"] == kid:
            return key_data
    return None


def verify_token(token):
    """Verify the JWT token from Azure AD B2C"""
    try:
        # Get the header without verification
        header = jwt.get_unverified_header(token)

        # Get the key matching the kid from the token header
        key_data = get_key_by_kid(header["kid"])
        if not key_data:
            raise AuthError("Invalid token: Key ID not found")

        # Construct the public key from the JWKS data
        if key_data["kty"] == "RSA":
            # Convert the modulus and exponent to a public key
            from cryptography.hazmat.primitives.asymmetric import rsa, padding
            from cryptography.hazmat.primitives import serialization

            # Create public key in PEM format
            public_numbers = rsa.RSAPublicNumbers(
                n=int.from_bytes(
                    base64.urlsafe_b64decode(key_data["n"] + "=="), byteorder="big"
                ),
                e=int.from_bytes(
                    base64.urlsafe_b64decode(key_data["e"] + "=="), byteorder="big"
                ),
            )
            public_key = public_numbers.public_key(default_backend())

            # Verify and decode the token
            decoded = jwt.decode(
                token,
                key=public_key,
                algorithms=["RS256"],
                audience=auth_config.client_id,
                issuer=auth_config.issuer,
                options={"verify_exp": True, "verify_aud": True, "verify_iss": True},
            )

            return decoded

        else:
            raise AuthError("Unsupported key type")

    except PyJWTError as e:
        raise AuthError(f"Token verification failed: {str(e)}")


def require_auth(f):
    """Decorator to require authentication on endpoints"""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", None)
        if not auth_header:
            return jsonify({"error": "No authorization header"}), 401

        try:
            # Extract token from "Bearer <token>"
            token = auth_header.split()[1]
            claims = verify_token(token)
            # Add verified claims to request context
            request.auth_claims = claims
            return f(*args, **kwargs)
        except AuthError as e:
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            return jsonify({"error": "Invalid authorization header"}), 401

    return decorated
