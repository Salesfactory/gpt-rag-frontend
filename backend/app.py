from flask import (
    current_app,
    Flask,
    request,
    jsonify,
    Response,
    send_from_directory,
    redirect,
    url_for,
    session,
    render_template,
    stream_with_context
)
from functools import wraps
import os
from dotenv import load_dotenv




import requests
import json
import stripe
from flask_cors import CORS
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from azure.identity import DefaultAzureCredential
from urllib.parse import unquote, urlparse, urlencode, urljoin
import uuid
from urllib.parse import urlparse
from identity.flask import Auth
from datetime import timedelta, datetime, timezone
import time

from typing import Dict, Any, Tuple, Optional
from tenacity import retry, wait_fixed, stop_after_attempt
from http import HTTPStatus  # Best Practice: Use standard HTTP status codes
from azure.cosmos.exceptions import CosmosHttpResponseError, CosmosResourceNotFoundError
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound

from gallery.blob_utils import get_gallery_items_by_org

# Load .env BEFORE importing modules that might read env at import time
load_dotenv(override=True)
import app_config

from shared.error_handling import (
    IncompleteConfigurationError,
    MissingRequiredFieldError,
    InvalidParameterError,
    MissingParameterError,
)

from utils import (
    create_error_response,
    create_success_response,
    delete_url_by_id,
    get_client_principal,
    get_set_user,
    get_setting,
    modify_url,
    require_client_principal,
    get_conversations,
    get_conversation,
    delete_conversation,
    get_organization_urls,
    add_or_update_organization_url,
    search_urls,
    set_settings,
    validate_url,
)

import stripe.error
from bs4 import BeautifulSoup
from urllib.parse import urlencode
from shared.cosmo_db import (
    get_cosmos_container,
    get_invitation_role,
    get_user_organizations,
    patch_organization_data,
    get_audit_logs,
    get_organization_subscription,
    create_organization,
)
from shared import clients
from data_summary.config import get_azure_openai_config
from data_summary.llm import PandasAIClient

from routes.report_jobs import bp as jobs_bp
from routes.organizations import bp as organizations
from routes.upload_source_document import bp as upload_source_document
from routes.user_documents import bp as user_documents
from routes.voice_customer import bp as voice_customer
from routes.categories import bp as categories
from routes.invitations import bp as invitations
from routes.users import bp as users

from _secrets import get_secret

from azure.storage.blob import (
    BlobServiceClient,
    generate_blob_sas,
    BlobSasPermissions,
)
from datetime import datetime, timedelta
from io import BytesIO
import pandas as pd
import logging

for _n in (
    "azure",
    "azure.identity",
    "azure.keyvault",
    "azure.core",
    "azure.core.pipeline.policies.http_logging_policy",
    "urllib3",
):
    logging.getLogger(_n).setLevel(logging.WARNING)
    
# Suppress Azure SDK logs (including Key Vault calls)
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)
logging.getLogger("azure.keyvault").setLevel(logging.WARNING)
logging.getLogger("azure.core").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)  
logging.getLogger("urllib3").setLevel(logging.WARNING)                                            
logging.getLogger("werkzeug").setLevel(logging.WARNING) 

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

DESCRIPTION_VALID_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls"]
# ==== BLOB STORAGE ====
BLOB_CONTAINER_NAME = "documents"
ORG_FILES_PREFIX = "organization_files"

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


SPEECH_RECOGNITION_LANGUAGE = os.getenv("SPEECH_RECOGNITION_LANGUAGE")
SPEECH_SYNTHESIS_LANGUAGE = os.getenv("SPEECH_SYNTHESIS_LANGUAGE")
SPEECH_SYNTHESIS_VOICE_NAME = os.getenv("SPEECH_SYNTHESIS_VOICE_NAME")
AZURE_CSV_STORAGE_NAME = os.getenv("AZURE_CSV_STORAGE_CONTAINER", "files")
ORCH_MASTER_KEY = "orchestrator-host--functionKey"


logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(app_config)
CORS(app)

# Enable compression for all responses
Compress(app)

# Initialize Flask-Limiter with basic configuration
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per hour", "100 per minute"],
    storage_uri="memory://",
    strategy="fixed-window",
)


def setup_llm() -> PandasAIClient:
    cfg = get_azure_openai_config(deployment_name="gpt-4.1")
    llm = PandasAIClient(
        cfg.endpoint, cfg.api_key, cfg.api_version, cfg.deployment_name
    )
    return llm


auth = Auth(
    app,
    client_id=os.getenv("AAD_CLIENT_ID"),
    client_credential=os.getenv("AAD_CLIENT_SECRET"),
    redirect_uri=os.getenv("AAD_REDIRECT_URI"),
    b2c_tenant_name=os.getenv("AAD_TENANT_NAME"),
    b2c_signup_signin_user_flow=os.getenv("AAD_POLICY_NAME"),
    b2c_edit_profile_user_flow=os.getenv("EDITPROFILE_USER_FLOW"),
)


@app.before_first_request
def setup_clients():
    print(f"[before_first_request] ", flush=True)
    clients.warm_up()  # idempotent
    current_app.config["llm"] = setup_llm()  # todo move to a client for panda AI
    current_app.config["blob_storage_manager"] = (
        BlobStorageManager()
    )  # TODO implement the new BlobStorageManager in the upload_sources.py (this is the only way that there is no pytest import issue) The issue was that when running all tests together, there was a complex import resolution problem where the utils module was not being found properly due to module caching issues and conflicts between test fixtures.
    current_app.config["auth"] = auth


@app.before_first_request
def _load_secrets_once():
    # Prefer env / Key Vault References; fallback to KV
    current_app.config["SPEECH_KEY"] = get_secret(
        "speechKey", env_name="SPEECH_KEY", ttl=60 * 60
    )
    # If you must keep function keys, give them a short TTL so rotations are picked up
    current_app.config["ORCH_FUNCTION_KEY"] = get_secret(
        "orchestrator-host--functionKey", env_name="ORCH_FUNCTION_KEY", ttl=15 * 60
    )
    # Storage: try to avoid connection strings; see section 3. If you must, still cache:
    current_app.config["AZURE_STORAGE_CONNECTION_STRING"] = get_secret(
        "storageConnectionString",
        env_name="AZURE_STORAGE_CONNECTION_STRING",
        ttl=60 * 60,
    )


app.register_blueprint(jobs_bp)
app.register_blueprint(organizations)
app.register_blueprint(upload_source_document)
app.register_blueprint(user_documents)
app.register_blueprint(voice_customer)
app.register_blueprint(categories)
app.register_blueprint(invitations)
app.register_blueprint(users)


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
        user_context: Dict[str, Any],
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
                "email": email,  # Default role, if necessary
            }

            # Call get_set_user to retrieve or create the user in the database
            user_response = get_set_user(client_principal)

            # Validate response
            if not user_response or "user_data" not in user_response:
                logger.error(
                    f"[auth] User data could not be retrieved for {client_principal_id}"
                )
                raise ValueError("Failed to retrieve user data")

            # Extract user data
            user_data = user_response["user_data"]

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
            logger.error(
                f"[auth] Validation error for user {client_principal_id}: {str(e)}"
            )
            raise

        except Exception as e:
            logger.error(
                f"[auth] Unexpected error validating user {client_principal_id}: {str(e)}"
            )
            raise


def store_request_params_in_session(keys=None):
    """
    Decorator to store specified request parameters into the Flask session.

    Args:
        keys (list, optional): A list of parameter keys to store.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if keys is not None:
                stored_params = []
                for key in keys:
                    if key in request.args:
                        session[key] = request.args[key]
                        stored_params.append(key)
                    elif key in request.form:
                        session[key] = request.form[key]
                        stored_params.append(key)
                # Only log the parameter names, not the session content
                if stored_params:
                    logger.info(
                        f"Stored request parameters in session: {stored_params}"
                    )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def append_script(file, query_params):
    try:
        with open(file, "r") as f:
            html_content = f.read()

        soup = BeautifulSoup(html_content, "html.parser")
        encoded_params = urlencode(query_params)
        full_url = f"?{encoded_params}"

        script_tag = soup.new_tag("script", type="text/javascript")
        script_content = f"""
        console.log('Modifying location without reload: {full_url}');
        if (window.history && window.history.pushState)
            window.history.pushState(null, '', '{full_url}');
        """
        script_tag.string = script_content

        soup.body.append(script_tag)

        modified_html = str(soup)
        return Response(modified_html, mimetype="text/html")

    except FileNotFoundError:
        return "HTML file not found", 404


def activate_invitation(invitation_id: str) -> bool:
    container = get_cosmos_container("invitations")

    try:
        item = container.read_item(item=invitation_id, partition_key=invitation_id)
        if item.get("active") is False:
            item["active"] = True
            container.upsert_item(item)
            return True
        return False
    except CosmosResourceNotFoundError:
        return False


@app.route("/api/invitations/<inviteId>/redeemed", methods=["GET"])
def mark_invitation_as_redeemed(inviteId):
    """
    Validates and redeems an invitation by ID and token.
    """
    print(f"Marking invitation {inviteId} as redeemed")

    token = request.args.get("token")
    if not token:
        return (
            render_template(
                "token_error.html",
                title="Token required",
                message="You must provide a valid token.",
            ),
            400,
        )

    try:
        container = get_cosmos_container("invitations")
        item = container.read_item(item=inviteId, partition_key=inviteId)

        # Security validations
        if item.get("token") != token:
            return (
                render_template(
                    "token_error.html",
                    title="Invalid token",
                    message="The token does not match the invitation.",
                ),
                403,
            )

        if item.get("token_used", False):
            return (
                render_template(
                    "token_error.html",
                    title="Invitation already used",
                    message="This invitation has already been used.",
                ),
                409,
            )

        current_timestamp = int(datetime.now(timezone.utc).timestamp())
        if current_timestamp > item.get("token_expiry", 0):
            return (
                render_template(
                    "token_error.html",
                    title="Expired Invitation",
                    message="Please contact your organization admin to request a new invitation.",
                ),
                410,
            )

        # Mark as redeemed
        item["active"] = True
        item["token_used"] = True
        item["redeemed_at"] = int(datetime.now(timezone.utc).timestamp())

        container.upsert_item(item)
        return render_template(
            "token_status.html",
            title="Invitation Activated!",
            message="Your invitation has been successfully activated. You can now register on the platform or login if you already have an account on the platform.",
            button_link=url_for("index"),
            button_text="Go to Login",
        )

    except CosmosResourceNotFoundError:
        print(f"Invitation {inviteId} not found")
        return (
            render_template(
                "token_error.html",
                title="Your invitation was not found.",
                message="Please ask your organization admin to send you a new one.",
            ),
            404,
        )

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return (
            render_template(
                "token_error.html",
                title="Unexpected error",
                message="An unexpected error occurred.",
            ),
            500,
        )


@app.route("/")
@store_request_params_in_session(["agent", "document"])
@store_request_params_in_session(["invitation_id"])
@auth.login_required
def index(*, context):
    """
    Endpoint to get the current user's data from Microsoft Graph API
    """
    logger.debug(f"User context: {context}")

    # get session data if available
    agent = session.get("agent")
    document = session.get("document")
    invitation_id = session.get("invitation_id")

    session.pop("agent", None)
    session.pop("document", None)

    if invitation_id:
        logger.info(f"Activando invitación con ID {invitation_id}")
        activate_invitation(invitation_id)

    if not agent or not document:
        return send_from_directory("static", "index.html")

    query_params = {"agent": agent, "document": document}
    return append_script("static/index.html", query_params)


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
        function_key = clients.get_azure_key_vault_secret(key_secret_name)
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


@app.route("/stream_chatgpt", methods=["POST"])
@auth.login_required
def proxy_orc(*, context):
    data = request.get_json()
    conversation_id = data.get("conversation_id")
    question = data.get("question")
    agent = data.get("agent")
    user_timezone = data.get("user_timezone")
    user_document_blob_names = data.get("user_document_blob_names")

    if not question:
        return jsonify({"error": "Missing required parameters"}), 400

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")
    client_principal_organization = request.headers.get(
        "X-MS-CLIENT-PRINCIPAL-ORGANIZATION"
    )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = (
            "orchestrator-host--financial"
            if agent == "financial"
            else "orchestrator-host--functionKey"
        )
        functionKey = clients.get_azure_key_vault_secret(keySecretName)
        if not functionKey:
            raise ValueError(f"Function key {keySecretName} is empty")
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
    orchestrator_url = (
        FINANCIAL_ASSISTANT_ENDPOINT if agent == "financial" else ORCHESTRATOR_ENDPOINT
    )

    payload_dict = {
        "conversation_id": conversation_id,
        "question": question,
        "client_principal_id": client_principal_id,
        "client_principal_name": client_principal_name,
        "client_principal_organization": client_principal_organization,
        "user_timezone": user_timezone,
    }
    if isinstance(user_document_blob_names, list) and len(user_document_blob_names) > 0:
        payload_dict["blob_names"] = user_document_blob_names
    payload = json.dumps(payload_dict)

    headers = {"Content-Type": "text/event-stream", "x-functions-key": functionKey}

    def generate():
        try:
            with requests.post(
                orchestrator_url, stream=True, headers=headers, data=payload
            ) as r:
                # Check for error status codes
                if r.status_code != 200:
                    raise Exception(
                        f"Orchestrator returned status code {r.status_code}"
                    )
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk.decode()
        except Exception as e:
            logging.exception(f"[webbackend] exception in /stream_chatgpt: {str(e)}")
            error_message = f"Error contacting orchestrator {str(e)}"
            logging.error(error_message)
            yield error_message

    return Response(stream_with_context(generate()), content_type="text/event-stream")


@app.route("/chatgpt", methods=["POST"])
@auth.login_required
def chatgpt(*, context):
    conversation_id = request.json["conversation_id"]
    question = request.json["query"]
    agent = request.json["agent"]

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")
    client_principal_organization = request.headers.get(
        "X-MS-CLIENT-PRINCIPAL-ORGANIZATION"
    )
    logging.info("[webbackend] conversation_id: " + conversation_id)
    logging.info("[webbackend] question: " + question)
    logging.info(f"[webbackend] User principal: {client_principal_id}")
    logging.info(f"[webbackend] User name: {client_principal_name}")
    logging.info(f"[webbackend] User organization: {client_principal_organization}")
    logging.info(f"[webappend] Agent: {agent}")

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        if agent == "financial":
            keySecretName = "orchestrator-host--financial"
        else:
            keySecretName = "orchestrator-host--functionKey"

        functionKey = clients.get_azure_key_vault_secret(keySecretName)
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
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "client_principal_organization": client_principal_organization,
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
@auth.login_required
def getChatHistory(*, context):
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
@auth.login_required
def getChatConversation(*, context, chat_id):

    if chat_id is None:
        return jsonify({"error": "Missing conversation_id parameter"}), 400

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    try:
        conversation = get_conversation(chat_id, client_principal_id)
        return jsonify(conversation), 200
    except ValueError as ve:
        logging.warning(f"ValueError fetching conversation_id: {str(ve)}")
        return jsonify({"error": "Invalid input or client data"}), 400
    except Exception as e:
        logging.exception(f"Unexpected error fetching conversation: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/api/chat-conversations/<chat_id>", methods=["DELETE"])
@auth.login_required
def deleteChatConversation(*, context, chat_id):

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


@app.route("/api/conversations/export", methods=["POST"])
@auth.login_required
def exportConversation(*, context):
    """
    Export a conversation by calling the orchestrator endpoint with proper authentication.

    Expected JSON payload:
    {
        "id": "conversation_id",
        "user_id": "user_id",
        "format": "html" #default is html
    }
    """
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return jsonify({"error": "Missing client principal ID"}), 400

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request data"}), 400

        conversation_id = data.get("id")
        user_id = data.get("user_id")
        format = data.get("format", "html")

        if not conversation_id or not user_id:
            return jsonify({"error": "Missing conversation ID or user ID"}), 400

        # Get the function key from Azure Key Vault
        try:
            keySecretName = "orchestrator-host--functionKey"
            functionKey = clients.get_azure_key_vault_secret(keySecretName)
            if not functionKey:
                raise ValueError(f"Function key {keySecretName} is empty")
        except Exception as e:
            logging.exception(
                "[webbackend] exception getting orchestrator function key"
            )
            return (
                jsonify(
                    {
                        "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                    }
                ),
                500,
            )

        # Prepare the payload for the orchestrator
        payload = json.dumps(
            {"id": conversation_id, "user_id": user_id, "format": format}
        )

        # Set up headers with the function key
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}

        # Call the orchestrator export endpoint
        orchestrator_export_url = ORCHESTRATOR_URI + "/api/conversations"
        response = requests.post(orchestrator_export_url, headers=headers, data=payload)

        logging.info(f"[webbackend] Export response status: {response.status_code}")

        if response.status_code != 200:
            logging.error(f"[webbackend] Error from orchestrator: {response.text}")
            return (
                jsonify({"error": "Error contacting orchestrator for export"}),
                response.status_code,
            )

        # Return the response from the orchestrator
        return response.json(), 200

    except Exception as e:
        logging.exception("[webbackend] exception in /api/conversations/export")
        return jsonify({"error": str(e)}), 500


@app.route("/api/organization/<org_id>", methods=["PATCH"])
@auth.login_required
def patch_organization_info(*, context, org_id):
    """
    Endpoint to update 'brandInformation', 'industryInformation' and 'segmentSynonyms' and 'additionalInstructions' in an organization document.
    """
    try:
        patch_data = request.get_json()

        if patch_data is None or not isinstance(patch_data, dict):
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        allowed_fields = {
            "brandInformation",
            "industryInformation",
            "segmentSynonyms",
            "additionalInstructions",
        }
        if not any(field in patch_data for field in allowed_fields):
            return jsonify({"error": "No valid fields to update"}), 400

        updated_org = patch_organization_data(org_id, patch_data)
        return (
            jsonify(
                {
                    "message": "Organization data updated successfully",
                    "data": updated_org,
                }
            ),
            200,
        )

    except NotFound:
        return jsonify({"error": f"Organization with ID {org_id} not found."}), 404

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

    except Exception as e:
        logging.exception(f"Error updating organization data for ID {org_id}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/api/get-speech-token", methods=["GET"])
@auth.login_required
def getGptSpeechToken(*, context):
    try:
        SPEECH_KEY = current_app.config["SPEECH_KEY"]
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
@auth.login_required
def getStorageAccount(*, context):
    if STORAGE_ACCOUNT is None or STORAGE_ACCOUNT == "":
        return jsonify({"error": "Add STORAGE_ACCOUNT to frontend app settings"}), 500
    try:
        return json.dumps({"storageaccount": STORAGE_ACCOUNT})
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-storage-account")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-feedback-url", methods=["GET"])
@auth.login_required
def getFeedbackUrl(*, context):
    try:
        feedback_url = os.environ.get("USER_FEEDBACK_URL")
        return jsonify({"feedback_url": feedback_url})
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-feedback-url")
        return jsonify({"error": str(e)}), 500


@app.route("/create-checkout-session", methods=["POST"])
@auth.login_required
def create_checkout_session(*, context):
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
            metadata={
                "userId": userId,
                "organizationId": organizationId,
                "userName": userName,
                "organizationName": organizationName,
            },
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


@app.route("/get-customer", methods=["POST"])
@auth.login_required
def get_customer(*, context):

    subscription_id = request.json["subscription_id"]

    if not subscription_id:
        logging.warning({"Error": "No subscription_id was provided for this request."})
        return (
            jsonify({"error": "No subscription_id was provided for this request."}),
            404,
        )

    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        customer_id = subscription.get("customer")

        if not customer_id:
            logging.warning(
                {"error": "No customer_id found for the provided subscription."}
            )
            return (
                jsonify(
                    {"error": "No customer_id found for the provided subscription."}
                ),
                404,
            )

        return jsonify({"customer_id": customer_id}), 200

    except stripe.error.StripeError as e:
        logging.warning({"error": {str(e)}})
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logging.warning({"error": "Unexpected error: " + {str(e)}})
        return jsonify({"error": "Unexpected error: " + str(e)}), 500


@app.route("/create-customer-portal-session", methods=["POST"])
@auth.login_required
def create_customer_portal_session(*, context):
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
        stripe.Subscription.modify(
            subscription_id,
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name": request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
                "modification_type": "",
            },
        )

        portal_session = stripe.billing_portal.Session.create(
            customer=customer, return_url=return_url
        )

    except Exception as e:
        logging.error({"error": f"Unexpected error: {str(e)}"})
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    return jsonify({"url": portal_session.url})


@app.route("/api/stripe", methods=["GET"])
@auth.login_required
def getStripe(*, context):
    try:
        keySecretName = "stripeKey"
        functionKey = clients.get_azure_key_vault_secret(keySecretName)
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
            functionKey = clients.get_azure_key_vault_secret(keySecretName)
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
@auth.login_required
def uploadBlob(*, context):
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
            current_app.config["AZURE_STORAGE_CONNECTION_STRING"]
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
@auth.login_required
def getBlob(*, context):
    blob_name = unquote(request.json["blob_name"])
    container = request.json["container"]
    # White list of containers
    white_list_containers = ["documents", "fa-documents"]
    if container not in white_list_containers:
        return jsonify({"error": "Invalid container"}), 400

    try:
        conn_str = current_app.config.get("AZURE_STORAGE_CONNECTION_STRING")
        if conn_str:
            blob_service_client = BlobServiceClient.from_connection_string(conn_str)
        else:
            client_credential = DefaultAzureCredential()
            blob_service_client = BlobServiceClient(
                f"https://{STORAGE_ACCOUNT}.blob.core.windows.net",
                credential=client_credential,
            )
        blob_client = blob_service_client.get_blob_client(
            container=container, blob=blob_name
        )
        blob_data = blob_client.download_blob()
        blob_text = blob_data.readall()
        return Response(blob_text, content_type="application/octet-stream")
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-blob")
        logging.exception(blob_name)
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["GET"])
@auth.login_required
def getSettings(*, context):
    client_principal, error_response, status_code = get_client_principal()
    if error_response:
        return error_response, status_code

    try:
        settings = get_setting(client_principal)

        return settings
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500


@app.route("/api/download", methods=["GET"])
@auth.login_required
def download_document(*, context):

    organization_id = request.args.get("organizationId")
    blob_name = request.args.get("blobName")

    if not organization_id or not blob_name:
        return jsonify({"error": "Missing required parameters"}), 400

    expected_prefix = f"organization_files/{organization_id}/"
    if not blob_name.startswith(expected_prefix):
        return jsonify({"error": "Access to this file is not allowed"}), 403

    try:
        blob_service_client = BlobServiceClient.from_connection_string(
            current_app.config["AZURE_STORAGE_CONNECTION_STRING"]
        )
        account_name = blob_service_client.account_name
        container_name = "documents"

        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(minutes=10),
        )

        blob_url = f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}?{sas_token}"
        return redirect(blob_url, code=302)

    except Exception as e:
        logging.exception("[webbackend] Exception in /api/download")
        return jsonify({"error": str(e)}), 500


@app.route("/api/download-excel-citation", methods=["POST"])
@auth.login_required()
def download_excel_citation(*, context):
    """
    Generate a 2-day SAS token for downloading Excel files from citations.
    This endpoint specifically handles Excel files (.xlsx, .xls, .csv) for citation downloads.
    """
    try:
        data = request.json
        file_path = data.get("file_path")

        if not file_path:
            return jsonify({"error": "Missing file_path parameter"}), 400

        # Log the received file_path for debugging
        logging.info(f"Processing file_path: {file_path}")

        # Handle different citation formats
        if file_path.startswith("@https://") and file_path.endswith("/"):
            # Handle citation format like: @https://construction%20adhesives%20pos%202024%202025%20ytd.xlsx/
            # Extract the filename from between @https:// and the trailing /
            encoded_filename = file_path[
                9:-1
            ]  # Remove '@https://' prefix and '/' suffix
            blob_name = unquote(encoded_filename)  # URL decode the filename
            logging.info(f"Detected citation format, extracted filename: {blob_name}")

        elif file_path.startswith("https://") and (
            file_path.endswith(".xlsx")
            or file_path.endswith(".xls")
            or file_path.endswith(".csv")
        ):
            # Handle citation format like: https://Construction%20Adhesives%20POS%202024%202025%20YTD.xlsx
            # This is just a URL-encoded filename, not a real URL - remove the https:// prefix
            encoded_filename = file_path[8:]  # Remove 'https://' prefix
            blob_name = unquote(encoded_filename)
            logging.info(f"Detected encoded filename format, extracted: {blob_name}")

        elif file_path.startswith("https://") and "blob.core.windows.net" in file_path:
            # Handle full blob URL - extract the blob name after documents/
            parsed_url = urlparse(file_path)
            path_parts = [part for part in parsed_url.path.split("/") if part]

            if "documents" in path_parts:
                docs_index = path_parts.index("documents")
                blob_name = (
                    "/".join(path_parts[docs_index + 1 :])
                    if docs_index + 1 < len(path_parts)
                    else ""
                )
            else:
                # If no 'documents' in path, try to extract filename from the path
                blob_name = "/".join(path_parts) if path_parts else ""
                logging.warning(f"URL doesn't contain 'documents' in path: {file_path}")
        else:
            # Handle simple filename or relative path
            blob_name = unquote(file_path)
            if blob_name.startswith("documents/"):
                blob_name = blob_name[10:]  # Remove 'documents/' prefix

        logging.info(f"Extracted blob_name: {blob_name}")

        # Additional validation
        if not blob_name or blob_name.strip() == "":
            return jsonify({"error": "Unable to extract valid filename from path"}), 400

        # Validate file extension for Excel files
        allowed_extensions = [".xlsx", ".xls", ".csv"]
        if not any(blob_name.lower().endswith(ext) for ext in allowed_extensions):
            return (
                jsonify(
                    {"error": "Only Excel files (.xlsx, .xls, .csv) are supported"}
                ),
                400,
            )

        # Build a streaming preview URL
        q = urlencode({"file_path": file_path})
        preview_url = urljoin(request.url_root, f"preview/spreadsheet?{q}")

        # Derive filename for download button; normalize CSV to .xlsx
        try:
            if file_path.startswith("@https://") and file_path.endswith("/"):
                encoded_filename = file_path[9:-1]
                name = unquote(encoded_filename)
            elif (
                file_path.startswith("https://")
                and "blob.core.windows.net" in file_path
            ):
                parsed_url = urlparse(file_path)
                parts = [p for p in parsed_url.path.split("/") if p]
                name = parts[-1] if parts else "file"
            else:
                name = unquote(file_path.split("/")[-1])
        except Exception:
            name = "file"
        # Keep original filename extension for downloads (CSV remains .csv)
        # Try to generate a SAS URL to the original blob for dev fallback (Excel files)
        sas_url = None
        try:
            blob_service_client = BlobServiceClient.from_connection_string(
                current_app.config["AZURE_STORAGE_CONNECTION_STRING"]
            )
            container_name = "documents"
            _blob_name = blob_name
            blob_client = blob_service_client.get_blob_client(
                container=container_name, blob=_blob_name
            )
            try:
                blob_client.get_blob_properties()
            except Exception:
                filename_only = _blob_name.split("/")[-1]
                container_client = blob_service_client.get_container_client(
                    container_name
                )
                found_blob = None
                for b in container_client.list_blobs():
                    if b.name.endswith(filename_only):
                        found_blob = b.name
                        break
                if found_blob:
                    _blob_name = found_blob
                else:
                    _blob_name = None
            if _blob_name:
                sas_token = generate_blob_sas(
                    account_name=blob_service_client.account_name,
                    container_name=container_name,
                    blob_name=_blob_name,
                    account_key=blob_service_client.credential.account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.now(timezone.utc) + timedelta(days=2),
                )
                sas_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{container_name}/{_blob_name}?{sas_token}"
        except Exception as e:
            logging.warning(
                f"[download-excel-citation] SAS fallback generation failed: {e}"
            )

        return jsonify(
            {
                "success": True,
                "download_url": sas_url
                or preview_url,  # Download should return the ORIGINAL file (CSV remains CSV)
                "preview_url": preview_url,  # Preview uses streaming endpoint (converted XLSX for CSV)
                "sas_url": sas_url,
                "filename": name,
                "expires_in_days": 2,
            }
        )

    except Exception as e:
        logging.exception("[webbackend] Exception in /api/download-excel-citation")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route("/preview/spreadsheet", methods=["GET"])
def preview_spreadsheet():
    try:
        file_path = request.args.get("file_path")
        if not file_path:
            return jsonify({"error": "Missing file_path parameter"}), 400

        # Resolve blob name from various citation formats
        if file_path.startswith("@https://") and file_path.endswith("/"):
            encoded_filename = file_path[9:-1]
            blob_name = unquote(encoded_filename)
        elif file_path.startswith("https://") and file_path.endswith(
            (".xlsx", ".xls", ".csv")
        ):
            blob_name = unquote(file_path[8:])
        elif file_path.startswith("https://") and "blob.core.windows.net" in file_path:
            parsed_url = urlparse(file_path)
            parts = [p for p in parsed_url.path.split("/") if p]
            if "documents" in parts:
                idx = parts.index("documents")
                blob_name = "/".join(parts[idx + 1 :]) if idx + 1 < len(parts) else ""
            else:
                blob_name = "/".join(parts) if parts else ""
        else:
            blob_name = unquote(file_path)
            if blob_name.startswith("documents/"):
                blob_name = blob_name[10:]

        if not blob_name:
            return jsonify({"error": "Unable to extract valid filename from path"}), 400

        # Connect to blob store
        blob_service_client = BlobServiceClient.from_connection_string(
            current_app.config["AZURE_STORAGE_CONNECTION_STRING"]
        )
        container_name = "documents"
        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_name
        )

        # Verify existence; if not, try to locate by filename
        try:
            blob_client.get_blob_properties()
        except Exception:
            filename_only = blob_name.split("/")[-1]
            container_client = blob_service_client.get_container_client(container_name)
            found_blob = None
            for blob in container_client.list_blobs():
                if blob.name.endswith(filename_only):
                    found_blob = blob.name
                    break
            if not found_blob:
                return jsonify({"error": "File not found"}), 404
            blob_client = blob_service_client.get_blob_client(
                container=container_name, blob=found_blob
            )
            blob_name = found_blob

        lower = blob_name.lower()
        if lower.endswith(".csv"):
            csv_bytes = blob_client.download_blob().readall()
            try:
                df = pd.read_csv(BytesIO(csv_bytes))
            except UnicodeDecodeError:
                df = pd.read_csv(BytesIO(csv_bytes), encoding="latin1")
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Sheet1")
            output.seek(0)
            resp = Response(
                output.getvalue(),
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            base = blob_name.split("/")[-1].rsplit(".", 1)[0]
            resp.headers["Content-Disposition"] = f'inline; filename="{base}.xlsx"'
            resp.headers["Cache-Control"] = "no-store"
            return resp
        elif lower.endswith(".xlsx"):
            data = blob_client.download_blob().readall()
            resp = Response(
                data,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            base = blob_name.split("/")[-1]
            resp.headers["Content-Disposition"] = f'inline; filename="{base}"'
            resp.headers["Cache-Control"] = "no-store"
            return resp
        elif lower.endswith(".xls"):
            data = blob_client.download_blob().readall()
            resp = Response(data, mimetype="application/vnd.ms-excel")
            base = blob_name.split("/")[-1]
            resp.headers["Content-Disposition"] = f'inline; filename="{base}"'
            resp.headers["Cache-Control"] = "no-store"
            return resp
        else:
            return jsonify({"error": "Unsupported file type for preview"}), 400
    except Exception as e:
        logging.exception("[webbackend] Exception in /preview/spreadsheet")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route("/api/settings", methods=["POST"])
@auth.login_required
def setSettings(*, context):

    client_principal, error_response, status_code = get_client_principal()
    if error_response:
        return error_response, status_code

    try:
        request_body = request.json
        if not request_body:
            return jsonify({"error": "Invalid request body"}), 400

        temperature = request_body.get("temperature", 0.0)
        model = request_body.get(
            "model", "gpt-4.1"
        )  # address later since we're adding more models
        font_family = request_body.get("font_family")
        font_size = request_body.get("font_size")
        detail_level = request_body.get("detail_level")

        ALLOWED_DETAIL_LEVELS = {"brief", "balanced", "detailed"}

        if detail_level is not None:
            detail_level_norm = str(detail_level).strip().lower()
            if detail_level_norm not in ALLOWED_DETAIL_LEVELS:
                logging.warning(
                    "[/api/settings] Invalid detail_level '%s' — falling back to 'balanced'.",
                    detail_level
                )
                detail_level = "balanced"
            else:
                detail_level = detail_level_norm

        set_settings(
            client_principal=client_principal,
            temperature=temperature,
            model=model,
            font_family=font_family,
            font_size=font_size,
            detail_level=detail_level,
        )

        # Return all saved settings, including the model
        return (
            jsonify(
                {
                    "client_principal_id": client_principal["id"],
                    "client_principal_name": client_principal["name"],
                    "temperature": temperature,
                    "model": model,
                    "font_family": font_family,
                    "font_size": font_size,
                    "detail_level": detail_level,
                }
            ),
            200,
        )
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings POST")
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


@app.route("/api/get-organization-subscription", methods=["GET"])
@auth.login_required
def getOrganization(*, context):
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    organizationId = request.args.get("organizationId")
    if not client_principal_id:
        create_error_response(
            "Missing required parameter: client_principal_id", HTTPStatus.BAD_REQUEST
        )
    if not organizationId:
        create_error_response(
            "Missing required parameter: organizationId", HTTPStatus.BAD_REQUEST
        )
    try:
        if not organizationId:
            raise MissingParameterError("organizationId")
        response = get_organization_subscription(organizationId)
        return jsonify(response)
    except NotFound as e:
        return jsonify({}), 204
    except MissingParameterError as e:
        return create_error_response(
            "Missing required parameter: " + str(e), HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        logging.exception("[webbackend] exception in /get-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-user-organizations", methods=["GET"])
@auth.login_required
def getUserOrganizations(*, context):
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return create_error_response(
            "Missing required parameter: client_principal_id", HTTPStatus.BAD_REQUEST
        )
    try:
        response = get_user_organizations(client_principal_id)
        return jsonify(response)
    except Exception as e:
        logging.exception("[webbackend] exception in /get-user-organizations")
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)


@app.route("/api/get-users-organizations-role", methods=["GET"])
@auth.login_required
def getUserOrganizationsRole(*, context):
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    organization_id = request.args.get("organization_id")

    if not client_principal_id or not organization_id:
        return create_error_response(
            "Missing required parameter: client_principal_id, organization_id",
            HTTPStatus.BAD_REQUEST,
        )

    try:
        role = get_invitation_role(client_principal_id, organization_id)
        return jsonify({"role": role}), 200
    except ValueError as e:
        # If the invitation is missing or inactive
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/create-organization", methods=["POST"])
@auth.login_required
def createOrganization(*, context):
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
        if not "organizationName" in request.json:
            return (
                jsonify({"error": "Missing required parameters, organizationName"}),
                400,
            )
    try:
        organizationName = request.json["organizationName"]
        response = create_organization(client_principal_id, organizationName)
        if not response:
            return create_error_response(
                "Failed to create organization", HTTPStatus.INTERNAL_SERVER_ERROR
            )
        return jsonify(response), HTTPStatus.CREATED
    except NotFound as e:
        return create_error_response(
            f"User {client_principal_id} not found", HTTPStatus.NOT_FOUND
        )
    except MissingRequiredFieldError as field:
        return create_error_response(
            f"Missing required parameters, {field}", HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)


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
@auth.login_required
def get_product_prices_endpoint(*, context):
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
        raise IncompleteConfigurationError(
            "Financial Assistant price ID not configured"
        )

    try:
        updated_subscription = stripe.Subscription.modify(
            subscriptionId,
            items=[{"price": FINANCIAL_ASSISTANT_PRICE_ID}],
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name": request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
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
    except IncompleteConfigurationError as e:
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
                "modified_by_name": request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
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
        return jsonify({"error": "Authentication with Stripe failed."}), 401
    except stripe.error.APIConnectionError:
        logging.exception("Network communication with Stripe failed")
        return jsonify({"error": "Network communication with Stripe failed."}), 502
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


@app.route("/api/subscriptions/<subscription_id>/change", methods=["PUT"])
@auth.login_required
def change_subscription(*, context, subscription_id):
    try:

        data = request.json
        new_plan_id = data.get("new_plan_id")
        if not new_plan_id:
            return jsonify({"error": "new_plan_id is required"}), 400

        # Retrieve subscription from Stripe
        stripe_subscription = stripe.Subscription.retrieve(subscription_id)
        if not stripe_subscription or stripe_subscription["status"] == "canceled":
            return (
                jsonify({"error": "Subscription not found or is already canceled"}),
                404,
            )

        # Update the plan, which is reflected and charged when changing it
        updated_subscription = stripe.Subscription.modify(
            subscription_id,
            items=[
                {
                    "id": stripe_subscription["items"]["data"][0]["id"],
                    "price": new_plan_id,
                }
            ],
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modified_by_name": request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME"),
                "modification_type": "subscription_tier_change",
            },
            proration_behavior="none",  # No proration
            billing_cycle_anchor="now",  # Change the billing cycle so that it is charged at that moment
            cancel_at_period_end=False,  # Do not cancel the subscription
        )

        result = {
            "message": "Subscription change successfully",
            "subscription": updated_subscription,
        }

        return jsonify(result), 200

    except stripe.error.InvalidRequestError as e:
        return jsonify({"error": f"Invalid request: {str(e)}"}), 400
    except stripe.error.AuthenticationError:
        return jsonify({"error": "Authentication with Stripe API failed"}), 403
    except stripe.error.PermissionError:
        return jsonify({"error": "Permission error when accessing the Stripe API"}), 403
    except stripe.error.RateLimitError:
        return (
            jsonify(
                {"error": "Too many requests to Stripe API, please try again later"}
            ),
            429,
        )
    except stripe.error.StripeError as e:
        return jsonify({"error": f"Stripe API error: {str(e)}"}), 500

    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


@app.route("/api/subscriptions/<subscription_id>/cancel", methods=["DELETE"])
@auth.login_required
def cancel_subscription(*, context, subscription_id):
    try:

        subscription = stripe.Subscription.retrieve(subscription_id)

        if not subscription:
            return jsonify({"message": "Subscription not found"}), 404

        canceled_subscription = stripe.Subscription.delete(subscription_id)

        return jsonify({"message": "Subscription canceled successfully"}), 200

    except stripe.error.InvalidRequestError as e:
        return jsonify({"message": "Invalid subscription ID"}), 404
    except stripe.error.AuthenticationError as e:
        return jsonify({"message": "Unauthorized access"}), 403
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


################################################
# Financial Doc Ingestion
################################################


from pathlib import Path
from curation_report_generator import graph
from financial_doc_processor import (
    BlobUploadError,
    markdown_to_html,
    BlobStorageManager,
)
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
@auth.login_required
def generate_report(*, context):
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
            report_topic_prompt = REPORT_TOPIC_PROMPT_DICT[report_topic_rqst].replace(
                "company_name", data["company_name"]
            )
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
        company_name = str(data.get("company_name", "")).replace(" ", "_")
        if report_topic_rqst in WEEKLY_CURATION_REPORT:
            file_path = Path(
                f"Reports/Curation_Reports/{report_topic_rqst}/{current_date.strftime('%B_%Y')}/{report_topic_rqst}_Week_{week_of_month}.html"
            )
        elif report_topic_rqst == "Company_Analysis":
            # add company name to the file path
            logger.info(f"Company name after replacement: {company_name}")
            file_path = Path(
                f"Reports/Curation_Reports/{report_topic_rqst}/{company_name}/{company_name}_{report_topic_rqst}_{datetime.now().strftime('%b %d %y')}.html"
            )
        else:
            file_path = Path(
                f"Reports/Curation_Reports/{report_topic_rqst}/{report_topic_rqst}_{datetime.now().strftime('%b %d %y')}.html"
            )

        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Convert and save report
        logger.info("Converting markdown to html")
        markdown_to_html(report["final_report"], str(file_path))

        # Read the generated HTML file
        with open(str(file_path), "r", encoding="utf-8") as f:
            html_content = f.read()

        # Add logo to the top of the HTML content
        logo_url = "https://raw.githubusercontent.com/Salesfactory/gpt-rag-frontend/develop/backend/images/Sales%20Factory%20Logo%20BW.jpg"
        style_and_logo = f"""<style>
            body {{
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }}
            .header {{
                padding: 20px;
            }}
        </style>
        <div class="header">
            <a href="https://www.linkedin.com/company/the-sales-factory">
                <img src="{logo_url}" 
                     alt="Sales Factory Logo"  
                     style="width: 250px; height: auto;"/>
            </a>
        </div>"""
        html_content = html_content.replace("<body>", f"<body>{style_and_logo}")

        # Write the modified HTML back to the file
        with open(str(file_path), "w", encoding="utf-8") as f:
            f.write(html_content)

        logger.info("Uploading to blob storage")
        blob_storage_manager = BlobStorageManager()
        if report_topic_rqst in WEEKLY_CURATION_REPORT:
            blob_folder = f"Reports/Curation_Reports/{report_topic_rqst}/{current_date.strftime('%B_%Y')}"
        elif report_topic_rqst == "Company_Analysis":
            blob_folder = f"Reports/Curation_Reports/{report_topic_rqst}/{company_name}"
        else:
            blob_folder = f"Reports/Curation_Reports/{report_topic_rqst}"

        metadata = {
            "document_id": str(uuid.uuid4()),
            "report_type": report_topic_rqst,
            "date": current_date.isoformat(),
            "company_name": (
                company_name if report_topic_rqst == "Company_Analysis" else ""
            ),
        }

        upload_result = blob_storage_manager.upload_to_blob(
            file_path=str(file_path), blob_folder=blob_folder, metadata=metadata
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

    except KeyError as e:
        logger.error(f"Missing key in request: {str(e)}")
        return jsonify({"error": f"Missing key in request: {str(e)}"}), 400

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
@auth.login_required
def send_email_endpoint(*, context):
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


from rp2email import process_and_send_email, ReportProcessor


@app.route("/api/reports/digest", methods=["POST"])
@auth.login_required
def digest_report(*, context):
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
                        "message": "Missing required fields: blob_link and/or recipients",
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
            summary=data.get("summary", None),
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
@auth.login_required
def list_blobs(*, context):
    """
    List blobs in the container with optional filtering and pagination

    Query params:
    - prefix(str): filter blobs by prefix
    - include_metadata(str): include metadata in results
    - page_size(int): number of results per page (default: 10, max: 100)
    - page(int): page number (1-based, default: 1)
    - continuation_token(str): token for continuing pagination from a specific point
    - container_name(str): name of the container to list blobs from

    Returns:
        JSON response with list of blobs and pagination metadata

    Example Payload:
    {
        "prefix": "Reports/Curation_Reports/Monthly_Economics/",
        "include_metadata": "yes",
        "page_size": 20,
        "page": 1,
        "continuation_token": null,
        "container_name": "documents"
    }
    """

    try:
        # get query params
        data = request.get_json()

        container_name = data.get("container_name")
        prefix = data.get("prefix", None)
        include_metadata = data.get("include_metadata", "no").lower()

        # Pagination parameters
        page_size = min(data.get("page_size", 10), 100)  # Cap at 100 for performance
        page = max(data.get("page", 1), 1)  # Ensure page is at least 1
        continuation_token = data.get("continuation_token")

        if not container_name:
            return (
                jsonify(
                    {"status": "error", "message": "Blob container name is required"}
                ),
                400,
            )

        if page_size <= 0:
            return (
                jsonify(
                    {"status": "error", "message": "page_size must be greater than 0"}
                ),
                400,
            )

        blob_storage_manager = BlobStorageManager()
        result = blob_storage_manager.list_blobs_in_container_paginated(
            container_name=container_name,
            prefix=prefix,
            include_metadata=include_metadata,
            page_size=page_size,
            page=page,
            continuation_token=continuation_token,
        )

        return (
            jsonify(
                {
                    "status": "success",
                    "data": result["blobs"],
                    "pagination": {
                        "current_page": result["current_page"],
                        "page_size": result["page_size"],
                        "total_count": result["total_count"],
                        "has_more": result["has_more"],
                        "next_continuation_token": result.get(
                            "next_continuation_token"
                        ),
                        "total_pages": result.get("total_pages"),
                    },
                }
            ),
            200,
        )

    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400

    except Exception as e:
        logger.exception("Unexpected error in list_blobs")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/logs/", methods=["POST"])
@auth.login_required
def get_logs(*, context):
    try:
        data = request.get_json()
        if data == None:
            return create_error_response("Request data is required", 400)
        organization_id = data.get("organization_id")
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
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


@app.route("/api/get-source-documents", methods=["GET"])
@auth.login_required
def get_source_documents(*, context):
    organization_id = request.args.get("organization_id", "").strip()
    folder_path = request.args.get("folder_path", "").strip()
    category = request.args.get("category", "all").strip()

    logger.info(f"Getting source documents for organization {organization_id}, folder: {folder_path}, category: {category}")

    if not organization_id:
        return create_error_response("Organization ID is required", 400)

    # Define file extension mappings for categories
    CATEGORY_EXTENSIONS = {
        "documents": [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"],
        "spreadsheets": [".csv", ".xlsx", ".xls", ".ods"],
        "presentations": [".ppt", ".pptx", ".odp", ".key"]
    }

    def should_include_file(file_name, category):
        """Check if a file should be included based on the category filter"""
        if category == "all":
            return True
        
        if category not in CATEGORY_EXTENSIONS:
            return True
        
        # Get file extension
        file_ext = os.path.splitext(file_name.lower())[1]
        return file_ext in CATEGORY_EXTENSIONS[category]

    try:
        blob_storage_manager = BlobStorageManager()
        
        # Build the base prefix for the organization
        base_prefix = f"organization_files/{organization_id}/"
        
        # Add the folder path if provided
        if folder_path:
            # Ensure folder_path doesn't start with / and ends with /
            folder_path = folder_path.strip("/")
            current_prefix = f"{base_prefix}{folder_path}/"
        else:
            current_prefix = base_prefix
        
        # Get all blobs with the current prefix
        blobs = blob_storage_manager.list_blobs_in_container_for_upload_files(
            container_name="documents", prefix=current_prefix, include_metadata="yes"
        )

        # Exclude generated_images folder
        generated_images_prefix = f"{base_prefix}generated_images/"
        
        files = []
        folder_set = set()
        
        for blob in blobs:
            blob_name = blob.get("name", "")
            
            # Skip generated images
            if blob_name.startswith(generated_images_prefix):
                continue
            
            # Get the relative path from current prefix
            relative_path = blob_name[len(current_prefix):]
            
            # Skip empty paths
            if not relative_path:
                continue
            
            # Check if this is a file in the current directory or a nested item
            parts = relative_path.split("/")
            
            if len(parts) == 1:
                # This is a file directly in the current folder
                # Apply category filter
                if should_include_file(blob_name, category):
                    files.append(blob)
            elif len(parts) > 1:
                # This is a nested item, add the folder name
                folder_name = parts[0]
                folder_set.add(folder_name)
        
        # Create folder objects
        folders = []
        for folder_name in sorted(folder_set):
            folder_full_path = f"{folder_path}/{folder_name}" if folder_path else folder_name
            folders.append({
                "name": folder_name,
                "full_path": folder_full_path,
                "type": "folder",
                "size": 0,
                "created_on": "",
                "last_modified": "",
                "content_type": "folder",
                "url": "",
            })
        
        # Sort files by creation date
        if files:
            files.sort(
                key=lambda x: datetime.fromisoformat(x["created_on"]), reverse=True
            )
        
        # Combine folders and files (folders first)
        result = {
            "folders": folders,
            "files": files,
            "current_path": folder_path
        }

        logger.info(
            f"Found {len(folders)} folders and {len(files)} files for organization {organization_id} in path '{folder_path}'"
        )
        return create_success_response(result, 200)

    except Exception as e:
        logger.exception(f"Unexpected error in get_source_documents: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/delete-source-document", methods=["DELETE"])
@auth.login_required
def delete_source_document(*, context):
    try:
        # Get blob name from query parameters
        blob_name = request.args.get("blob_name")
        if not blob_name:
            return create_error_response("Blob name is required", 400)

        # # Make sure blob_name starts with organization_files/ for security
        # if not blob_name.startswith("organization_files/"):
        #     return create_error_response("Invalid blob path. Path must start with 'organization_files/'", 400)
        # NOTE: commented out to allow deletion of results from web scraping folder as well

        # Initialize blob storage manager and delete blob
        blob_storage_manager = BlobStorageManager()
        container_client = (
            blob_storage_manager.blob_service_client.get_container_client("documents")
        )

        # Get the blob client
        blob_client = container_client.get_blob_client(blob_name)

        # Check if blob exists
        if not blob_client.exists():
            return create_error_response(f"File not found: {blob_name}", 404)

        # Delete the blob
        blob_client.delete_blob()

        return create_success_response({"message": "File deleted successfully"}, 200)
    except Exception as e:
        logger.exception(f"Unexpected error in delete_source_from_blob: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/create-folder", methods=["POST"])
@auth.login_required
def create_folder(*, context):
    """
    Create a virtual folder in blob storage by creating an init.txt file.
    
    Expected JSON payload:
    {
        "organization_id": "org-123",
        "folder_name": "New Folder",
        "current_path": "subfolder" (optional, empty string for root)
    }
    
    Returns:
        JSON response with success message or error details
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)
        
        # Validate required fields
        organization_id = data.get("organization_id", "").strip()
        folder_name = data.get("folder_name", "").strip()
        current_path = data.get("current_path", "").strip()
        
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        
        if not folder_name:
            return create_error_response("Folder name is required", 400)
        
        # Validate folder name (same validation as frontend)
        invalid_chars = r'<>:"/\\|?*'
        if any(char in folder_name for char in invalid_chars):
            return create_error_response(
                f"Folder name contains invalid characters ({invalid_chars})", 400
            )
        
        if len(folder_name) > 255:
            return create_error_response("Folder name is too long (max 255 characters)", 400)
        
        # Build the folder path
        base_prefix = f"organization_files/{organization_id}/"
        
        if current_path:
            current_path = current_path.strip("/")
            folder_full_path = f"{base_prefix}{current_path}/{folder_name}/"
        else:
            folder_full_path = f"{base_prefix}{folder_name}/"
        
        # Check if folder already exists by checking for any blobs with this prefix
        blob_storage_manager = BlobStorageManager()
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
        
        # List blobs with the folder prefix to check if it exists
        existing_blobs = list(container_client.list_blobs(name_starts_with=folder_full_path, results_per_page=1))
        
        if existing_blobs:
            return create_error_response("A folder with this name already exists", 409)
        
        # Create the init.txt file to represent the folder
        init_file_path = f"{folder_full_path}init.txt"
        blob_client = container_client.get_blob_client(init_file_path)
        
        # Upload an empty file with metadata
        blob_client.upload_blob(
            data="",
            blob_type="BlockBlob",
            metadata={
                "folder_marker": "true",
                "created_by": "folder_creation_endpoint",
                "organization_id": organization_id
            },
            overwrite=False
        )
        
        logger.info(f"Created folder '{folder_name}' at path '{folder_full_path}' for organization {organization_id}")
        
        return create_success_response({
            "message": "Folder created successfully",
            "folder_path": folder_full_path,
            "folder_name": folder_name
        }, 201)
        
    except Exception as e:
        logger.exception(f"Unexpected error in create_folder: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/move-file", methods=["POST"])
@auth.login_required
def move_file(*, context):
    """
    Move a file from one location to another in blob storage.
    This is implemented as a copy + delete operation.
    
    Expected JSON payload:
    {
        "organization_id": "org-123",
        "source_blob_name": "organization_files/org-123/folder1/file.pdf",
        "destination_folder_path": "folder2" (or "" for root)
    }
    
    Returns:
        JSON response with success message or error details
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)
        
        # Validate required fields
        organization_id = data.get("organization_id", "").strip()
        source_blob_name = data.get("source_blob_name", "").strip()
        destination_folder_path = data.get("destination_folder_path", "").strip()
        
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        
        if not source_blob_name:
            return create_error_response("Source blob name is required", 400)
        
        # This prevents cross-tenant data access/deletion
        expected_org_prefix = f"organization_files/{organization_id}/"
        if not source_blob_name.startswith(expected_org_prefix):
            logger.warning(
                f"Unauthorized move attempt: organization {organization_id} tried to move blob '{source_blob_name}' "
                f"which doesn't belong to them (expected prefix: {expected_org_prefix})"
            )
            return create_error_response(
                "Unauthorized: Source file does not belong to your organization", 403
            )
        
        # Extract the file name from the source blob path
        file_name = source_blob_name.split("/")[-1]
        
        # Build the destination blob path
        base_prefix = f"organization_files/{organization_id}/"
        
        if destination_folder_path:
            destination_folder_path = destination_folder_path.strip("/")
            destination_blob_name = f"{base_prefix}{destination_folder_path}/{file_name}"
        else:
            destination_blob_name = f"{base_prefix}{file_name}"
        
        # Don't allow moving to the same location
        if source_blob_name == destination_blob_name:
            return create_error_response("Source and destination are the same", 400)
        
        blob_storage_manager = BlobStorageManager()
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
        
        # Check if source blob exists
        source_blob_client = container_client.get_blob_client(source_blob_name)
        if not source_blob_client.exists():
            return create_error_response("Source file not found", 404)
        
        # Check if destination already exists
        destination_blob_client = container_client.get_blob_client(destination_blob_name)
        if destination_blob_client.exists():
            return create_error_response("A file with this name already exists in the destination folder", 409)
        
        # Get source blob properties and metadata
        source_properties = source_blob_client.get_blob_properties()
        source_metadata = source_properties.metadata or {}
        
        # Copy the blob to the new location
        # Using start_copy_from_url which is async in Azure but we'll wait for it
        source_url = source_blob_client.url
        copy_operation = destination_blob_client.start_copy_from_url(source_url)
        
        # Wait for the copy to complete (with timeout)
        max_wait_time = 60  # 60 seconds timeout
        wait_time = 0
        sleep_interval = 0.5
        
        while wait_time < max_wait_time:
            dest_properties = destination_blob_client.get_blob_properties()
            copy_status = dest_properties.copy.status
            
            if copy_status == "success":
                break
            elif copy_status == "failed":
                return create_error_response("Failed to copy file", 500)
            elif copy_status in ["pending", "copying"]:
                time.sleep(sleep_interval)
                wait_time += sleep_interval
            else:
                return create_error_response(f"Unknown copy status: {copy_status}", 500)
        
        if wait_time >= max_wait_time:
            return create_error_response("Copy operation timed out", 500)
        
        # Set metadata on the destination blob (preserving original metadata)
        try:
            destination_blob_client.set_blob_metadata(metadata=source_metadata)
        except Exception as metadata_error:
            logger.warning(f"Failed to set metadata on destination blob: {metadata_error}")
        
        # Delete the source blob
        try:
            source_blob_client.delete_blob()
        except Exception as delete_error:
            logger.error(f"Failed to delete source blob after copy: {delete_error}")
            # File was copied but not deleted - return a partial success message
            return create_success_response({
                "message": "File copied but original could not be deleted",
                "destination_blob_name": destination_blob_name,
                "warning": "Original file still exists"
            }, 200)
        
        logger.info(f"Successfully moved file from '{source_blob_name}' to '{destination_blob_name}'")
        
        return create_success_response({
            "message": "File moved successfully",
            "destination_blob_name": destination_blob_name,
            "source_blob_name": source_blob_name
        }, 200)
        
    except Exception as e:
        logger.exception(f"Unexpected error in move_file: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/delete-folder", methods=["DELETE"])
@auth.login_required
def delete_folder(*, context):
    """
    Delete a folder and all its contents from blob storage.
    This deletes all blobs with the specified folder prefix.
    
    Expected JSON payload:
    {
        "organization_id": "org-123",
        "folder_path": "subfolder/folder-name"
    }
    
    Returns:
        JSON response with success message or error details
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)
        
        # Validate required fields
        organization_id = data.get("organization_id", "").strip()
        folder_path = data.get("folder_path", "").strip()
        
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        
        if not folder_path:
            return create_error_response("Folder path is required", 400)
        
        # Build the full folder prefix
        base_prefix = f"organization_files/{organization_id}/"
        folder_full_path = f"{base_prefix}{folder_path.strip('/')}"
        
        # Prevent deletion of root organization folder
        # Only allow deletion of sub-folders
        if folder_full_path == base_prefix.rstrip('/'):
            return create_error_response("Cannot delete root organization folder", 400)
        
        # Ensure the folder path ends with /
        if not folder_full_path.endswith('/'):
            folder_full_path += '/'
        
        # This prevents cross-tenant data access/deletion
        if not folder_full_path.startswith(base_prefix):
            logger.warning(
                f"Unauthorized delete attempt: organization {organization_id} tried to delete folder '{folder_path}' "
                f"which doesn't belong to them (expected prefix: {base_prefix})"
            )
            return create_error_response(
                "Unauthorized: Folder does not belong to your organization", 403
            )
        
        blob_storage_manager = BlobStorageManager()
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
        
        # List all blobs with this prefix (includes all files and subfolders)
        blobs_to_delete = list(container_client.list_blobs(name_starts_with=folder_full_path))
        
        if not blobs_to_delete:
            return create_error_response("Folder not found or is empty", 404)
        
        # Delete all blobs with this prefix
        deleted_count = 0
        failed_deletions = []
        
        for blob in blobs_to_delete:
            try:
                blob_client = container_client.get_blob_client(blob.name)
                blob_client.delete_blob()
                deleted_count += 1
                logger.info(f"Deleted blob: {blob.name}")
            except Exception as delete_error:
                logger.error(f"Failed to delete blob {blob.name}: {delete_error}")
                failed_deletions.append(blob.name)
        
        if failed_deletions:
            logger.warning(f"Some files could not be deleted: {failed_deletions}")
            return create_success_response({
                "message": f"Folder partially deleted. {deleted_count} files deleted, {len(failed_deletions)} failed.",
                "deleted_count": deleted_count,
                "failed_count": len(failed_deletions),
                "failed_files": failed_deletions
            }, 200)
        
        logger.info(f"Successfully deleted folder '{folder_path}' with {deleted_count} files for organization {organization_id}")
        
        return create_success_response({
            "message": "Folder deleted successfully",
            "deleted_count": deleted_count,
            "folder_path": folder_path
        }, 200)
        
    except Exception as e:
        logger.exception(f"Unexpected error in delete_folder: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/get-password-reset-url", methods=["GET"])
@auth.login_required
def get_password_reset_url(*, context):
    tenant = os.getenv("AAD_TENANT_NAME")
    policy = os.getenv("ADD_CHANGE_PASSWORD")
    client_id = os.getenv("AAD_CLIENT_ID")
    redirect_uri = os.getenv("AAD_REDIRECT_URI")
    nonce = "defaultNonce"
    scope = "openid"
    response_type = "code"

    url = f"https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}/oauth2/v2.0/authorize"
    url += f"?client_id={client_id}&redirect_uri={redirect_uri}&response_type={response_type}&scope={scope}&nonce={nonce}"

    return jsonify({"resetUrl": url})


@app.route("/api/webscraping/scrape-url", methods=["POST"])
@auth.login_required
def scrape_url(*, context):
    """
    Endpoint to scrape a single URL using the external web scraping service.
    Expects a JSON payload with a 'url' string and optionally 'organization_id'.
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)

        # Validate required fields
        url = data.get("url")
        organization_id = data.get(
            "organization_id"
        )  # Optional for backwards compatibility

        if not url:
            return create_error_response("URL field is required", 400)

        # Extract user information from request headers
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

        # Get the external scraping service endpoint
        WEB_SCRAPING_ENDPOINT = os.getenv("ORCHESTRATOR_URI") + "/api/scrape-page"
        if not WEB_SCRAPING_ENDPOINT:
            return create_error_response("Scraping service endpoint is not set", 500)

        # Initialize result
        blob_storage_results = []

        # Prepare payload for external scraping service
        payload = {"url": url, "client_principal_id": client_principal_id}
        orch_function_key = current_app.config["ORCH_FUNCTION_KEY"]
        if not orch_function_key:
            return create_error_response(
                "Scraping service function key is not set", 500
            )

        # Make request to external scraping service
        try:
            response = requests.post(
                WEB_SCRAPING_ENDPOINT,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-functions-key": orch_function_key,
                },
                timeout=120,
            )

            # Check if request was successful
            if not response.ok:
                logger.error(
                    f"Scraping service returned error for {url}: {response.status_code} - {response.text}"
                )
                return create_error_response(
                    f"Scraping service error: {response.status_code}",
                    response.status_code,
                )

            # Parse response from scraping service
            try:
                scraping_result = response.json()
            except ValueError:
                logger.error(f"Invalid JSON response from scraping service for {url}")
                return create_error_response(
                    "Invalid response from scraping service", 500
                )

            # Simple success check - external service returns "completed" for success
            scraping_success = scraping_result.get("status") == "completed"

            # Extract data from the results array (single URL, so take first result)
            first_result = (
                scraping_result.get("results", [{}])[0] if scraping_success else {}
            )

            # Create a simple formatted result for database and frontend
            formatted_result = {
                "url": url,
                "status": "success" if scraping_success else "error",
                "title": first_result.get("title"),
                "content_length": first_result.get("content_length"),
                "blob_path": scraping_result.get("blob_storage_result", {}).get(
                    "blob_path"
                ),
                "error": None if scraping_success else "Scraping failed",
            }

            # If organization_id is provided, save the URL to the database
            if organization_id and organization_id.strip():
                try:
                    # Extract blob storage info from scraping result
                    if scraping_result.get("blob_url") and scraping_result.get(
                        "blob_name"
                    ):
                        blob_storage_results.append(
                            {
                                "blob_url": scraping_result["blob_url"],
                                "blob_name": scraping_result["blob_name"],
                                "container_name": scraping_result.get(
                                    "container_name", "knowledge-sources"
                                ),
                            }
                        )

                    # Save URL to database using the correctly formatted result
                    result = add_or_update_organization_url(
                        organization_id=organization_id,
                        url=url,
                        scraping_result=formatted_result,  # Use formatted result with correct status
                        added_by_id=client_principal_id,
                        added_by_name=client_principal_name,
                    )
                    action = result.get("action", "processed")
                    logger.info(
                        f"{action.capitalize()} URL {url} for organization {organization_id} by {client_principal_name or 'Unknown'}"
                    )

                except Exception as e:
                    logger.error(f"Error saving URL to Cosmos DB: {str(e)}")
                    # Don't fail the entire request if database save fails

            # Return response with correct status and summary
            return (
                jsonify(
                    {
                        "status": "success",
                        "data": {
                            "result": {
                                "results": [formatted_result],
                                "summary": {
                                    "total_urls": 1,
                                    "successful_scrapes": 1 if scraping_success else 0,
                                    "failed_scrapes": 0 if scraping_success else 1,
                                },
                            },
                            "blob_storage_results": blob_storage_results,
                        },
                    }
                ),
                200,
            )

        except requests.Timeout:
            logger.error(f"Timeout while scraping {url}")
            return create_error_response("Scraping service timeout", 504)
        except requests.RequestException as e:
            logger.error(f"Request error while scraping {url}: {str(e)}")
            return create_error_response("Failed to connect to scraping service", 502)

    except Exception as e:
        logger.error(f"Unexpected error in scrape_url: {str(e)}")
        return create_error_response("Internal server error", 500)


@app.route("/api/webscraping/multipage-scrape", methods=["POST"])
@auth.login_required
def multipage_scrape(*, context):
    """
    Endpoint to scrape URLs using the external multipage scraping service.
    This is a proxy endpoint that forwards requests to the orchestrator's multipage-scrape endpoint.
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)

        # Validate required fields
        url = data.get("url")
        if not url:
            return create_error_response("URL field is required", 400)

        # Extract user information from request headers
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

        # Get the external multipage scraping service endpoint
        MULTIPAGE_SCRAPING_ENDPOINT = (
            os.getenv("ORCHESTRATOR_URI") + "/api/multipage-scrape"
        )
        if not MULTIPAGE_SCRAPING_ENDPOINT:
            return create_error_response(
                "Multipage scraping service endpoint is not set", 500
            )

        payload = {"url": url, "client_principal_id": client_principal_id}

        # Include organization_id
        organization_id = data.get("organization_id")
        if organization_id:
            payload["organization_id"] = organization_id

        # Forward the request to the orchestrator's multipage-scrape endpoint
        try:
            orch_function_key = current_app.config["ORCH_FUNCTION_KEY"]

            logger.info(
                f"Forwarding multipage scrape request for {url} to orchestrator"
            )
            response = requests.post(
                MULTIPAGE_SCRAPING_ENDPOINT,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-functions-key": orch_function_key,
                },
                timeout=120,  # 2 minute timeout for multipage scraping
            )

            # Check if request was successful
            if not response.ok:
                logger.error(
                    f"Multipage scraping service returned error: {response.status_code} - {response.text}"
                )
                return create_error_response(
                    f"Multipage scraping service error: {response.status_code}",
                    response.status_code,
                )

            # Parse and return the response from the orchestrator
            try:
                scraping_result = response.json()
                logger.info(f"Successfully received multipage scraping response")

                # If organization_id is provided, save the successfully scraped URLs to the database
                if organization_id and organization_id.strip():
                    client_principal_name = request.headers.get(
                        "X-MS-CLIENT-PRINCIPAL-NAME"
                    )

                    # Check overall status first - accept both 'success' and 'completed'
                    if scraping_result.get("status") in ["success", "completed"]:
                        results = scraping_result.get("results", [])
                        root_blob_result = scraping_result.get(
                            "blob_storage_result", {}
                        )

                        for result in results:
                            try:
                                # For multipage results, check if we have raw_content (indicates successful scraping)
                                if result.get("raw_content"):
                                    blob_path = None
                                    result_status = "error"  # Default to error

                                    # Look for this URL in successful_uploads
                                    successful_uploads = root_blob_result.get(
                                        "successful_uploads", []
                                    )
                                    logger.info(
                                        f"Checking URL {result.get('url')} against {len(successful_uploads)} successful uploads"
                                    )
                                    for upload in successful_uploads:
                                        if upload.get("url") == result.get("url"):
                                            blob_path = upload.get("blob_path")
                                            result_status = "success"
                                            logger.info(
                                                f"Found matching URL {result.get('url')} with blob_path {blob_path}"
                                            )
                                            break

                                    if result_status == "error":
                                        logger.warning(
                                            f"URL {result.get('url')} not found in successful_uploads"
                                        )

                                    # Format the result for database storage
                                    formatted_result = {
                                        "url": result.get("url"),
                                        "status": result_status,
                                        "title": result.get("title"),
                                        "content_length": len(
                                            result.get("raw_content", "")
                                        ),
                                        "blob_path": blob_path,
                                        "error": (
                                            None
                                            if result_status == "success"
                                            else "Blob storage failed"
                                        ),
                                    }

                                    # Save URL to database
                                    db_result = add_or_update_organization_url(
                                        organization_id=organization_id,
                                        url=result.get("url"),
                                        scraping_result=formatted_result,
                                        added_by_id=client_principal_id,
                                        added_by_name=client_principal_name,
                                    )
                                    action = db_result.get("action", "processed")
                                    logger.info(
                                        f"{action.capitalize()} URL {result.get('url')} for organization {organization_id} by {client_principal_name or 'Unknown'} with status {result_status}"
                                    )

                            except Exception as e:
                                logger.error(
                                    f"Error saving URL {result.get('url', 'unknown')} to Cosmos DB: {str(e)}"
                                )
                                continue
                if "blob_storage_result" not in scraping_result:
                    results = scraping_result.get("results", [])
                    total_results = len(results)

                    scraping_result["blob_storage_result"] = {
                        "status": "error" if total_results > 0 else "success",
                        "message": "No blob storage information provided by orchestrator",
                        "successful_count": 0,
                        "total_count": total_results,
                    }

                return jsonify(scraping_result), 200

            except ValueError:
                logger.error("Invalid JSON response from multipage scraping service")
                return create_error_response(
                    "Invalid response from multipage scraping service", 500
                )

        except requests.Timeout:
            logger.error("Timeout while calling multipage scraping service")
            return create_error_response("Multipage scraping service timeout", 504)
        except requests.RequestException as e:
            logger.error(
                f"Request error while calling multipage scraping service: {str(e)}"
            )
            return create_error_response(
                "Failed to connect to multipage scraping service", 502
            )

    except Exception as e:
        logger.error(f"Unexpected error in multipage_scrape: {str(e)}")
        return create_error_response("Internal server error", 500)


@app.route("/api/webscraping/get-urls", methods=["GET"])
@auth.login_required
def get_organization_urls_endpoint(*, context):
    try:
        organization_id = request.args.get("organization_id")
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        urls = get_organization_urls(organization_id)
        return create_success_response(urls, 200)
    except Exception as e:
        logger.exception(f"Unexpected error in get_organization_urls: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/webscraping/delete-url", methods=["DELETE"])
@auth.login_required
def delete_url_endpoint(*, context):
    try:
        url_id = request.args.get("url_id")
        organization_id = request.args.get("organization_id")
        if not url_id:
            return create_error_response("URL ID is required", 400)
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        delete_url_by_id(url_id, organization_id)
        return create_success_response({"message": "URL deleted successfully"}, 200)
    except Exception as e:
        logger.exception(f"Unexpected error in delete_url: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/webscraping/search-urls", methods=["GET"])
@auth.login_required
def filter_urls(*, context):
    try:
        search_term = request.args.get("search_term")
        organization_id = request.args.get("organization_id")
        if not search_term:
            return create_error_response("Search term is required", 400)
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        urls = search_urls(search_term, organization_id)
        return create_success_response(urls, 200)
    except Exception as e:
        logger.exception(f"Unexpected error in search_urls: {e}")
        return create_error_response("Internal Server Error", 500)


@app.route("/api/webscraping/modify-url", methods=["PUT"])
@auth.login_required
def update_url(*, context):
    """
    Update a URL for web scraping in an organization.

    Request Body:
    {
        "url_id": "string",
        "organization_id": "string",
        "new_url": "string"
    }

    Example Usage:
    PUT /api/webscraping/modify-url
    Content-Type: application/json
    Authorization: Bearer <token>

    {
        "url_id": "123e4567-e89b-12d3-a456-426614174000",
        "organization_id": "org-456",
        "new_url": "https://newexample.com"
    }

    Returns:
        JSON response with success message or error details
    """
    try:
        # Parse and validate request body
        data = request.get_json()
        if not data:
            return create_error_response("Invalid or missing JSON payload", 400)

        # Validate required fields
        required_fields = ["url_id", "organization_id", "new_url"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return create_error_response(
                f"Missing required fields: {', '.join(missing_fields)}", 400
            )

        url_id = data["url_id"]
        organization_id = data["organization_id"]
        new_url = data["new_url"]

        # Validate data types and content
        if not isinstance(new_url, str) or not new_url.strip():
            return create_error_response("new_url must be a non-empty string", 400)

        # Validate URL format
        is_valid, error_msg = validate_url(new_url)
        if not is_valid:
            return create_error_response(f"Invalid URL: {error_msg}", 400)

        modify_url(url_id, organization_id, new_url)
        return create_success_response({"message": "URL modified successfully"}, 200)

    except NotFound:
        return create_error_response("URL not found", 404)
    except CosmosHttpResponseError as e:
        logger.exception(f"Database error in modify_url: {e}")
        return create_error_response("Database error", 500)
    except Exception as e:
        logger.exception(f"Unexpected error in modify_url: {e}")
        return create_error_response("Internal Server Error", 500)


@app.get("/healthz")
def healthz():
    _ = clients.get_cosmos_container(clients.USERS_CONT)
    return jsonify(status="ok")


@app.route("/api/organization/<organization_id>/gallery", methods=["GET"])
@auth.login_required
def get_gallery(*, context, organization_id):
    """
    Retrieve gallery items for a specific organization.

    Query Parameters:
        sort (str, optional): Sort order - 'newest' or 'oldest'. Defaults to 'newest'.
        page (int, optional): Page number (1-based). Defaults to 1.
        limit (int, optional): Items per page. Defaults to 20, max 100.

    Args:
        organization_id (str): The unique identifier of the organization.

    Returns:
        Response: JSON response containing paginated gallery items (HTTP 200),
                  or an error response with an appropriate message and status code.

    Error Codes:
        400: If organization_id is missing or invalid.
        404: If no gallery items are found for the organization.
        500: If an unexpected error occurs during retrieval.
    """
    if (
        not organization_id
        or not isinstance(organization_id, str)
        or not organization_id.strip()
    ):
        return create_error_response(
            "Organization ID is required and must be a non-empty string.", 400
        )
    try:
        uploader_id = request.args.get("uploader_id")
        order = (request.args.get("order") or "newest").lower()
        search_query = request.args.get("query") or request.args.get("q")

        # Pagination parameters
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))

        result = get_gallery_items_by_org(
            organization_id,
            uploader_id=uploader_id,
            order=order,
            query=search_query,
            page=page,
            limit=limit,
        )

        return create_success_response(result, 200)

    except ValueError as ve:
        logger.error(
            f"Value error retrieving gallery items for org {organization_id}: {ve}"
        )
        return create_error_response(str(ve), 400)
    except CosmosHttpResponseError as ce:
        logger.error(
            f"Cosmos DB error retrieving gallery items for org {organization_id}: {ce}"
        )
        return create_error_response("Database error retrieving gallery items.", 500)
    except Exception as e:
        logger.exception(
            f"Unexpected error retrieving gallery items for org {organization_id}: {e}"
        )
        return create_error_response("Internal Server Error", 500)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
