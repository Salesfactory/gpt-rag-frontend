# document_processor.py

import os
import logging
import base64
import uuid
import shutil
from pathlib import Path
from collections import defaultdict
from typing import Dict, List

import pandas as pd
import fitz
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient, ContentSettings
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

from utils import convert_html_to_pdf
from app_config import BLOB_CONTAINER_NAME, PDF_PATH


BLOB_CONNECTION_STRING = os.getenv('BLOB_CONNECTION_STRING')
BLOB_CONTAINER_NAME = os.getenv('BLOB_CONTAINER_NAME')

# Load environment variables
load_dotenv()

# configure logging
logging.basicConfig(
    level = logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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
    EQUITY_IDS: List[str],
    FILING_TYPES: List[str],
    get_downloaded_files: callable
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
                        pdf_path = Path(html_path).with_suffix('.pdf')
                        
                        # Convert HTML to PDF
                        success = convert_html_to_pdf(
                            input_path=html_path,
                            output_path=pdf_path
                        )
                        
                        if success:
                            document_paths[equity][filing_type] = str(pdf_path)
                            logger.debug(f"Converted and stored PDF for {equity} {filing_type}: {pdf_path}")
                        else:
                            logger.warning(f"Failed to convert {filing_type} for {equity}")
                    else:
                        logger.warning(f"No {filing_type} document found for {equity}")
                        
                except Exception as e:
                    logger.error(f"Error processing {filing_type} for {equity}: {str(e)}")
                    continue
            
            if not document_paths[equity]:
                logger.warning(f"No documents found for equity: {equity}")
                
    except Exception as e:
        logger.error(f"Unexpected error during document collection: {str(e)}")
        raise
    
    return dict(document_paths)


blob_connection_string = os.getenv("BLOB_CONNECTION_STRING")
if not blob_connection_string:
    raise ValueError("BLOB_CONNECTION_STRING environment variable is not set")
blob_container_name = BLOB_CONTAINER_NAME

blob_service_client = BlobServiceClient.from_connection_string(blob_connection_string)
container_client = blob_service_client.get_container_client(blob_container_name)


def upload_to_blob(document_paths: dict, container_client, base_folder: str = "financial") -> Dict[str, Dict[str, Dict[str, str]]]:
    """
    Upload files to Azure Blob Storage with organized folder structure based on filing type.
    
    Args:
        document_paths (dict): Nested dictionary with equity IDs and their filing types
        container_client: Azure blob container client
        base_folder (str): Base folder name in blob storage
    
    Returns:
        dict: Dictionary of upload results with equity IDs and filing types as keys
    """
    upload_results = {}
    
    for equity, filings in document_paths.items():
        upload_results[equity] = {}
        
        for filing_type, document_path in filings.items():
            try:
                # Construct blob path using the filing type directly
                blob_path = f"{base_folder}/{filing_type}/{equity}.pdf"
                
                # Upload file with determined path
                with open(document_path, "rb") as data:
                    container_client.upload_blob(
                        name=blob_path,
                        data=data,
                        overwrite=True  # Overwrite if file exists
                    )
                
                upload_results[equity][filing_type] = {
                    "status": "success",
                    "blob_path": blob_path
                }
                
            except Exception as e:
                upload_results[equity][filing_type] = {
                    "status": "failed",
                    "error": str(e)
                }
                logger.error(f"Failed to upload {equity} {filing_type}: {str(e)}")
                raise
    
    return upload_results


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
                if not str(path).lower().endswith('.pdf'):
                    logger.error(f"file for {equity} {filing_type} is not a PDF: {path}")
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
    print ('Extracting images from PDF...')
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
        image_out_file = os.path.join(image_out_dir, f'{file_name}_{page_number + 1}.png')
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
            bottomMargin=72
        )
        
        # Create the story (content)
        styles = getSampleStyleSheet()
        story = []
        
        # Add the text as a paragraph
        para = Paragraph(text, styles['Normal'])
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
    if os.path.exists('json'):
        remove_directory('json')
    if os.path.exists('images'):
        remove_directory('images')
    if os.path.exists('pdf'):
        remove_directory('pdf')

def create_document_paths(output_path: str, equity_name: str, financial_type: str) -> dict:
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
    return {
        equity_name: {
            financial_type: output_path
        }
    }


class BlobStorageManager:
    def __init__(self):
        self.blob_service_client = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
        self.container_client = self.blob_service_client.get_container_client(BLOB_CONTAINER_NAME)
        self.blob_base_folder = 'financial'

    def download_documents(self, equity_name: str,
                         financial_type: str = '10-K',
                         exclude_summary: bool = True,
                         local_data_path: str = PDF_PATH) -> List[str]:
        downloaded_files = [] # should be only 1 file, but keep it as a list for now
        try:
            os.makedirs(local_data_path, exist_ok=True) # create the folder if it doesn't exist
            prefix = f"{self.blob_base_folder}/{financial_type}/{equity_name}"
            filtered_blobs = list(self.container_client.list_blobs(name_starts_with=prefix))
            if exclude_summary:
                logger.info(f'Excluding summary documents')
                filtered_blobs = [blob for blob in filtered_blobs if "summary" not in blob.name]
            else:
                logger.info(f'Downloaded documents include summary documents')

            for blob in filtered_blobs:
                try:
                    logger.info(f'Downloading {blob.name}')
                    blob_client = self.container_client.get_blob_client(blob.name) # this is the link to the remote blob
                    file_name = f'{financial_type}_{os.path.basename(blob.name)}' # add financial type to the file name locally
                    local_file_path = os.path.join(local_data_path, file_name)
                    logger.info(f'Downloading {blob.name} to {local_file_path}')

                    with open(local_file_path, "wb") as file:
                        data = blob_client.download_blob()
                        file.write(data.readall())
                    
                    downloaded_files.append(local_file_path)
                    logger.info(f"Successfully downloaded: {file_name}")

                except Exception as e:
                    logger.error(f"Error downloading {blob.name}: {str(e)}")
                    continue

        except Exception as e:
            logger.error(f"Error in blob storage operations: {str(e)}")
        
        return downloaded_files

    # make sure the document_paths is a dict with the structure of create_document_paths
    def upload_to_blob(self, document_paths: dict) -> Dict:
        """
        Upload files to Azure Blob Storage with organized folder structure based on filing type.
        
        Args:
            document_paths (dict): Nested dictionary with equity IDs and their filing types
            container_client: Azure blob container client
            base_folder (str): Base folder name in blob storage
            
        Returns:
            dict: Dictionary of upload results with equity IDs and filing types as keys
        """
        
        upload_results = {}
        for equity, filings in document_paths.items():
            upload_results[equity] = {}
            for filing_type, document_path in filings.items():
                try:
                    blob_path = f"{self.blob_base_folder}/{filing_type}/{equity}_summary.pdf" if "summary" in document_path else f"{self.blob_base_folder}/{filing_type}/{equity}.pdf"
                    with open(document_path, "rb") as data:
                        self.container_client.upload_blob(name=blob_path, 
                                                          data=data, 
                                                          overwrite=True, 
                                                          content_settings=ContentSettings(content_type='application/pdf'))
                    upload_results[equity][filing_type] = {"status": "success", "blob_path": blob_path}
                    logger.info(f'Document has been uploaded to {blob_path}')
                except Exception as e:
                    upload_results[equity][filing_type] = {"status": "failed", "error": str(e)}
                    logger.error(f"Failed to upload {equity} {filing_type}: {str(e)}")
        return upload_results
    
