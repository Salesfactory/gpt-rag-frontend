from functools import wraps
import logging
import uuid
import os

import requests
from shared.cosmo_db import get_cosmos_container, get_subscription_tier_by_id, get_organization_usage
from flask import request, jsonify, Flask
from http import HTTPStatus
from typing import Tuple, Dict, Any
from azure.cosmos.exceptions import CosmosHttpResponseError
from datetime import datetime, timezone, timedelta
from time import time
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
import urllib.parse
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError
from werkzeug.exceptions import NotFound
from urllib.parse import urlparse

from shared.cosmo_db import (
    get_organization_subscription,
    get_subscription_tier_by_id, 
    get_organization_usage,
    upsert_organization_usage,
    get_user_organizations
)

AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")

if not AZURE_DB_ID:
    raise ValueError("AZURE_DB_ID is not set in environment variables")

AZURE_DB_URI = f"https://{AZURE_DB_ID}.documents.azure.com:443/"

AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")
AZURE_DB_URI = f"https://{AZURE_DB_ID}.documents.azure.com:443/"

AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")

if not AZURE_DB_ID:
    raise ValueError("AZURE_DB_ID is not set in environment variables")

if not AZURE_DB_NAME:
    raise ValueError("AZURE_DB_NAME is not set in environment variables")


AZURE_DB_URI = f"https://{AZURE_DB_ID}.documents.azure.com:443/"

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
def create_success_response(
    data: Dict[str, Any], optionalCode=HTTPStatus.OK
) -> JsonResponse:
    """
    Create a standardized success response.
    Response Formatting: Ensures consistent success response structure.
    """
    return jsonify({"data": data, "status": optionalCode}), optionalCode

def create_error_response_with_body(message: str, status_code: int, body: Dict[str, Any]) -> JsonResponse:
    """
    Create a standardized error response with additional body data.
    Response Formatting: Ensures consistent error response structure with extra context.
    """
    response_body = {"error": {"message": message, "status": status_code, **body}}
    return jsonify(response_body), status_code

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
            return create_error_response(
                "Missing required client principal ID", HTTPStatus.UNAUTHORIZED
            )
        return f(*args, **kwargs)

    return decorated_function


################################################
# Financial Doc Ingestion Utils
################################################

# utils.py
import os
import logging
from pathlib import Path
import pdfkit
from typing import Dict, Any, Tuple, Optional, Union
import logging
import shutil
from app_config import ALLOWED_FILING_TYPES


# configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

################################################
# financialDocument (EDGAR) Ingestion
################################################


def validate_payload(data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate the request payload for Edgar financialDocument endpoint

    Args:
        data (dict): The request payload

    Returns:
        tuple: (is_valid: bool, error_message: str)
    """
    # Check if equity_ids exists and is not empty
    if not data.get("equity_id"):
        return False, "equity_id is required"

    # check if date is provided
    if not data.get("after_date"):
        logger.warning("No after_date provided, retrieving most recent filings")

    # Check if equity_ids is not empty
    if data["equity_id"].strip() == "":
        return False, "equity_id cannot be empty"

    # Validate filing_types if provided
    if not data.get("filing_type"):
        return False, "filing_type is required"

    # Check if all filing types are valid
    if data["filing_type"] not in ALLOWED_FILING_TYPES:
        return (
            False,
            f"Invalid filing type(s): {data['filing_type']}. Allowed types are: {', '.join(ALLOWED_FILING_TYPES)}",
        )

    return True, ""


def convert_html_to_pdf(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    options: Optional[Dict] = None,
) -> bool:
    """
    Convert HTML file to PDF using wkhtmltopdf.

    Args:
        input_path (Union[str, Path]): Path to the input HTML file
        output_path (Union[str, Path]): Path where the PDF will be saved
        wkhtmltopdf_path (Optional[str]): Path to wkhtmltopdf executable
        options (Optional[Dict]): Additional options for PDF conversion

    Returns:
        bool: True if conversion was successful, False otherwise

    Raises:
        FileNotFoundError: If input file or wkhtmltopdf executable doesn't exist
        OSError: If there's an error during PDF conversion
        Exception: For other unexpected errors
    """

    try:
        # Convert paths to Path objects for better path handling
        input_path = Path(input_path)
        output_path = Path(output_path)

        # Validate input file exists
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        # Create output directory if it doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Default options if none provided
        if options is None:
            options = {
                "quiet": "",
                "enable-local-file-access": "",
                "encoding": "UTF-8",
                "no-stop-slow-scripts": "",
                "disable-smart-shrinking": "",
            }

        logger.info(f"Converting {input_path} to PDF...")

        # Perform conversion
        pdfkit.from_file(str(input_path), str(output_path), options=options)

        # Verify the output file was created
        if not output_path.exists():
            raise OSError("PDF file was not created")

        logger.info(f"Successfully converted to PDF: {output_path}")
        return True

    except FileNotFoundError as e:
        logger.error(f"File not found error: {str(e)}")
        raise

    except OSError as e:
        logger.error(f"PDF conversion error: {str(e)}")
        # Clean up partial output file if it exists
        if output_path.exists():
            output_path.unlink()
        raise

    except Exception as e:
        logger.error(f"Unexpected error during PDF conversion: {str(e)}")
        # Clean up partial output file if it exists
        if output_path.exists():
            output_path.unlink()
        raise


def check_and_install_wkhtmltopdf():
    """Check if wkhtmltopdf is installed and configured properly"""
    import subprocess
    import sys
    import os

    try:
        # For Windows, add wkhtmltopdf to PATH if not already present
        if sys.platform == "win32":
            wkhtmltopdf_path = r"C:\Program Files\wkhtmltopdf\bin"
            logger.info(f"Windows detected")
            if os.path.exists(wkhtmltopdf_path):
                logger.info(f"wkhtmltopdf directory found at {wkhtmltopdf_path}")
                if wkhtmltopdf_path not in os.environ["PATH"]:
                    logger.info(f"Adding wkhtmltopdf to PATH: {wkhtmltopdf_path}")
                    os.environ["PATH"] += os.pathsep + wkhtmltopdf_path
            else:
                logger.warning(f"wkhtmltopdf directory not found at {wkhtmltopdf_path}")
                return install_wkhtmltopdf()

        # Try to run wkhtmltopdf --version
        result = subprocess.run(
            ["wkhtmltopdf", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            text=True,
        )
        logger.info(
            f"wkhtmltopdf is installed and configured. Version: {result.stdout.strip()}"
        )
        return True

    except (subprocess.SubprocessError, FileNotFoundError):
        logger.warning("wkhtmltopdf not found or not properly configured")
        return install_wkhtmltopdf()
    except Exception as e:
        logger.error(f"Unexpected error checking wkhtmltopdf: {str(e)}")
        return False


def install_wkhtmltopdf():
    """Attempt to install wkhtmltopdf based on the operating system"""
    import subprocess
    import sys
    import platform

    if sys.platform == "win32":
        # Windows installation code remains the same
        download_url = "https://wkhtmltopdf.org/downloads.html"
        logger.error(
            "Automatic installation not supported on Windows. "
            "Please install wkhtmltopdf manually:\n"
            "1. Download from: " + download_url + "\n"
            "2. Install to default location (C:\\Program Files\\wkhtmltopdf)\n"
            "3. Add C:\\Program Files\\wkhtmltopdf\\bin to your system PATH"
        )
        return False

    elif sys.platform.startswith("linux"):
        try:
            logger.info("Installing wkhtmltopdf on Linux...")

            # Try to determine the package manager
            if (
                subprocess.run(
                    ["which", "apt-get"], stdout=subprocess.PIPE, stderr=subprocess.PIPE
                ).returncode
                == 0
            ):
                # Debian/Ubuntu
                install_cmd = ["apt-get", "install", "-y", "wkhtmltopdf"]
            elif (
                subprocess.run(
                    ["which", "yum"], stdout=subprocess.PIPE, stderr=subprocess.PIPE
                ).returncode
                == 0
            ):
                # CentOS/RHEL
                install_cmd = ["yum", "install", "-y", "wkhtmltopdf"]
            else:
                logger.error(
                    "Could not determine package manager. Please install wkhtmltopdf manually."
                )
                return False

            # Try to install without sudo first
            try:
                subprocess.run(install_cmd, check=True)
            except subprocess.CalledProcessError:
                # If that fails, try with sudo if available
                if (
                    subprocess.run(
                        ["which", "sudo"],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                    ).returncode
                    == 0
                ):
                    install_cmd.insert(0, "sudo")
                    subprocess.run(install_cmd, check=True)
                else:
                    logger.error(
                        "Installation requires root privileges. Please install wkhtmltopdf manually."
                    )
                    return False

            logger.info("wkhtmltopdf installed successfully")
            return True

        except subprocess.SubprocessError as e:
            logger.error(f"Failed to install wkhtmltopdf: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during installation: {str(e)}")
            return False
    else:
        logger.error(f"Unsupported operating system: {sys.platform}")
        return False


def cleanup_resources() -> bool:
    # Delete all files in the sec-edgar-filings directory
    try:
        filings_dir = os.path.join(os.getcwd(), "sec-edgar-filings")
        if os.path.exists(filings_dir):
            logger.info(f"Deleting all files in {filings_dir}")
            shutil.rmtree(filings_dir)
            logger.info(f"Deleted all files in {filings_dir}")
            return True
        else:
            logger.info(
                f"No files to delete in {filings_dir} - directory does not exist"
            )
            return True
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        return False


def _extract_response_data(response):
    """Helper function to extract JSON data from response objects"""
    if isinstance(response, tuple):
        return response[0].get_json()
    return response.get_json()


################################################
# Email distribution Utils
################################################
from typing import List
from email.message import EmailMessage
import smtplib

EMAIL_CONTAINER_NAME = "emails"


class EmailServiceError(Exception):
    """Base exception for email service errors"""

    pass


class EmailService:
    def __init__(self, smtp_server, smtp_port, username, password):
        self.smtp_server = smtp_server
        self.smtp_port = int(smtp_port)
        self.username = username
        self.password = password
        self._server = None

    def _get_server(self):
        """Get or create SMTP server connection with SSL"""
        if self._server is None:
            try:
                # Use SMTP_SSL instead of SMTP
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, timeout=30)
                server.login(self.username, self.password)
                self._server = server
            except Exception as e:
                logger.error(f"Failed to create SMTP connection: {str(e)}")
                raise EmailServiceError(f"SMTP connection failed: {str(e)}")
        return self._server

    def send_email(self, subject, html_content, recipients, attachment_path=None):
        max_retries = 3
        retry_delay = 2  # seconds
        import time

        for attempt in range(max_retries):
            try:
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = self.username
                msg["To"] = ",".join(recipients)
                msg.add_alternative(html_content, subtype="html")

                if attachment_path:
                    self._add_attachment(msg, attachment_path)

                server = self._get_server()
                server.send_message(msg)
                return  # Success, exit the function

            except smtplib.SMTPServerDisconnected:
                logger.warning(
                    f"SMTP server disconnected (attempt {attempt + 1}/{max_retries})"
                )
                self._server = None  # Reset the connection
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                raise EmailServiceError(
                    "Failed to maintain SMTP connection after multiple attempts"
                )

            except Exception as e:
                logger.error(
                    f"Error sending email (attempt {attempt + 1}/{max_retries}): {str(e)}"
                )
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                raise EmailServiceError(f"Failed to send email: {str(e)}")

    def _add_attachment(self, msg, attachment_path):
        """Add an attachment to the email message"""
        try:
            # convert to path object and resolve to absolute path
            file_path = Path(attachment_path).resolve()
            # validate file exists and is accessible
            if not file_path.exists():
                raise EmailServiceError(f"File not found: {attachment_path}")

            with open(file_path, "rb") as file:
                file_data = file.read()
                file_name = file_path.name
                msg.add_attachment(
                    file_data,
                    maintype="application",
                    subtype="octet-stream",
                    filename=file_name,
                )
        except (OSError, EmailServiceError) as e:
            logger.error(f"Error adding attachment: {str(e)}")
            raise EmailServiceError(f"Error adding attachment: {str(e)}")

    def _save_email_to_blob(
        self,
        html_content: str,
        subject: str,
        recipients: List[str],
        attachment_path: Optional[str] = None,
    ) -> str:
        """
        Save the email content to a blob storage container
        """
        from azure.storage.blob import BlobServiceClient
        from datetime import datetime, timezone
        from azure.storage.blob import ContentSettings
        from azure.identity import DefaultAzureCredential
        from financial_doc_processor import BlobUploadError
        import uuid

        credential = DefaultAzureCredential()
        BLOB_STORAGE_URL = (
            f"https://{os.getenv('STORAGE_ACCOUNT')}.blob.core.windows.net"
        )
        blob_service_client = BlobServiceClient(
            account_url=BLOB_STORAGE_URL, credential=credential
        )
        blob_container_client = blob_service_client.get_container_client(
            EMAIL_CONTAINER_NAME
        )
        # create an id for the email
        email_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        # get date only from timestamp
        date_only = timestamp.split("T")[0]

        # create a blob name for the email
        blob_name = f"{date_only}/{email_id}/content.html"

        # add metadata to the blob
        metadata = {
            "email_id": email_id,
            "subject": subject,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "recipients": ", ".join(recipients),
            "has_attachment": str(bool(attachment_path)),
        }

        # upload the email content to the blob
        try:
            blob_container_client.upload_blob(
                blob_name,
                html_content,
                metadata=metadata,
                content_settings=ContentSettings(content_type="text/html"),
            )
        except BlobUploadError as e:
            logger.error(f"Error uploading email to blob: {str(e)}")
            raise BlobUploadError(f"Error uploading email to blob: {str(e)}")

        # return the blob name
        return blob_name


################################################
# Chat History show a previous chat of the user
################################################


def get_conversation(conversation_id, user_id):
    try:
        if not conversation_id:
            raise ValueError("conversation_id is required")
        if not user_id:
            raise ValueError("user_id is required")

        container = get_cosmos_container("conversations")

        conversation = container.read_item(
            item=conversation_id, partition_key=user_id
        )
        if conversation["conversation_data"]["interaction"]["user_id"] != user_id:
            return {}
        formatted_conversation = {
            "id": conversation_id,
            "start_date": conversation["conversation_data"]["start_date"],
            "messages": [
                {
                    "role": message["role"],
                    "content": message["content"],
                    "thoughts": message["thoughts"] if "thoughts" in message else "",
                    "data_points": (
                        message["data_points"] if "data_points" in message else ""
                    ),
                }
                for message in conversation["conversation_data"]["history"]
            ],
            "type": (
                conversation["conversation_data"]["type"]
                if "type" in conversation["conversation_data"]
                else "default"
            ),
        }
        return formatted_conversation
    except Exception:
        logging.error(f"Error retrieving the conversation '{conversation_id}'")
        return {}


def delete_conversation(conversation_id, user_id):
    try:
        if not conversation_id:
            raise ValueError("conversation_id is required")
        if not user_id:
            raise ValueError("user_id is required")

        container = get_cosmos_container("conversations")

        conversation = container.read_item(
            item=conversation_id, partition_key=user_id
        )

        if conversation["conversation_data"]["interaction"]["user_id"] != user_id:
            raise Exception("User does not have permission to delete this conversation")

        container.delete_item(item=conversation_id, partition_key=user_id)

        return True
    except Exception as e:
        logging.error(f"Error deleting conversation '{conversation_id}': {str(e)}")
        return False


################################################
# Chat History Get All Chats From User
################################################


def get_conversations(user_id):
    try:
        credential = DefaultAzureCredential()
        db_client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
        db = db_client.get_database_client(database=AZURE_DB_NAME)
        container = db.get_container_client("conversations")

        # Fetch all conversations for the user
        query = """
            SELECT c.id, c.conversation_data.start_date, 
                   c.conversation_data.history[0].content AS first_message, 
                   c.conversation_data.type,
                   c.conversation_data.interaction.organization_id
            FROM c 
            WHERE c.conversation_data.interaction.user_id = @user_id
        """
        parameters = [dict(name="@user_id", value=user_id)]

        try:
            conversations = list(
                container.query_items(
                    query=query,
                    parameters=parameters,
                    partition_key=user_id,
                )
            )
        except CosmosHttpResponseError as e:
            logging.error(
                f"CosmosDB error retrieving conversations for user '{user_id}': {e}"
            )
            return []
        except Exception as e:
            logging.exception(
                f"Unexpected error retrieving conversations for user '{user_id}': {e}"
            )
            return []

        # DEFAULT DATE 1 YEAR AGO in case start_date is not present
        now = datetime.now()
        one_year_ago = now - timedelta(days=365)
        default_date = one_year_ago.strftime("%Y-%m-%d %H:%M:%S")

        formatted_conversations = []
        for con in conversations:
            formatted_conversations.append({
                "id": con["id"],
                "start_date": con.get("start_date", default_date),
                "content": con.get("first_message", "No content"),
                "type": con.get("type", "default"),
                "organization_id": con.get("organization_id", ""),  # always include, empty string if missing
            })

        return formatted_conversations
    except Exception as e:
        logging.error(
            f"Error retrieving the conversations for user '{user_id}': {str(e)}"
        )
        return []


################################################
# AZURE GET SECRET
################################################
def get_azure_key_vault_secret(secret_name):
    """
    Retrieve a secret value from Azure Key Vault.

    Args:
        secret_name (str): The name of the secret to retrieve.

    Returns:
        str: The value of the secret.

    Raises:
        Exception: If the secret cannot be retrieved.
    """
    from azure.keyvault.secrets import SecretClient
    from azure.identity import DefaultAzureCredential

    try:
        keyVaultName = os.getenv("AZURE_KEY_VAULT_NAME")
        if not keyVaultName:
            raise ValueError("Environment variable 'AZURE_KEY_VAULT_NAME' is not set.")

        KVUri = f"https://{keyVaultName}.vault.azure.net"
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=KVUri, credential=credential)
        logging.info(
            f"[webbackend] retrieving {secret_name} secret from {keyVaultName}."
        )
        retrieved_secret = client.get_secret(secret_name)
        return retrieved_secret.value
    except Exception as e:
        logging.error(f"Failed to retrieve secret '{secret_name}': {e}")
        raise

################################################
# SETTINGS UTILS
################################################


def set_settings(client_principal, temperature, model, font_family, font_size, detail_level=None):

    new_setting = {}
    container = get_cosmos_container("settings")

    # set default values
    temperature = temperature if temperature is not None else 0.0
    model = model if model is not None else "gpt-4.1"

    # validate temperature
    if temperature < 0 or temperature > 1:
        logging.error(
            f"[util__module] set_settings: invalid temperature value {temperature}."
        )
        return

    # Add validation for model if necessary
    allowed_models = ["gpt-4.1", "Claude-4.5-Sonnet"]
    if model not in allowed_models:
        logging.error(f"[util__module] set_settings: invalid model value {model}.")
        return

    # validate detail level
    if detail_level is not None:
        allowed_detail_levels = ["brief", "balanced", "detailed"]
        if detail_level not in allowed_detail_levels:
            logging.error(f"[util__module] set_settings: invalid detail_level value {detail_level}.")
            return

    if client_principal["id"]:
        query = "SELECT * FROM c WHERE c.user_id = @user_id"
        parameters = [{"name": "@user_id", "value": client_principal["id"]}]

        logging.info(
            f"[util__module] set_settings: Querying settings for user_id {client_principal['id']}."
        )

        results = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )

        if results:
            logging.info(
                f"[util__module] set_settings: Found existing settings for user_id {client_principal['id']}."
            )
            setting = results[0]

            # Update only temperature and model
            setting["temperature"] = temperature
            setting["model"] = model

            if font_family is not None:
                setting["font_family"] = font_family
            if font_size is not None:
                setting["font_size"] = font_size
            if detail_level is not None:
                setting["detail_level"] = detail_level

            try:
                container.replace_item(item=setting["id"], body=setting)
                logging.info(
                    f"Successfully updated settings document for user {client_principal['id']}"
                )
                return {"status": "success", "message": "Settings updated successfully"}
            except CosmosResourceNotFoundError:
                # This case should ideally not happen if results were found, but handle defensively
                logging.error(
                    f"[util__module] CosmosResourceNotFoundError during update for user {client_principal['id']}"
                )
                return {
                    "status": "error",
                    "message": "Settings not found during update.",
                }
            except Exception as e:
                logging.error(
                    f"[util__module] Failed to update settings document for user {client_principal['id']}. Error: {str(e)}"
                )
                return {
                    "status": "error",
                    "message": f"Failed to update settings: {str(e)}",
                }
        else:
            logging.info(
                f"[util__module] set_settings: No settings found for user_id {client_principal['id']}. Creating new document."
            )

            try:
                new_setting["id"] = str(uuid.uuid4())
                new_setting["user_id"] = client_principal["id"]
                new_setting["temperature"] = temperature
                new_setting["model"] = model
                new_setting["font_family"] = font_family or ""
                new_setting["font_size"] = font_size or ""
                new_setting["detail_level"] = detail_level or "balanced"
                container.create_item(body=new_setting)

                logging.info(
                    f"Successfully created new settings document for user {client_principal['id']}"
                )
                return {"status": "success", "message": "Settings created successfully"}
            except Exception as e:
                logging.error(
                    f"[util__module] Failed to create settings document for user {client_principal['id']}. Error: {str(e)}"
                )
                return {
                    "status": "error",
                    "message": f"Failed to create settings: {str(e)}",
                }
    else:
        logging.warning(
            f"[util__module] set_settings: user_id not provided in client_principal."
        )
        return {"status": "error", "message": "User ID not provided."}


def get_client_principal():
    """Util to extract the Client Principal Headers"""
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            None,
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    return {"id": client_principal_id, "name": client_principal_name}, None, None


def get_setting(client_principal):
    if not client_principal or not client_principal.get("id"):
        logging.warning("[util__module] get_setting: client_principal ID not provided.")
        # Return defaults immediately if no user ID
        return {
            "temperature": 0.0,
            "model": "gpt-4.1",  # Default model
            "font_family": "",
            "font_size": "",
            "detail_level": "balanced",
        }

    user_id = client_principal["id"]
    logging.info(f"User ID found ({user_id}). Getting settings.")

    setting = {}
    container = get_cosmos_container("settings")
    try:
        query = "SELECT c.temperature, c.model, c.font_family, c.font_size, c.detail_level FROM c WHERE c.user_id = @user_id"
        parameters = [{"name": "@user_id", "value": user_id}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if result:
            setting = result[0]
            setting["temperature"] = setting.get("temperature", 0.0)
            setting["model"] = setting.get("model", "gpt-4.1")
            setting["font_family"] = setting.get("font_family", "")
            setting["font_size"] = setting.get("font_size", "")
            setting["detail_level"] = setting.get("detail_level", "balanced")
            logging.info(f"Settings found for user {user_id}: {setting}")
        else:  # If no settings found, return defaults
            logging.info(
                f"No settings document found for user {user_id}. Returning defaults."
            )
            setting = {
                "temperature": 0.0,
                "model": "gpt-4.1",  # Default model
                "font_family": "",
                "font_size": "",
                "detail_level": "balanced",
            }
    except CosmosHttpResponseError as e:
        # Handle specific Cosmos errors, like 404 Not Found if needed, otherwise log generic error
        logging.error(
            f"[util__module] get_setting: Cosmos DB error for user {user_id}. Status: {e.status_code}, Message: {e.message}"
        )
        # Return defaults on error
        setting = {
            "temperature": 0.0,
            "model": "gpt-4.1",  # Default model
            "font_family": "",
            "font_size": "",
            "detail_level": "balanced",
        }
    except Exception as e:
        logging.error(
            f"[util__module] get_setting: Unexpected error for user {user_id}. {str(e)}"
        )
        # Return defaults on unexpected error
        setting = {
            "temperature": 0.0,
            "model": "gpt-4.1",  # Default model
            "font_family": "",
            "font_size": "",
            "detail_level": "balanced",
        }
    return setting


################################################
# INVITATION UTILS
################################################


def get_invitations(organization_id):
    if not organization_id:
        return {"error": "Organization ID not found."}

    logging.info(
        "Organization ID found. Getting invitations for organization: "
        + organization_id
    )

    invitations = []
    container = get_cosmos_container("invitations")
    try:
        query = "SELECT TOP 1 * FROM c WHERE c.organization_id = @organization_id"
        parameters = [{"name": "@organization_id", "value": organization_id}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if not result:
            logging.info(
                f"[get_invitation] No active invitations found for organization {organization_id}"
            )
            invitations = result[0]
            return {}
        if result:
            invitations = result
    except Exception as e:
        logging.info(
            f"[get_invitations] get_invitations: something went wrong. {str(e)}"
        )
    return invitations


def get_invitation(invited_user_email):
    if not invited_user_email:
        return {"error": "User ID not found."}
    logging.info("[get_invitation] Getting invitation for user: " + invited_user_email)
    invitation = {}
    credential = DefaultAzureCredential()
    db_client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = db_client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("invitations")
    try:
        query = "SELECT * FROM c WHERE c.invited_user_email = @invited_user_email AND c.active = true"
        parameters = [{"name": "@invited_user_email", "value": invited_user_email}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if result:
            logging.info(
                f"[get_invitation] active invitation found for user {invited_user_email}"
            )
            invitation = result[0]
            container.replace_item(item=invitation["id"], body=invitation)
            logging.info(
                f"[get_invitation] Successfully updated invitation status for user {invited_user_email}"
            )
        else:
            logging.info(
                f"[get_invitation] no active invitation found for user {invited_user_email}"
            )
    except Exception as e:
        logging.error(f"[get_invitation] something went wrong. {str(e)}")
    return invitation


################################################
# CHECK USERS UTILS
################################################
# Get user data from the database
def get_set_user(client_principal):
    if not client_principal["id"]:
        return {"error": "User ID not found."}

    logging.info("[get_user] Retrieving data for user: " + client_principal["id"])

    user = {}
    container = get_cosmos_container("users")
    is_new_user = False

    try:
        user = container.read_item(
            item=client_principal["id"], partition_key=client_principal["id"]
        )
        logging.info(f"[get_user] user_id {client_principal['id']} found.")
    except CosmosHttpResponseError:
        logging.info(
            f"[get_user] User {client_principal['id']} not found. Creating new user."
        )
        is_new_user = True

        logging.info("[get_user] Checking user invitations for new user registration")

        email = client_principal["email"]
        user_email = email.lower() if email else None
        user_invitation = get_invitation(user_email)
        try:
            user = container.create_item(
                body={
                    "id": client_principal["id"],
                    "data": {
                        "name": client_principal["name"],
                        "email": user_email,
                        "role": user_invitation["role"] if user_invitation else "admin",
                        "organizationId": (
                            user_invitation["organization_id"]
                            if user_invitation
                            else None
                        ),
                    },
                }
            )
            # Update the invitation with the registered user ID
            if user_invitation:
                try:
                    invitation_id = user_invitation["id"]
                    user_invitation["invited_user_id"] = client_principal["id"]

                    container_inv = get_cosmos_container("invitations")
                    updated_invitation = container_inv.replace_item(
                        item=invitation_id, body=user_invitation
                    )
                    logging.info(
                        f"[get_user] Invitation {invitation_id} updated successfully with user_id {client_principal['id']}"
                    )
                except Exception as e:
                    logging.error(
                        f"[get_user] Failed to update invitation with user_id: {e}"
                    )
            else:
                logging.info(
                    f"[get_user] No invitation found for user {client_principal['id']}"
                )
        except Exception as e:
            logging.error(f"[get_user] Error creating the user: {e}")
            return {
                "is_new_user": False,
                "user_data": None,
            }

    return {"is_new_user": is_new_user, "user_data": user["data"]}


def check_users_existance():
    container = get_cosmos_container("users")
    _user = {}

    try:
        results = list(
            container.query_items(
                query="SELECT c FROM c",
                max_item_count=1,
                enable_cross_partition_query=True,
            )
        )
        if results:
            if len(results) > 0:
                return True
        return False
    except Exception as e:
        logging.info(f"[util__module] get_user: something went wrong. {str(e)}")
    return _user


def get_user_by_id(user_id):
    if not user_id:
        return {"error": "User ID not found."}
    logging.info("User ID found. Getting data for user: " + user_id)
    user = {}
    credential = DefaultAzureCredential()
    db_client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = db_client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("users")
    try:
        query = "SELECT * FROM c WHERE c.id = @user_id"
        parameters = [{"name": "@user_id", "value": user_id}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if result:
            user = result[0]
    except Exception as e:
        logging.info(f"[get_user] get_user: something went wrong. {str(e)}")
    return user


def get_users(organization_id):
    users_container = get_cosmos_container("users")
    invitations_container = get_cosmos_container("invitations")
    organizations_container = get_cosmos_container("organizations")

    try:
        # 1. Get all invitations for the organization
        invitation_result = list(invitations_container.query_items(
            query="""
                SELECT c.invited_user_id, c.role, c.active, c.invited_user_email, c.nickname, c.token_expiry, c.id, c.redeemed_at
                FROM c 
                WHERE c.organization_id = @organization_id
            """,
            parameters=[{"name": "@organization_id", "value": organization_id}],
            enable_cross_partition_query=True,
        ))

        # Map user_id to role and active for invitations with invited_user_id
        user_roles = {
            item["invited_user_id"]: {"role": item["role"], "active": item.get("active", False)}
            for item in invitation_result if item.get("invited_user_id")
        }

        # 2. Obtain organization owner
        org_result = organizations_container.query_items(
            query="SELECT VALUE c.owner FROM c WHERE c.id = @org_id",
            parameters=[{"name": "@org_id", "value": organization_id}],
            enable_cross_partition_query=True,
        )
        owner_list = list(org_result)
        if owner_list:
            owner_id = owner_list[0]
            user_roles[owner_id] = {"role": "admin", "active": True}

        filtered_users = []
        existing_emails = set()
        user_ids = list(user_roles.keys())
        BATCH_SIZE = 10

        # 3. Bring active users
        for i in range(0, len(user_ids), BATCH_SIZE):
            found_user_ids = set()
            batch_ids = user_ids[i : i + BATCH_SIZE]
            in_clause = ", ".join([f'"{uid}"' for uid in batch_ids])
            query = f"""
                SELECT * FROM c WHERE c.id IN ({in_clause})
            """
            user_batch_result = users_container.query_items(
                query=query,
                enable_cross_partition_query=True,
            )

            for user in user_batch_result:
                uid = user["id"]
                found_user_ids.add(uid)
                # Look for inactive and NOT redeemed invitation for this user
                invitation = next(
                    (
                        item for item in invitation_result
                        if item.get("invited_user_id") == uid
                        and item.get("active") == False
                        and not item.get("redeemed_at")
                    ),
                    None
                )
                # Search for inactive and YES redeemed invitation for this user
                invitation_redeemed = next(
                    (
                        item for item in invitation_result
                        if item.get("invited_user_id") == uid
                        and item.get("active") == False
                        and item.get("redeemed_at")
                    ),
                    None
                )
                # If there is an inactive invitation and NOT redeemed, display as a guest.
                if invitation:
                    email = invitation.get("invited_user_email", "")
                    filtered_users.append({
                        "id": None,
                        "invitation_id": invitation.get("id"),
                        "data": {
                            "name": invitation.get("nickname", ""),
                            "email": email
                        },
                        "role": invitation.get("role"),
                        "active": invitation.get("active", False),
                        "user_new": True,
                        "token_expiry": invitation.get("token_expiry"),
                        "nickname": invitation.get("nickname", "")
                    })
                    if email:
                        existing_emails.add(email)
                # If there is inactive invitation and YES redeemed, DO NOT add anything (skip this user)
                elif invitation_redeemed:
                    continue
                # If active and no redeemed invitation, display as active user
                elif user_roles.get(uid, {}).get("active"):
                    user["role"] = user_roles.get(uid, {}).get("role")
                    user["active"] = user_roles.get(uid, {}).get("active")
                    user["user_new"] = False
                    user["user_account_created"] = True
                    filtered_users.append(user)
                    email = user.get("data", {}).get("email")
                    if email:
                        existing_emails.add(email)

        # 3.5. Add invitations with active+redeemed but no user (user_account_created=False), only once per invitation
        for item in invitation_result:
            email = item.get("invited_user_email", "")
            if (
                not item.get("invited_user_id")
                and item.get("active")
                and item.get("redeemed_at")
                and email not in existing_emails
            ):
                filtered_users.append({
                    "id": None,
                    "invitation_id": item.get("id"),
                    "data": {
                        "name": item.get("nickname", ""),
                        "email": email
                    },
                    "role": item.get("role"),
                    "active": item.get("active", False),
                    "user_new": True,
                    "token_expiry": item.get("token_expiry"),
                    "nickname": item.get("nickname", ""),
                    "user_account_created": False
                })
                if email:
                    existing_emails.add(email)

        # 4. Add invitations without invited_user_id as "new" users
        for item in invitation_result:
            if (
                not item.get("invited_user_id")
                and not item.get("redeemed_at")
            ):
                token_expiry = item.get("token_expiry")
                email = item.get("invited_user_email", "")
                filtered_users.append({
                    "id": None,
                    "invitation_id": item.get("id"),
                    "data": {
                        "name": "",
                        "email": email
                    },
                    "role": item.get("role"),
                    "active": item.get("active", False),
                    "user_new": True,
                    "token_expiry": token_expiry,
                    "nickname": item.get("nickname", "")
                })
                if email:
                    existing_emails.add(email)

        return filtered_users

    except CosmosHttpResponseError:
        logging.exception("[get_users] Cosmos error")
    except Exception:
        logging.exception("[get_users] General error")

    return []


def delete_user(user_id, organization_id):
    if not user_id:
        return {"error": "User ID not found."}
    if not organization_id:
        return {"error": "Organization ID not found."}

    logging.info("User ID found. Deleting user: " + user_id+"for this organization: "+ organization_id)

    container = get_cosmos_container("users")
    try:
        user = container.read_item(item=user_id, partition_key=user_id)
        user_email = user["data"]["email"]
        logging.info(f"[delete_user] User {user_id} deleted from its organization")
        logging.info(f"[delete_user] Deleting all {user_id} active invitations")
        inv_container = get_cosmos_container("invitations")
        invitations = inv_container.query_items(
            query="SELECT * FROM c WHERE c.invited_user_email = @user_email AND c.organization_id = @org_id",
            parameters=[
                {"name": "@user_email", "value": user_email}
                , {"name": "@org_id", "value": organization_id}
                ],
            enable_cross_partition_query=True,
        )
        for invitation in invitations:
            inv_container.delete_item(item=invitation["id"], partition_key=invitation["id"])
            logging.info(f"[delete_user] Invitation {invitation['id']} deleted for user {user_id} for this organization {organization_id}")

        return jsonify("Success")
    except CosmosResourceNotFoundError:
        logging.warning(f"[delete_user] User not Found.")
        raise NotFound
    except CosmosHttpResponseError:
        logging.warning(f"[delete_user] Unexpected Error in the CosmosDB Database")
    except Exception as e:
        logging.error(f"[delete_user] delete_user: something went wrong. {str(e)}")

def delete_invitation(invitation_id):
    if not invitation_id:
        return {"error": "Invitation ID not provided."}

    container = get_cosmos_container("invitations")

    try:
        original_invitation = container.read_item(item=invitation_id, partition_key=invitation_id)
        invited_user_email = original_invitation.get("invited_user_email")
        organization_id = original_invitation.get("organization_id")

        if not invited_user_email or not organization_id:
            logging.warning("[delete_invitation] Missing invited_user_email or organization_id.")
            return {"error": "Invalid invitation data."}

        logging.info(f"[delete_invitation] Deleting all invitations for user {invited_user_email} in organization {organization_id}")

        query = """
        SELECT c.id FROM c 
        WHERE c.invited_user_email = @user_email AND c.organization_id = @org_id
        """
        parameters = [
            {"name": "@user_email", "value": invited_user_email},
            {"name": "@org_id", "value": organization_id}
        ]

        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        if not items:
            logging.info("[delete_invitation] No matching invitations found.")
            return {"status": "no_invitations_found"}

        for item in items:
            container.delete_item(item=item["id"], partition_key=item["id"])
            logging.info(f"[delete_invitation] Deleted invitation {item['id']}")

        return {"status": "success", "deleted_count": len(items)}

    except CosmosResourceNotFoundError:
        logging.warning("[delete_invitation] Original invitation not found.")
        raise NotFound
    except CosmosHttpResponseError as e:
        logging.error(f"[delete_invitation] Cosmos DB error: {e}")
        return {"error": "Cosmos DB error."}
    except Exception as e:
        logging.error(f"[delete_invitation] Unexpected error: {str(e)}")
        return {"error": "Unexpected error."}

def get_graph_api_token():
    tenant_id = os.getenv("AAD_TENANT_ID")
    client_id = os.getenv("AAD_CLIENT_ID")
    client_secret = os.getenv("AAD_CLIENT_SECRET")

    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    headers = { "Content-Type": "application/x-www-form-urlencoded" }
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default"
    }

    response = requests.post(url, headers=headers, data=data)

    if response.status_code == 200:
        return response.json().get("access_token")
    else:
        logging.error(f"Could not get token: {response.text}")
        return None
    
def reset_password(user_id, new_password):
    token = get_graph_api_token()
    GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
    if not token:
        raise Exception("Could not obtain Graph API token.")

    url = f"{GRAPH_API_URL}/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    body = {
        "passwordProfile": {
            "password": new_password,
            "forceChangePasswordNextSignIn": False
        }
    }

    response = requests.patch(url, headers=headers, json=body)

    if response.status_code == 204:
        logging.info(f"[reset_password] Password reset for user {user_id}")
    elif response.status_code == 404:
        raise NotFound(f"User {user_id} not found.")
    else:
        logging.error(f"Failed to reset password: {response.text}")
        raise Exception("Failed to reset password")

################################################
# WEB SCRAPING UTILS
################################################


# delete an url by id and organization id from the container OrganizationWebsites
def delete_url_by_id(url_id, organization_id):
    if not url_id or not organization_id:
        return {"error": "URL ID and Organization ID are required."}

    logging.info(f"Deleting URL: {url_id} from organization: {organization_id}")

    container = get_cosmos_container("organizationWebsites")
    try:
        # get the blob path from the url document 
        url_document = container.read_item(item = url_id, partition_key = organization_id)
        blob_path = url_document.get("blobPath")

        # delete the blob from storage if exists 
        if blob_path: 
            try:
                from financial_doc_processor import BlobStorageManager
                blob_storage_manager = BlobStorageManager()
                container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
                blob_client = container_client.get_blob_client(blob_path)
                
                if blob_client.exists():
                    blob_client.delete_blob()
                    logging.info(f"[delete_url] Blob {blob_path} deleted successfully")
                else:
                    logging.warning(f"[delete_url] Blob {blob_path} not found in storage")
            except Exception as blob_error:
                logging.error(f"[delete_url] Error deleting blob {blob_path}: {str(blob_error)}")

        # Delete the URL document from Cosmos DB
        container.delete_item(item=url_id, partition_key=organization_id)
        logging.info(f"[delete_url] URL {url_id} deleted successfully")
        return jsonify("Success")
    except CosmosResourceNotFoundError:
        logging.warning(f"[delete_url] URL not Found.")
        raise NotFound
    except CosmosHttpResponseError:
        logging.warning(f"[delete_url] Unexpected Error in the CosmosDB Database")
    except Exception as e:
        logging.error(f"[delete_url] delete_url: something went wrong. {str(e)}")


# search urls
def search_urls(search_term, organization_id):
    if not search_term or not organization_id:
        return {"error": "Search term and Organization ID are required."}

    # Clean and validate input
    cleaned_search_term = search_term.strip()
    if not cleaned_search_term:
        return {"error": "Search term cannot be empty after removing whitespace."}

    # Normalize internal whitespace
    cleaned_search_term = " ".join(cleaned_search_term.split())

    # if len(cleaned_search_term) < 2:
    #     return {"error": "Search term must be at least 2 characters long."} # not that important

    logging.info(
        f"[search_urls] Searching for URLs in organization: {organization_id} with search term: '{cleaned_search_term}'"
    )

    try:
        container = get_cosmos_container("organizationWebsites")

        # Split into words
        words = cleaned_search_term.split()

        if len(words) == 1:
            # Single word search
            word = words[0]
            url_encoded_word = urllib.parse.quote(word)

            query = """
                SELECT * FROM c 
                WHERE c.organizationId = @organization_id 
                AND (
                    CONTAINS(LOWER(c.url), LOWER(@word)) 
                    OR CONTAINS(LOWER(c.url), LOWER(@encoded_word))
                )
            """
            parameters = [
                {"name": "@organization_id", "value": organization_id},
                {"name": "@word", "value": word},
                {"name": "@encoded_word", "value": url_encoded_word},
            ]
        else:
            # Multi-word search with OR logic
            word_conditions = []
            parameters = [{"name": "@organization_id", "value": organization_id}]

            for i, word in enumerate(words):
                # Add both regular and URL-encoded versions for each word
                word_conditions.append(
                    f"(CONTAINS(LOWER(c.url), LOWER(@word{i})) OR CONTAINS(LOWER(c.url), LOWER(@encoded_word{i})))"
                )
                parameters.append({"name": f"@word{i}", "value": word})
                parameters.append(
                    {"name": f"@encoded_word{i}", "value": urllib.parse.quote(word)}
                )

            # Join with OR - any word match is enough
            query = f"SELECT * FROM c WHERE c.organizationId = @organization_id AND ({' OR '.join(word_conditions)})"

        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=False
            )
        )

        logging.info(f"[search_urls] Found {len(result)} URLs matching the search term")
        return result

    except Exception as e:
        logging.error(f"[search_urls] search_urls: something went wrong. {str(e)}")
    return []

def modify_url(url_id, organization_id, new_url):
    if not url_id or not organization_id or not new_url:
        return {"error": "URL ID, Organization ID and new URL are required."}
    
    logging.info(f"[modify_url] Modifying URL: {url_id} in organization: {organization_id} to {new_url}")

    container = get_cosmos_container("organizationWebsites")
    try:
        # Step 1: Get existing document using correct partition key
        existing_doc = container.read_item(item=url_id, partition_key=organization_id)
        
        # Step 2: Delete the previous scraped data from blob storage if it exists
        old_blob_path = existing_doc.get("blobPath")
        if old_blob_path:
            try:
                from financial_doc_processor import BlobStorageManager
                blob_storage_manager = BlobStorageManager()
                container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
                blob_client = container_client.get_blob_client(old_blob_path)
                
                if blob_client.exists():
                    blob_client.delete_blob()
                    logging.info(f"[modify_url] Previous scraped data blob {old_blob_path} deleted successfully")
                else:
                    logging.warning(f"[modify_url] Previous scraped data blob {old_blob_path} not found in storage")
            except Exception as blob_error:
                logging.error(f"[modify_url] Error deleting previous scraped data blob {old_blob_path}: {str(blob_error)}")
        
        # Step 3: Update the URL field, timestamp, and reset scraping-related fields
        existing_doc["url"] = new_url
        existing_doc["lastModified"] = datetime.now(timezone.utc).isoformat()
        # Reset scraping-related fields since the URL has changed
        existing_doc["status"] = "Processing"
        existing_doc["result"] = "Pending"
        existing_doc["error"] = None
        existing_doc["contentLength"] = None
        existing_doc["title"] = None
        existing_doc["blobPath"] = None
        
        # Step 4: Replace item with the updated data
        container.replace_item(item=url_id, body=existing_doc)
        
        logging.info(f"[modify_url] URL {url_id} modified successfully")
        return {"message": "URL modified successfully"}
        
    except CosmosResourceNotFoundError:
        logging.warning(f"[modify_url] URL not Found.")
        raise NotFound
    except CosmosHttpResponseError as e:
        logging.warning(f"[modify_url] Cosmos HTTP Error: {e}")
        raise
    except Exception as e:
        logging.error(f"[modify_url] modify_url: something went wrong. {str(e)}")
        raise

def validate_url(url: str) -> Tuple[bool, str]:
    """
    Validate URL format and scheme.
    
    Args:
        url (str): URL to validate
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if not url or not isinstance(url, str):
        return False, "URL must be a non-empty string"
    
    url = url.strip()
    if not url:
        return False, "URL cannot be empty"
    
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False, "URL must include scheme (e.g., https://) and hostname"
        if parsed.scheme not in ['http', 'https']:
            return False, "URL must use http or https scheme"
        return True, ""
    except Exception:
        return False, "Invalid URL format"

# get all urls for an organization from the container OrganizationWebsites
def get_organization_urls(organization_id):
    if not organization_id:
        return {"error": "Organization ID is required."}
    
    logging.info(f"[get_organization_urls] Getting all URLs for organization: {organization_id}")
    
    try:
        container = get_cosmos_container("organizationWebsites")
        
        query = "SELECT * FROM c WHERE c.organizationId = @organization_id ORDER BY c.lastModified DESC"
        parameters = [{"name": "@organization_id", "value": organization_id}]
        
        result = list(
            container.query_items(
                query=query, 
                parameters=parameters, 
                enable_cross_partition_query=False
            )
        )
        
        logging.info(f"[get_organization_urls] Found {len(result)} URLs for organization {organization_id}")
        return result
        
    except Exception as e:
        logging.error(f"[get_organization_urls] get_organization_urls: something went wrong. {str(e)}")
        return []

# Helper function to find existing URL for an organization
def find_existing_url(organization_id, url):
    """
    Check if a URL already exists for the given organization.
    
    Args:
        organization_id (str): The organization ID
        url (str): The URL to check
        
    Returns:
        dict or None: The existing document if found, None otherwise
    """
    if not organization_id or not url:
        return None
    
    try:
        container = get_cosmos_container("organizationWebsites")
        
        query = "SELECT * FROM c WHERE c.organizationId = @organization_id AND c.url = @url"
        parameters = [
            {"name": "@organization_id", "value": organization_id},
            {"name": "@url", "value": url}
        ]
        
        result = list(
            container.query_items(
                query=query, 
                parameters=parameters, 
                enable_cross_partition_query=False
            )
        )
        
        return result[0] if result else None
        
    except Exception as e:
        logging.error(f"[find_existing_url] Error checking existing URL: {str(e)}")
        return None

# Add or update a URL in the container OrganizationWebsites
def add_or_update_organization_url(organization_id, url, scraping_result=None, added_by_id=None, added_by_name=None):
    """
    Add a new URL or update an existing one with scraping results.
    
    Args:
        organization_id (str): The organization ID
        url (str): The URL to add or update
        scraping_result (dict): The scraping result data
        added_by_id (str): User ID who added/updated the URL
        added_by_name (str): User name who added/updated the URL
        
    Returns:
        dict: Result with message and document ID
    """
    if not organization_id or not url:
        return {"error": "Organization ID and URL are required."}
    
    try:
        container = get_cosmos_container("organizationWebsites")
        
        # Check if URL already exists
        existing_doc = find_existing_url(organization_id, url)
        
        if existing_doc:
            # Update existing document
            logging.info(f"[add_or_update_organization_url] Updating existing URL: {url} in organization: {organization_id} by user: {added_by_name or 'Unknown'}")
            
            # Update fields with new scraping results
            existing_doc["lastModified"] = datetime.now(timezone.utc).isoformat()
            existing_doc["status"] = "Processing" if not scraping_result else ("Active" if scraping_result.get("status") == "success" else "Error")
            existing_doc["result"] = "Pending" if not scraping_result else ("Success" if scraping_result.get("status") == "success" else "Failed")
            existing_doc["error"] = scraping_result.get("error") if scraping_result and scraping_result.get("error") else None
            existing_doc["contentLength"] = scraping_result.get("content_length") if scraping_result else None
            existing_doc["title"] = scraping_result.get("title") if scraping_result else None
            existing_doc["blobPath"] = scraping_result.get("blob_path") if scraping_result else None
            
            # Replace the document
            container.replace_item(item=existing_doc["id"], body=existing_doc)
            
            logging.info(f"[add_or_update_organization_url] URL {existing_doc['id']} updated successfully by {added_by_name or 'Unknown'}")
            return {"message": "URL updated successfully", "id": existing_doc["id"], "action": "updated"}
            
        else:
            # Create new document
            logging.info(f"[add_or_update_organization_url] Adding new URL: {url} to organization: {organization_id} by user: {added_by_name or 'Unknown'}")
            
            # Generate a unique ID for the URL entry
            url_id = str(uuid.uuid4())
            
            # Create the document
            url_document = {
                "id": url_id,
                "organizationId": organization_id,
                "url": url,
                "dateAdded": datetime.now(timezone.utc).isoformat(),
                "lastModified": datetime.now(timezone.utc).isoformat(),
                "status": "Processing" if not scraping_result else ("Active" if scraping_result.get("status") == "success" else "Error"),
                "result": "Pending" if not scraping_result else ("Success" if scraping_result.get("status") == "success" else "Failed"),
                "error": scraping_result.get("error") if scraping_result and scraping_result.get("error") else None,
                "contentLength": scraping_result.get("content_length") if scraping_result else None,
                "title": scraping_result.get("title") if scraping_result else None,
                "blobPath": scraping_result.get("blob_path") if scraping_result else None,
                "addedBy": {
                    "userId": added_by_id,
                    "userName": added_by_name,
                    "dateAdded": datetime.now(timezone.utc).isoformat()
                } if added_by_id else None
            }
            
            # Insert the document
            container.create_item(body=url_document)
            
            logging.info(f"[add_or_update_organization_url] URL {url_id} added successfully by {added_by_name or 'Unknown'}")
            return {"message": "URL added successfully", "id": url_id, "action": "added"}
        
    except Exception as e:
        logging.error(f"[add_or_update_organization_url] add_or_update_organization_url: something went wrong. {str(e)}")
        raise
def update_organization_usage(organization_id, subscription_id, subscription_tier_id, organization_usage):
    """
    Updates organization usage wallet in the organizationsUsage container.
    """
    if not organization_id or not subscription_id or not subscription_tier_id or not organization_usage:
        return {"error": "Organization ID, subscription ID, subscription tier ID and organization usage are required."}
    try:
        upsert_organization_usage(organization_usage)
        return {"message": "Organization usage updated successfully"}
    except Exception as e:
        logging.error(f"[update_organization_usage] update_organization_usage: something went wrong. {str(e)}")
        raise

def create_organization_usage(organization_id, subscription_id, subscription_tier_id, client_principal_id,current_period_ends=None):
    """
    Creates or updates organization usage wallet in the organizationsUsage container.
    
    This function manages the wallet configuration for an organization based on their 
    subscription tier. It preserves existing seat usage data during renewals/updates.
    
    Args:
        organization_id (str): The ID of the organization
        subscription_id (str): The ID of the subscription (from Stripe) None for free organizations
        subscription_tier_id (str): The ID of the subscription tier (plan nickname from Stripe)
        client_principal_id (str): The ID of the client principal
        current_period_ends (float): The current period ends date in milliseconds
    Returns:
        dict: The created or updated organization usage document
        
    Raises:
        ValueError: If required parameters are missing or invalid
        NotFound: If organization or subscription tier doesn't exist
        Exception: For any other unexpected errors
    """

    # Input validation
    if not organization_id or not isinstance(organization_id, str) or not organization_id.strip():
        logging.error("[create_organization_usage] Invalid organization_id provided")
        raise ValueError("organization_id must be a non-empty string")

    if not subscription_tier_id or not isinstance(subscription_tier_id, str) or not subscription_tier_id.strip():
        logging.error("[create_organization_usage] Invalid subscription_tier_id provided")
        raise ValueError("subscription_tier_id must be a non-empty string")
    # If no period end provided, calculate it
    if current_period_ends is None:
        # Default to 30 days from now for new subscriptions
        current_period_ends = (datetime.now(timezone.utc) + timedelta(days=30)).timestamp()

    try:
        # Validate organization exists
        logging.info(f"[create_organization_usage] Validating organization exists: {organization_id}")
        try:
            organization = get_organization_subscription(organization_id)
        except NotFound:
            logging.error(f"[create_organization_usage] Organization '{organization_id}' not found")
            raise NotFound(f"Organization with id '{organization_id}' does not exist")

        # Get subscription tier data
        logging.info(f"[create_organization_usage] Retrieving subscription tier: {subscription_tier_id}")
        try:
            subscription_tier = get_subscription_tier_by_id(subscription_tier_id)
        except NotFound:
            logging.error(f"[create_organization_usage] Subscription tier '{subscription_tier_id}' not found")
            raise NotFound(f"Subscription tier with id '{subscription_tier_id}' does not exist")

        # Extract tier data with validation
        tier_id = subscription_tier.get("id")
        
        total_allocated = subscription_tier.get("quotas", {}).get("totalCreditsAllocated", 0)

        # Check if organization usage already exists
        logging.info(f"[create_organization_usage] Checking existing organization usage for: {organization_id}")
        existing_usage = get_organization_usage(organization_id)

        # Determine seat usage based on whether this is new or renewal/update
        if existing_usage:
            # Renewal or update - preserve existing seat data
            logging.info(f"[create_organization_usage] Existing usage found. Preserving seat data for organization: {organization_id}")
            current_seats = existing_usage.get("policy", {}).get("currentSeats", 0)
            allowed_user_ids = existing_usage.get("policy", {}).get("allowedUserIds", [{ "userId": client_principal_id, "totalAllocated": total_allocated, "currentUsed": 0 }])
            current_used = existing_usage.get("balance", {}).get("currentUsed", 0)
            # Validate preserved data
            if not isinstance(current_seats, int) or current_seats < 0:
                logging.warning("[create_organization_usage] Invalid currentSeats in existing data, resetting to 0")
                current_seats = 0

            if not isinstance(allowed_user_ids, list):
                logging.warning("[create_organization_usage] Invalid allowedUserIds in existing data, resetting to empty list")
                allowed_user_ids = []

            if not isinstance(current_used, int) or current_used < 0:
                logging.warning("[create_organization_usage] Invalid currentUsed in existing data, resetting to 0")
                current_used = 0
        else:
            # New organization - initialize with zeros
            logging.info(f"[create_organization_usage] No existing usage. Initializing new wallet for organization: {organization_id}")
            current_seats = 1
            allowed_user_ids = [{ "userId": client_principal_id, "limit": total_allocated, "used": 0 }]
            current_used = 0

        # Check subscription status from organization
        is_subscription_active = subscription_id is not None

        # Build the usage document
        usage_document = {
            "id": f"config_{organization_id}",
            "organizationId": organization_id,
            "currentPeriodEnds": current_period_ends,
            "subscriptionId": subscription_id,
            "isSubscriptionActive": is_subscription_active,
            "type": "wallet",
            "balance": {
                "totalAllocated": total_allocated,
                "currentUsed": current_used
            },
            "policy": {
                "tierId": tier_id,
                "currentSeats": current_seats,
                "allowedUserIds": allowed_user_ids,
                "isSubscriptionActive": is_subscription_active
            }
        }

        # Upsert the document
        logging.info(f"[create_organization_usage] Upserting organization usage for: {organization_id}")
        result = upsert_organization_usage(usage_document)

        logging.info(f"[create_organization_usage] Successfully created/updated organization usage for: {organization_id}")
        return result

    except (ValueError, NotFound) as e:
        # Re-raise validation and not found errors
        logging.error(f"[create_organization_usage] Validation error: {str(e)}")
        raise

    except Exception as e:
        logging.error(f"[create_organization_usage] Unexpected error for organization '{organization_id}': {str(e)}")
        raise Exception(f"Failed to create organization usage: {str(e)}")
    
def get_organization_usage_by_id(organization_id: str):
    if not organization_id:
        return {"error": "Organization ID is required."}
    try:
        container = get_cosmos_container("organizationsUsage")
        query = "SELECT * FROM c WHERE c.organizationId = @organization_id AND c.type = @type"
        parameters = [{"name": "@organization_id", "value": organization_id}, {"name": "@type", "value": "wallet"}]
        result = list(container.query_items(query=query, parameters=parameters, partition_key=organization_id))
        return result[0] if result else None
    except Exception as e:
        logging.error(f"[get_organization_usage_by_id] get_organization_usage_by_id: something went wrong. {str(e)}")
        return None
    
def get_organization_usage_by_subscription_id(subscription_id: str):
    if not subscription_id:
        return {"error": "Subscription ID is required."}
    try:
        container = get_cosmos_container("organizationsUsage")
        query = "SELECT * FROM c WHERE c.subscriptionId = @subscription_id AND c.type = @type"
        parameters = [{"name": "@subscription_id", "value": subscription_id}, {"name": "@type", "value": "wallet"}]
        result = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        return result[0] if result else None
    except Exception as e:
        logging.error(f"[get_organization_usage_by_subscription_id] get_organization_usage_by_subscription_id: something went wrong. {str(e)}")
        return None
    
def get_organization_id_from_request(request):
    """
    Extracts the organization_id from the request.
    Checks URL parameters first, then JSON body if applicable.
    
    Returns:
        str or None: The organization_id if found, else None
    """

    if request.is_json:
        data = request.get_json()
        organization_id = data.get("organization_id")
        if organization_id:
            return organization_id
        
    organization_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ORGANIZATION")
    if organization_id:
        return organization_id
    
    organization_id = None

    return organization_id



def get_organization_id_and_user_id_from_request(request):
    """
    Extracts the organization_id and user_id from the request.
    Checks URL parameters first, then JSON body if applicable.
    
    Returns:
        tuple: (organization_id or None, user_id or None)
    """

    organization_id = None
    user_id = None

    if request.is_json:
        data = request.get_json()
        organization_id = data.get("organization_id")
        user_id = data.get("user_id")
        if organization_id and user_id:
            return organization_id, user_id
        
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    organization_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ORGANIZATION")
    if organization_id:
        return organization_id, client_principal_id
    if client_principal_id:
        organizations = get_user_organizations(client_principal_id)
        if organizations:
            organization_id = organizations[0]["id"]
            
    user_id = client_principal_id

    return organization_id, user_id

def get_organization_tier_and_subscription(organization_id):
    """
    Retrieves the subscription tier and usage for the given organization ID.
    """
    if not organization_id:
        return None
    try:
        org_usage = get_organization_usage(organization_id)
        org_tier = get_subscription_tier_by_id(org_usage["policy"]["tierId"]) if org_usage else None
        
        return org_tier, org_usage

    except Exception as e:
        logging.error(f"[get_organization_tier_and_subscription] get_organization_tier_and_subscription: something went wrong. {str(e)}")
        return None