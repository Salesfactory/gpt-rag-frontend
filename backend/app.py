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
from azure.keyvault.secrets import SecretClient
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
import smtplib
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound
from utils import (
    create_error_response,
    create_success_response,
    SubscriptionError,
    InvalidSubscriptionError,
    InvalidFinancialPriceError,
    require_client_principal,
)
import stripe.error


load_dotenv()

SPEECH_REGION = os.getenv("SPEECH_REGION")
ORCHESTRATOR_ENDPOINT = os.getenv("ORCHESTRATOR_ENDPOINT")
ORCHESTRATOR_URI = os.getenv("ORCHESTRATOR_URI", default="")
SETTINGS_ENDPOINT = ORCHESTRATOR_URI + "/settings"
FEEDBACK_ENDPOINT = ORCHESTRATOR_URI + "/feedback"
HISTORY_ENDPOINT = ORCHESTRATOR_URI + "/conversations"
CHECK_USER_ENDPOINT = ORCHESTRATOR_URI + "/checkUser"
SUBSCRIPTION_ENDPOINT = ORCHESTRATOR_URI + "/subscriptions"
INVITATIONS_ENDPOINT = ORCHESTRATOR_URI + "/invitations"
STORAGE_ACCOUNT = os.getenv("STORAGE_ACCOUNT")
FINANCIAL_ASSISTANT_ENDPOINT = ORCHESTRATOR_URI + "/financial-orc"
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


def get_secret(secretName):
    keyVaultName = os.environ["AZURE_KEY_VAULT_NAME"]
    KVUri = f"https://{keyVaultName}.vault.azure.net"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=KVUri, credential=credential)
    logging.info(f"[webbackend] retrieving {secretName} secret from {keyVaultName}.")
    retrieved_secret = client.get_secret(secretName)
    return retrieved_secret.value


SPEECH_KEY = get_secret("speechKey")

SPEECH_RECOGNITION_LANGUAGE = os.getenv("SPEECH_RECOGNITION_LANGUAGE")
SPEECH_SYNTHESIS_LANGUAGE = os.getenv("SPEECH_SYNTHESIS_LANGUAGE")
SPEECH_SYNTHESIS_VOICE_NAME = os.getenv("SPEECH_SYNTHESIS_VOICE_NAME")
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CSV_STORAGE_NAME = os.getenv("AZURE_CSV_STORAGE_CONTAINER", "files")

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
        function_key: str,
        check_user_endpoint: str,
        timeout: int = 10,
    ) -> Dict[str, Any]:
        """
        Check user authorization with the orchestrator using POST request

        Args:
            client_principal_id: The user's principal ID from Azure B2C
            client_principal_name: The user's principal name from Azure B2C
            email: The user's email address
            function_key: The function key for authentication
            check_user_endpoint: The endpoint URL for checking user authorization
            timeout: Request timeout in seconds (default: 10)

        Returns:
            Dict containing the authorization response

        Raises:
            requests.RequestException: If the request fails
            ValueError: If the response format is invalid
            TimeoutError: If the request times out
        """
        try:
            # Prepare request payload
            payload = {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "id": client_principal_id,
                "name": client_principal_name,
                "email": email,
            }

            # Prepare headers
            headers = {
                "Content-Type": "application/json",
                "x-functions-key": function_key,
            }

            logger.info(
                f"[auth] Checking authorization for user {client_principal_id} "
                f"with email {email} at {datetime.utcnow().isoformat()}"
            )

            # Make the request using a session for better performance
            with requests.Session() as session:
                response = session.post(
                    check_user_endpoint,
                    headers=headers,
                    data=json.dumps(payload),
                    timeout=timeout,
                )

                # Log the response (truncated for security)
                truncated_response = (
                    response.text[:500] + "..."
                    if len(response.text) > 500
                    else response.text
                )
                logger.info(f"[auth] Authorization response: {truncated_response}")

                # Raise an exception for bad status codes
                response.raise_for_status()

                # Parse response
                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    logger.error(f"[auth] Failed to parse JSON response: {str(e)}")
                    raise ValueError("Invalid JSON response") from e

                # Validate response format if needed
                if not data:
                    raise ValueError("Empty response received")

                return data

        except requests.Timeout as e:
            logger.error(
                f"[auth] Request timed out after {timeout} seconds for "
                f"user {client_principal_id}: {str(e)}"
            )
            raise TimeoutError(f"Request timed out after {timeout} seconds") from e

        except requests.RequestException as e:
            logger.error(
                f"[auth] Request failed for user {client_principal_id}: {str(e)}"
            )
            raise

        except Exception as e:
            logger.error(
                f"[auth] Unexpected error checking authorization for "
                f"user {client_principal_id}: {str(e)}"
            )
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
        function_key = get_secret(key_secret_name)
        if not function_key:
            raise ValueError(f"Secret {key_secret_name} not found in Key Vault")

        check_user_endpoint = CHECK_USER_ENDPOINT
        client_principal_name = context["user"]["name"]
        email = context["user"]["emails"][0]
        # Check user authorization
        user_profile = UserService.check_user_authorization(
            client_principal_id,
            client_principal_name,
            email,
            function_key,
            check_user_endpoint,
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

        functionKey = get_secret(keySecretName)
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
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--conversations"
        functionKey = get_secret(keySecretName)
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
        url = HISTORY_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps({"user_id": client_principal_id})
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /chat-history")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat-conversation/<chat_id>", methods=["GET"])
def getChatConversation(chat_id):

    if chat_id is None:
        return jsonify({"error": "Missing chatId parameter"}), 400

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    try:
        keySecretName = "orchestrator-host--conversations"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        return jsonify({"error": f"Error getting function key: {e}"}), 500

    try:
        url = f"{HISTORY_ENDPOINT}/?id={chat_id}"
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps({"user_id": client_principal_id})
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")

        return response.text, response.status_code
    except Exception as e:
        logging.exception("[webbackend] exception in /get-chat-history")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat-conversations/<chat_id>", methods=["DELETE"])
def deleteChatConversation(chat_id):
    try:
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        keySecretName = "orchestrator-host--conversations"
        functionKey = get_secret(keySecretName)

        url = f"{HISTORY_ENDPOINT}/?id={chat_id}"
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps({"user_id": client_principal_id})

        response = requests.delete(url, headers=headers, data=payload)
        return response.text, response.status_code
    except Exception as e:
        logging.exception("[webbackend] exception in /delete-chat-conversation")
        return jsonify({"error": str(e)}), 500


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
    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {"price": price, "quantity": 1},
            ],
            mode="subscription",
            client_reference_id=userId,
            metadata={"userId": userId, "organizationId": organizationId},
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


@app.route("/api/stripe", methods=["GET"])
def getStripe():
    try:
        keySecretName = "stripeKey"
        functionKey = get_secret(keySecretName)
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
            functionKey = get_secret(keySecretName)
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
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--settings"
        functionKey = get_secret(keySecretName)
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
        url = SETTINGS_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["POST"])
def setSettings():
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
        temperature = float(request.json["temperature"])
    except:
        temperature = 0

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--settings"
        functionKey = get_secret(keySecretName)
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
        url = SETTINGS_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "temperature": temperature,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
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
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--feedback"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--feedback")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = FEEDBACK_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "conversation_id": conversation_id,
                "question": question,
                "answer": answer,
                "category": category,
                "feedback": feedback,
                "rating": rating,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
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

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        organizationId = request.args.get("organizationId")
        url = CHECK_USER_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"organizationId": organizationId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
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
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        userId = request.args.get("userId")
        url = CHECK_USER_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "DELETE", url, headers=headers, params={"id": userId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
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
    try:
        keySecretName = "orchestrator-host--invitations"
        functionKey = get_secret(keySecretName)
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
        organizationId = request.args.get("organizationId")
        url = INVITATIONS_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"organizationId": organizationId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /get-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/createInvitation", methods=["POST"])
def createInvitation():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    try:
        keySecretName = "orchestrator-host--invitations"
        functionKey = get_secret(keySecretName)
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
        organizationId = request.json["organizationId"]
        invitedUserEmail = request.json["invitedUserEmail"]
        role = request.json["role"]
        url = INVITATIONS_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps(
            {
                "invited_user_email": invitedUserEmail,
                "organization_id": organizationId,
                "role": role,
            }
        )
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /getUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/checkuser", methods=["POST"])
def checkUser():
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
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
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
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-organization-subscription", methods=["GET"])
def getOrganization():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    try:
        keySecretName = "orchestrator-host--subscriptions"
        functionKey = get_secret(keySecretName)
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
        organizationId = request.args.get("organizationId")
        url = SUBSCRIPTION_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"organizationId": organizationId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /get-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/create-organization", methods=["POST"])
def createOrganization():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--subscriptions"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            f"[webbackend] exception in /api/orchestrator-host--subscriptions {e}"
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
        organizationName = request.json["organizationName"]
        payload = json.dumps(
            {
                "id": client_principal_id,
                "organizationName": organizationName,
            }
        )
        url = SUBSCRIPTION_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /post-organization")
        return jsonify({"error": str(e)}), 500


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
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = CHECK_USER_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"id": client_principal_id}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /getUser")
        return jsonify({"error": str(e)}), 500


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
                "modification_type": "add_financial_assistant",
                "modification_time": datetime.now().isoformat(),
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
                "modification_type": "remove_financial_assistant",
                "modification_time": datetime.now().isoformat(),
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
