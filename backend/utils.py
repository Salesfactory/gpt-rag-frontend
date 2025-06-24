from functools import wraps
import logging
import uuid
import os
from shared.cosmo_db import get_cosmos_container
from flask import request, jsonify, Flask
from http import HTTPStatus
from typing import Tuple, Dict, Any
from azure.cosmos.exceptions import CosmosHttpResponseError
from datetime import datetime, timezone, timedelta
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
import urllib.parse
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError
from werkzeug.exceptions import NotFound
from urllib.parse import urlparse

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


class MissingJSONPayloadError(Exception):
    """Raised when JSON payload is missing"""

    pass


class MissingRequiredFieldError(Exception):
    """Raised when a required field is missing"""

    pass


class InvalidParameterError(Exception):
    """Raised when an invalid parameter is provided"""

    pass


class MissingParameterError(Exception):
    """Raised when a required parameter is missing"""

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
            item=conversation_id, partition_key=conversation_id
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
            item=conversation_id, partition_key=conversation_id
        )

        if conversation["conversation_data"]["interaction"]["user_id"] != user_id:
            raise Exception("User does not have permission to delete this conversation")

        container.delete_item(item=conversation_id, partition_key=conversation_id)

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

        query = "SELECT c.id, c.conversation_data.start_date, c.conversation_data.history[0].content AS first_message, c.conversation_data.type FROM c WHERE c.conversation_data.interaction.user_id = @user_id"
        parameters = [dict(name="@user_id", value=user_id)]

        try:
            conversations = list(
                container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True,
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

        formatted_conversations = [
            {
                "id": con["id"],
                "start_date": con.get("start_date", default_date),
                "content": con.get("first_message", "No content"),
                "type": con.get("type", "default"),
            }
            for con in conversations
        ]

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


def set_feedback(
    client_principal,
    conversation_id,
    feedback_message,
    question,
    answer,
    rating,
    category,
):
    if not client_principal["id"]:
        return {"error": "User ID not found."}

    if not conversation_id:
        return {"error": "Conversation ID not found."}

    if not question:
        return {"error": "Question not found."}

    if not answer:
        return {"error": "Answer not found."}

    if rating and rating not in [0, 1]:
        return {"error": "Invalid rating value."}

    if feedback_message and len(feedback_message) > 500:
        return {"error": "Feedback message is too long."}

    logging.info(
        "User ID and Conversation ID found. Setting feedback for user: "
        + client_principal["id"]
        + " and conversation: "
        + str(conversation_id)
    )

    feedback = {}
    credential = DefaultAzureCredential()
    db_client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = db_client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("feedback")
    try:
        feedback = {
            "id": str(uuid.uuid4()),
            "user_id": client_principal["id"],
            "conversation_id": conversation_id,
            "feedback_message": feedback_message,
            "question": question,
            "answer": answer,
            "rating": rating,
            "category": category,
        }
        result = container.create_item(body=feedback)
        print("Feedback created: ", result)
    except Exception as e:
        logging.info(f"[util__module] set_feedback: something went wrong. {str(e)}")
    return feedback


################################################
# SETTINGS UTILS
################################################


def set_settings(client_principal, temperature, model, font_family, font_size):

    new_setting = {}
    container = get_cosmos_container("settings")

    # set default values
    temperature = temperature if temperature is not None else 0.0
    model = model if model is not None else "DeepSeek-V3-0324"

    # validate temperature
    if temperature < 0 or temperature > 1:
        logging.error(
            f"[util__module] set_settings: invalid temperature value {temperature}."
        )
        return

    # Add validation for model if necessary
    allowed_models = ["gpt-4.1", "DeepSeek-V3-0324", "Claude-4-Sonnet"]
    if model not in allowed_models:
        logging.error(f"[util__module] set_settings: invalid model value {model}.")
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
            "model": "DeepSeek-V3-0324",  # Default model
            "font_family": "",
            "font_size": "",
        }

    user_id = client_principal["id"]
    logging.info(f"User ID found ({user_id}). Getting settings.")

    setting = {}
    container = get_cosmos_container("settings")
    try:
        # Update query to select only temperature and model
        query = "SELECT c.temperature, c.model, c.font_family, c.font_size FROM c WHERE c.user_id = @user_id"
        parameters = [{"name": "@user_id", "value": user_id}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if result:
            setting = result[0]
            # Ensure both expected keys exist, provide defaults if missing
            setting["temperature"] = setting.get("temperature", 0.0)
            setting["model"] = setting.get("model", "DeepSeek-V3-0324")
            setting["font_family"] = setting.get("font_family", "")
            setting["font_size"] = setting.get("font_size", "")
            logging.info(f"Settings found for user {user_id}: {setting}")
        else:  # If no settings found, return defaults
            logging.info(
                f"No settings document found for user {user_id}. Returning defaults."
            )
            setting = {
                "temperature": 0.0,
                "model": "DeepSeek-V3-0324",  # Default model
                "font_family": "",
                "font_size": "",
            }
    except CosmosHttpResponseError as e:
        # Handle specific Cosmos errors, like 404 Not Found if needed, otherwise log generic error
        logging.error(
            f"[util__module] get_setting: Cosmos DB error for user {user_id}. Status: {e.status_code}, Message: {e.message}"
        )
        # Return defaults on error
        setting = {
            "temperature": 0.0,
            "model": "DeepSeek-V3-0324",  # Default model
            "font_family": "",
            "font_size": "",
        }
    except Exception as e:
        logging.error(
            f"[util__module] get_setting: Unexpected error for user {user_id}. {str(e)}"
        )
        # Return defaults on unexpected error
        setting = {
            "temperature": 0.0,
            "model": "DeepSeek-V3-0324",  # Default model
            "font_family": "",
            "font_size": "",
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
        # 1. Get IDs of active guest users
        invitation_result = invitations_container.query_items(
            query="""
                SELECT c.invited_user_id, c.role
                FROM c 
                WHERE c.active = true AND c.organization_id = @organization_id
            """,
            parameters=[{"name": "@organization_id", "value": organization_id}],
            enable_cross_partition_query=True,
        )

        # Map user_id and role
        user_roles = {
            item["invited_user_id"]: item["role"] for item in invitation_result
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
            user_roles[owner_id] = "admin"

        # 3. If there are no IDs, return empty.
        if not user_roles:
            return []

        # Get only the necessary users (in batches of 10 per Cosmos limit).
        filtered_users = []
        user_ids = list(user_roles.keys())
        BATCH_SIZE = 10

        for i in range(0, len(user_ids), BATCH_SIZE):
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
                user["role"] = user_roles.get(uid)  # rol invitation
                filtered_users.append(user)

        return filtered_users

    except CosmosHttpResponseError:
        logging.exception("[get_users] Cosmos error")
    except Exception:
        logging.exception("[get_users] General error")

    return []


def delete_user(user_id):
    if not user_id:
        return {"error": "User ID not found."}

    logging.info("User ID found. Deleting user: " + user_id)

    container = get_cosmos_container("users")
    try:
        user = container.read_item(item=user_id, partition_key=user_id)
        user_email = user["data"]["email"]
        logging.info(f"[delete_user] User {user_id} deleted from its organization")
        logging.info(f"[delete_user] Deleting all {user_id} active invitations")
        container = get_cosmos_container("invitations")
        invitations = container.query_items(
            query="SELECT * FROM c WHERE c.invited_user_email = @user_email",
            parameters=[{"name": "@user_email", "value": user_email}],
            enable_cross_partition_query=True,
        )
        for invitation in invitations:
            invitation["active"] = False
            container.replace_item(item=invitation["id"], body=invitation)
            logging.info(f"Changed status of Invitation for: {invitation['id']}")

        return jsonify("Success")
    except CosmosResourceNotFoundError:
        logging.warning(f"[delete_user] User not Found.")
        raise NotFound
    except CosmosHttpResponseError:
        logging.warning(f"[delete_user] Unexpected Error in the CosmosDB Database")
    except Exception as e:
        logging.error(f"[delete_user] delete_user: something went wrong. {str(e)}")


################################################
# WEB SCRAPING UTILS
################################################


# delete an url by id and organization id from the container OrganizationWebsites
def delete_url_by_id(url_id, organization_id):
    if not url_id or not organization_id:
        return {"error": "URL ID and Organization ID are required."}

    logging.info(f"Deleting URL: {url_id} from organization: {organization_id}")

    container = get_cosmos_container("OrganizationWebsites")
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
        container = get_cosmos_container("OrganizationWebsites")

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

    container = get_cosmos_container("OrganizationWebsites")
    try:
        # Step 1: Get existing document using correct partition key
        existing_doc = container.read_item(item=url_id, partition_key=organization_id)
        
        # Step 2: Update the URL field and timestamp
        existing_doc["url"] = new_url
        existing_doc["lastModified"] = datetime.now(timezone.utc).isoformat() 
        
        # Step 3: Replace item with the new url 
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
        container = get_cosmos_container("OrganizationWebsites")
        
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

# add a new url to the container OrganizationWebsites
def add_organization_url(organization_id, url, scraping_result=None, added_by_id=None, added_by_name=None):
    if not organization_id or not url:
        return {"error": "Organization ID and URL are required."}
    
    logging.info(f"[add_organization_url] Adding URL: {url} to organization: {organization_id} by user: {added_by_name or 'Unknown'}")
    
    try:
        container = get_cosmos_container("OrganizationWebsites")
        
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
        
        logging.info(f"[add_organization_url] URL {url_id} added successfully by {added_by_name or 'Unknown'}")
        return {"message": "URL added successfully", "id": url_id}
        
    except Exception as e:
        logging.error(f"[add_organization_url] add_organization_url: something went wrong. {str(e)}")
        raise