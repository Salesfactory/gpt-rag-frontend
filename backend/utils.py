from functools import wraps
import logging
import uuid
import os
from flask import request, jsonify, Flask
from http import HTTPStatus
from typing import Tuple, Dict, Any
from datetime import datetime, timezone, timedelta
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")
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

class MissingJSONPayloadError(Exception):
    """Raised when JSON payload is missing"""

    pass

class MissingRequiredFieldError(Exception):
    """Raised when a required field is missing"""

    pass

class InvalidParameterError(Exception):
    """Raised when an invalid parameter is provided"""

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
# Chat History Get All Chats From User
################################################

def get_conversations(user_id):
    try:
        logging.info("ENTRE AQUI PARA OBTENER TODAS LAS CONVERSACIONES")
        credential = DefaultAzureCredential()
        db_client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
        db = db_client.get_database_client(database=AZURE_DB_NAME)
        container = db.get_container_client("conversations")

        query = (
            "SELECT * FROM c WHERE c.conversation_data.interaction.user_id = @user_id"
        )
        parameters = [dict(name="@user_id", value=user_id)]

        conversations = container.query_items(
            query=query, parameters=parameters, enable_cross_partition_query=True
        )

        # DEFAULT DATE 1 YEAR AGO in case start_date is not present
        now = datetime.now()
        one_year_ago = now - timedelta(days=365)
        default_date = one_year_ago.strftime("%Y-%m-%d %H:%M:%S")

        formatted_conversations = [
            {
                "id": con["id"],
                "start_date": (
                    con["conversation_data"]["start_date"]
                    if "start_date" in con["conversation_data"]
                    else default_date
                ),
                "content": con["conversation_data"]["history"][0]["content"],
                "type": (
                    con["conversation_data"]["type"]
                    if "type" in con["conversation_data"]
                    else "default"
                ),
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