# document_processor.py
from azure.storage.blob import BlobServiceClient
from utils import convert_html_to_pdf
import os
from pathlib import Path
from collections import defaultdict
from typing import Dict, List
import logging 
from app_config import BLOB_CONTAINER_NAME

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
