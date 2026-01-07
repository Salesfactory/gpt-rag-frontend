from flask import Blueprint, current_app, request
import os
import tempfile
from shared.decorators import only_platform_admin
from utils import create_success_response, create_error_response
from http import HTTPStatus
import logging
import json
from datetime import datetime
from shared.blob_storage import BlobStorageManager


bp = Blueprint("platform_admin", __name__, url_prefix="/api/platform-admin")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

CUSTOMER_PULSE_CONTAINER_NAME = os.getenv("CUSTOMER_PULSE_CONTAINER_NAME", "survey-data")
CUSTOMER_PULSE_FOLDER = "customer-pulse"


@bp.route("/data-ingestion", methods=["POST"])
@only_platform_admin()
def ingest_global_data():
    """
    Upload and store customer pulse data file.
    
    Endpoint for platform administrators to upload customer pulse data files.
    The file is temporarily saved locally and then uploaded to blob storage
    in the customer-pulse folder.
    
    Args:
        file: File uploaded via multipart/form-data with key 'file'
    
    Returns:
        JSON response with success message and HTTP 201 on successful upload,
        or error message with appropriate HTTP status code on failure.
    
    Raises:
        400: If no file is provided or no file is selected
        500: If there's an error during file processing or upload
    
    Example:
        POST /api/platform-admin/data-ingestion
        Content-Type: multipart/form-data
        
        Response:
        {
            "message": "Global data ingested successfully"
        }
    """
    file = request.files.get("file")
    form_metadata: list(dict) = request.form.get("metadata", [])
    if not file:
        return create_error_response(
            "No file part in the request", HTTPStatus.BAD_REQUEST
        )
    if file.filename == "":
        logging.error("No file selected")
        return create_error_response("No file selected", HTTPStatus.BAD_REQUEST)
    try:
        blob_storage_manager = current_app.config["blob_storage_manager"]
        

        metadata = {
            "upload_date": datetime.now().isoformat(),
        }

        form_metadata = json.loads(form_metadata) if form_metadata else []
        for item in form_metadata:
            metadata[item["key"]] = item["value"]

        # Use the new memory-based upload method
        result = blob_storage_manager.upload_fileobj_to_blob(
            fileobj=file.stream, 
            filename=file.filename,
            blob_folder=CUSTOMER_PULSE_FOLDER,
            container=CUSTOMER_PULSE_CONTAINER_NAME,
            metadata=metadata
        )
        
        if result["status"] == "success":
            logging.info("Global data ingested successfully")
            return create_success_response(
                "Global data ingested successfully", HTTPStatus.CREATED
            )
        else:
            logging.error(f"Upload failed: {result.get('error', 'Unknown error')}")
            return create_error_response(
                result.get("error", "Upload failed"), 
                HTTPStatus.INTERNAL_SERVER_ERROR
            )
            
    except Exception as e:
        logging.error(f"Error ingesting global data: {str(e)}")
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)


@bp.route("/global-data", methods=["GET"])
@only_platform_admin()
def get_global_data():
    """
    Retrieve list of global data files.
    
    Endpoint for platform administrators to list all global data files
    stored in blob storage. Returns a list of available files for management
    and reference purposes.
    
    Returns:
        JSON response containing array of file information with HTTP 200 on success,
        or error message with HTTP 500 on failure.
    
    Raises:
        500: If there's an error accessing blob storage or listing files
    
    Example:
        GET /api/platform-admin/global-data
        
        Response:
        {
            "data": [
                {
                    "name": "customer-pulse-2024-01.csv",
                    "size": 1024,
                    "last_modified": "2024-01-15T10:30:00Z"
                }
            ]
        }
    """
    try:
        blob_storage_manager: BlobStorageManager = current_app.config[
            "blob_storage_manager"
        ]
        files = blob_storage_manager.list_blobs_in_container(
            CUSTOMER_PULSE_CONTAINER_NAME,
            prefix=CUSTOMER_PULSE_FOLDER + "/",
        )
        return create_success_response(files, HTTPStatus.OK)
    except Exception as e:
        logger.exception("Error retrieving global data files")
        return create_error_response(
            "Failed to retrieve global data files.",
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )
