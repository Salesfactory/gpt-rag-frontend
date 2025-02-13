from functools import wraps
import logging
import uuid
import os
from shared.cosmo_db import get_cosmos_container
from flask import request, jsonify, Flask
from http import HTTPStatus
from typing import Tuple, Dict, Any

from datetime import datetime, timezone, timedelta
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError
from werkzeug.exceptions import NotFound

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
def create_success_response(data: Dict[str, Any], optionalCode=HTTPStatus.OK) -> JsonResponse:
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
            return create_error_response("Missing required client principal ID", HTTPStatus.UNAUTHORIZED)
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
    level = logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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
    if not data.get('equity_id'):
        return False, "equity_id is required"
    
    # check if date is provided 
    if not data.get('after_date'):
        logger.warning("No after_date provided, retrieving most recent filings")
    
    # Check if equity_ids is not empty
    if data['equity_id'].strip() == "":
        return False, "equity_id cannot be empty"
    
    # Validate filing_types if provided
    if not data.get('filing_type'):
        return False, "filing_type is required"
    
    # Check if all filing types are valid
    if data['filing_type'] not in ALLOWED_FILING_TYPES:
        return False, f"Invalid filing type(s): {data['filing_type']}. Allowed types are: {', '.join(ALLOWED_FILING_TYPES)}"
    
    return True, ""


def convert_html_to_pdf(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    options: Optional[Dict] = None
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
                'quiet': '',
                'enable-local-file-access': '',
                'encoding': 'UTF-8',
                'no-stop-slow-scripts': '',
                'disable-smart-shrinking': ''
            }

        logger.info(f"Converting {input_path} to PDF...")
        
        # Perform conversion
        pdfkit.from_file(
            str(input_path),
            str(output_path),
            options=options
        )

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
        if sys.platform == 'win32':
            wkhtmltopdf_path = r'C:\Program Files\wkhtmltopdf\bin'
            logger.info(f"Windows detected")
            if os.path.exists(wkhtmltopdf_path):
                logger.info(f"wkhtmltopdf directory found at {wkhtmltopdf_path}")
                if wkhtmltopdf_path not in os.environ['PATH']:
                    logger.info(f"Adding wkhtmltopdf to PATH: {wkhtmltopdf_path}")
                    os.environ['PATH'] += os.pathsep + wkhtmltopdf_path
            else:
                logger.warning(f"wkhtmltopdf directory not found at {wkhtmltopdf_path}")
                return install_wkhtmltopdf()

        # Try to run wkhtmltopdf --version
        result = subprocess.run(
            ['wkhtmltopdf', '--version'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            text=True
        )
        logger.info(f"wkhtmltopdf is installed and configured. Version: {result.stdout.strip()}")
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
    
    if sys.platform == 'win32':
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
        
    elif sys.platform.startswith('linux'):
        try:
            logger.info("Installing wkhtmltopdf on Linux...")
            
            # Try to determine the package manager
            if subprocess.run(['which', 'apt-get'], stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0:
                # Debian/Ubuntu
                install_cmd = ['apt-get', 'install', '-y', 'wkhtmltopdf']
            elif subprocess.run(['which', 'yum'], stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0:
                # CentOS/RHEL
                install_cmd = ['yum', 'install', '-y', 'wkhtmltopdf']
            else:
                logger.error("Could not determine package manager. Please install wkhtmltopdf manually.")
                return False

            # Try to install without sudo first
            try:
                subprocess.run(install_cmd, check=True)
            except subprocess.CalledProcessError:
                # If that fails, try with sudo if available
                if subprocess.run(['which', 'sudo'], stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0:
                    install_cmd.insert(0, 'sudo')
                    subprocess.run(install_cmd, check=True)
                else:
                    logger.error("Installation requires root privileges. Please install wkhtmltopdf manually.")
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
            logger.info(f"No files to delete in {filings_dir} - directory does not exist")
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

EMAIL_CONTAINER_NAME = 'emails'
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
                msg['Subject'] = subject
                msg['From'] = self.username
                msg['Bcc'] = ','.join(recipients)
                msg.add_alternative(html_content, subtype='html')

                if attachment_path:
                    self._add_attachment(msg, attachment_path)

                server = self._get_server()
                server.send_message(msg)
                return  # Success, exit the function
                
            except smtplib.SMTPServerDisconnected:
                logger.warning(f"SMTP server disconnected (attempt {attempt + 1}/{max_retries})")
                self._server = None  # Reset the connection
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                raise EmailServiceError("Failed to maintain SMTP connection after multiple attempts")
                
            except Exception as e:
                logger.error(f"Error sending email (attempt {attempt + 1}/{max_retries}): {str(e)}")
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

            with open(file_path, 'rb') as file:
                file_data = file.read()
                file_name = file_path.name
                msg.add_attachment(file_data, 
                                maintype='application', 
                                subtype='octet-stream', 
                                filename=file_name)
        except (OSError, EmailServiceError) as e:
            logger.error(f"Error adding attachment: {str(e)}")
            raise EmailServiceError(f"Error adding attachment: {str(e)}")
        

    def _save_email_to_blob(self, 
                            html_content: str,
                            subject: str,
                            recipients: List[str],
                            attachment_path: Optional[str] = None) -> str:
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
        BLOB_STORAGE_URL = f"https://{os.getenv('STORAGE_ACCOUNT')}.blob.core.windows.net"
        blob_service_client = BlobServiceClient(
            account_url=BLOB_STORAGE_URL,
            credential=credential
        )
        blob_container_client = blob_service_client.get_container_client(EMAIL_CONTAINER_NAME)
        # create an id for the email 
        email_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        # get date only from timestamp
        date_only = timestamp.split('T')[0]
        
        # create a blob name for the email 
        blob_name = f"{date_only}/{email_id}/content.html"

        # add metadata to the blob
        metadata = {
            "email_id": email_id,
            "subject": subject,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "recipients": ', '.join(recipients),
            "has_attachment": str(bool(attachment_path))
        }

        # upload the email content to the blob
        try:
            blob_container_client.upload_blob(blob_name, html_content, metadata=metadata, content_settings=ContentSettings(content_type='text/html'))
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

        query = (
            "SELECT c.id, c.conversation_data.start_date, c.conversation_data.history[0].content AS first_message, c.conversation_data.type FROM c WHERE c.conversation_data.interaction.user_id = @user_id"
        )
        parameters = [dict(name="@user_id", value=user_id)]

        try:
            conversations = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        except CosmosHttpResponseError as e:
            logging.error(f"CosmosDB error retrieving conversations for user '{user_id}': {e}")
            return []
        except Exception as e:
            logging.exception(f"Unexpected error retrieving conversations for user '{user_id}': {e}")
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

def set_settings(client_principal, temperature, frequency_penalty, presence_penalty):

    new_setting = {}
    container = get_cosmos_container("settings")

    # set default values
    temperature = temperature if temperature is not None else 0.0
    frequency_penalty = frequency_penalty if frequency_penalty is not None else 0.0
    presence_penalty = presence_penalty if presence_penalty is not None else 0.0

    # validate temperature, frequency_penalty, presence_penalty
    if temperature < 0 or temperature > 1:
        logging.error(
            f"[util__module] set_settings: invalid temperature value {temperature}."
        )
        return

    if frequency_penalty < 0 or frequency_penalty > 1:
        logging.error(
            f"[util__module] set_settings: invalid frequency_penalty value {frequency_penalty}."
        )
        return

    if presence_penalty < 0 or presence_penalty > 1:
        logging.error(
            f"[util__module] set_settings: invalid presence_penalty value {presence_penalty}."
        )
        return


    if client_principal["id"]:
        query = "SELECT * FROM c WHERE c.user_id = @user_id"
        parameters = [{"name": "@user_id", "value": client_principal["id"]}]

        logging.info(f"[util__module] set_settings: user_id {client_principal['id']}.")

        results = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )

        if results:
            logging.info(
                f"[util__module] set_settings: user_id {client_principal['id']} found, results are {results}."
            )
            setting = results[0]

            setting["temperature"] = temperature
            setting["frequencyPenalty"] = frequency_penalty
            setting["presencePenalty"] = presence_penalty
            try:
                container.replace_item(item=setting["id"], body=setting)
                logging.info(
                    f"Successfully updated settings document for user {client_principal['id']}"
                )
                return{
                    "status": "success",
                    "message": "Settings updated successfully"
                }
            except CosmosResourceNotFoundError:
                logging.error(f"[util__module] No settings found for user {client_principal['id']}")
            except Exception as e:
                logging.error(
                    f"[util__module] Failed to update settings document for user {client_principal['id']}. Error: {str(e)}"
                )
        else:
            logging.info(
                f"[util__module] set_settings: user_id {client_principal['id']} not found. creating new document."
            )

            try:
                new_setting["id"] = str(uuid.uuid4())
                new_setting["user_id"] = client_principal["id"]
                new_setting["temperature"] = temperature
                new_setting["frequencyPenalty"] = frequency_penalty
                new_setting["presencePenalty"] = presence_penalty
                container.create_item(body=new_setting)

                logging.info(
                    f"Successfully created new settings document for user {client_principal['id']}"
                )
                return{
                    "status": "success",
                    "message": "Settings updated successfully"
                }
            except CosmosResourceNotFoundError:
                logging.info(f"[util__module] get_setting: No settings found for user {client_principal['id']}")
            except Exception as e:
                logging.error(
                    f"Failed to create settings document for user {client_principal['id']}. Error: {str(e)}"
                )
    else:
        logging.info(f"[util__module] set_settings: user_id not provided.")

def get_client_principal():
    """Util to extract the Client Principal Headers"""
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return None, jsonify({
            "error": "Missing required parameters, client_principal_id or client_principal_name"
        }), 400

    return {"id": client_principal_id, "name": client_principal_name}, None, None

def get_setting(client_principal):
    if not client_principal["id"]:
        return {}

    logging.info("User ID found. Getting settings for user: " + client_principal["id"])

    setting = {}
    container = get_cosmos_container("settings")
    try:
        query = "SELECT c.temperature, c.frequencyPenalty, c.presencePenalty FROM c WHERE c.user_id = @user_id"
        parameters = [{"name": "@user_id", "value": client_principal["id"]}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if result:
            setting = result[0]
    except Exception as e:
        logging.info(
            f"[util__module] get_setting: no settings found for user {client_principal['id']} (keyvalue store with '{client_principal['id']}' id does not exist)."
        )
    return setting

################################################
# INVITATION UTILS
################################################

def get_invitations(organization_id):
    if not organization_id:
        return {"error": "Organization ID not found."}

    logging.info(
        "Organization ID found. Getting invitations for organization: " + organization_id
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
            logging.info(f"[get_invitation] No active invitations found for organization {organization_id}")
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

    container = get_cosmos_container("invitations")
    try:
        query = "SELECT * FROM c WHERE c.invited_user_email = @invited_user_email AND c.active = true"
        parameters = [{"name": "@invited_user_email", "value": invited_user_email}]

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
        logging.info(f"[get_user] User {client_principal['id']} not found. Creating new user.")
        is_new_user = True

        logging.info("[get_user] Checking user invitations for new user registration")
        user_invitation = get_invitation(client_principal["email"])

        try:
            user = container.create_item(
                body={
                    "id": client_principal["id"],
                    "data": {
                        "name": client_principal["name"],
                        "email": client_principal["email"],
                        "role": user_invitation["role"] if user_invitation else "admin",
                        "organizationId": (
                            user_invitation["organization_id"] if user_invitation else None
                        ),
                    },
                }
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
    container = get_cosmos_container("users")
    try:
        query = "SELECT * FROM c WHERE c.id = @user_id"
        parameters = [{"name": "@user_id", "value": user_id}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if not result:
            logging.info(f"[get_invitation] No active invitation found for user {invited_user_email}")
            return {}
        if result:
            logging.info(
                f"[get_invitation] active invitation found for user {invited_user_email}"
            )
            invitation = result[0]
            invitation["active"] = False
            container.replace_item(item=invitation["id"], body=invitation)
            logging.info(
                f"[get_invitation] Successfully updated invitation status for user {invited_user_email}"
            )
    except Exception as e:
        logging.error(f"[get_invitation] something went wrong. {str(e)}")
    return invitation
        if result:
            user = result[0]
    except Exception as e:
        logging.info(f"[get_user] get_user: something went wrong. {str(e)}")
    return user

# return all users
def get_users(organization_id):
    users = []
    container = get_cosmos_container("users")
    try:
        users = container.query_items(
            query="SELECT * FROM c WHERE c.data.organizationId = @organization_id",
            parameters=[{"name": "@organization_id", "value": organization_id}],
            enable_cross_partition_query=True,
        )
        users = list(users)

    except Exception as e:
        logging.info(
            f"[get_users] get_users: no users found (keyvalue store with 'users' id does not exist)."
        )
    return users

def delete_user(user_id):
    if not user_id:
        return {"error": "User ID not found."}

    logging.info("User ID found. Deleting user: " + user_id)

    container = get_cosmos_container("users")
    try:
        user = container.read_item(item=user_id, partition_key=user_id)
        user_email = user["data"]["email"]
        user["data"]["organizationId"] = None
        user["data"]["role"] = None
        container.replace_item(item=user_id, body=user)
        logging.info(f"[delete_user] User {user_id} deleted from its organization")
        logging.info(f"[delete_user] Deleting all {user_id} active invitations")
        container = get_cosmos_container("invitations")
        invitations = container.query_items(
            query="SELECT * FROM c WHERE c.invited_user_email = @user_email",
            parameters=[{"name": "@user_email", "value": user_email}],
            enable_cross_partition_query=True,
        )
        for invitation in invitations:
            container.delete_item(item=invitation["id"], partition_key=invitation["id"])
            logging.info(f"Deleted invitation with ID: {invitation['id']}")

    except CosmosResourceNotFoundError:
        logging.warning(f"[delete_user] User not Found.")
        raise NotFound
    except CosmosHttpResponseError:
        logging.warning(f"[delete_user] Unexpected Error in the CosmosDB Database")
    except Exception as e:
        logging.error(f"[delete_user] delete_user: something went wrong. {str(e)}")
