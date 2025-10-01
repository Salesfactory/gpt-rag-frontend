import os
from flask import Blueprint, current_app, request
import tempfile
import logging
from data_summary.summarize import create_description
from utils import create_success_response, create_error_response

DESCRIPTION_VALID_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls"]
BLOB_CONTAINER_NAME = "documents"
ORG_FILES_PREFIX = "organization_files"

bp = Blueprint("upload_source_document", __name__, url_prefix="/api")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@bp.route("/upload-source-document", methods=["POST"])
def upload_source_document():
    llm = current_app.config["llm"]
    temp_file_path = None
    try:
        # Check if file is in the request
        if "file" not in request.files:
            logger.error("No file part in the request")
            return create_error_response("No file part in the request", 400)

        file = request.files["file"]

        # Check if filename is empty
        if file.filename == "":
            logger.error("No file selected")
            return create_error_response("No file selected", 400)

        # Get organization ID from form data, query parameters, or headers
        organization_id = request.form.get("organization_id")

        if not organization_id:
            logger.error("Organization ID not provided in request")
            return create_error_response("Organization ID is required", 400)

        logger.info(
            f"Uploading file '{file.filename}' for organization '{organization_id}'"
        )

        # Create a temporary file to save the uploaded content
        temp_file_path = os.path.join(tempfile.gettempdir(), file.filename)
        file.save(temp_file_path)

        # Define the folder path in blob storage
        blob_folder = f"organization_files/{organization_id}"

        # Create metadata with organization ID
        metadata = {"organization_id": organization_id}

        if file.filename.endswith((".csv", ".xls", ".xlsx")):
            logger.info(f"Gen AI description for file '{file.filename}'")
            description = str(create_description(temp_file_path, llm=llm))
            logger.info(
                f"Generated Description of file {temp_file_path}: {description}"
            )
            metadata["description"] = description

        # Initialize blob storage manager and upload file
        blob_storage_manager = current_app.config["blob_storage_manager"]

        result = blob_storage_manager.upload_to_blob(
            file_path=temp_file_path,
            blob_folder=blob_folder,
            metadata=metadata,
            container=os.getenv("BLOB_CONTAINER_NAME"),
        )

        if result["status"] == "success":
            logger.info(
                f"Successfully uploaded file '{file.filename}' to '{blob_folder}'"
            )
            return create_success_response({"blob_url": result["blob_url"]}, 200)
        else:
            error_msg = f"Error uploading file: {result.get('error', 'Unknown error')}"
            logger.error(error_msg)
            return create_error_response(error_msg, 500)

    except Exception as e:
        logger.exception(f"Unexpected error in upload_source_to_blob: {e}")
        return create_error_response("Internal Server Error", 500)

    finally:
        # Remove temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)