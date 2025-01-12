# document_processor.py

import os
import logging
import base64
import uuid
import shutil
from pathlib import Path
from collections import defaultdict
import markdown2
from typing import Dict, List, Any
from datetime import datetime, timezone, timedelta

import pandas as pd
import fitz
from dotenv import load_dotenv
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

from utils import convert_html_to_pdf
from app_config import BLOB_CONTAINER_NAME, PDF_PATH

# Load environment variables
load_dotenv()


def get_secret(secret_name):
    """
    Retrieve a secret value from Azure Key Vault.

    Args:
        secret_name (str): The name of the secret to retrieve.

    Returns:
        str: The value of the secret.

    Raises:
        Exception: If the secret cannot be retrieved.
    """
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


# Retrieve the connection string for Azure Blob Storage from secrets
try:
    BLOB_CONNECTION_STRING = get_secret("storageConnectionString")
    if not BLOB_CONNECTION_STRING:
        raise ValueError(
            "The connection string for Azure Blob Storage (BLOB_CONNECTION_STRING): '{BLOB_CONNECTION_STRING}' is not set. Please ensure it is correctly configured."
        )

    logging.info("Successfully retrieved Blob connection string.")
    # Validate that the connection string is available

except Exception as e:
    logging.error("Error retrieving the connection string for Azure Blob Storage.")
    logging.debug(f"Detailed error: {e}")  # Log detailed errors at the debug level
    raise

# Retrieve the Blob container name from environment variables
BLOB_CONTAINER_NAME = os.getenv("BLOB_CONTAINER_NAME")
if not BLOB_CONTAINER_NAME:
    raise ValueError(
        "The Blob container name (BLOB_CONTAINER_NAME) is not set. Please ensure it is correctly configured."
    )

# Initialize the Blob service client
try:
    blob_service_client = BlobServiceClient.from_connection_string(
        BLOB_CONNECTION_STRING
    )
    container_client = blob_service_client.get_container_client(BLOB_CONTAINER_NAME)
    if not container_client.exists():
        logging.warning(f"Blob container '{BLOB_CONTAINER_NAME}' does not exist.")
        # Uncomment below to create the container dynamically:
        # container_client.create_container()
except Exception as e:
    logging.error(f"Failed to initialize Blob service client or access container: {e}")
    raise


# configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_downloaded_files(equity_id: str, filing_type: str):
    filings_dir = os.path.join(os.getcwd(), "sec-edgar-filings", equity_id, filing_type)
    # reformat the directory path to be a valid path

    if not os.path.exists(filings_dir):
        logger.warning(f"The directory {filings_dir} does not exist")
        return None
    # Walk through all subdirectories
    for root, dirs, files in os.walk(filings_dir):
        # Find the primary-document.html file
        for file in files:
            # Look specifically for primary-document.html
            if file == "primary-document.html":
                return os.path.join(root, file)
    logger.warning(f"No primary-document.html file found for {equity_id} {filing_type}")
    return None


def collect_filing_documents(
    EQUITY_IDS: List[str], FILING_TYPES: List[str], get_downloaded_files: callable
) -> Dict[str, Dict[str, str]]:
    """
    Collect filing documents for multiple equities and filing types and convert to PDF.
    """
    if not EQUITY_IDS:
        raise ValueError("EQUITY_IDS list cannot be empty")
    if not FILING_TYPES:
        raise ValueError("FILING_TYPES list cannot be empty")

    document_paths: Dict[str, Dict[str, str]] = defaultdict(dict)

    try:
        for equity in EQUITY_IDS:
            logger.info(f"Processing equity: {equity}")

            for filing_type in FILING_TYPES:
                try:
                    logger.debug(f"Fetching {filing_type} for {equity}")
                    html_path = get_downloaded_files(equity, filing_type)

                    if html_path:
                        # Convert HTML path to PDF path
                        pdf_path = Path(html_path).with_suffix(".pdf")

                        # Convert HTML to PDF
                        success = convert_html_to_pdf(
                            input_path=html_path, output_path=pdf_path
                        )

                        if success:
                            document_paths[equity][filing_type] = str(pdf_path)
                            logger.debug(
                                f"Converted and stored PDF for {equity} {filing_type}: {pdf_path}"
                            )
                        else:
                            logger.warning(
                                f"Failed to convert {filing_type} for {equity}"
                            )
                    else:
                        logger.warning(f"No {filing_type} document found for {equity}")

                except Exception as e:
                    logger.error(
                        f"Error processing {filing_type} for {equity}: {str(e)}"
                    )
                    continue

            if not document_paths[equity]:
                logger.warning(f"No documents found for equity: {equity}")

    except Exception as e:
        logger.error(f"Unexpected error during document collection: {str(e)}")
        raise

    return dict(document_paths)


def validate_document_paths(document_paths: Dict[str, Dict[str, str]]) -> bool:
    """
    Validate the collected document paths.

    Args:
        document_paths (Dict[str, Dict[str, str]]): Collected document paths

    Returns:
        bool: True if validation passes, False otherwise
    """

    try:
        # Check if any documents were collected
        if not document_paths:
            logger.error("No documents were collected")
            return False

        # Validate each path exists OR path does not end with .pdf
        for equity, filings in document_paths.items():
            if not filings:
                logger.warning(f"No filings found for equity {equity}")
                continue

            for filing_type, path in filings.items():
                logger.info(f"Checking PDF requirements for {equity} {filing_type} ")
                if not str(path).lower().endswith(".pdf"):
                    logger.error(
                        f"file for {equity} {filing_type} is not a PDF: {path}"
                    )
                logger.info(f"PDF found for {equity}")

                if not Path(path).exists():
                    logger.error(f"File not found for {equity} {filing_type}: {path}")
                    return False
        return True

    except Exception as e:
        logger.error(f"Error during validation: {str(e)}")
        return False


# Create directory if it does not exist
def ensure_directory_exists(directory_path):
    path = Path(directory_path)
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
        print(f"Directory created: {directory_path}")
    else:
        print(f"Directory already exists: {directory_path}")


# Convert pages from PDF to images
def extract_pdf_pages_to_images(pdf_path, image_dir):
    # Validate image_out directory exists
    doc_id = str(uuid.uuid4())
    image_out_dir = os.path.join(image_dir, doc_id)
    ensure_directory_exists(image_out_dir)

    # Open the PDF file and iterate pages
    print("Extracting images from PDF...")
    try:
        pdf_document = fitz.open(pdf_path)
    except Exception as e:
        logger.error(f"Error opening PDF: {str(e)}")
        return None

    # get the file name without extension
    file_name = os.path.splitext(os.path.basename(pdf_path))[0]

    for page_number in range(len(pdf_document)):
        page = pdf_document.load_page(page_number)
        image = page.get_pixmap()
        image_out_file = os.path.join(
            image_out_dir, f"{file_name}_{page_number + 1}.png"
        )
        image.save(image_out_file)

    pdf_document.close()
    return doc_id


# save the summary to pdf to upload to blob later
def save_str_to_pdf(text: str, output_path: str) -> None:
    """
    Save a given text string to a PDF file with full Unicode support using ReportLab.

    Args:
        text (str): The text content to be saved in the PDF.
        output_path (str): The file path where the PDF will be saved.

    Raises:
        Exception: If there is an error during the PDF creation or saving process.
    """
    try:
        # Create the PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72,
        )

        # Create the story (content)
        styles = getSampleStyleSheet()
        story = []

        # Add the text as a paragraph
        para = Paragraph(text, styles["Normal"])
        story.append(para)

        # Build the PDF
        doc.build(story)

        logger.info(f"PDF saved successfully to {output_path}")

    except Exception as e:
        logger.error(f"Error saving PDF: {str(e)}")
        raise


def remove_directory(directory_path):
    try:
        if os.path.exists(directory_path):
            shutil.rmtree(directory_path)
            print(f"Directory '{directory_path}' has been removed successfully.")
        else:
            print(f"Directory '{directory_path}' does not exist.")
    except Exception as e:
        print(f"An error occurred while removing the directory: {e}")


def reset_local_dirs():
    if os.path.exists("json"):
        remove_directory("json")
    if os.path.exists("images"):
        remove_directory("images")
    if os.path.exists("pdf"):
        remove_directory("pdf")


def create_document_paths(
    output_path: str, equity_name: str, financial_type: str
) -> dict:
    """
    Create a document paths dictionary structure compatible with upload_to_blob function.

    Args:
        output_path (str): Path to the document (e.g., 'pdf/10-K_AAPL_summary.pdf')
        equity_name (str): Name of the equity (e.g., 'AAPL')
        financial_type (str): Type of financial document (e.g., '10-K')

    Returns:
        dict: Nested dictionary structure for upload_to_blob function

    Example:
        >>> path = 'pdf/10-K_AAPL_summary.pdf'
        >>> create_document_paths(path, 'AAPL', '10-K')
        {
            'AAPL': {
                '10-K': 'pdf/10-K_AAPL_summary.pdf'
            }
        }
    """
    return {equity_name: {financial_type: output_path}}


def markdown_to_html(markdown_text: str, output_file: str):
    """Convert markdown to HTML using markdown2"""
    # Define CSS styles
    css_styles = """
            <style>
                body {
                    font-family: 'Times New Roman', Times, serif;
                    line-height: 1.6;
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 20px;
                    font-size: 12pt;  /* Standard size for Times New Roman */
                }
                h1, h2, h3 {
                    font-family: 'Times New Roman', Times, serif;
                    color: #333;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 20px 0;
                    font-family: 'Times New Roman', Times, serif;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f5f5f5;
                }
            </style>
            """

    html_content = markdown2.markdown(markdown_text, extras=["tables"])

    # Combine CSS with HTML content
    final_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                {css_styles}
            </head>
            <body>
                {html_content}
            </body>
            </html>
            """

    # Create output directory if it doesn't exist
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(final_html)


class BlobStorageError(Exception):
    """Base exception for blob storage operations"""

    pass


class BlobConnectionError(BlobStorageError):
    """Failed to connect to blob storage"""

    pass


class ContainerNotFoundError(BlobStorageError):
    """Container not found in blob storage"""

    pass


class BlobAuthenticationError(BlobStorageError):
    """Authentication failed for blob storage"""

    pass


class BlobNotFoundError(BlobStorageError):
    """Blob not found in storage"""

    pass


class BlobUploadError(BlobStorageError):
    """Failed to upload blob"""

    pass


class BlobDownloadError(BlobStorageError):
    """Failed to download blob"""

    pass


# class to catch metadata error
class BlobMetadataError(BlobStorageError):
    """Failed to retrieve metadata"""

    pass


class ReportGenerationError(Exception):
    """Base exception for report generation errors"""

    pass


class InvalidReportTypeError(ReportGenerationError):
    """Raised when report type is invalid"""

    pass


class StorageError(ReportGenerationError):
    """Raised when storage operations fail"""

    pass


class BlobStorageManager:
    def __init__(self):
        try:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                BLOB_CONNECTION_STRING
            )
            self.container_client = self.blob_service_client.get_container_client(
                BLOB_CONTAINER_NAME
            )
            self.blob_base_folder = "financial"
        except ValueError as e:
            raise BlobConnectionError(f"Invalid connection string: {str(e)}")
        except Exception as e:
            raise BlobConnectionError(f"Failed to initialize blob storage: {str(e)}")

    # todo: add report blob path to the click here link in the html template like this: https://webgpt0-vm2b2htvuuclm.azurewebsites.net/?agent=financial&document=Ecommerce&blobpath=%22https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Reports/Curation_Reports/Ecommerce/De[%E2%80%A6]KdAaWXqNHsjhB5c3cWaAT3rWymLUB3YuZQdOc%2F6FYG8%3D%22
    # todo: then retrieve the document in init and load the report content to the llm

    def get_rpcontent_from_blob_path(self, blob_path: str) -> str:
        """
        Get report content from blob path.

        Args:
            blob_path (str): Path to the blob, e.g. 'Reports/Curation_Reports/Ecommerce/December_2024.html'
        """
        try:
            # Remove any leading/trailing slashes
            clean_path = blob_path.strip("/")

            logger.info(f"Attempting to access blob at path: {clean_path}")

            blob_client = self.container_client.get_blob_client(clean_path)

            if not blob_client.exists():
                logger.error(f"Blob not found: {clean_path}")
                raise BlobDownloadError(f"Blob not found at path: {clean_path}")

            downloaded_blob = blob_client.download_blob()
            return downloaded_blob.content_as_text()

        except Exception as e:
            logger.exception(f"Error accessing blob at {blob_path}")
            raise BlobDownloadError(f"Failed to download blob: {str(e)}")

    # todo: double check this function
    def _get_blob_path_parts_from_url(self, url: str) -> List[str]:
        """
        Get the blob path parts from a given URL.
        """
        from urllib.parse import urlparse

        parsed_url = urlparse(url)
        return parsed_url.path.lstrip("/").split("/")

    def download_blob_from_a_link(self, url: str, filename: str = None) -> bool:
        """
        Download a document from a given blob URL and save it to the downloads directo ry.

        Args:
            url (str): The full Azure blob storage URL
            filename (str, optional): Name for the downloaded file. If not provided,
                                    will be extracted from the URL

        Returns:
            None
        """
        try:
            # Parse the URL to get the container and blob path
            from urllib.parse import urlparse

            parsed_url = urlparse(url)

            # Split the path into parts
            path_parts = parsed_url.path.lstrip("/").split("/")

            # Get blob path
            blob_path = "/".join(path_parts[1:])

            # If filename not provided, use the last part of the blob path
            if not filename:
                filename = os.path.basename(blob_path)

            # Create downloads directory in project root
            downloads_dir = os.path.join(os.getcwd(), "blob_downloads")
            os.makedirs(downloads_dir, exist_ok=True)

            # Construct the full local path
            local_data_path = os.path.join(downloads_dir, filename)

            # Get the blob client
            blob_client = self.container_client.get_blob_client(blob_path)

            # Download the blob
            with open(local_data_path, "wb") as file:
                download_stream = blob_client.download_blob()
                file.write(download_stream.readall())

            logger.info(f"Successfully downloaded blob to {local_data_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to download blob: {str(e)}")
            return False

    def download_documents(
        self,
        equity_name: str,
        financial_type: str,
        exclude_summary: bool = True,
        local_data_path: str = PDF_PATH,
    ) -> List[str]:
        """
        Download documents from blob storage.

        Args:
            equity_name (str): Name of the equity
            financial_type (str): Type of financial document
            exclude_summary (bool): Whether to exclude summary documents
            local_data_path (str): Local path to save documents

        Returns:
            List[str]: List of downloaded file paths

        Raises:
            BlobAuthenticationError: If authentication fails
            BlobNotFoundError: If no documents are found
            BlobDownloadError: If download fails
            OSError: If local file operations fail
        """
        downloaded_files = []
        try:
            # Create local directory
            try:
                os.makedirs(local_data_path, exist_ok=True)
            except OSError as e:
                raise OSError(f"Failed to create local directory: {str(e)}")

            base_path = f"{self.blob_base_folder}/{financial_type}"

            try:
                # List all blobs
                all_blobs = list(
                    self.container_client.list_blobs(name_starts_with=base_path)
                )
            except Exception as e:
                raise BlobNotFoundError(f"Failed to list blobs: {str(e)}")

            # Filter for exact equity name matches
            import re

            equity_pattern = re.compile(
                f"{re.escape(base_path)}/{re.escape(equity_name)}(_summary)?\.pdf$"
            )

            filtered_blobs = [
                blob
                for blob in all_blobs
                if equity_pattern.match(blob.name)
                and (not exclude_summary or "_summary" not in blob.name)
            ]

            if not filtered_blobs:
                raise BlobNotFoundError(
                    f"No matching documents found for {equity_name}"
                )

            logger.info(
                f"Found {len(filtered_blobs)} matching documents for {equity_name}"
            )

            for blob in filtered_blobs:
                try:
                    logger.info(f"Downloading {blob.name}")
                    blob_client = self.container_client.get_blob_client(blob.name)
                    file_name = f"{financial_type}_{os.path.basename(blob.name)}"
                    local_file_path = os.path.join(local_data_path, file_name)

                    with open(local_file_path, "wb") as file:
                        data = blob_client.download_blob()
                        file.write(data.readall())

                    downloaded_files.append(local_file_path)
                    logger.info(f"Successfully downloaded: {file_name}")
                except OSError as e:
                    logger.error(f"Error downloading {blob.name}: {str(e)}")
                    raise OSError(f"Failed to write file {local_file_path}: {str(e)}")
                except Exception as e:
                    logger.error(f"Error downloading {blob.name}: {str(e)}")
                    raise BlobDownloadError(f"Failed to download {blob.name}: {str(e)}")

        except Exception as e:
            logger.error(f"Error in blob storage operations: {str(e)}")
            raise

        return downloaded_files

    def get_document_metadata(self, remote_file_path: str) -> dict:
        """Retrieve metadata for a specific blob from defined container in env

        Args:
            remote_file_path (str): Path to the blob in blob storage

        Returns:
            dict: Metadata of the blob

        Raises:
            BlobMetadataError: If there is an error retrieving metadata
        Example:
            metadata = doc_processor.get_document_metadata('financial/10-K/AAPL.pdf')
            print(metadata)
        """

        try:
            blob_client = self.container_client.get_blob_client(remote_file_path)
            blob_properties = blob_client.get_blob_properties()
            return blob_properties.metadata
        except Exception as e:
            raise BlobMetadataError(
                f"Error retrieving metadata for {remote_file_path}: {str(e)}"
            )

    # make sure the document_paths is a dict with the structure of create_document_paths
    def upload_to_blob(
        self,
        document_paths: dict = None,
        metadata: dict = None,
        file_path: str = None,
        blob_folder: str = None,
    ) -> Dict:
        """
        Upload files to Azure Blob Storage. Can handle either a document_paths dictionary
        or a single file path.

        Args:
            document_paths (dict, optional): Nested dictionary with equity IDs and their filing types
            file_path (str, optional): Direct path to a file to upload
            blob_folder (str, optional): Custom folder path in blob storage (defaults to self.blob_base_folder)

        Returns:
            dict: Dictionary of upload results
        """
        if not document_paths and not file_path:
            raise ValueError("Either document_paths or file_path must be provided")

        if document_paths and file_path:
            raise ValueError("Cannot provide both document_paths and file_path")
        try:
            blob_sas_token = get_secret("blobSasToken")
            if not blob_sas_token:
                raise ValueError(
                    "The SAS token for Azure Blob Storage (blob_sas_token) is not set. Please ensure it is correctly configured."
                )

            logging.info("Successfully retrieved Blob SAS token.")
            # Validate that the SAS token is available

        except Exception as e:
            logging.error("Error retrieving the SAS token for Azure Blob Storage.")
            logging.debug(
                f"Detailed error: {e}"
            )  # Log detailed errors at the debug level
            raise
        # Handle single file upload
        if file_path:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")

            try:
                # Use provided blob folder or default to base folder
                base_folder = blob_folder if blob_folder else self.blob_base_folder
                blob_path = f"{base_folder}/{os.path.basename(file_path)}"
                # set the content type based on the file extension
                if blob_path.endswith(".pdf"):
                    content_type = "application/pdf"
                elif blob_path.endswith(".html"):
                    content_type = "text/html"
                elif blob_path.endswith(".txt"):
                    content_type = "text/plain"
                else:
                    content_type = "application/octet-stream"
                with open(file_path, "rb") as data:
                    try:
                        self.container_client.upload_blob(
                            name=blob_path,
                            data=data,
                            overwrite=True,
                            content_settings=ContentSettings(content_type=content_type),
                            metadata=metadata,
                        )
                    except Exception as e:
                        raise BlobUploadError(f"Failed to upload {blob_path}: {str(e)}")

                # get the blob url for the uploaded file
                blob_url = f"{self.blob_service_client.url}{os.getenv('BLOB_CONTAINER_NAME')}/{blob_path}?{blob_sas_token}"

                result = {
                    "status": "success",
                    "blob_path": blob_path,
                    "blob_url": blob_url,
                }
                logger.info(f"Document has been uploaded to {blob_path}")
                return result

            except Exception as e:
                result = {"status": "failed", "error": str(e)}
                logger.error(f"Failed to upload file {file_path}: {str(e)}")
                return result

        # Handle document_paths dictionary upload (original functionality)
        if not isinstance(document_paths, dict):
            raise ValueError("document_paths must be a dictionary")
        try:
            blob_sas_token = get_secret("blobSasToken")
            if not blob_sas_token:
                raise ValueError(
                    "The SAS token for Azure Blob Storage (blob_sas_token) is not set. Please ensure it is correctly configured."
                )

            logging.info("Successfully retrieved Blob SAS token.")
            # Validate that the SAS token is available

        except Exception as e:
            logging.error("Error retrieving the SAS token for Azure Blob Storage.")
            logging.debug(
                f"Detailed error: {e}"
            )  # Log detailed errors at the debug level
            raise
        upload_results = {}
        for equity, filings in document_paths.items():
            upload_results[equity] = {}
            for filing_type, document_path in filings.items():
                try:
                    if not os.path.exists(document_path):
                        raise FileNotFoundError(f"File not found: {document_path}")

                    blob_path = (
                        f"{self.blob_base_folder}/{filing_type}/{equity}_summary.pdf"
                        if "summary" in document_path
                        else f"{self.blob_base_folder}/{filing_type}/{equity}.pdf"
                    )

                    # set the content type based on the file extension
                    if blob_path.endswith(".pdf"):
                        content_type = "application/pdf"
                    elif blob_path.endswith(".html"):
                        content_type = "text/html"
                    elif blob_path.endswith(".txt"):
                        content_type = "text/plain"
                    else:
                        content_type = "application/octet-stream"

                    with open(document_path, "rb") as data:
                        try:
                            self.container_client.upload_blob(
                                name=blob_path,
                                data=data,
                                overwrite=True,
                                content_settings=ContentSettings(
                                    content_type=content_type
                                ),
                                metadata=metadata,
                            )
                        except Exception as e:
                            raise BlobUploadError(
                                f"Failed to upload {blob_path}: {str(e)}"
                            )

                    # get the blob url for the uploaded file
                    blob_url = f"{self.blob_service_client.url}{os.getenv('BLOB_CONTAINER_NAME')}/{blob_path}?{blob_sas_token}"
                    upload_results[equity][filing_type] = {
                        "status": "success",
                        "blob_path": blob_path,
                        "blob_url": blob_url,
                        "metadata": metadata,
                    }
                    logger.info(f"Document has been uploaded to {blob_path}")
                except Exception as e:
                    upload_results[equity][filing_type] = {
                        "status": "failed",
                        "error": str(e),
                    }
                    logger.error(f"Failed to upload {equity} {filing_type}: {str(e)}")
        return upload_results

    def list_blobs_in_container(
        self,
        container_name: str,
        prefix: str = None,
        include_metadata: str = "no",
        max_results: int = None,
    ) -> List[Dict[str, Any]]:
        """
        List blobs in a container with filtering and metadat

        Args:
            container_name(str): Name of the container to list blobs from
            prefix(str, optional): Filter results to blob with this prefix
            include_metadata(str, optional): Include metadata in results
            max_results (int, optional): Maximum number of results to return

        Returns:
            List[Dict[str, Any]]: List of blobs information dictionaries containing
                - name: Blob name
                - size: size in bytes
                - created_on: Creation timestamp
                - last_modified: Last modified timestamp
                - content_type: MIME type of the blob
                - metadata: Blob metadata if include_metadata is True
                - url: Blob URL

        Raises:
            ValueError: If container_name is empty or max_results is invalid
            ContainerNotFoundError: if container doesn't exist
            BlobAuthenticationError: if authentication fails
        """
        if not container_name or not container_name.strip():
            raise ValueError("Container name is required and cannot be empty")

        if max_results is None and max_results <= 0:
            raise ValueError("max_results must be greater than 0")

        try:
            container_client = self.blob_service_client.get_container_client(
                container_name
            )

            # Verify container exists
            if not container_client.exists():
                raise ContainerNotFoundError(f"Container not found: {container_name}")

            # build list params
            list_params = {
                "name_starts_with": prefix if prefix else None,
                "results_per_page": max_results,
            }

            # list blobs with params
            blob_list = []
            blobs = container_client.list_blobs(
                **{k: v for k, v in list_params.items() if v is not None}
            )

            for blob in blobs:
                blob_info = {
                    "name": blob.name,
                    "size": blob.size,
                    "created_on": blob.creation_time.isoformat(),
                    "last_modified": blob.last_modified.isoformat(),
                    "content_type": blob.content_settings.content_type,
                    "url": f"{self.blob_service_client.url}{container_name}/{blob.name}",
                }
                if include_metadata == "yes":
                    try:
                        blob_client = container_client.get_blob_client(blob.name)
                        properties = blob_client.get_blob_properties()
                        blob_info["metadata"] = properties.metadata
                    except Exception as e:
                        logger.warning(
                            f"Failed to retrieve metadata for {blob.name}: {str(e)}"
                        )
                        blob_info["metadata"] = None

                blob_list.append(blob_info)

                if max_results and len(blob_list) >= max_results:
                    break

            return blob_list

        except Exception as e:
            if "AuthenticationFailed" in str(e):
                raise BlobAuthenticationError(
                    f"Error authenticating with blob storage: {str(e)}"
                )
            logger.error(f"Error listing blobs in container: {str(e)}")
            raise


from sec_edgar_downloader import Downloader
from utils import cleanup_resources


class FinancialDocumentProcessor:
    def __init__(self):
        self.dl = Downloader(
            os.getenv("USER_AGENT_NAME", "SalesFactory"),
            os.getenv("USER_AGENT_EMAIL", "nam.tran@salesfactory.com"),
        )
        self.blob_manager = BlobStorageManager()

    def download_filing(
        self, equity_id: str, filing_type: str, after_date: str = None
    ) -> dict:
        """
        Download a single SEC filing.

        Args:
            equity_id (str): The equity identifier (e.g., 'AAPL')
            filing_type (str): The type of filing (e.g., '10-K')
            after_date (str): Date string in 'YYYY-MM-DD' format

        Returns:
            dict: Status of the download operation
        """
        try:
            if after_date:
                # Validate date format
                try:
                    # Parse the input date
                    parsed_date = datetime.strptime(after_date, "%Y-%m-%d")

                    # Ensure date is in UTC timezone
                    utc_date = parsed_date.replace(tzinfo=timezone.utc)

                    # Convert to string format expected by SEC EDGAR
                    formatted_date = utc_date.strftime("%Y-%m-%d")

                    # today
                    today = datetime.now(timezone.utc)

                    # Add one day
                    tomorrow = today + timedelta(days=1)

                    tomorrow_str = tomorrow.strftime("%Y-%m-%d")

                    logger.info(
                        f"Downloading {filing_type} for {equity_id} after {formatted_date}"
                    )
                    num_downloaded_file = self.dl.get(
                        filing_type,
                        equity_id,
                        limit=1,
                        download_details=True,
                        after=formatted_date,
                        before=tomorrow_str,  # avoid afterdate is greater than before date error
                    )

                    if num_downloaded_file == 0:
                        return {
                            "status": "not_found",
                            "message": f"No {filing_type} found after {formatted_date} for {equity_id}",
                            "code": 404,
                        }
                except ValueError as e:
                    return {
                        "status": "error",
                        "message": f"Error: {str(e)}",
                        "code": 400,
                    }
            else:
                logger.info(f"Downloading most recent {filing_type} for {equity_id}")
                self.dl.get(filing_type, equity_id, limit=1, download_details=True)

            return {
                "status": "success",
                "message": f"Successfully downloaded {filing_type} for {equity_id}",
                "code": 200,
            }
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            return {
                "status": "error",
                "message": f"Failed to download {filing_type} for {equity_id}: {str(e)}",
                "code": 500,
            }

    def process_and_upload(self, equity_id: str, filing_type: str) -> dict:
        """Process and upload a single document."""
        try:
            document_paths = collect_filing_documents(
                EQUITY_IDS=[equity_id],
                FILING_TYPES=[filing_type],
                get_downloaded_files=get_downloaded_files,
            )

            if not validate_document_paths(document_paths):
                return {
                    "status": "error",
                    "message": "Document collection validation failed",
                    "code": 400,
                }

            # add metadata to uploaded document
            from datetime import datetime

            metadata = {
                "equity_id": equity_id,
                "filing_type": filing_type,
                "uploaded_date": datetime.now().strftime("%Y-%m-%d"),
                "source": "SEC EDGAR",
            }

            results = self.blob_manager.upload_to_blob(
                document_paths, metadata=metadata
            )

            equity_result = results.get(equity_id, {})
            filing_result = equity_result.get(filing_type, {})
            upload_successful = filing_result.get("status") == "success"

            if upload_successful:
                if cleanup_resources():
                    logger.info("Successfully cleaned up files")
                else:
                    logger.warning("Failed to clean up files")
            else:
                logger.warning("Skipping cleanup as upload failed")

            return {
                "status": "success" if upload_successful else "error",
                "message": (
                    "Document processed successfully"
                    if upload_successful
                    else "Upload failed"
                ),
                "results": results,
                "code": 200 if upload_successful else 500,
            }
        except Exception as e:
            logger.error(f"Processing failed: {str(e)}")
            return {
                "status": "error",
                "message": f"Processing failed: {str(e)}",
                "code": 500,
            }


# example usage for get_document_metadata
if __name__ == "__main__":
    doc_processor = BlobStorageManager()
    blobs = doc_processor.list_blobs_in_container(
        container_name="documents",
        prefix="Reports/Curation_Reports/Ecommerce",
        include_metadata="yes",
        max_results=10,
    )
    print(blobs)
