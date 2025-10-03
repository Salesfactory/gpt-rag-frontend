import os
import tempfile
import logging
from flask import Blueprint, current_app, request
from data_summary.summarize import create_description
from utils import create_success_response, create_error_response

# Allowed file extensions for description generation
DESCRIPTION_VALID_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls"]

# Allowed MIME types (strict mapping: extension → mimetype)
ALLOWED_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

BLOB_CONTAINER_NAME = "documents"
ORG_FILES_PREFIX = "organization_files"

bp = Blueprint("upload_source_document", __name__, url_prefix="/api")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def validate_file_signature(file_path, mimetype):
    """Lightweight signature validation for safety."""
    with open(file_path, "rb") as f:
        header = f.read(8)

    if mimetype == "application/pdf":
        return header.startswith(b"%PDF")

    if mimetype in [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    ]:
        return header.startswith(b"PK")  # ZIP archive

    if mimetype in [
        "application/vnd.ms-excel",      # .xls
        "application/msword",            # .doc
        "application/vnd.ms-powerpoint", # .ppt
    ]:
        return header.startswith(b"\xD0\xCF\x11\xE0")  # OLE Compound File

    if mimetype == "text/csv":
        # Try to decode as UTF-8 text
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                f.read(1024)
            return True
        except UnicodeDecodeError:
            return False

    return False


@bp.route("/upload-source-document", methods=["POST"])
def upload_source_document():
    llm = current_app.config["llm"]
    temp_file_path = None
    try:
        organization_id = request.form.get("organization_id")
        if not organization_id:
            logger.error("Organization ID not provided in request")
            return create_error_response("Organization ID is required", 400)

        file = request.files.get("file")
        if not file:
            logger.error("No file part in the request")
            return create_error_response("No file part in the request", 400)

        if file.filename == "":
            logger.error("No file selected")
            return create_error_response("No file selected", 400)

        # Extract extension & mimetype
        _, ext = os.path.splitext(file.filename.lower())
        file_mime = file.mimetype

        expected_mime = ALLOWED_MIME_TYPES.get(ext)
        if not expected_mime or file_mime != expected_mime:
            logger.error(f"Invalid file type: {file.filename} ({file_mime})")
            return create_error_response("Invalid file type", 422)

        # Save to temp
        temp_file_path = os.path.join(tempfile.gettempdir(), file.filename)
        file.save(temp_file_path)

        # Validate file signature
        if not validate_file_signature(temp_file_path, file_mime):
            logger.error(f"File signature mismatch for {file.filename} ({file_mime})")
            return create_error_response("File content does not match declared type", 422)

        logger.info(f"Uploading file '{file.filename}' for organization '{organization_id}'")

        # Blob folder
        blob_folder = f"{ORG_FILES_PREFIX}/{organization_id}"

        # Metadata
        metadata = {"organization_id": organization_id}

        if ext in DESCRIPTION_VALID_FILE_EXTENSIONS:
            logger.info(f"Gen AI description for file '{file.filename}'")
            description = create_description(temp_file_path, llm=llm)
            logger.info(f"Generated Description of file {temp_file_path}: {description}")
            metadata["description"] = description["file_description"]
            metadata["description_source"] = description["source"]

        # Upload to blob
        blob_storage_manager = current_app.config["blob_storage_manager"]
        result = blob_storage_manager.upload_to_blob(
            file_path=temp_file_path,
            blob_folder=blob_folder,
            metadata=metadata,
            container=os.getenv("BLOB_CONTAINER_NAME", BLOB_CONTAINER_NAME),
        )

        if result["status"] == "success":
            logger.info(f"Successfully uploaded file '{file.filename}' to '{blob_folder}'")
            return create_success_response({"blob_url": result["blob_url"]}, 200)
        else:
            error_msg = f"Error uploading file: {result.get('error', 'Unknown error')}"
            logger.error(error_msg)
            return create_error_response(error_msg, 500)

    except Exception as e:
        logger.exception(f"Unexpected error in upload_source_document: {e}")
        return create_error_response("Internal Server Error", 500)

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
