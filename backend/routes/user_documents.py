import os
from flask import Blueprint, current_app, request
import tempfile
import logging
import re
import secrets
import uuid
import time
from utils import create_success_response, create_error_response

BLOB_CONTAINER_NAME = "user-documents"
ALLOWED_FILE_EXTENSIONS = [".pdf"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB 

bp = Blueprint("user_documents", __name__, url_prefix="/api")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def sanitize_path_component(component):
    """Sanitize path components to prevent directory traversal"""
    if not component:
        return ""
    return re.sub(r'[^a-zA-Z0-9\-_]', '', str(component))


def validate_uuid(uuid_string):
    """Validate UUID format"""
    try:
        uuid.UUID(uuid_string)
        return True
    except (ValueError, TypeError):
        return False


def validate_file(file):
    """Validate uploaded file type and size"""
    if not file.filename:
        return False, "No filename provided"
    
    # extension check     
    if not any(file.filename.lower().endswith(ext) for ext in ALLOWED_FILE_EXTENSIONS):
        allowed = ", ".join(ALLOWED_FILE_EXTENSIONS)
        return False, f"File type not allowed. Only {allowed} files are permitted"
    
    # size check
    if hasattr(file, 'content_length') and file.content_length:
        if file.content_length > MAX_FILE_SIZE:
            return False, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"

    return True, "Valid file"


@bp.route("/upload-user-document", methods=["POST"])
def upload_user_document():
    temp_file_path = None
    try:
        if "file" not in request.files:
            logger.error("No file part in the request")
            return create_error_response("No file part in the request", 400)

        file = request.files["file"]

        # Validate file
        is_valid, validation_message = validate_file(file)
        if not is_valid:
            logger.error(f"File validation failed: {validation_message}")
            return create_error_response(validation_message, 400)

        user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not user_id:
            logger.error("User ID not provided in headers")
            return create_error_response("User authentication required", 401)

        # Get required parameters from form data
        organization_id = request.form.get("organization_id")
        conversation_id = request.form.get("conversation_id")

        if not organization_id:
            logger.error("Organization ID not provided in request")
            return create_error_response("Organization ID is required", 400)

        if not conversation_id:
            logger.error("Conversation ID not provided in request")
            return create_error_response("Conversation ID is required", 400)

        # Validate UUID format for conversation_id
        if not validate_uuid(conversation_id):
            logger.error(f"Invalid conversation ID format: {conversation_id}")
            return create_error_response("Invalid conversation ID format", 400)

        # Sanitize path components to prevent directory traversal
        safe_org_id = sanitize_path_component(organization_id)
        safe_user_id = sanitize_path_component(user_id)
        safe_conversation_id = sanitize_path_component(conversation_id)

        if not safe_org_id or not safe_user_id or not safe_conversation_id:
            logger.error("Invalid characters in path components")
            return create_error_response("Invalid characters in identifiers", 400)

        logger.info(
            f"Uploading file '{file.filename}' for user '{safe_user_id}' in organization '{safe_org_id}' conversation '{safe_conversation_id}'"
        )

        # Generate timestamped filename for blob storage
        safe_filename = os.path.basename(file.filename)  # Remove any path components
        base_name, ext = os.path.splitext(safe_filename)
        timestamp = int(time.time())
        timestamped_filename = f"{base_name}_{timestamp}{ext}"

        # Create a secure temporary file with the timestamped name
        temp_filename = f"{secrets.token_hex(16)}_{timestamped_filename}"
        temp_file_path = os.path.join(tempfile.gettempdir(), temp_filename)
        file.save(temp_file_path)

        blob_folder = f"{safe_org_id}/{safe_user_id}/{safe_conversation_id}"

        # Create metadata with hierarchical information
        metadata = {
            "organization_id": organization_id,
            "user_id": user_id,
            "conversation_id": conversation_id
        }

        # Initialize blob storage manager and upload file
        blob_storage_manager = current_app.config["blob_storage_manager"]

        result = blob_storage_manager.upload_to_blob(
            file_path=temp_file_path,
            blob_folder=blob_folder,
            metadata=metadata,
            container=BLOB_CONTAINER_NAME,
        )

        if result["status"] == "success":
            logger.info(
                f"Successfully uploaded file '{file.filename}' to '{blob_folder}' in container '{BLOB_CONTAINER_NAME}'"
            )
            return create_success_response({"blob_url": result["blob_url"]}, 200)
        else:
            error_msg = f"Error uploading file: {result.get('error', 'Unknown error')}"
            logger.error(error_msg)
            return create_error_response(error_msg, 500)

    except Exception as e:
        logger.exception(f"Unexpected error in upload_user_document: {e}")
        return create_error_response("Internal Server Error", 500)

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@bp.route("/list-user-documents", methods=["GET"])
def list_user_documents():
    try:
        user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not user_id:
            logger.error("User ID not provided in headers")
            return create_error_response("User authentication required", 401)

        organization_id = request.args.get("organization_id")
        conversation_id = request.args.get("conversation_id")

        if not organization_id:
            logger.error("Organization ID not provided in request")
            return create_error_response("organization_id is required", 400)

        if not conversation_id:
            logger.error("Conversation ID not provided in request")
            return create_error_response("conversation_id is required", 400)

        if not validate_uuid(conversation_id):
            logger.error(f"Invalid conversation ID format: {conversation_id}")
            return create_error_response("Invalid conversation ID format", 400)

        # Sanitize path components 
        safe_org_id = sanitize_path_component(organization_id)
        safe_user_id = sanitize_path_component(user_id)
        safe_conversation_id = sanitize_path_component(conversation_id)

        if not safe_org_id or not safe_user_id or not safe_conversation_id:
            logger.error("Invalid characters in path components")
            return create_error_response("Invalid characters in identifiers", 400)

        prefix = f"{safe_org_id}/{safe_user_id}/{safe_conversation_id}/"

        logger.info(f"Listing documents for user '{safe_user_id}' in organization '{safe_org_id}' conversation '{safe_conversation_id}'")

        blob_storage_manager = current_app.config["blob_storage_manager"]

        blobs = blob_storage_manager.list_blobs_in_container(
            container_name=BLOB_CONTAINER_NAME,
            prefix=prefix,
            include_metadata="no"
        )

        files = []
        for blob in blobs:
            filename = blob["name"].split("/")[-1] # tbd if we need the full path or not
            files.append({
                "filename": filename,
                "size": blob["size"],
                "uploaded_at": blob["last_modified"]
            })

        logger.info(f"Found {len(files)} files for conversation '{safe_conversation_id}'")
        return create_success_response({"files": files}, 200)

    except Exception as e:
        logger.exception(f"Unexpected error in list_user_documents: {e}")
        return create_error_response("Internal Server Error", 500)


@bp.route("/delete-user-document", methods=["DELETE"])
def delete_user_document():
    try:
        user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not user_id:
            logger.error("User ID not provided in headers")
            return create_error_response("User authentication required", 401)

        data = request.get_json()
        if not data:
            logger.error("No JSON data provided in request body")
            return create_error_response("JSON body is required", 400)

        filename = data.get("filename")
        organization_id = data.get("organization_id")
        conversation_id = data.get("conversation_id")

        if not filename:
            logger.error("Filename not provided in request")
            return create_error_response("filename is required", 400)

        if not organization_id:
            logger.error("Organization ID not provided in request")
            return create_error_response("organization_id is required", 400)

        if not conversation_id:
            logger.error("Conversation ID not provided in request")
            return create_error_response("conversation_id is required", 400)

        if not validate_uuid(conversation_id):
            logger.error(f"Invalid conversation ID format: {conversation_id}")
            return create_error_response("Invalid conversation ID format", 400)

        safe_org_id = sanitize_path_component(organization_id)
        safe_user_id = sanitize_path_component(user_id)
        safe_conversation_id = sanitize_path_component(conversation_id)
        safe_filename = os.path.basename(filename) 

        if not safe_org_id or not safe_user_id or not safe_conversation_id or not safe_filename:
            logger.error("Invalid characters in path components")
            return create_error_response("Invalid characters in identifiers", 400)

        blob_path = f"{safe_org_id}/{safe_user_id}/{safe_conversation_id}/{safe_filename}"

        logger.info(f"Deleting file '{safe_filename}' for user '{safe_user_id}' in organization '{safe_org_id}' conversation '{safe_conversation_id}'")

        blob_storage_manager = current_app.config["blob_storage_manager"]

        result = blob_storage_manager.delete_blob(
            blob_name=blob_path,
            container_name=BLOB_CONTAINER_NAME
        )

        if result["status"] == "success":
            logger.info(f"Successfully deleted file '{safe_filename}' from '{blob_path}' in container '{BLOB_CONTAINER_NAME}'")
            return create_success_response({"message": f"File '{safe_filename}' deleted successfully"}, 200)
        else:
            error_msg = f"Error deleting file: {result.get('error', 'Unknown error')}"
            logger.error(error_msg)
            return create_error_response(error_msg, 500)

    except Exception as e:
        logger.exception(f"Unexpected error in delete_user_document: {e}")
        return create_error_response("Internal Server Error", 500)