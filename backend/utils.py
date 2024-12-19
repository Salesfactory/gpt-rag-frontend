from functools import wraps
import logging
from flask import request, jsonify, Flask
from http import HTTPStatus
from typing import Tuple, Dict, Any


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

def validate_payload(data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate the request payload.
    
    Args:
        data (dict): The request payload
        
    Returns:
        tuple: (is_valid: bool, error_message: str)
    """
    # Check if equity_ids exists and is not empty
    if not data.get('equity_ids'):
        return False, "equity_ids is required"
    
    # Check if equity_ids is a list
    if not isinstance(data['equity_ids'], list):
        return False, "equity_ids must be a list"
    
    # Check if equity_ids is not empty
    if len(data['equity_ids']) == 0:
        return False, "equity_ids cannot be empty"
    
    # Validate filing_types if provided
    if 'filing_types' in data:
        if not isinstance(data['filing_types'], list):
            return False, "filing_types must be a list"
        
        # Check if all filing types are valid
        invalid_types = [ft for ft in data['filing_types'] if ft not in ALLOWED_FILING_TYPES]
        if invalid_types:
            return False, f"Invalid filing type(s): {', '.join(invalid_types)}. Allowed types are: {', '.join(ALLOWED_FILING_TYPES)}"
    
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
