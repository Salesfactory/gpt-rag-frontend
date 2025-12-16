from http import HTTPStatus
import os

from flask import Blueprint, current_app, jsonify, request
from datetime import datetime
from werkzeug.exceptions import NotFound
from functools import wraps
import logging

from shared.error_handling import MissingRequiredFieldError
from azure.cosmos.exceptions import CosmosHttpResponseError
from utils import (
    EmailService,
    EmailServiceError,
    create_error_response,
    create_success_response,
    delete_user,
    get_user_by_id,
    get_users,
    reset_password,
)
from shared.cosmo_db import get_organization_usage, get_user_container, patch_user_data, update_user, set_user
from routes.decorators.auth_decorator import auth_required
from shared.decorators import require_user_conversation_limits

bp = Blueprint("users", __name__)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PORT = os.getenv("EMAIL_PORT")

INVITATION_LINK = os.getenv("INVITATION_LINK")


@bp.route("/api/user/<user_id>", methods=["GET"])
@auth_required
def getUserid(user_id):
    """
    Endpoint to get a user by ID.
    """
    try:
        user = get_user_container(user_id)
        return jsonify(user), 200
    except NotFound as e:
        logging.warning(f"Report with id {user_id} not found.")
        return jsonify({"error": f"Report with this id {user_id} not found"}), 404
    except Exception as e:
        logging.exception(f"An error occurred retrieving the report with id {user_id}")
        return jsonify({"error": "Internal Server Error"}), 500


# Update Users
@bp.route("/api/user/<user_id>", methods=["PUT"])
@auth_required
def updateUser(user_id):
    """
    Endpoint to update a user
    """
    try:
        updated_data = request.get_json()

        if updated_data is None:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        updated_data = update_user(user_id, updated_data)
        return "", 204

    except NotFound as e:
        logging.warning(f"Tried to update a user that doesn't exist: {user_id}")
        return (
            jsonify(
                {
                    "error": f"Tried to update a user with this id {user_id} that does not exist"
                }
            ),
            404,
        )

    except Exception as e:
        logging.exception(
            f"Error updating user with ID {user_id}"
        )  # Logs the full exception
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


@bp.route("/api/user/<user_id>", methods=["PATCH"])
@auth_required
def patchUserData(user_id):
    """
    Endpoint to update the 'name', role and 'email' fields of a user's 'data'
    """
    try:
        patch_data = request.get_json()

        if patch_data is None or not isinstance(patch_data, dict):
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        patch_data = patch_user_data(user_id, patch_data)
        return jsonify({"message": "User data updated successfully"}), 200

    except NotFound as nf:
        logging.error(f"User with ID {user_id} not found.")
        return jsonify({"error": str(e)}), 404

    except ValueError as ve:
        logging.error(f"Validation error for user ID {user_id}: {str(ve)}")
        return jsonify({"error": str(ve)}), 400

    except Exception as e:
        logging.exception(f"Error updating user data for user ID {user_id}")
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


# Reset Password


@bp.route("/api/user/<user_id>/reset-password", methods=["PATCH"])
@auth_required
def reset_user_password(user_id):
    """
    Endpoint to reset a user's password and send a notification email.
    """
    try:
        data = request.get_json()
        if not data or "new_password" not in data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        reset_password(user_id, data["new_password"])
        user = get_user_container(user_id)
        user_email = user["data"]["email"]
        user_name = user["data"].get("name", "User")

        # Email details
        subject = "Your FreddAid password has been changed"
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Changed - FreddAid</title>
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                    background-color: #F9FAFB;
                    line-height: 1.6;
                }}
                .email-container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #FFFFFF;
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    background-color: #FFFFFF;
                    padding: 24px 32px;
                    border-bottom: 1px solid #E5E7EB;
                }}
                .logo-section {{
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }}
                .logo {{
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }}
                .header-image {{
                    max-width: 200px;
                    max-height: 60px;
                    height: auto;
                }}
                .logo-text {{
                    font-size: 28px;
                    font-weight: bold;
                    color: #1F2937;
                }}
                .logo-sparkle {{
                    color: #10B981;
                    font-size: 32px;
                }}
                .version {{
                    font-size: 14px;
                    color: #6B7280;
                    font-weight: 500;
                }}
                .timestamp {{
                    font-size: 12px;
                    color: #9CA3AF;
                }}
                .content {{
                    padding: 40px 32px;
                }}
                .greeting {{
                    font-size: 24px;
                    font-weight: 600;
                    color: #1F2937;
                    margin-bottom: 24px;
                }}
                .main-title {{
                    font-size: 20px;
                    font-weight: 600;
                    color: #1F2937;
                    margin-bottom: 16px;
                }}
                .description {{
                    font-size: 16px;
                    color: #4B5563;
                    margin-bottom: 24px;
                }}
                .password-label {{
                    font-size: 16px;
                    font-weight: 500;
                    color: #1F2937;
                    margin-bottom: 12px;
                }}
                .password-box {{
                    background-color: #F3F4F6;
                    border: 2px solid #E5E7EB;
                    border-radius: 8px;
                    padding: 16px 20px;
                    font-family: 'Courier New', monospace;
                    font-size: 18px;
                    font-weight: 600;
                    color: #1F2937;
                    letter-spacing: 1px;
                    margin-bottom: 32px;
                    text-align: center;
                }}
                .security-notice {{
                    background-color: #ECFDF5;
                    border: 1px solid #D1FAE5;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 24px;
                }}
                .security-notice-title {{
                    font-size: 14px;
                    font-weight: 600;
                    color: #059669;
                    margin-bottom: 4px;
                }}
                .security-notice-text {{
                    font-size: 14px;
                    color: #065F46;
                }}
                .footer {{
                    background-color: #F9FAFB;
                    padding: 24px 32px;
                    border-top: 1px solid #E5E7EB;
                    text-align: center;
                }}
                .footer-text {{
                    font-size: 14px;
                    color: #6B7280;
                    margin-bottom: 8px;
                }}
                .footer-link {{
                    color: #10B981;
                    text-decoration: none;
                }}
                .footer-link:hover {{
                    text-decoration: underline;
                }}
                @media (max-width: 640px) {{
                    .email-container {{
                        margin: 0;
                        box-shadow: none;
                    }}
                    .header,
                    .content,
                    .footer {{
                        padding-left: 20px;
                        padding-right: 20px;
                    }}
                    .logo-section {{
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }}
                    .greeting {{
                        font-size: 20px;
                    }}
                    .main-title {{
                        font-size: 18px;
                    }}
                    .password-box {{
                        font-size: 16px;
                        padding: 14px 16px;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <!-- Header -->
                <div class="header" style="text-align:center;">
                    <img src="https://clewcsvstorage.blob.core.windows.net/images/header_logo.png.png" 
                    alt="Sales Factory Logo"
                    style="max-width:220px; height:auto; margin:0 auto; display:block;" />
                </div>
                <!-- Main Content -->
                <div class="content">
                    <div class="greeting">Hello {user_name},</div>
                    <div class="main-title">Your password has been changed</div>
                    <div class="description">
                        This is a confirmation that the password for your FreddAid account has been successfully changed.
                    </div>
                    <div class="password-label">Your new password is:</div>
                    <div class="password-box">
                        {data["new_password"]}
                    </div>
                    <div class="security-notice">
                        <div class="security-notice-title">🔒 Security Reminder</div>
                        <div class="security-notice-text">
                            Please store this password securely and consider changing it to something more memorable after your first login.
                        </div>
                    </div>
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div style="font-size: 16px; color: #4B5563; margin-bottom: 16px;">
                            We recommend logging in to change your password to something more memorable.
                        </div>
                        <a href="{INVITATION_LINK}"
                            style="display: inline-block; background-color: #10B981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                            Login to FreddAid
                        </a>
                    </div>
                </div>
                <!-- Footer -->
                <div class="footer">
                    <div class="footer-text">
                        This email was sent from Sales Factory's app FreddAid
                    </div>
                    <div class="footer-text">
                        Need help? <a href="#" class="footer-link">Contact Support</a>
                    </div>
                    <div class="footer-text" style="margin-top: 16px; font-size: 12px;">
                        © {datetime.now().year} Sales Factory AI. All rights reserved.
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        email_config = {
            "smtp_server": EMAIL_HOST,
            "smtp_port": EMAIL_PORT,
            "username": EMAIL_USER,
            "password": EMAIL_PASS,
        }

        email_service = EmailService(**email_config)
        try:
            email_service.send_email(
                subject=subject, html_content=html_content, recipients=[user_email]
            )
            logging.info(f"Password reset email sent to {user_email}")
        except EmailServiceError as e:
            logging.error(f"Failed to send password reset email: {str(e)}")

        return jsonify({"message": "Password reset successfully and email sent"}), 200

    except NotFound as e:
        logging.warning(f"User with id {user_id} not found.")
        return jsonify({"error": f"User with id {user_id} not found."}), 404

    except Exception as e:
        logging.exception(f"Error resetting password for user with id {user_id}")
        return jsonify({"error": "Internal Server Error"}), 500


@bp.route("/api/deleteuser", methods=["DELETE"])
@auth_required
def deleteUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )

    user_id = request.args.get("userId")
    organization_id = request.args.get("organizationId")
    if not user_id or not organization_id:
        return (
            jsonify(
                {"error": "Missing required parameter: user_id or organization_id"}
            ),
            400,
        )

    try:
        success = delete_user(user_id, organization_id)
        if not success:
            return jsonify({"error": "User not found or already deleted"}), 404
        return "", 204
    except NotFound:
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logging.exception(
            f"[webbackend] exception in /api/deleteuser for user {user_id}"
        )
        return jsonify({"error": str(e)}), 500


@bp.route("/api/checkuser", methods=["POST"])
@auth_required
def checkUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")
    if not client_principal_id or not client_principal_name:
        return create_error_response(
            "Missing authentication headers", HTTPStatus.UNAUTHORIZED
        )

    if not request.json or "email" not in request.json:
        return create_error_response("Email is required", HTTPStatus.BAD_REQUEST)

    email = request.json["email"]

    try:
        response = set_user(
            {
                "id": client_principal_id,
                "email": email,
                "role": "user",
                "name": client_principal_name,
            }
        )

        if not response or "user_data" not in response:
            return create_error_response(
                "Failed to set user", HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return response["user_data"]

    except MissingRequiredFieldError as field:
        return create_error_response(
            f"Field '{field}' is required", HTTPStatus.BAD_REQUEST
        )

    except CosmosHttpResponseError as cosmos_error:
        logging.error(f"[webbackend] Cosmos DB error in /api/checkUser: {cosmos_error}")
        return create_error_response(
            "Database error in CosmosDB", HTTPStatus.INTERNAL_SERVER_ERROR
        )

    try:
        email = request.json["email"]
        url = CHECK_USER_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "id": client_principal_id,
                "name": client_principal_name,
                "email": email,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")

        if response.status_code != 200:
            logging.error(f"[webbackend] Error from orchestrator: {response.text}")
            return jsonify({"error": "Error contacting orchestrator"}), 500

        return response.text
    except Exception as e:
        logging.exception("[webbackend] Unexpected exception in /api/checkUser")
        return jsonify({"error": "An unexpected error occurred"}), 500


@bp.route("/api/getUser", methods=["GET"])
@auth_required
def getUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        user = get_user_container(client_principal_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify(user), 200
    except Exception as e:
        logging.exception("[webbackend] exception in /getUser")
        return jsonify({"error": str(e)}), 500
    except NotFound as e:
        return jsonify({"error": str(e)}), 404


@bp.route("/api/getusers", methods=["GET"])
@auth_required
def getUsers():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )
    user_id = request.args.get("user_id")
    organization_id = request.args.get("organizationId")

    try:

        if user_id:
            user = get_user_by_id(user_id)
            return user
        users = get_users(organization_id)
        return jsonify(users)

    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
        return jsonify({"error": str(e)}), 500


@bp.route("/api/users/usage", methods=["GET"])
@auth_required
@require_user_conversation_limits()
def getUserConversationUsage(**kwargs):
    """
    Endpoint to get the conversation usage for a user within an organization.
    Expects 'organization_id' and 'user_id' in the request (either as URL parameters or in the JSON body). THIS IS AN EXAMPLE ENDPOINT
    """
    try:
        return create_success_response(kwargs.get("user_limits", {}))
    except Exception as e:
        logging.exception("[webbackend] exception in /api/users/usage endpoint")
        return jsonify({"error": "Internal Server Error"}), 500