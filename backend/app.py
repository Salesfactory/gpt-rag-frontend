from functools import wraps
import os
import re
import logging
import requests
import json
import stripe
from flask import (
    Flask,
    request,
    jsonify,
    Response,
    send_from_directory,
    redirect,
    url_for,
    session,
)

from flask_cors import CORS
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from urllib.parse import unquote
import uuid

from identity.flask import Auth
from datetime import timedelta, datetime

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import app_config
import logging
from functools import wraps
from typing import Dict, Any, Tuple, Optional
from tenacity import retry, wait_fixed, stop_after_attempt
from http import HTTPStatus  # Best Practice: Use standard HTTP status codes
from azure.cosmos.exceptions import CosmosHttpResponseError
import smtplib
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound
from utils import (
    create_error_response,
    create_success_response,
    SubscriptionError,
    InvalidSubscriptionError,
    InvalidFinancialPriceError,
    InvalidParameterError,
    MissingJSONPayloadError,
    MissingRequiredFieldError,
    MissingParameterError,
    require_client_principal,
    get_azure_key_vault_secret,
    get_conversations,
    get_conversation,
    delete_conversation,
)
import stripe.error

from shared.cosmo_db import (
    create_report,
    get_report,
    get_user_container,
    patch_user_data,
    update_report,
    delete_report,
    get_filtered_reports,
    create_template,
    delete_template,
    get_templates,
    get_template_by_ID,
    update_user,
    get_audit_logs
    get_organization_subscription
    create_invitation
    set_user,
    create_organization
)

load_dotenv(override=True)

SPEECH_REGION = os.getenv("SPEECH_REGION")
ORCHESTRATOR_ENDPOINT = os.getenv("ORCHESTRATOR_ENDPOINT")
ORCHESTRATOR_URI = os.getenv("ORCHESTRATOR_URI", default="")

SETTINGS_ENDPOINT = ORCHESTRATOR_URI + "/api/settings"

HISTORY_ENDPOINT = ORCHESTRATOR_URI + "/api/conversations"
SUBSCRIPTION_ENDPOINT = ORCHESTRATOR_URI + "/api/subscriptions"
INVITATIONS_ENDPOINT = ORCHESTRATOR_URI + "/api/invitations"
STORAGE_ACCOUNT = os.getenv("STORAGE_ACCOUNT")
FINANCIAL_ASSISTANT_ENDPOINT = ORCHESTRATOR_URI + "/api/financial-orc"
PRODUCT_ID_DEFAULT = os.getenv("STRIPE_PRODUCT_ID")

# email
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PORT = os.getenv("EMAIL_PORT")

# stripe
stripe.api_key = os.getenv("STRIPE_API_KEY")
FINANCIAL_ASSISTANT_PRICE_ID = os.getenv("STRIPE_FA_PRICE_ID")

INVITATION_LINK = os.getenv("INVITATION_LINK")

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)

SPEECH_KEY = get_azure_key_vault_secret("speechKey")

SPEECH_RECOGNITION_LANGUAGE = os.getenv("SPEECH_RECOGNITION_LANGUAGE")
SPEECH_SYNTHESIS_LANGUAGE = os.getenv("SPEECH_SYNTHESIS_LANGUAGE")
SPEECH_SYNTHESIS_VOICE_NAME = os.getenv("SPEECH_SYNTHESIS_VOICE_NAME")
AZURE_CSV_STORAGE_NAME = os.getenv("AZURE_CSV_STORAGE_CONTAINER", "files")


# Retrieve the connection string for Azure Blob Storage from secrets
try:
    AZURE_STORAGE_CONNECTION_STRING = get_azure_key_vault_secret("storageConnectionString")
    if not AZURE_STORAGE_CONNECTION_STRING:
        raise ValueError(
            "The connection string for Azure Blob Storage (AZURE_STORAGE_CONNECTION_STRING):  is not set. Please ensure it is correctly configured."
        )

    logging.info("Successfully retrieved Blob connection string.")
    # Validate that the connection string is available

except Exception as e:
    logging.error("Error retrieving the connection string for Azure Blob Storage.")
    logging.debug(f"Detailed error: {e}")  # Log detailed errors at the debug level
    raise


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(app_config)
CORS(app)


auth = Auth(
    app,
    client_id=os.getenv("AAD_CLIENT_ID"),
    client_credential=os.getenv("AAD_CLIENT_SECRET"),
    redirect_uri=os.getenv("AAD_REDIRECT_URI"),
    b2c_tenant_name=os.getenv("AAD_TENANT_NAME"),
    b2c_signup_signin_user_flow=os.getenv("AAD_POLICY_NAME"),
    b2c_edit_profile_user_flow=os.getenv("EDITPROFILE_USER_FLOW"),
)


def handle_auth_error(func):
    """Decorator to handle authentication errors consistently"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.exception("[auth] Error in user authentication")
            return (
                jsonify(
                    {
                        "error": "Authentication error",
                        "message": str(e),
                        "status": "error",
                    }
                ),
                500,
            )

    return wrapper


class UserService:
    """Service class to handle user-related operations"""

    @staticmethod
    def validate_user_context(
        user_context: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate the user context from B2C

        Args:
            user_context: The user context from B2C

        Returns:
            Tuple of (is_valid: bool, error_message: Optional[str])
        """
        required_fields = {
            "sub": "User ID",
            "name": "User Name",
            "emails": "Email Address",
        }

        for field, display_name in required_fields.items():
            if field not in user_context:
                return False, f"Missing {display_name}"
            if field == "emails" and not user_context[field]:
                return False, "Email address list is empty"

        return True, None

    @staticmethod
    @retry(wait=wait_fixed(2), stop=stop_after_attempt(3))
    def check_user_authorization(
        client_principal_id: str,
        client_principal_name: str,
        email: str,
        timeout: int = 10,
    ) -> Dict[str, Any]:
        """
        Check user authorization using local database logic.

        Args:
            client_principal_id: The user's principal ID from Azure B2C
            client_principal_name: The user's principal name from Azure B2C
            email: The user's email address
            timeout: Timeout for potential long-running operations (default: 10 seconds)

        Returns:
            Dict containing the user's profile data, including role and organizationId

        Raises:
            ValueError: If the user is not found or data is invalid
            Exception: For unexpected errors
        """
        try:
            logger.info(
                f"[auth] Validating user {client_principal_id} "
                f"with email {email} and name {client_principal_name}"
            )

            # Create user payload for `get_set_user` function
            client_principal = {
                "id": client_principal_id,
                "name": client_principal_name,
                "email": email  # Default role, if necessary
            }

            # Call get_set_user to retrieve or create the user in the database
            user_response = get_set_user(client_principal)

            # Validate response
            if not user_response or "user_data" not in user_response:
                logger.error(f"[auth] User data could not be retrieved for {client_principal_id}")
                raise ValueError("Failed to retrieve user data")

            # Extract user data
            user_data = user_response["user_data"]
            logger.info(f"[auth] User data retrieved: {user_data}")

            # Ensure required fields are present
            required_fields = ["role", "organizationId"]
            for field in required_fields:
                if field not in user_data:
                    logger.error(f"[auth] Missing required field: {field}")
                    raise ValueError(f"User profile is missing required field: {field}")

            logger.info(
                f"[auth] Successfully validated user {client_principal_id} "
                f"with role {user_data['role']} and organizationId {user_data['organizationId']}"
            )

            # Return the user's profile data
            return user_data

        except ValueError as e:
            logger.error(f"[auth] Validation error for user {client_principal_id}: {str(e)}")
            raise

        except Exception as e:
            logger.error(f"[auth] Unexpected error validating user {client_principal_id}: {str(e)}")
            raise

@app.route("/")
@auth.login_required
def index(*, context):
    """
    Endpoint to get the current user's data from Microsoft Graph API
    """
    logger.debug(f"User context: {context}")
    return send_from_directory("static", "index.html")


# route for other static files


@app.route("/<path:path>")
def static_files(path):
    # Don't require authentication for static assets
    return send_from_directory("static", path)


@app.route("/auth-response")
def auth_response():
    try:
        return auth.complete_log_in(request.args)
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        return redirect(url_for("index"))


@app.route("/api/auth/config")
def get_auth_config():
    """Return Azure AD B2C configuration for frontend"""
    return jsonify(
        {
            "clientId": os.getenv("AAD_CLIENT_ID"),
            "authority": f"https://{os.getenv('AAD_TENANT_NAME')}.b2clogin.com/{os.getenv('AAD_TENANT_NAME')}.onmicrosoft.com/{os.getenv('AAD_POLICY_NAME')}",
            "redirectUri": "http://localhost:8000",
            "scopes": ["openid", "profile"],
        }
    )


# Constants and Configuration


@app.route("/api/auth/user")
@auth.login_required
@handle_auth_error
def get_user(*, context: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Get authenticated user information and profile from authorization service.

    Args:
        context: The authentication context from B2C containing user claims

    Returns:
        Tuple[Dict[str, Any], int]: User profile data and HTTP status code

    Raises:
        ValueError: If required secrets or user data is missing
        RequestException: If authorization service call fails
    """
    try:
        # Validate user context
        is_valid, error_message = UserService.validate_user_context(context["user"])
        if not is_valid:
            logger.error(f"[auth] Invalid user context: {error_message}")
            return (
                jsonify(
                    {
                        "error": "Invalid user context",
                        "message": error_message,
                        "status": "error",
                    }
                ),
                400,
            )

        # Get user ID early to include in logs
        client_principal_id = context["user"].get("sub")
        logger.info(f"[auth] Processing request for user {client_principal_id}")

        # Get function key from Key Vault
        key_secret_name = "orchestrator-host--checkuser"
        function_key = get_azure_key_vault_secret(key_secret_name)
        if not function_key:
            raise ValueError(f"Secret {key_secret_name} not found in Key Vault")

        client_principal_name = context["user"]["name"]
        email = context["user"]["emails"][0]
        # Check user authorization
        user_profile = UserService.check_user_authorization(
            client_principal_id,
            client_principal_name,
            email,
            timeout=10,
        )

        # Validate user profile response
        if not user_profile:
            logger.error(f"[auth] Invalid user profile response: {user_profile}")
            return (
                jsonify(
                    {
                        "error": "Invalid user profile",
                        "message": "User profile data is missing or invalid",
                        "status": "error",
                    }
                ),
                500,
            )

        # Validate required fields in user profile
        required_profile_fields = ["role", "organizationId"]
        for field in required_profile_fields:
            if field not in user_profile:
                logger.error(f"[auth] Missing required field in user profile: {field}")
                return (
                    jsonify(
                        {
                            "error": "Invalid user profile",
                            "message": f"Missing required field: {field}",
                            "status": "error",
                        }
                    ),
                    500,
                )

        # Log successful profile retrieval
        logger.info(
            f"[auth] Successfully retrieved profile for user {client_principal_id} "
            f"with role {user_profile['role']}"
        )

        # Construct and return response
        return (
            jsonify(
                {
                    "status": "success",
                    "authenticated": True,
                    "user": {
                        "id": context["user"]["sub"],
                        "name": context["user"]["name"],
                        "email": context["user"]["emails"][0],
                        "role": user_profile["role"],
                        "organizationId": user_profile["organizationId"],
                    },
                }
            ),
            200,
        )

    except ValueError as e:
        logger.error(f"[auth] Key Vault error for user {client_principal_id}: {str(e)}")
        return (
            jsonify(
                {
                    "error": "Configuration error",
                    "message": "Failed to retrieve necessary configuration",
                    "status": "error",
                }
            ),
            500,
        )

    except requests.RequestException as e:
        logger.error(
            f"[auth] User authorization check failed for user {client_principal_id}: {str(e)}"
        )
        return (
            jsonify(
                {
                    "error": "Authorization check failed",
                    "message": "Failed to verify user authorization",
                    "status": "error",
                }
            ),
            500,
        )

    except KeyError as e:
        logger.error(
            f"[auth] Missing required data in response for user {client_principal_id}: {str(e)}"
        )
        return (
            jsonify(
                {
                    "error": "Data error",
                    "message": "Missing required user data",
                    "status": "error",
                }
            ),
            500,
        )

    except Exception as e:
        logger.exception(
            f"[auth] Unexpected error in get_user for user {client_principal_id}"
        )
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "message": "An unexpected error occurred",
                    "status": "error",
                }
            ),
            500,
        )


@app.route("/chatgpt", methods=["POST"])
def chatgpt():
    conversation_id = request.json["conversation_id"]
    question = request.json["query"]
    file_blob_url = request.json["url"]
    agent = request.json["agent"]
    documentName = request.json["documentName"]

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")
    logging.info("[webbackend] conversation_id: " + conversation_id)
    logging.info("[webbackend] question: " + question)
    logging.info(f"[webbackend] file_blob_url: {file_blob_url}")
    logging.info(f"[webbackend] User principal: {client_principal_id}")
    logging.info(f"[webbackend] User name: {client_principal_name}")
    logging.info(f"[webappend] Agent: {agent}")

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        if agent == "financial":
            keySecretName = "orchestrator-host--financial"
        else:
            keySecretName = "orchestrator-host--functionKey"

        functionKey = get_azure_key_vault_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--functionKey"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        if agent == "financial":
            orchestrator_url = FINANCIAL_ASSISTANT_ENDPOINT
        else:
            orchestrator_url = ORCHESTRATOR_ENDPOINT

        payload = json.dumps(
            {
                "conversation_id": conversation_id,
                "question": question,
                "url": file_blob_url,
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "documentName": documentName,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", orchestrator_url, headers=headers, data=payload
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")

        if response.status_code != 200:
            logging.error(f"[webbackend] Error from orchestrator: {response.text}")
            return jsonify({"error": "Error contacting orchestrator"}), 500

        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /chatgpt")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat-history", methods=["GET"])
def getChatHistory():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return jsonify({"error": "Missing client principal ID"}), 400
    
    try:
        conversations = get_conversations(client_principal_id)
        return jsonify(conversations), 200
    except ValueError as ve:
        logging.warning(f"ValueError fetching chat history: {str(ve)}")
        return jsonify({"error": "Invalid input or client data"}), 400
    except Exception as e:
        logging.exception(f"Unexpected error fetching chat history: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500



@app.route("/api/chat-conversation/<chat_id>", methods=["GET"])
def getChatConversation(chat_id):

    if chat_id is None:
        return jsonify({"error": "Missing conversation_id parameter"}), 400

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    try:
        conversation = get_conversation(chat_id, client_principal_id)
        return jsonify(conversation),200
    except ValueError as ve:
        logging.warning(f"ValueError fetching conversation_id: {str(ve)}")
        return jsonify({"error": "Invalid input or client data"}), 400
    except Exception as e:
        logging.exception(f"Unexpected error fetching conversation: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/api/chat-conversations/<chat_id>", methods=["DELETE"])
def deleteChatConversation(chat_id):

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    try:
        if chat_id:
            delete_conversation(chat_id, client_principal_id)
            return jsonify({"message": "Conversation deleted successfully"}), 200
        else:
            return jsonify({"error": "Missing conversation ID"}), 400
    except Exception as e:
        logging.exception("[webbackend] exception in /delete-chat-conversation")
        return jsonify({"error": str(e)}), 500


# get report by id argument from Container Reports
@app.route("/api/reports/<report_id>", methods=["GET"])
@auth.login_required()
def getReport(*, context, report_id):
    """
    Endpoint to get a report by ID.
    """
    try:
        report = get_report(report_id)
        return jsonify(report), 200
    except NotFound as e:
        logging.warning(f"Report with id {report_id} not found.")
        return jsonify({"error": f"Report with this id {report_id} not found"}), 404
    except Exception as e:
        logging.exception(
            f"An error occurred retrieving the report with id {report_id}"
        )
        return jsonify({"error": "Internal Server Error"}), 500


# create Reports curation and companySummarization container Reports
@app.route("/api/reports", methods=["POST"])
@auth.login_required()
def createReport(*, context):
    """
    Endpoint to create a new report.
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        # Validate the 'name' field
        if "name" not in data:
            return jsonify({"error": "Field 'name' is required"}), 400

        # Validate the 'type' field
        if "type" not in data:
            return jsonify({"error": "Field 'type' is required"}), 400

        if data["type"] not in ["curation", "companySummarization"]:
            return (
                jsonify(
                    {
                        "error": "Invalid 'type'. Must be 'curation' or 'companySummarization'"
                    }
                ),
                400,
            )

        # Validate fields according to type
        if data["type"] == "companySummarization":
            required_fields = ["reportTemplate", "companyTickers"]
            missing_fields = [field for field in required_fields if field not in data]

            if missing_fields:
                return (
                    jsonify(
                        {
                            "error": f"Missing required fields: {', '.join(missing_fields)}"
                        }
                    ),
                    400,
                )

            # Validate 'reportTemplate'
            valid_templates = ["10-K", "10-Q", "8-K", "DEF 14A"]
            if data["reportTemplate"] not in valid_templates:
                return (
                    jsonify(
                        {
                            "error": f"'reportTemplate' must be one of: {', '.join(valid_templates)}"
                        }
                    ),
                    400,
                )

        elif data["type"] == "curation":
            required_fields = ["category"]
            missing_fields = [field for field in required_fields if field not in data]

            if missing_fields:
                return (
                    jsonify(
                        {
                            "error": f"Missing required fields: {', '.join(missing_fields)}"
                        }
                    ),
                    400,
                )

            # Validate 'category'
            valid_categories = ["Ecommerce", "Weekly Economic", "Monthly Economic"]
            if data["category"] not in valid_categories:
                return (
                    jsonify(
                        {
                            "error": f"'category' must be one of: {', '.join(valid_categories)}"
                        }
                    ),
                    400,
                )

        # Validar the 'status' field
        if "status" not in data:
            return jsonify({"error": "Field 'status' is required"}), 400

        valid_statuses = ["active", "archived"]
        if data["status"] not in valid_statuses:
            return (
                jsonify(
                    {"error": f"'status' must be one of: {', '.join(valid_statuses)}"}
                ),
                400,
            )

        # Delegate report creation
        new_report = create_report(data)
        return jsonify(new_report), 201

    except Exception as e:
        logging.exception("Error creating report")
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


# update Reports curation and companySummarization container Reports
@app.route("/api/reports/<report_id>", methods=["PUT"])
@auth.login_required()
def updateReport(*, context, report_id):
    """
    Endpoint to update a report by ID.
    """
    try:
        updated_data = request.get_json()

        if updated_data is None:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        updated_report = update_report(report_id, updated_data)
        return "", 204

    except NotFound as e:
        logging.warning(f"Tried to update a report that doesn't exist: {report_id}")
        return (
            jsonify(
                {
                    "error": f"Tried to update a report with this id {report_id} that does not exist"
                }
            ),
            404,
        )

    except Exception as e:
        logging.exception(
            f"Error updating report with ID {report_id}"
        )  # Logs the full exception
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


# delete report from Container Reports
@app.route("/api/reports/<report_id>", methods=["DELETE"])
@auth.login_required()
def deleteReport(*, context, report_id):
    """
    Endpoint to delete a report by ID.
    """
    try:
        delete_report(report_id)

        return "", 204

    except NotFound as e:
        # If the report does not exist, return 404 Not Found
        logging.warning(f"Report with id {report_id} not found.")
        return jsonify({"error": f"Report with id {report_id} not found."}), 404

    except Exception as e:
        logging.exception(f"Error deleting report with id {report_id}")
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            500,
        )


# Get User for email receivers
@app.route("/api/user/<user_id>", methods=["GET"])
@auth.login_required()
def getUserid(*, context, user_id):
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
@app.route("/api/user/<user_id>", methods=["PUT"])
@auth.login_required()
def updateUser(*, context, user_id):
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


#Update User data info

@app.route("/api/user/<user_id>", methods=["PATCH"])
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
        return jsonify({"error": "An unexpected error occurred. Please try again later."}), 500


@app.route("/api/reports", methods=["GET"])
@auth.login_required()
def getFilteredType(*, context):
    """
    Endpoint to obtain reports by type or retrieve all reports if no type is specified.
    """
    report_type = request.args.get("type")

    try:
        if report_type:
            reports = get_filtered_reports(report_type)
        else:
            reports = get_filtered_reports()

        return jsonify(reports), 200

    except NotFound as e:
        logging.warning(f"No reports found for type '{report_type}'.")
        return jsonify({"error": f"No reports found for type '{report_type}'."}), 404

    except Exception as e:
        logging.exception(f"Error retrieving reports.")
        return jsonify({"error": "Internal Server Error"}), 500


@app.route("/api/reports/summarization/templates", methods=["POST"])
@auth.login_required()
def addSummarizationReport(*, context):
    """
    Endpoint to add a summarization report template.

    This endpoint expects a JSON payload with the following fields:
    - name: The name of the report template. Must be one of ["10-K", "10-Q", "8-K", "DEF 14A"].
    - description: A description of the report template.

    MissingJSONPayloadError: If the JSON payload is missing.
    MissingRequiredFieldError: If the 'name' or 'description' field is missing.
    InvalidParameterError: If the 'name' field is not one of the valid names.

    JSON response with the created report template if successful.
    JSON error response with appropriate HTTP status code if an error occurs.
    """
    try: 
        data = request.get_json()
        if not data:
            raise MissingJSONPayloadError('Missing JSON payload')
        if not "templateType" in data:
            raise MissingRequiredFieldError('templateType')
        if not "description" in data:
            raise MissingRequiredFieldError('description')
        if not "companyTicker" in data:
            raise MissingRequiredFieldError('companyTicker')
        if not "companyName" in data:
            raise MissingRequiredFieldError('companyName')
        if not data["templateType"] in ALLOWED_FILING_TYPES:
            raise InvalidParameterError('templateType', f"Must be one of: {', '.join(ALLOWED_FILING_TYPES)}")
        new_template = {'templateType': data['templateType'], 'description': data['description'], 'companyTicker': data['companyTicker'], 'companyName': data['companyName'], 'status': 'active', 'type': 'summarization'}
        # add to cosmosDB container
        result = create_template(new_template)
        return create_success_response(result)
    except MissingJSONPayloadError as e:
        return create_error_response(
            "Invalid or Missing JSON payload", HTTPStatus.BAD_REQUEST
        )
    except MissingRequiredFieldError as field:
        return create_error_response(
            f"Field '{field}' is required", HTTPStatus.BAD_REQUEST
        )
    except InvalidParameterError as e:
        return create_error_response(str(e), HTTPStatus.BAD_REQUEST)
    except Exception as e:
        logging.exception(e)
        return (
            jsonify({"error": "An unexpected error occurred. Please try again later."}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@app.route("/api/reports/summarization/templates/<template_id>", methods=["DELETE"])
@auth.login_required()
def removeSummarizationReport(*, context, template_id):
    """
    Endpoint to remove a summarization report template by ID.

    This endpoint expects the following URL parameter:
    - template_id: The ID of the report template to be removed.

    NotFound: If the report template with the specified ID does not exist.
    Exception: For any other unexpected errors.

    JSON response with appropriate HTTP status code:
    - 204 No Content: If the report template is successfully deleted.
    - 404 Not Found: If the report template with the specified ID does not exist.
    - 500 Internal Server Error: If an unexpected error occurs.
    """
    try:
        if not template_id:
            raise MissingRequiredFieldError("template_id")
        # delete from cosmosDB container
        result = delete_template(template_id)
        return create_success_response(result)
    except NotFound as e:
        return create_error_response(
            f"Template with id '{template_id}' not found", HTTPStatus.NOT_FOUND
        )
    except MissingRequiredFieldError as field:
        return create_error_response(
            f"Field '{field}' is required", HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        return create_error_response(
            "An unexpected error occurred. Please try again later.",
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@app.route("/api/reports/summarization/templates/", methods=["GET"])
@auth.login_required()
def getSummarizationReports(*, context):
    try:
        result = get_templates()
        return create_success_response(result)
    except Exception as e:
        return create_error_response(
            "An unexpected error occurred. Please try again later.",
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@app.route("/api/reports/summarization/templates/<template_id>", methods=["GET"])
@auth.login_required()
def getSummarizationReport(*, context, template_id):
    try:
        result = get_template_by_ID(template_id)
        return create_success_response(result)
    except NotFound as e:
        return create_error_response(
            f"Template with id '{template_id}' not found", HTTPStatus.NOT_FOUND
        )
    except Exception as e:
        return create_error_response(
            "An unexpected error occurred. Please try again later.",
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


# methods to provide access to speech services and blob storage account blobs


@app.route("/api/get-speech-token", methods=["GET"])
def getGptSpeechToken():
    try:
        fetch_token_url = (
            f"https://{SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        )
        headers = {
            "Ocp-Apim-Subscription-Key": SPEECH_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        response = requests.post(fetch_token_url, headers=headers)
        access_token = str(response.text)
        return json.dumps(
            {
                "token": access_token,
                "region": SPEECH_REGION,
                "speechRecognitionLanguage": SPEECH_RECOGNITION_LANGUAGE,
                "speechSynthesisLanguage": SPEECH_SYNTHESIS_LANGUAGE,
                "speechSynthesisVoiceName": SPEECH_SYNTHESIS_VOICE_NAME,
            }
        )
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-speech-token")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-storage-account", methods=["GET"])
def getStorageAccount():
    if STORAGE_ACCOUNT is None or STORAGE_ACCOUNT == "":
        return jsonify({"error": "Add STORAGE_ACCOUNT to frontend app settings"}), 500
    try:
        return json.dumps({"storageaccount": STORAGE_ACCOUNT})
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-storage-account")
        return jsonify({"error": str(e)}), 500


@app.route("/create-checkout-session", methods=["POST"])
def create_checkout_session():
    price = request.json["priceId"]
    userId = request.json["userId"]
    success_url = request.json["successUrl"]
    cancel_url = request.json["cancelUrl"]
    organizationId = request.json["organizationId"]
    userName = request.json["userName"]
    organizationName = request.json["organizationName"]
    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[{"price": price, "quantity": 1}],
            mode="subscription",
            client_reference_id=userId,
            metadata={"userId": userId, "organizationId": organizationId, "userName":userName, "organizationName":organizationName},
            success_url=success_url,
            cancel_url=cancel_url,
            automatic_tax={"enabled": True},
            custom_fields=[
                (
                    {
                        "key": "organization_name",
                        "label": {"type": "custom", "custom": "Organization Name"},
                        "type": "text",
                        "text": {"minimum_length": 5, "maximum_length": 100},
                    }
                    if organizationId == ""
                    else {}
                )
            ],
        )
    except Exception as e:
        return str(e)

    return jsonify({"url": checkout_session.url})

@app.route("/get-customer", methods=['POST'])
def get_customer():

    subscription_id = request.json["subscription_id"]

    if not subscription_id:
        logging.warning({"Error": "No subscription_id was provided for this request."})
        return jsonify({"error": "No subscription_id was provided for this request."}), 404

    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        customer_id = subscription.get("customer")

        if not customer_id:
            logging.warning({"error": "No customer_id found for the provided subscription."})
            return jsonify({"error": "No customer_id found for the provided subscription."}), 404
        
        return jsonify({"customer_id": customer_id}), 200

    except stripe.error.StripeError as e:
        logging.warning({"error": {str(e)}})
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logging.warning({"error": "Unexpected error: " + {str(e)}})
        return jsonify({"error": "Unexpected error: " + str(e)}), 500

@app.route("/create-customer-portal-session", methods=["POST"])
def create_customer_portal_session():
    customer = request.json.get("customer")
    return_url = request.json.get("return_url")
    subscription_id = request.json.get("subscription_id")

    if not customer or not return_url:
        logging.warning({"error": "Missing 'customer' or 'return_url'"})
        return jsonify({"error": "Missing 'customer' or 'return_url'"}), 400

    if not subscription_id:
        logging.warning({"error": "Missing 'subscription_id'."})
        return jsonify({"error": "Missing 'subscription_id'."}), 400

    try:
       # Clear the metadata of the specific subscription
        stripe.Subscription.modify(subscription_id, metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name":request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
                "modification_type": "",
            })

        portal_session = stripe.billing_portal.Session.create(
            customer=customer,
            return_url=return_url
        )

    except Exception as e:
        logging.error({"error": f"Unexpected error: {str(e)}"})
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    return jsonify({"url": portal_session.url})

@app.route("/api/stripe", methods=["GET"])
def getStripe():
    try:
        keySecretName = "stripeKey"
        functionKey = get_azure_key_vault_secret(keySecretName)
        return functionKey
    except Exception as e:
        logging.exception("[webbackend] exception in /api/stripe")
        return jsonify({"error": str(e)}), 500


@app.route("/webhook", methods=["POST"])
def webhook():
    stripe.api_key = os.getenv("STRIPE_API_KEY")
    endpoint_secret = os.getenv("STRIPE_SIGNING_SECRET")

    event = None
    payload = request.data

    try:
        event = json.loads(payload)
    except json.decoder.JSONDecodeError as e:
        print("⚠️  Webhook error while parsing basic request." + str(e))
        return jsonify(success=False)
    if endpoint_secret:
        # Only verify the event if there is an endpoint secret defined
        # Otherwise use the basic event deserialized with json
        sig_header = request.headers["STRIPE_SIGNATURE"]
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except stripe.error.SignatureVerificationError as e:
            print("⚠️  Webhook signature verification failed. " + str(e))
            return jsonify(success=False)

    # Handle the event
    if event["type"] == "checkout.session.completed":
        print("🔔  Webhook received!", event["type"])
        userId = event["data"]["object"]["client_reference_id"]
        organizationId = event["data"]["object"]["metadata"]["organizationId"]
        sessionId = event["data"]["object"]["id"]
        subscriptionId = event["data"]["object"]["subscription"]
        paymentStatus = event["data"]["object"]["payment_status"]
        organizationName = event["data"]["object"]["custom_fields"][0]["text"]["value"]
        expirationDate = event["data"]["object"]["expires_at"]
        try:
            # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
            # It is set during the infrastructure deployment.
            keySecretName = "orchestrator-host--subscriptions"
            functionKey = get_azure_key_vault_secret(keySecretName)
        except Exception as e:
            logging.exception(
                "[webbackend] exception in /api/orchestrator-host--subscriptions"
            )
            return (
                jsonify(
                    {
                        "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                    }
                ),
                500,
            )
        try:
            url = SUBSCRIPTION_ENDPOINT
            payload = json.dumps(
                {
                    "id": userId,
                    "organizationId": organizationId,
                    "sessionId": sessionId,
                    "subscriptionId": subscriptionId,
                    "paymentStatus": paymentStatus,
                    "organizationName": organizationName,
                    "expirationDate": expirationDate,
                }
            )
            headers = {
                "Content-Type": "application/json",
                "x-functions-key": functionKey,
            }
            response = requests.request("POST", url, headers=headers, data=payload)
            logging.info(f"[webbackend] RESPONSE: {response.text[:500]}...")
        except Exception as e:
            logging.exception("[webbackend] exception in /api/checkUser")
            return jsonify({"error": str(e)}), 500
    else:
        # Unexpected event type
        print("Unexpected event type")

    return jsonify(success=True)


@app.route("/api/upload-blob", methods=["POST"])
def uploadBlob():
    if "file" not in request.files:
        print("No file sent")
        return jsonify({"error": "No file sent"}), 400

    valid_file_extensions = [".csv", ".xlsx", ".xls"]

    file = request.files["file"]

    extension = os.path.splitext(file.filename)[1]

    if extension not in valid_file_extensions:
        return jsonify({"error": "Invalid file type"}), 400

    filename = str(uuid.uuid4()) + extension

    try:
        blob_service_client = BlobServiceClient.from_connection_string(
            AZURE_STORAGE_CONNECTION_STRING
        )
        blob_client = blob_service_client.get_blob_client(
            container=AZURE_CSV_STORAGE_NAME, blob=filename
        )
        blob_client.upload_blob(data=file, blob_type="BlockBlob")

        return jsonify({"blob_url": blob_client.url}), 200
    except Exception as e:
        logging.exception("[webbackend] exception in /api/upload-blob")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-blob", methods=["POST"])
def getBlob():
    logging.exception("------------------ENTRA ------------")
    blob_name = unquote(request.json["blob_name"])
    try:
        client_credential = DefaultAzureCredential()
        blob_service_client = BlobServiceClient(
            f"https://{STORAGE_ACCOUNT}.blob.core.windows.net", client_credential
        )
        blob_client = blob_service_client.get_blob_client(
            container="documents", blob=blob_name
        )
        blob_data = blob_client.download_blob()
        blob_text = blob_data.readall()
        return Response(blob_text, content_type="application/octet-stream")
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-blob")
        logging.exception(blob_name)
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["GET"])
def getSettings():
    client_principal, error_response, status_code = get_client_principal()
    if error_response:
        return error_response, status_code

    try:
        settings = get_setting(client_principal)
        
        return settings
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["POST"])
def setSettings():
    
    client_principal, error_response, status_code = get_client_principal()
    if error_response:
        return error_response, status_code

    try:
        request_body = request.json
        if not request_body:
            return jsonify({"error": "Invalid request body"}), 400

        temperature = request_body.get("temperature", 0.0)
        frequency_penalty = request_body.get("frequency_penalty", 0.0)
        presence_penalty = request_body.get("presence_penalty", 0.0)

        set_settings(
            client_principal=client_principal,
            temperature=temperature,
            frequency_penalty=frequency_penalty,
            presence_penalty=presence_penalty
        )

        return jsonify({
            "client_principal_id": client_principal["id"],
            "client_principal_name": client_principal["name"],
            "temperature": temperature,
            "frequency_penalty": frequency_penalty,
            "presence_penalty": presence_penalty,
        }), 200
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500


@app.route("/api/feedback", methods=["POST"])
def setFeedback():
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

    client_principal = {
        'id': client_principal_id,
        'name': client_principal_name
    }

    conversation_id = request.json["conversation_id"]
    question = request.json["question"]
    answer = request.json["answer"]
    category = request.json["category"]
    feedback = request.json["feedback"]
    rating = request.json["rating"]

    if not conversation_id or not question or not answer or not category:
        return (
            jsonify(
                {
                    "error": "Missing required parameters conversation_id, question, answer or category"
                }
            ),
            400,
        )

    try:
        conversations = set_feedback(
            client_principal=client_principal,
            conversation_id=conversation_id,
            feedback_message=feedback,
            question=question,
            answer=answer,
            rating=rating,
            category=category
        )
        return jsonify({
            "client_principal_id": client_principal_id,
            "client_principal_name": client_principal_name,
            "feedback_message": feedback,
            "question": question,
            "answer": answer,
            "rating": rating,
            "category": category
        }), 200
    except Exception as e:
        logging.exception("[webbackend] exception in /api/feedback")
        return jsonify({"error": str(e)}), 500


@app.route("/api/getusers", methods=["GET"])
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
    user_id =request.args.get("user_id")
    organization_id = request.args.get("organizationId")

    try:
        
        if user_id:
            user = get_user_by_id(user_id)
            return user
        users = get_users(organization_id)
        return users
    
    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/deleteuser", methods=["DELETE"])
def deleteUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )

    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "Missing required parameter: user_id"}), 400

    try:
        success = delete_user(user_id)
        if not success:
            return jsonify({"error": "User not found or already deleted"}), 404
        return "", 204
    except NotFound:
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logging.exception(f"[webbackend] exception in /api/deleteuser for user {user_id}")
        return jsonify({"error": str(e)}), 500


@app.route("/logout")
def logout():
    # Clear the user's session
    session.clear()
    # Build the Azure AD B2C logout URL
    logout_url = (
        f"https://{os.getenv('AAD_TENANT_NAME')}.b2clogin.com/{os.getenv('AAD_TENANT_NAME')}.onmicrosoft.com/"
        f"{os.getenv('AAD_POLICY_NAME')}/oauth2/v2.0/logout"
        f"?p={os.getenv('AAD_POLICY_NAME')}"
        f"&post_logout_redirect_uri={os.getenv('AAD_REDIRECT_URI')}"
    )
    return redirect(logout_url)


@app.route("/api/inviteUser", methods=["POST"])
def sendEmail():
    if (
        not request.json
        or "username" not in request.json
        or "email" not in request.json
    ):
        return jsonify({"error": "Missing username or email"}), 400

    username = request.json["username"]
    email = request.json["email"]

    # Validate email format
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400

    try:
        # Email account credentials
        gmail_user = EMAIL_USER
        gmail_password = EMAIL_PASS

        # Email details
        sent_from = gmail_user
        to = [email]
        subject = "SalesFactory Chatbot Invitation"
        body = """
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to FreddAid - Your Marketing Powerhouse</title>
        <style>
            body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            }
            .container {
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
            }
            h1, h2 {
            margin: 10px 0;
            }
            p {
            line-height: 1.5;
            }
            a {
            color: #337ab7;
            text-decoration: none;
            }
            .cta-button {
            background-color: #337ab7;
            color: #fff !important;
            padding: 10px 20px;
            border-radius: 5px;
            text-align: center;
            display: inline-block;
            }
            .cta-button:hover {
            background-color: #23527c;
            }
            .cta-button a {
            color: #fff !important;
            }
            .cta-button a:visited {
            color: #fff !important;
            }
            .ii a[href] {
            color: #fff !important;
            }
            .footer {
            text-align: center;
            margin-top: 20px;
            }
        </style>
        </head>
        <body>
        <div class="container">
            <h1>Dear [Recipient's Name],</h1>
            <h2>Congratulations!</h2>
            <p>You now have exclusive access to FreddAid, your new marketing powerhouse. Get ready to transform your approach to marketing and take your strategies to the next level.</p>
            <h2>Ready to Get Started?</h2>
            <p>Click the link below and follow the easy steps to create your FreddAid account:</p>
            <a href="[link to activate account]" class="cta-button">Activate Your FreddAid Account Now</a>
            <p>Unlock FreddAid's full potential and start enjoying unparalleled insights, real-time data, and a high-speed advantage in all your marketing efforts.</p>
            <p>If you need any assistance, our support team is here to help you every step of the way.</p>
            <p>Welcome to the future of marketing. Welcome to FreddAid.</p>
            <p class="footer">Best regards,<br>Juan Hernandez<br>Chief Technology Officer<br>Sales Factory AI<br>juan.hernandez@salesfactory.com</p>
        </div>
        </body>
        </html>
        """.replace(
            "[Recipient's Name]", username
        ).replace(
            "[link to activate account]", INVITATION_LINK
        )

        # Create a multipart message and set headers
        message = MIMEMultipart()
        message["From"] = sent_from
        message["To"] = ", ".join(to)
        message["Subject"] = subject

        # Add body to email
        message.attach(MIMEText(body, "html"))

        # Connect to Gmail's SMTP server
        server = smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT)
        server.ehlo()
        server.login(gmail_user, gmail_password)

        # Send email
        server.sendmail(sent_from, to, message.as_string())
        server.close()

        logging.error("Email sent!")
        return jsonify({"message": "Email sent!"})
    except Exception as e:
        logging.error("Something went wrong...", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/getInvitations", methods=["GET"])
def getInvitations():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    
    user_id = request.args.get("user_id")
    organization_id = request.args.get("organizationId")
    
    if not organization_id and not user_id:
        return jsonify({"error": "Either 'organization_id' or 'user_id' is required"}), 400

    try:
        if organization_id:
            return jsonify(get_invitations(organization_id))
        return get_invitation(user_id)
    except Exception as e:
        logging.exception("[webbackend] exception in /getInvitation")
        return jsonify({"error": str(e)}), 500


@app.route("/api/createInvitation", methods=["POST"])
def createInvitation():
    try:
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not client_principal_id:
            raise MissingRequiredFieldError("client_principal_id")
        data = request.get_json()
        if not data:
            raise MissingJSONPayloadError()
        if not "invitedUserEmail" in data:
            raise MissingRequiredFieldError("invitedUserEmail")
        if not "organizationId" in data:
            raise MissingRequiredFieldError("organizationId")
        if not "role" in data:
            raise MissingRequiredFieldError("role")
        invitedUserEmail = data["invitedUserEmail"]
        organizationId = data["organizationId"]
        role = data["role"]
        response = create_invitation(invitedUserEmail, organizationId, role)
        return jsonify(response), HTTPStatus.CREATED 
    except MissingRequiredFieldError as field:
        return create_error_response(f"Field '{field}' is required", HTTPStatus.BAD_REQUEST)
    except Exception as e:
        logging.exception(str(e))
        return create_error_response(f'An unexpected error occurred. Please try again later. {e}', HTTPStatus.INTERNAL_SERVER_ERROR)


@app.route("/api/checkuser", methods=["POST"])
def checkUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")
    if not client_principal_id or not client_principal_name:
        return create_error_response("Missing authentication headers", HTTPStatus.UNAUTHORIZED)
    
    if not request.json or "email" not in request.json:
        return create_error_response("Email is required", HTTPStatus.BAD_REQUEST)
    
    email = request.json["email"]

    try:
        response = set_user({
            "id": client_principal_id,
            "email": email,
            "role": "user",
            "name": client_principal_name
        })

        if not response or "user_data" not in response:
            return create_error_response("Failed to set user", HTTPStatus.INTERNAL_SERVER_ERROR)

        return response["user_data"]

    except MissingRequiredFieldError as field:
        return create_error_response(f"Field '{field}' is required", HTTPStatus.BAD_REQUEST)
    
    except CosmosHttpResponseError as cosmos_error:
        logging.error(f"[webbackend] Cosmos DB error in /api/checkUser: {cosmos_error}")
        return create_error_response("Database error in CosmosDB", HTTPStatus.INTERNAL_SERVER_ERROR)

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
        return jsonify(response), 200

    except Exception as e:
        logging.exception("[webbackend] Unexpected exception in /api/checkUser")
        return jsonify({"error": "An unexpected error occurred"}), 500


@app.route("/api/get-organization-subscription", methods=["GET"])
def getOrganization():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    organizationId = request.args.get("organizationId")
    if not client_principal_id:
        create_error_response('Missing required parameter: client_principal_id', HTTPStatus.BAD_REQUEST)
    if not organizationId:
        create_error_response('Missing required parameter: organizationId', HTTPStatus.BAD_REQUEST)
    try:
        if not organizationId:
            raise MissingParameterError("organizationId")
        response = get_organization_subscription(organizationId)
        return jsonify(response)
    except NotFound as e:
        return jsonify({}), 204
    except MissingParameterError as e:
        return create_error_response('Missing required parameter: ' + str(e), HTTPStatus.BAD_REQUEST)
    except Exception as e:
        logging.exception("[webbackend] exception in /get-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/create-organization", methods=["POST"])
def createOrganization():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
        if not 'organizationName' in request.json:
            return jsonify({"error": "Missing required parameters, organizationName"}), 400
    try:
        organizationName = request.json["organizationName"]
        response = create_organization(client_principal_id, organizationName)
        if not response:
            return create_error_response("Failed to create organization", HTTPStatus.INTERNAL_SERVER_ERROR)
        return jsonify(response), HTTPStatus.CREATED
    except NotFound as e:
        return create_error_response(f'User {client_principal_id} not found', HTTPStatus.NOT_FOUND)
    except MissingRequiredFieldError as field:
        return create_error_response(f'Missing required parameters, {field}', HTTPStatus.BAD_REQUEST)
    except Exception as e:
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)


@app.route("/api/getUser", methods=["GET"])
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


def get_product_prices(product_id):

    if not product_id:
        raise ValueError("Product ID is required to fetch prices")

    try:
        # Fetch all prices associated with a product
        prices = stripe.Price.list(
            product=product_id, active=True  # Optionally filter only active prices
        )
        return prices.data
    except Exception as e:
        logging.error(f"Error fetching prices: {e}")
        raise

@app.route("/api/prices", methods=["GET"])
def get_product_prices_endpoint():
    product_id = request.args.get("product_id", PRODUCT_ID_DEFAULT)

    if not product_id:
        return jsonify({"error": "Missing product_id parameter"}), 400

    try:
        prices = get_product_prices(product_id)
        return jsonify({"prices": prices}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"Failed to retrieve prices: {e}")
        return jsonify({"error": str(e)}), 500


# ADD FINANCIAL ASSITANT A SUBSCRIPTION
@app.route("/api/subscription/<subscriptionId>/financialAssistant", methods=["PUT"])
@require_client_principal  # Security: Enforce authentication
def financial_assistant(subscriptionId):
    """
    Add Financial Assistant to an existing subscription.

    Args:
        subscription_id (str): Unique Stripe Subscription ID
    Returns:
        JsonResponse: Response containing a new updated subscription with the new new Item
        Success format: {
            "data": {
                "message": "Financial Assistant added to subscription successfully.",
                 "subscription": {
                    "application": null, ...
                },
                status: 200
            }
        }

    Raises:
        BadRequest: If the request is invalid. HttpCode: 400
        NotFound: If the subscription is not found. HttpCode: 404
        Unauthorized: If client principal ID is missing. HttpCode: 401
    """
    if not subscriptionId or not isinstance(subscriptionId, str):
        raise BadRequest("Invalid subscription ID")

    # Logging: Info level for normal operations
    logging.info(f"Modifying subscription {subscriptionId} to add Financial Assistant")
    if not FINANCIAL_ASSISTANT_PRICE_ID:
        raise InvalidFinancialPriceError("Financial Assistant price ID not configured")

    try:
        updated_subscription = stripe.Subscription.modify(
            subscriptionId,
            items=[{"price": FINANCIAL_ASSISTANT_PRICE_ID}],
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name":request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
                "modification_type": "add_financial_assistant",
            },
        )
        # Logging: Success confirmation
        logging.info(f"Successfully modified subscription {subscriptionId}")

        # Response Formatting: Clean, structured success response
        return create_success_response(
            {
                "message": "Financial Assistant added to subscription successfully.",
                "subscription": {
                    "id": updated_subscription.id,
                    "status": updated_subscription.status,
                    "current_period_end": updated_subscription.current_period_end,
                },
            }
        )

    # Error Handling: Specific error types with proper status codes
    except InvalidFinancialPriceError as e:
        # Logging: Error level for operation failures
        logging.error(f"Stripe invalid request error: {str(e)}")
        return create_error_response(
            f"An error occurred while processing your request", HTTPStatus.NOT_FOUND
        )
    except stripe.error.InvalidRequestError as e:
        logging.error(f"Stripe API error: {str(e)}")
        return create_error_response("Invalid Subscription ID", HTTPStatus.NOT_FOUND)
    except stripe.error.StripeError as e:
        # Logging: Error level for API failures
        logging.error(f"Stripe API error: {str(e)}")
        return create_error_response(
            "An error occurred while processing your request", HTTPStatus.BAD_REQUEST
        )

    except BadRequest as e:
        # Logging: Warning level for invalid requests
        logging.warning(f"Bad request: {str(e)}")
        return create_error_response(str(e), HTTPStatus.BAD_REQUEST)

    except Exception as e:
        # Logging: Exception level for unexpected errors
        logging.exception(f"Unexpected error: {str(e)}")
        return create_error_response(
            "An unexpected error occurred", HTTPStatus.INTERNAL_SERVER_ERROR
        )


# DELETE FINANCIAL ASSITANT A SUBSCRIPTION
@app.route("/api/subscription/<subscriptionId>/financialAssistant", methods=["DELETE"])
@require_client_principal  # Security: Enforce authentication
def remove_financial_assistant(subscriptionId):
    """
    Remove Financial Assistant from an existing subscription.

    Args:
        subscription_id (str): Unique Stripe Subscription ID
    Returns:
        JsonResponse: Response confirming the removal of the Financial Assistant
        Success format: {
            "data": {
                "message": "Financial Assistant removed from subscription successfully.",
                "subscription": {
                    "id": "<subscription_id>",
                    "status": "<status>",
                    "current_period_end": "<current_period_end>"
                },
                status: 200
            }
        }

    Raises:
        BadRequest: If the request is invalid. HttpCode: 400
        NotFound: If the subscription is not found. HttpCode: 404
        Unauthorized: If client principal ID is missing. HttpCode: 401
    """
    if not subscriptionId or not isinstance(subscriptionId, str):
        raise BadRequest("Invalid subscription ID")

    logging.info(
        f"Modifying subscription {subscriptionId} to remove Financial Assistant"
    )

    try:
        # Get the subscription to find the Financial Assistant item
        subscription = stripe.Subscription.retrieve(subscriptionId)

        # Find the Financial Assistant item
        assistant_item_id = None
        for item in subscription["items"]["data"]:
            if item["price"]["id"] == FINANCIAL_ASSISTANT_PRICE_ID:
                assistant_item_id = item["id"]
                break

        if not assistant_item_id:
            raise NotFound("Financial Assistant item not found in subscription")

        # Modify the subscription to remove the Financial Assistant item
        updated_subscription = stripe.Subscription.modify(
            subscriptionId,
            items=[{"id": assistant_item_id, "deleted": True}],
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name":request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
                "modification_type": "remove_financial_assistant",
            },
        )

        logging.info(
            f"Successfully removed Financial Assistant from subscription {subscriptionId}"
        )

        return create_success_response(
            {
                "message": "Financial Assistant removed from subscription successfully.",
                "subscription": {
                    "id": updated_subscription.id,
                    "status": updated_subscription.status,
                    "current_period_end": updated_subscription.current_period_end,
                },
            }
        )

    except stripe.error.InvalidRequestError as e:
        logging.error(f"Stripe API error: {str(e)}")
        return create_error_response("Invalid Subscription ID", HTTPStatus.NOT_FOUND)
    except stripe.error.StripeError as e:
        logging.error(f"Stripe API error: {str(e)}")
        return create_error_response(
            "An error occurred while processing your request", HTTPStatus.BAD_REQUEST
        )
    except NotFound as e:
        logging.warning(f"Not found: {str(e)}")
        return create_error_response(str(e), HTTPStatus.NOT_FOUND)
    except Exception as e:
        logging.exception(f"Unexpected error: {str(e)}")
        return create_error_response(
            "An unexpected error occurred", HTTPStatus.INTERNAL_SERVER_ERROR
        )


# CHECK STATUS SUBSCRIPTION FA (FINANCIAL ASSITANT)
@app.route("/api/subscription/<subscriptionId>/financialAssistant", methods=["GET"])
@require_client_principal  # Security: Enforce authentication
def get_financial_assistant_status(subscriptionId):
    """
    Check if Financial Assistant is added to a subscription.

    Args:
        subscriptionId (str): Unique Stripe Subscription ID

    Returns:
        JsonResponse: Response indicating if Financial Assistant is active in the subscription.
        Success format:
        {
            "data": {
                "financial_assistant_active": true,
                "subscription": {
                    "id": "<subscriptionId>",
                    "status": "active"
                }
            }
        }

    Raises:
        NotFound: If the subscription is not found. HttpCode: 404
        Unauthorized: If client principal ID is missing. HttpCode: 401
    """
    try:
        subscription = stripe.Subscription.retrieve(subscriptionId)

        financial_assistant_active = any(
            item.price.id == FINANCIAL_ASSISTANT_PRICE_ID
            for item in subscription["items"]["data"]
        )

        financial_assistant_item = next(
            (
                item
                for item in subscription["items"]["data"]
                if item.price.id == FINANCIAL_ASSISTANT_PRICE_ID
            ),
            None,
        )

        if financial_assistant_item is False:
            logging.info(
                f"Financial Assistant not actived in subscription: {subscriptionId}"
            )
            return (
                jsonify(
                    {
                        "data": {
                            "financial_assistant_active": False,
                            "message": "Financial Assistant is not active in this subscription.",
                        }
                    }
                ),
                HTTPStatus.OK,
            )

        if financial_assistant_item is None:
            logging.info(
                f"Financial Assistant not found in subscription: {subscriptionId}"
            )
            return (
                jsonify(
                    {
                        "data": {
                            "financial_assistant_active": False,
                            "message": "Financial Assistant not founded in this subscription.",
                        }
                    }
                ),
                HTTPStatus.OK,
            )

        return (
            jsonify(
                {
                    "data": {
                        "financial_assistant_active": financial_assistant_active,
                        "subscription": {
                            "id": subscription.id,
                            "status": subscription.status,
                            "price_id": financial_assistant_item.price.id,
                        },
                    }
                }
            ),
            HTTPStatus.OK,
        )

    except stripe.error.InvalidRequestError:
        logging.error(f"Invalid Subscription ID: {subscriptionId}")
        return (
            jsonify({"error": {"message": "Invalid Subscription ID", "status": 404}}),
            HTTPStatus.NOT_FOUND,
        )

    except stripe.error.StripeError as e:
        logging.error(f"Stripe API error: {str(e)}")
        return (
            jsonify(
                {
                    "error": {
                        "message": "An error occurred while processing your request.",
                        "status": 400,
                    }
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    except Exception as e:
        logging.exception(f"Unexpected error: {str(e)}")
        return (
            jsonify(
                {"error": {"message": "An unexpected error occurred", "status": 500}}
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@app.route("/api/subscriptions/<subscription_id>/tiers", methods=["GET"])
@require_client_principal  # Security: Enforce authentication
def get_subscription_details(subscription_id):
    try:
        # Retrieve the subscription from Stripe
        subscription = stripe.Subscription.retrieve(
            subscription_id, expand=["items.data.price.product"]
        )

        # Log subscription details
        logging.info(f"[webbackend] Retrieved subscription: {subscription.id}")

        # Determine the subscription tiers
        subscription_tiers = determine_subscription_tiers(subscription)

        # Prepare the response
        result = {
            "subscriptionId": subscription.id,
            "subscriptionTiers": subscription_tiers,
            "subscriptionData": {
                "status": subscription.status,
                "current_period_end": subscription.current_period_end,
                "items": [
                    {
                        "product_id": item.price.product.id,
                        "product_name": item.price.product.name,
                        "price_id": item.price.id,
                        "price_nickname": item.price.nickname,
                        "unit_amount": item.price.unit_amount,
                        "currency": item.price.currency,
                        "quantity": item.quantity,
                    }
                    for item in subscription["items"]["data"]
                ],
            },
        }

        return jsonify(result), 200
    except stripe.error.InvalidRequestError as e:
        logging.exception("Invalid subscription ID provided")
        return jsonify({"error": "Invalid subscription ID provided."}), 400
    except stripe.error.AuthenticationError:
        logging.exception("Authentication with Stripe's API failed")
        return jsonify({"error": "Authentication with Stripe failed."}), 500
    except stripe.error.APIConnectionError:
        logging.exception("Network communication with Stripe failed")
        return jsonify({"error": "Network communication with Stripe failed."}), 502
    except stripe.error.StripeError as e:
        logging.exception("Stripe error occurred")
        return jsonify({"error": "An error occurred with Stripe."}), 500
    except Exception as e:
        logging.exception("Exception in /api/subscription/<subscription_id>/tiers")
        return jsonify({"error": str(e)}), 500


def determine_subscription_tiers(subscription):
    """
    Determines the subscription tiers based on the products and prices in the Stripe subscription.
    Updated to include 'Premium' tiers.
    """
    tiers = []

    # Flags to identify which products and prices are included
    has_ai_assistant_basic = False
    has_ai_assistant_custom = False
    has_ai_assistant_premium = False
    has_financial_assistant = False

    # Iterate through subscription items
    for item in subscription["items"]["data"]:
        product = item["price"]["product"]
        product_name = product.get("name", "").lower()
        nickname = (
            item["price"]["nickname"]
            if item.get("price")
            and isinstance(item["price"], dict)
            and "nickname" in item["price"]
            else None
        )
        price_nickname = nickname.lower() if nickname else ""
        if "ai assistant" in product_name:
            if "basic" in price_nickname:
                has_ai_assistant_basic = True
            elif "custom" in price_nickname:
                has_ai_assistant_custom = True
            elif "premium" in price_nickname:
                has_ai_assistant_premium = True
        elif "financial assistant" in product_name:
            has_financial_assistant = True

    # Determine tiers based on flags
    if has_ai_assistant_basic:
        tiers.append("Basic")
    if has_ai_assistant_custom:
        tiers.append("Custom")
    if has_ai_assistant_premium:
        tiers.append("Premium")
    if has_financial_assistant:
        tiers.append("Financial Assistant")

    # Combine tiers into possible combinations
    if has_financial_assistant:
        if has_ai_assistant_basic:
            tiers.append("Basic + Financial Assistant")
        if has_ai_assistant_custom:
            tiers.append("Custom + Financial Assistant")
        if has_ai_assistant_premium:
            tiers.append("Premium + Financial Assistant")

    return tiers

@app.route('/api/subscriptions/<subscription_id>/change', methods=['PUT'])
def change_subscription(subscription_id):
    try:
        
        data = request.json
        new_plan_id = data.get('new_plan_id')
        if not new_plan_id:
            return jsonify({'error': 'new_plan_id is required'}), 400

        # Retrieve subscription from Stripe
        stripe_subscription = stripe.Subscription.retrieve(subscription_id)
        if not stripe_subscription or stripe_subscription['status'] == 'canceled':
            return jsonify({'error': 'Subscription not found or is already canceled'}), 404

        # Update the plan, which is reflected and charged when changing it
        updated_subscription = stripe.Subscription.modify(
            subscription_id,
            items=[{
                'id': stripe_subscription['items']['data'][0]['id'],
                'price': new_plan_id,
            }],
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name":request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
                "modification_type": "subscription_tier_change",
            },
            proration_behavior='none',  # No proration
            billing_cycle_anchor='now',  # Change the billing cycle so that it is charged at that moment
            cancel_at_period_end=False  # Do not cancel the subscription
        )

        result = {
            'message': 'Subscription change successfully',
            'subscription': updated_subscription
        }

        return jsonify(result), 200

    except stripe.error.InvalidRequestError as e:
        return jsonify({'error': f'Invalid request: {str(e)}'}), 400
    except stripe.error.AuthenticationError:
        return jsonify({'error': 'Authentication with Stripe API failed'}), 403
    except stripe.error.PermissionError:
        return jsonify({'error': 'Permission error when accessing the Stripe API'}), 403
    except stripe.error.RateLimitError:
        return jsonify({'error': 'Too many requests to Stripe API, please try again later'}), 429
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Stripe API error: {str(e)}'}), 500

    except Exception as e:
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@app.route('/api/subscriptions/<subscription_id>/cancel', methods=['DELETE'])
def cancel_subscription(subscription_id):
    try:

        subscription = stripe.Subscription.retrieve(subscription_id)

        if not subscription:
            return jsonify({'message': 'Subscription not found'}), 404
        
        canceled_subscription = stripe.Subscription.delete(subscription_id)

        return jsonify({'message': 'Subscription canceled successfully'}), 200

    except stripe.error.InvalidRequestError as e:
        return jsonify({'message': 'Invalid subscription ID'}), 404
    except stripe.error.AuthenticationError as e:
        return jsonify({'message': 'Unauthorized access'}), 403
    except Exception as e:
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500
    
################################################
# Financial Doc Ingestion
################################################

from financial_doc_processor import *
from utils import *
from sec_edgar_downloader import Downloader
from app_config import FILING_TYPES, BASE_FOLDER


doc_processor = FinancialDocumentProcessor()  # from financial_doc_processor


@app.route("/api/SECEdgar/financialdocuments", methods=["GET"])
def process_edgar_document():
    """
    Process a single financial document from SEC EDGAR.

    Args for payload:
        equity_id (str): Stock symbol/ticker (e.g., 'AAPL')
        filing_type (str): SEC filing type (e.g., '10-K')
        after_date (str, optional): Filter for filings after this date (YYYY-MM-DD)

    Returns:
        JSON Response with processing status and results

    Raises:
        400: Invalid request parameters
        404: Document not found
        500: Internal server error
    """
    try:
        # Validate request and setup
        if not check_and_install_wkhtmltopdf():
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Failed to install required dependency wkhtmltopdf",
                        "code": 500,
                    }
                ),
                500,
            )

        # Get and validate parameters
        data = request.get_json()
        if not data:
            return (
                jsonify(
                    {"status": "error", "message": "No data provided", "code": 400}
                ),
                400,
            )

        # Extract and validate parameters
        equity_id = data.get("equity_id")
        filing_type = data.get("filing_type")
        after_date = data.get("after_date", None)

        if not equity_id or not filing_type:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Both equity_id and filing_type are required",
                        "code": 400,
                    }
                ),
                400,
            )

        if filing_type not in FILING_TYPES:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Invalid filing type. Must be one of: {FILING_TYPES}",
                        "code": 400,
                    }
                ),
                400,
            )

        # Download filing
        download_result = doc_processor.download_filing(
            equity_id, filing_type, after_date
        )

        if download_result.get("status") != "success":
            return jsonify(download_result), download_result.get("code", 500)

        # Process and upload document
        upload_result = doc_processor.process_and_upload(equity_id, filing_type)
        return jsonify(upload_result), upload_result.get("code", 500)

    except Exception as e:
        logger.error(f"API execution failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e), "code": 500}), 500


from tavily_tool import TavilySearch


@app.route("/api/web-search", methods=["POST"])
def web_search():
    """
    Endpoint for multiple web search

    Expected Json body:
    {
        "query": "search query", //required
        "mode": "news" or "general", default is "news" //required
        "max_results": optional int, default = 2 //optional
        "include_domains": optional list of strings, default = None //
        "search_days": optional int, default = 30 //
    }
    """
    try:
        data = request.get_json()

        # validate required fields:
        if not data or "query" not in data:
            logger.error("Missing required field: 'query'")
            return jsonify({"error": "Missing required field: 'query'"}), 400

        # get optional parameters
        mode = data.get("mode", "news")
        max_results = data.get("max_results", 2)
        if not isinstance(max_results, int) or max_results < 1:
            logger.error(f"Invalid max_results: {max_results}")
            return (
                jsonify(
                    {"error": "Invalid max_results. Please provide a positive integer."}
                ),
                400,
            )
        include_domains = data.get("include_domains", None)
        if include_domains is not None and not isinstance(include_domains, list):
            logger.error(f"Invalid include_domains: {include_domains}")
            return (
                jsonify(
                    {
                        "error": "Invalid include_domains. Please provide a list of strings."
                    }
                ),
                400,
            )

        search_days = data.get("search_days", 30)

        # initialize searcher
        logger.info("Initializing TavilySearch")
        try:
            searcher = TavilySearch(
                max_results=max_results,
                include_domains=include_domains,
                search_days=search_days,
            )
        except ValueError as e:
            logger.error(f"Error initializing TavilySearch: {e}")
            return jsonify({"error": f"Invalid configuration: {str(e)}"}), 400

        # perform search based on mode. If mode is not provided, default to news
        if mode.lower() == "news":
            logger.info("Performing news search")
            results = searcher.search_news(data["query"])
        elif mode.lower() == "general":
            logger.info("Performing general search")
            results = searcher.search_general(data["query"])
        else:
            logger.error("Invalid mode. Please use 'news' or 'general'.")
            return (
                jsonify({"error": "Invalid mode. Please use 'news' or 'general'."}),
                400,
            )

        # format results
        logger.info("Formatting search results")
        formatted_results = searcher.format_result(results)

        logger.info("Search completed successfully")
        return jsonify(formatted_results)

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        return (
            jsonify({"error": "An error occurred while processing the request."}),
            500,
        )


from app_config import IMAGE_PATH
from summarization import DocumentSummarizer


@app.route("/api/SECEdgar/financialdocuments/summary", methods=["POST"])
def generate_summary():
    """
    Endpoint to generate a summary of financial documents from SEC Edgar.

    Request Payload Example:
    {
        "equity_name": "MS",          # The name of the equity (e.g., 'MS' for Morgan Stanley)
        "financial_type": "10-K"      # The type of financial document (e.g., '10-K' for annual reports)
    }

    Required Fields:
    - equity_name (str): The name of the equity.
    - financial_type (str): The type of financial document.

    Both fields must be non-empty strings.
    """
    try:
        try:
            data = request.get_json()
            if not data:
                return (
                    jsonify(
                        {
                            "error": "Invalid request",
                            "details": "Request body is requred and must be a valid JSON object",
                        }
                    ),
                    400,
                )
            equity_name = data.get("equity_name")
            financial_type = data.get("financial_type")

            if not all([equity_name, financial_type]):
                return (
                    jsonify(
                        {
                            "error": "Missing required fields",
                            "details": "equity_name and financial_type are required",
                        }
                    ),
                    400,
                )

            if not isinstance(equity_name, str) or not isinstance(financial_type, str):
                return (
                    jsonify(
                        {
                            "error": "Invalid input type",
                            "details": "equity_name and financial_type must be strings",
                        }
                    ),
                    400,
                )

            if not equity_name.strip() or not financial_type.strip():
                return (
                    jsonify(
                        {
                            "error": "Empty input",
                            "details": "equity_name and financial_type cannot be empty",
                        }
                    ),
                    400,
                )

        except ValueError as e:
            return (
                jsonify(
                    {
                        "error": "Invalid input",
                        "details": f"Failed to parse request body: {str(e)}",
                    }
                ),
                400,
            )

        # Initialize components with error handling
        try:
            blob_manager = BlobStorageManager()
            summarizer = DocumentSummarizer()
        except ConnectionError as e:
            logging.error(f"Failed to connect to blob storage: {e}")
            return (
                jsonify(
                    {
                        "error": "Connection error",
                        "details": "Failed to connect to storage service",
                    }
                ),
                503,
            )
        except Exception as e:
            logging.error(f"Failed to initialize components: {e}")
            return (
                jsonify({"error": "Service initialization failed", "details": str(e)}),
                500,
            )

        # Reset directories
        try:
            reset_local_dirs()
        except PermissionError as e:
            logging.error(f"Permission error while cleaning up directories: {str(e)}")
            return (
                jsonify(
                    {
                        "error": "Permission error",
                        "details": "Failed to clean up directories due to permission issues",
                    }
                ),
                500,
            )
        except OSError as e:
            logging.error(f"OS error while reseting directories: {str(e)}")
            return (
                jsonify(
                    {
                        "error": "System error",
                        "details": "Failed to prepare working directories",
                    }
                ),
                500,
            )
        except Exception as e:
            logging.error(f"Failed to clean up directories: {e}")
            return (
                jsonify(
                    {
                        "error": "Cleanup failed",
                        "details": "Failed to clean up directories to prepare for processing",
                    }
                ),
                500,
            )

        # Download documents

        downloaded_files = blob_manager.download_documents(
            equity_name=equity_name, financial_type=financial_type
        )

        # Process documents
        for file_path in downloaded_files:
            doc_id = extract_pdf_pages_to_images(file_path, IMAGE_PATH)

        # Generate summaries
        all_summaries = summarizer.process_document_images(IMAGE_PATH)
        final_summary = summarizer.generate_final_summary(all_summaries)

        # Save the summary locally and upload to blob
        local_output_path = f"pdf/{financial_type}_{equity_name}_summary.pdf"
        save_str_to_pdf(final_summary, local_output_path)

        # Upload summary to blob
        document_paths = create_document_paths(
            local_output_path, equity_name, financial_type
        )

        # upload to blob and get the blob path/remote links
        upload_results = blob_manager.upload_to_blob(document_paths)

        blob_path = upload_results[equity_name][financial_type]["blob_path"]
        blob_url = upload_results[equity_name][financial_type]["blob_url"]

        # Clean up local directories
        try:
            reset_local_dirs()
        except Exception as e:
            logging.error(f"Failed to clean up directories: {e}")

        return (
            jsonify(
                {
                    "status": "success",
                    "equity_name": equity_name,
                    "financial_type": financial_type,
                    "blob_path": blob_path,
                    "remote_blob_url": blob_url,
                    "summary": final_summary,
                }
            ),
            200,
        )

    except Exception as e:
        logging.error(f"Unexpected error: {e}", exc_info=True)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    finally:
        # Ensure cleanup happens
        try:
            reset_local_dirs()
        except PermissionError as e:
            logging.error(f"Permission error while cleaning up directories: {str(e)}")
        except OSError as e:
            logging.error(f"OS error while reseting directories: {str(e)}")
        except Exception as e:
            logging.error(f"Failed to clean up: {e}")


from utils import _extract_response_data


@app.route("/api/SECEdgar/financialdocuments/process-and-summarize", methods=["POST"])
def process_and_summarize_document():
    """
    Process and summarize a financial document in sequence.

    Args:
        equity_id (str): Stock symbol/ticker (e.g., 'AAPL')
        filing_type (str): SEC filing type (e.g., '10-K')
        after_date (str, optional): Filter for filings after this date (YYYY-MM-DD)

    Returns:
        JSON Response with structure:
        {
            "status": "success",
            "edgar_data_process": {...},
            "summary_process": {...}
        }

    Raises:
        400: Invalid request parameters
        404: Document not found
        500: Internal server error
    """
    # Input validation
    try:
        data = request.get_json()
        if not data:
            return (
                jsonify(
                    {
                        "status": "error",
                        "error": "Invalid request",
                        "details": "Request body is requred and must be a valid JSON object",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                400,
            )

        # Validate required fields
        required_fields = ["equity_id", "filing_type"]
        if not all(field in data for field in required_fields):
            return (
                jsonify(
                    {
                        "status": "error",
                        "error": "Missing required fields",
                        "details": f"Missing required fields: {', '.join(required_fields)}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                400,
            )

        # Validate filing type
        if data["filing_type"] not in FILING_TYPES:
            return (
                jsonify(
                    {
                        "status": "error",
                        "error": "Invalid filing type",
                        "details": f"Invalid filing type. Must be one of: {', '.join(FILING_TYPES)}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                400,
            )

        # Validate date format if provided
        if "after_date" in data:
            try:
                datetime.strptime(data["after_date"], "%Y-%m-%d")
            except ValueError:
                return (
                    jsonify(
                        {
                            "status": "error",
                            "error": "Invalid date format",
                            "details": "Use YYYY-MM-DD",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    400,
                )

    except ValueError as e:
        logger.error(f"Invalid request data: {str(e)}")
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Invalid request data",
                    "details": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ),
            400,
        )

    try:
        # Step 1: Process document
        logger.info(
            f"Starting document processing for {data['equity_id']} {data['filing_type']}"
        )
        with app.test_request_context(
            "/api/SECEdgar/financialdocuments", method="GET", json=data
        ) as ctx:
            process_result = process_edgar_document()
            process_data = _extract_response_data(process_result)

            if process_data.get("status") != "success":
                logger.error(
                    f"Document processing failed: {process_data.get('message')}"
                )
                if process_data.get("code") == 404:
                    return (
                        jsonify(
                            {
                                "status": "not_found",
                                "error": process_data.get("message"),
                                "code": process_data.get("code"),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        404,
                    )
                else:
                    return (
                        jsonify(
                            {
                                "status": "error",
                                "error": process_data.get("message"),
                                "code": process_data.get(
                                    "code", HTTPStatus.INTERNAL_SERVER_ERROR
                                ),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                        500,
                    )

        # Step 2: Generate summary
        logger.info(
            f"Starting summary generation for {data['equity_id']} {data['filing_type']}"
        )
        summary_payload = {
            "equity_name": data["equity_id"],
            "financial_type": data["filing_type"],
        }

        with app.test_request_context(
            "/api/SECEdgar/financialdocuments/summary",
            method="POST",
            json=summary_payload,
        ) as ctx:
            summary_result = generate_summary()
            summary_data = _extract_response_data(summary_result)

            if summary_data.get("status") != "success":
                logger.error(
                    f"Summary generation failed: {summary_data.get('message')}"
                )
                return (
                    jsonify(
                        {
                            "status": "error",
                            "error": summary_data.get("message"),
                            "details": summary_data.get(
                                "code", HTTPStatus.INTERNAL_SERVER_ERROR
                            ),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                    500,
                )

        # Return combined results
        response_data = {
            "status": "success",
            "edgar_data_process": process_data,
            "summary_process": summary_data,
        }

        logger.info(
            f"Successfully processed and summarized document for {data['equity_id']}"
        )
        return jsonify(response_data), 200

    except Exception as e:
        logger.exception(
            f"Unexpected error in process_and_summarize_document: {str(e)}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "An unexpected error occurred while processing the document",
                    "details": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ),
            500,
        )


from pathlib import Path
from curation_report_generator import graph
from financial_doc_processor import markdown_to_html, BlobStorageManager
from financial_agent_utils.curation_report_utils import (
    REPORT_TOPIC_PROMPT_DICT,
    InvalidReportTypeError,
    ReportGenerationError,
    StorageError,
)
from financial_agent_utils.curation_report_config import (
    WEEKLY_CURATION_REPORT,
    ALLOWED_CURATION_REPORTS,
    NUM_OF_QUERIES,
)


@app.route("/api/reports/generate/curation", methods=["POST"])
def generate_report():
    try:
        data = request.get_json()
        report_topic_rqst = data["report_topic"]  # Will raise KeyError if missing

        # Validate report type
        if report_topic_rqst not in ALLOWED_CURATION_REPORTS:
            raise InvalidReportTypeError(
                f"Invalid report type. Please choose from: {ALLOWED_CURATION_REPORTS}"
            )
        if report_topic_rqst == "Company_Analysis" and not data.get("company_name"):
            raise ValueError("company_name is required for Company Analysis report")
        
        if report_topic_rqst == "Company_Analysis":
            # modify the prompt to include the company name
            report_topic_prompt = REPORT_TOPIC_PROMPT_DICT[report_topic_rqst].replace("company_name", data["company_name"])
        else:
            report_topic_prompt = REPORT_TOPIC_PROMPT_DICT[report_topic_rqst]

        search_days = 10 if report_topic_rqst in WEEKLY_CURATION_REPORT else 30

        # Generate report
        logger.info(f"Generating report for {report_topic_rqst}")
        report = graph.invoke(
            {
                "topic": report_topic_prompt,  # this is the prompt to to trigger the agent
                "report_type": report_topic_rqst,  # this is user request
                "number_of_queries": NUM_OF_QUERIES,
                "search_mode": "news",
                "search_days": search_days,
            }
        )

        # Generate file path
        current_date = datetime.now(timezone.utc)
        week_of_month = (current_date.day - 1) // 7 + 1
        if report_topic_rqst in WEEKLY_CURATION_REPORT:
            file_path = Path(
                f"Reports/Curation_Reports/{report_topic_rqst}/{current_date.strftime('%B_%Y')}/Week_{week_of_month}.html"
            )
        elif report_topic_rqst == "Company_Analysis":
            # add company name to the file path
            company_name = str(data["company_name"]).replace(" ", "_")  # Ensure string and replace spaces
            logger.info(f"Company name before replacement: {data['company_name']}")
            logger.info(f"Company name after replacement: {company_name}")
            file_path = Path(
                f"Reports/Curation_Reports/{report_topic_rqst}/{company_name}/{current_date.strftime('%B_%Y')}.html"
            )
        else:
            file_path = Path(
                f"Reports/Curation_Reports/{report_topic_rqst}/{current_date.strftime('%B_%Y')}.html"
            )

        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Convert and save report
        logger.info("Converting markdown to html")
        markdown_to_html(report["final_report"], str(file_path))

        logger.info("Uploading to blob storage")
        blob_storage_manager = BlobStorageManager()
        if report_topic_rqst in WEEKLY_CURATION_REPORT:
            blob_folder = f"Reports/Curation_Reports/{report_topic_rqst}/{current_date.strftime('%B_%Y')}"
        elif report_topic_rqst == "Company_Analysis":
            blob_folder = f"Reports/Curation_Reports/{report_topic_rqst}/{company_name}"
        else:
            blob_folder = f"Reports/Curation_Reports/{report_topic_rqst}"

        upload_result = blob_storage_manager.upload_to_blob(
            file_path=str(file_path), blob_folder=blob_folder
        )

        # Cleanup files
        logger.info("Cleaning up local files")
        try:
            # Use shutil.rmtree to recursively remove directory and all contents
            import shutil

            if file_path.exists():
                shutil.rmtree(file_path.parent, ignore_errors=True)
            logger.info(f"Successfully removed directory: {file_path.parent}")
        except Exception as e:
            logger.warning(
                f"Error while cleaning up directory {file_path.parent}: {str(e)}"
            )
            # Continue execution even if cleanup fails
            pass
        if report_topic_rqst == "Company_Analysis":
            return jsonify(
                {
                "status": "success",
                "message": f"Company Analysis report generated for {data['company_name']}",
                "report_url": upload_result["blob_url"],
            }
        )
        else:
            return jsonify(
                {
                "status": "success",
                "message": f"Report generated for {report_topic_rqst}",
                "report_url": upload_result["blob_url"],
            }
        )

    except KeyError:
        logger.error("Missing report_topic in request")
        return jsonify({"error": "report_topic is required"}), 400

    except InvalidReportTypeError as e:
        logger.error(f"Invalid report topic: {str(e)}")
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        logger.error(
            f"Unexpected error during report generation: {str(e)}", exc_info=True
        )
        return (
            jsonify(
                {"error": "An unexpected error occurred while generating the report"}
            ),
            500,
        )


from utils import EmailServiceError, EmailService


@app.route("/api/reports/email", methods=["POST"])
def send_email_endpoint():
    """Send an email with optional attachments.
    Note: currently attachment path has to be in the same directory as the app.py file.

    Expected JSON payload:
    {
        "subject": "Email subject",
        "html_content": "HTML formatted content",
        "recipients": ["email1@domain.com", "email2@domain.com"],
        "attachment_path": "path/to/attachment.pdf"  # Optional, use forward slashes.
        "save_email": "yes"  # Optional, default is "no"
    }

    Returns:
        JSON response indicating success/failure
    """
    try:
        # Get and validate request data
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        # Validate required fields
        required_fields = {"subject", "html_content", "recipients"}
        missing_fields = required_fields - set(data.keys())
        if missing_fields:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f'Missing required fields: {", ".join(missing_fields)}',
                    }
                ),
                400,
            )

        # Validate recipients format
        if not isinstance(data["recipients"], list):
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Recipients must be provided as a list",
                    }
                ),
                400,
            )

        if not data["recipients"]:
            return (
                jsonify(
                    {"status": "error", "message": "At least one recipient is required"}
                ),
                400,
            )

        # Validate attachment path if provided
        attachment_path = data.get("attachment_path")
        if attachment_path:
            # Convert Windows path to proper format
            attachment_path = Path(attachment_path.replace("\\", "/")).resolve()
            if not attachment_path.exists():
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": f"Attachment file not found: {attachment_path}",
                        }
                    ),
                    400,
                )

            # Update the attachment_path in data
            data["attachment_path"] = str(attachment_path)

        # Validate email configuration
        email_config = {
            "smtp_server": os.getenv("EMAIL_HOST"),
            "smtp_port": os.getenv("EMAIL_PORT"),
            "username": os.getenv("EMAIL_USER"),
            "password": os.getenv("EMAIL_PASS"),
        }

        if not all(email_config.values()):
            logger.error("Missing email configuration environment variables")
            return (
                jsonify(
                    {"status": "error", "message": "Email service configuration error"}
                ),
                500,
            )

        # Initialize and send email
        email_service = EmailService(**email_config)

        email_params = {
            "subject": data["subject"],
            "html_content": data["html_content"],
            "recipients": data["recipients"],
            "attachment_path": data.get("attachment_path"),
        }

        # send the email
        email_service.send_email(**email_params)

        # save the email to blob storage
        if data.get("save_email", "no").lower() == "yes":
            blob_name = email_service._save_email_to_blob(**email_params)
            logger.info(f"Email has been saved to blob storage: {blob_name}")
        else:
            logger.info(
                "Email has not been saved to blob storage because save_email is set to no"
            )
            blob_name = None

        return (
            jsonify(
                {
                    "status": "success",
                    "message": "Email sent successfully",
                    "blob_name": blob_name,
                }
            ),
            200,
        )

    except EmailServiceError as e:
        logger.error(f"Email service error: {str(e)}")
        return (
            jsonify({"status": "error", "message": f"Failed to send email: {str(e)}"}),
            500,
        )

    except BlobUploadError as e:
        logger.error(f"Blob upload error: {str(e)}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"Email has been sent, but failed to upload to blob storage: {str(e)}",
                }
            ),
            500,
        )

    except Exception as e:
        logger.exception("Unexpected error in send_email_endpoint")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"An unexpected error occurred: {str(e)}",
                }
            ),
            500,
        )


from rp2email import process_and_send_email


@app.route("/api/reports/digest", methods=["POST"])
def digest_report():
    """
    Process report and send email .

    Expected payload:
    {
        "blob_link": "https://...",
        "recipients": ["email1@domain.com"],
        "attachment_path": "path/to/attachment.pdf"  # Optional, use forward slashes.
        By default, it will automatically attach the document from the blob link (PDF converted). Select "no" to disable this feature.
        "email_subject": "Custom email subject"  # Optional
        "save_email": "yes"  # Optional, default is "yes"
    }
    """
    try:
        # Validate request data
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        # Validate required fields
        if "blob_link" not in data or "recipients" not in data:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Missing required fields: blob_link and recipients",
                    }
                ),
                400,
            )

        # Process report and send email
        success = process_and_send_email(
            blob_link=data["blob_link"],
            recipients=data["recipients"],
            attachment_path=data.get("attachment_path", None),
            email_subject=data.get("email_subject", None),
            save_email=data.get("save_email", "yes"),
            is_summarization=data.get("is_summarization", False),
        )

        if success:
            return (
                jsonify(
                    {
                        "status": "success",
                        "message": "Report processed and email sent successfully",
                    }
                ),
                200,
            )
        else:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Failed to process report and send email",
                    }
                ),
                500,
            )

    except Exception as e:
        logger.exception("Error processing report and sending email")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/reports/storage/files", methods=["GET"])
def list_blobs():
    """
    List blobs i nteh container with optional filtering

    Query params:
    - prefix(str): filter blobs by prefix
    - include_metadata(str): include metadata in results
    - max_results(int): maximum number of results to return
    - container_name(str): name of the container to list blobs from

    Returns:
        JSON response with list of blobs

    Example Payload:
    {
        "prefix": "Reports/Curation_Reports/Monthly_Economics/",
        "include_metadata": "yes",
        "max_results": 10,
        "container_name": "documents"
    }
    """

    try:
        # get query params
        data = request.get_json()

        container_name = data.get("container_name")
        prefix = data.get("prefix", None)

        include_metadata = data.get("include_metadata", "no").lower()

        # convert max_results to int
        max_results = data.get("max_results", 10)

        if not container_name:
            return (
                jsonify(
                    {"status": "error", "message": "Blob container name is required"}
                ),
                400,
            )

        blob_storage_manager = BlobStorageManager()
        blobs = blob_storage_manager.list_blobs_in_container(
            container_name=container_name,
            prefix=prefix,
            include_metadata=include_metadata,
            max_results=max_results,
        )

        return jsonify({"status": "success", "data": blobs, "count": len(blobs)}), 200

    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400

    except Exception as e:
        logger.exception("Unexpected error in list_blobs")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/logs/", methods=["POST"])
def get_logs():
    try: 
        data = request.get_json()
        if data == None:
            return create_error_response('Request data is required', 400)
        organization_id = data.get("organization_id")
        if not organization_id:
            return create_error_response('Organization ID is required', 400)
    except Exception as e:
        return create_error_response(str(e), 400)
    try:
        items = get_audit_logs(organization_id)
        if not items:
            return create_success_response([], 204)
        return create_success_response(items)
    except InvalidParameterError as e:
        return create_error_response(str(e), 400)
    except Exception as e:
        logger.exception("Unexpected error in get_logs")
        return create_error_response("Internal Server Error", 500)
    


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
