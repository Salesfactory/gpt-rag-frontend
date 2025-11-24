import os
import tempfile
import logging
import time
from flask import Blueprint, current_app, request
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError
from data_summary.summarize import create_description
from utils import create_success_response, create_error_response

from routes.decorators.auth_decorator import auth_required

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

bp = Blueprint("file_management", __name__, url_prefix="/api")

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


def delete_from_azure_search(filepath: str) -> dict:
    """
    Delete documents from Azure Search Service by filepath using Azure Search SDK.
    
    Args:
        filepath: The filepath value to match in the search index
        
    Returns:
        dict: Result dictionary with 'success' boolean and optional 'error' message
    """
    try:
        # Get Azure Search configuration from environment variables
        search_service_name = os.getenv("AZURE_SEARCH_SERVICE_NAME")
        search_admin_key = os.getenv("AZURE_SEARCH_ADMIN_KEY")
        search_index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")
        
        # If Azure Search is not configured, skip deletion
        if not all([search_service_name, search_admin_key]):
            logger.warning("Azure Search Service not fully configured. Skipping search index deletion.")
            return {"success": True, "skipped": True}
        
        # If index name is not provided, log warning and skip
        if not search_index_name:
            logger.warning("AZURE_SEARCH_INDEX_NAME not set. Skipping search index deletion.")
            return {"success": True, "skipped": True}
        
        # Construct the Azure Search endpoint
        search_endpoint = f"https://{search_service_name}.search.windows.net"
        
        # Create credential and search client
        credential = AzureKeyCredential(search_admin_key)
        search_client = SearchClient(
            endpoint=search_endpoint,
            index_name=search_index_name,
            credential=credential
        )
        
        logger.info(f"Attempting to delete document from Azure Search index '{search_index_name}' with filepath: {filepath}")
        
        # Delete document by filepath
        # The document must include the key field (filepath in this case)
        result = search_client.delete_documents(documents=[{"filepath": filepath}])
        
        # Check the result
        # The result is a list of IndexingResult objects
        if result and len(result) > 0:
            delete_result = result[0]
            if delete_result.succeeded:
                logger.info(f"Successfully deleted document from Azure Search: {filepath}")
                return {"success": True}
            else:
                error_msg = f"Failed to delete from Azure Search. Status code: {delete_result.status_code}, Error: {delete_result.error_message}"
                logger.error(error_msg)
                return {"success": False, "error": error_msg}
        else:
            logger.warning(f"No result returned from Azure Search deletion for: {filepath}")
            return {"success": True, "partial": True}
            
    except HttpResponseError as e:
        error_msg = f"Azure Search HTTP error: {str(e)}"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"Unexpected error deleting from Azure Search: {str(e)}"
        logger.exception(error_msg)
        return {"success": False, "error": error_msg}




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

        # Get folder path from request (optional)
        folder_path = request.form.get("folder_path", "").strip()

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

        logger.info(f"Uploading file '{file.filename}' for organization '{organization_id}' to folder '{folder_path}'")

        # Blob folder - include subfolder path if provided
        blob_folder = f"{ORG_FILES_PREFIX}/{organization_id}"
        if folder_path:
            # Clean the folder path (remove leading/trailing slashes)
            folder_path = folder_path.strip("/")
            blob_folder = f"{blob_folder}/{folder_path}"

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



@bp.route("/upload-shared-document", methods=["POST"])
@auth_required
def upload_shared_document():
    """
    Upload a file to the shared folder.
    This endpoint uploads the file to 'organization_files/shared/'.
    
    Expected form data:
    - file: The file to upload
    
    Returns:
        JSON response with upload result
    """
    llm = current_app.config["llm"]
    temp_file_path = None
    
    try:
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

        logger.info(f"Uploading shared file '{file.filename}' to shared folder")

        # Get blob storage manager
        blob_storage_manager = current_app.config["blob_storage_manager"]

        # Prepare metadata (generate description if applicable)
        metadata = {}
        
        if ext in DESCRIPTION_VALID_FILE_EXTENSIONS:
            logger.info(f"Generating AI description for shared file '{file.filename}'")
            try:
                description = create_description(temp_file_path, llm=llm)
                logger.info(f"Generated Description: {description}")
                metadata["description"] = description["file_description"]
                metadata["description_source"] = description["source"]
            except Exception as desc_error:
                logger.warning(f"Failed to generate description: {desc_error}")
                # Continue without description

        # Upload to shared folder
        blob_folder = f"{ORG_FILES_PREFIX}/shared"
        
        # Set metadata
        metadata["organization_id"] = "shared"
        metadata["shared_file"] = "true"
        
        # Upload to blob
        result = blob_storage_manager.upload_to_blob(
            file_path=temp_file_path,
            blob_folder=blob_folder,
            metadata=metadata,
            container=os.getenv("BLOB_CONTAINER_NAME", BLOB_CONTAINER_NAME),
        )

        if result["status"] == "success":
            logger.info(f"Successfully uploaded to shared folder")
            
            response_data = {
                "message": "File uploaded to shared folder successfully",
                "filename": file.filename,
                "blob_url": result["blob_url"]
            }
            return create_success_response(response_data, 200)
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.error(f"Failed to upload to shared folder: {error_msg}")
            return create_error_response(f"Failed to upload file: {error_msg}", 500)

    except Exception as e:
        logger.exception(f"Unexpected error in upload_shared_document: {e}")
        return create_error_response("Internal Server Error", 500)

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@bp.route("/delete-source-document", methods=["DELETE"])
@auth_required
def delete_source_document():
    try:
        # Get blob name from query parameters
        blob_name = request.args.get("blob_name")
        if not blob_name:
            return create_error_response("Blob name is required", 400)

        # # Make sure blob_name starts with organization_files/ for security
        # if not blob_name.startswith("organization_files/"):
        #     return create_error_response("Invalid blob path. Path must start with 'organization_files/'", 400)
        # NOTE: commented out to allow deletion of results from web scraping folder as well

        # Initialize blob storage manager and delete blob
        blob_storage_manager = current_app.config["blob_storage_manager"]
        container_client = (
            blob_storage_manager.blob_service_client.get_container_client("documents")
        )

        # Get the blob client
        blob_client = container_client.get_blob_client(blob_name)

        # Check if blob exists
        if not blob_client.exists():
            return create_error_response(f"File not found: {blob_name}", 404)

        # Delete the blob
        blob_client.delete_blob()
        
        # Delete from Azure Search Service
        search_result = delete_from_azure_search(blob_name)
        
        # Prepare response message
        response_data = {"message": "File deleted successfully"}
        
        # Add search deletion status to response
        if search_result.get("skipped"):
            response_data["search_index_note"] = "Azure Search deletion skipped (not configured)"
        elif not search_result.get("success"):
            # Log the error but don't fail the overall operation since blob was deleted
            logger.warning(f"File deleted from blob storage but failed to delete from Azure Search: {search_result.get('error')}")
            response_data["search_index_warning"] = "File deleted but search index deletion failed"
        else:
            response_data["search_index_deleted"] = True

        return create_success_response(response_data, 200)
    except Exception as e:
        logger.exception(f"Unexpected error in delete_source_from_blob: {e}")
        return create_error_response("Internal Server Error", 500)


@bp.route("/create-folder", methods=["POST"])
@auth_required
def create_folder():
    """
    Create a virtual folder in blob storage by creating an init.txt file.
    
    Expected JSON payload:
    {
        "organization_id": "org-123",
        "folder_name": "New Folder",
        "current_path": "subfolder" (optional, empty string for root)
    }
    
    Returns:
        JSON response with success message or error details
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)
        
        # Validate required fields
        organization_id = data.get("organization_id", "").strip()
        folder_name = data.get("folder_name", "").strip()
        current_path = data.get("current_path", "").strip()
        
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        
        if not folder_name:
            return create_error_response("Folder name is required", 400)
        
        # Validate folder name (same validation as frontend)
        invalid_chars = r'<>:"/\\|?*'
        if any(char in folder_name for char in invalid_chars):
            return create_error_response(
                f"Folder name contains invalid characters ({invalid_chars})", 400
            )
        
        if len(folder_name) > 255:
            return create_error_response("Folder name is too long (max 255 characters)", 400)
        
        # Build the folder path
        base_prefix = f"organization_files/{organization_id}/"
        
        if current_path:
            current_path = current_path.strip("/")
            folder_full_path = f"{base_prefix}{current_path}/{folder_name}/"
        else:
            folder_full_path = f"{base_prefix}{folder_name}/"
        
        # Check if folder already exists by checking for any blobs with this prefix
        blob_storage_manager = current_app.config["blob_storage_manager"]
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
        
        # List blobs with the folder prefix to check if it exists
        existing_blobs = list(container_client.list_blobs(name_starts_with=folder_full_path, results_per_page=1))
        
        if existing_blobs:
            return create_error_response("A folder with this name already exists", 409)
        
        # Create the init.txt file to represent the folder
        init_file_path = f"{folder_full_path}init.txt"
        blob_client = container_client.get_blob_client(init_file_path)
        
        # Upload an empty file with metadata
        blob_client.upload_blob(
            data="",
            blob_type="BlockBlob",
            metadata={
                "folder_marker": "true",
                "created_by": "folder_creation_endpoint",
                "organization_id": organization_id
            },
            overwrite=False
        )
        
        logger.info(f"Created folder '{folder_name}' at path '{folder_full_path}' for organization {organization_id}")
        
        return create_success_response({
            "message": "Folder created successfully",
            "folder_path": folder_full_path,
            "folder_name": folder_name
        }, 201)
        
    except Exception as e:
        logger.exception(f"Unexpected error in create_folder: {e}")
        return create_error_response("Internal Server Error", 500)




@bp.route("/move-file", methods=["POST"])
@auth_required
def move_file():
    """
    Move a file from one location to another in blob storage.
    This is implemented as a copy + delete operation.
    
    Expected JSON payload:
    {
        "organization_id": "org-123",
        "source_blob_name": "organization_files/org-123/folder1/file.pdf",
        "destination_folder_path": "folder2" (or "" for root)
    }
    
    Returns:
        JSON response with success message or error details
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)
        
        # Validate required fields
        organization_id = data.get("organization_id", "").strip()
        source_blob_name = data.get("source_blob_name", "").strip()
        destination_folder_path = data.get("destination_folder_path", "").strip()
        
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        
        if not source_blob_name:
            return create_error_response("Source blob name is required", 400)
        
        # This prevents cross-tenant data access/deletion
        expected_org_prefix = f"organization_files/{organization_id}/"
        if not source_blob_name.startswith(expected_org_prefix):
            logger.warning(
                f"Unauthorized move attempt: organization {organization_id} tried to move blob '{source_blob_name}' "
                f"which doesn't belong to them (expected prefix: {expected_org_prefix})"
            )
            return create_error_response(
                "Unauthorized: Source file does not belong to your organization", 403
            )
        
        # Extract the file name from the source blob path
        file_name = source_blob_name.split("/")[-1]
        
        # Build the destination blob path
        base_prefix = f"organization_files/{organization_id}/"
        
        if destination_folder_path:
            destination_folder_path = destination_folder_path.strip("/")
            destination_blob_name = f"{base_prefix}{destination_folder_path}/{file_name}"
        else:
            destination_blob_name = f"{base_prefix}{file_name}"
        
        # Don't allow moving to the same location
        if source_blob_name == destination_blob_name:
            return create_error_response("Source and destination are the same", 400)
        
        blob_storage_manager = current_app.config["blob_storage_manager"]
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
        
        # Check if source blob exists
        source_blob_client = container_client.get_blob_client(source_blob_name)
        if not source_blob_client.exists():
            return create_error_response("Source file not found", 404)
        
        # Check if destination already exists
        destination_blob_client = container_client.get_blob_client(destination_blob_name)
        if destination_blob_client.exists():
            return create_error_response("A file with this name already exists in the destination folder", 409)
        
        # Get source blob properties and metadata
        source_properties = source_blob_client.get_blob_properties()
        source_metadata = source_properties.metadata or {}
        
        # Copy the blob to the new location
        # Using start_copy_from_url which is async in Azure but we'll wait for it
        source_url = source_blob_client.url
        copy_operation = destination_blob_client.start_copy_from_url(source_url)
        
        # Wait for the copy to complete (with timeout)
        max_wait_time = 60  # 60 seconds timeout
        wait_time = 0
        sleep_interval = 0.5
        
        while wait_time < max_wait_time:
            dest_properties = destination_blob_client.get_blob_properties()
            copy_status = dest_properties.copy.status
            
            if copy_status == "success":
                break
            elif copy_status == "failed":
                return create_error_response("Failed to copy file", 500)
            elif copy_status in ["pending", "copying"]:
                time.sleep(sleep_interval)
                wait_time += sleep_interval
            else:
                return create_error_response(f"Unknown copy status: {copy_status}", 500)
        
        if wait_time >= max_wait_time:
            return create_error_response("Copy operation timed out", 500)
        
        # Set metadata on the destination blob (preserving original metadata)
        try:
            destination_blob_client.set_blob_metadata(metadata=source_metadata)
        except Exception as metadata_error:
            logger.warning(f"Failed to set metadata on destination blob: {metadata_error}")
        
        # Delete the source blob
        try:
            source_blob_client.delete_blob()
        except Exception as delete_error:
            logger.error(f"Failed to delete source blob after copy: {delete_error}")
            # File was copied but not deleted - return a partial success message
            return create_success_response({
                "message": "File copied but original could not be deleted",
                "destination_blob_name": destination_blob_name,
                "warning": "Original file still exists"
            }, 200)
        
        logger.info(f"Successfully moved file from '{source_blob_name}' to '{destination_blob_name}'")
        
        return create_success_response({
            "message": "File moved successfully",
            "destination_blob_name": destination_blob_name,
            "source_blob_name": source_blob_name
        }, 200)
        
    except Exception as e:
        logger.exception(f"Unexpected error in move_file: {e}")
        return create_error_response("Internal Server Error", 500)

@bp.route("/rename-file", methods=["POST"])
@auth_required
def rename_file():
    """
    Renames a single file by copying it to the same folder with a new filename and deleting the original.
    Expected JSON:
    {
        "organization_id": "org-123",
        "source_blob_name": "organization_files/org-123/path/file.xlsx",
        "new_file_name": "file_renamed.xlsx"   # name + extension, no slashes
    }
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)

        organization_id = (data.get("organization_id") or "").strip()
        source_blob_name = (data.get("source_blob_name") or "").strip()
        new_file_name = (data.get("new_file_name") or "").strip()

        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        if not source_blob_name:
            return create_error_response("Source blob name is required", 400)
        if not new_file_name:
            return create_error_response("New file name is required", 400)

        expected_org_prefix = f"organization_files/{organization_id}/"
        if not source_blob_name.startswith(expected_org_prefix):
            logger.warning(f"[rename-file] Org {organization_id} tried to rename foreign blob {source_blob_name}")
            return create_error_response("Unauthorized: Source file does not belong to your organization", 403)

        invalid_chars = '<>:"/\\|?*#^'
        if any(ch in new_file_name for ch in invalid_chars):
            return create_error_response(f"Invalid file name: contains one of ({invalid_chars})", 422)
        if "/" in new_file_name or "\\" in new_file_name:
            return create_error_response("New file name must not contain path separators", 422)
        if len(new_file_name) > 255:
            return create_error_response("File name is too long (max 255 characters)", 422)

        last_slash = source_blob_name.rfind("/")
        if last_slash < 0:
            return create_error_response("Invalid source path", 400)
        source_dir = source_blob_name[:last_slash]
        dest_blob_name = f"{source_dir}/{new_file_name}"

        if dest_blob_name == source_blob_name:
            return create_error_response("New name is the same as current name", 400)

        blob_storage_manager = current_app.config["blob_storage_manager"]
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")

        src = container_client.get_blob_client(source_blob_name)
        if not src.exists():
            return create_error_response("Source file not found", 404)

        dst = container_client.get_blob_client(dest_blob_name)
        if dst.exists():
            return create_error_response("A file with this name already exists in this folder", 409)

        source_url = src.url
        copy = dst.start_copy_from_url(source_url)

        max_wait_time = 60
        wait_time = 0.0
        interval = 0.5
        while wait_time < max_wait_time:
            props = dst.get_blob_properties()
            status = props.copy.status
            if status == "success":
                break
            if status == "failed":
                return create_error_response("Failed to copy file", 500)
            time.sleep(interval)
            wait_time += interval
        if wait_time >= max_wait_time:
            return create_error_response("Copy operation timed out", 500)

        try:
            src_props = src.get_blob_properties()
            dst.set_blob_metadata(metadata=(src_props.metadata or {}))
        except Exception as meta_err:
            logger.warning(f"[rename-file] Could not set metadata on {dest_blob_name}: {meta_err}")

        try:
            src.delete_blob()
        except Exception as del_err:
            logger.error(f"[rename-file] Copied but could not delete source {source_blob_name}: {del_err}")
            return create_success_response({
                "message": "File renamed (source not deleted)",
                "destination_blob_name": dest_blob_name,
                "warning": "Original file still exists"
            }, 200)

        # Delete old file reference from Azure Search Service
        search_result = delete_from_azure_search(source_blob_name)
        
        # Prepare response
        response_data = {
            "message": "File renamed successfully",
            "destination_blob_name": dest_blob_name,
            "source_blob_name": source_blob_name
        }
        
        # Add search deletion status to response
        if search_result.get("skipped"):
            response_data["search_index_note"] = "Azure Search deletion skipped (not configured)"
        elif not search_result.get("success"):
            logger.warning(f"File renamed but failed to delete old reference from Azure Search: {search_result.get('error')}")
            response_data["search_index_warning"] = "File renamed but old search index entry may still exist"
        else:
            response_data["search_index_deleted"] = True

        logger.info(f"[rename-file] {source_blob_name} -> {dest_blob_name} (org={organization_id})")
        return create_success_response(response_data, 200)

    except Exception as e:
        logger.exception(f"Unexpected error in rename_file: {e}")
        return create_error_response("Internal Server Error", 500)

@bp.route("/delete-folder", methods=["DELETE"])
@auth_required
def delete_folder():
    """
    Delete a folder and all its contents from blob storage.
    This deletes all blobs with the specified folder prefix.
    
    Expected JSON payload:
    {
        "organization_id": "org-123",
        "folder_path": "subfolder/folder-name"
    }
    
    Returns:
        JSON response with success message or error details
    """
    try:
        data = request.get_json()
        if not data:
            return create_error_response("No JSON data provided", 400)
        
        # Validate required fields
        organization_id = data.get("organization_id", "").strip()
        folder_path = data.get("folder_path", "").strip()
        
        if not organization_id:
            return create_error_response("Organization ID is required", 400)
        
        if not folder_path:
            return create_error_response("Folder path is required", 400)
        
        # Build the full folder prefix
        base_prefix = f"organization_files/{organization_id}/"
        folder_full_path = f"{base_prefix}{folder_path.strip('/')}"
        
        # Prevent deletion of root organization folder
        # Only allow deletion of sub-folders
        if folder_full_path == base_prefix.rstrip('/'):
            return create_error_response("Cannot delete root organization folder", 400)
        
        # Ensure the folder path ends with /
        if not folder_full_path.endswith('/'):
            folder_full_path += '/'
        
        # This prevents cross-tenant data access/deletion
        if not folder_full_path.startswith(base_prefix):
            logger.warning(
                f"Unauthorized delete attempt: organization {organization_id} tried to delete folder '{folder_path}' "
                f"which doesn't belong to them (expected prefix: {base_prefix})"
            )
            return create_error_response(
                "Unauthorized: Folder does not belong to your organization", 403
            )
        
        blob_storage_manager = current_app.config["blob_storage_manager"]
        container_client = blob_storage_manager.blob_service_client.get_container_client("documents")
        
        # List all blobs with this prefix (includes all files and subfolders)
        blobs_to_delete = list(container_client.list_blobs(name_starts_with=folder_full_path))
        
        if not blobs_to_delete:
            return create_error_response("Folder not found or is empty", 404)
        
        # Delete all blobs with this prefix
        deleted_count = 0
        failed_deletions = []
        
        for blob in blobs_to_delete:
            try:
                blob_client = container_client.get_blob_client(blob.name)
                blob_client.delete_blob()
                deleted_count += 1
                logger.info(f"Deleted blob: {blob.name}")
            except Exception as delete_error:
                logger.error(f"Failed to delete blob {blob.name}: {delete_error}")
                failed_deletions.append(blob.name)
        
        if failed_deletions:
            logger.warning(f"Some files could not be deleted: {failed_deletions}")
            return create_success_response({
                "message": f"Folder partially deleted. {deleted_count} files deleted, {len(failed_deletions)} failed.",
                "deleted_count": deleted_count,
                "failed_count": len(failed_deletions),
                "failed_files": failed_deletions
            }, 200)
        
        logger.info(f"Successfully deleted folder '{folder_path}' with {deleted_count} files for organization {organization_id}")
        
        return create_success_response({
            "message": "Folder deleted successfully",
            "deleted_count": deleted_count,
            "folder_path": folder_path
        }, 200)
        
    except Exception as e:
        logger.exception(f"Unexpected error in delete_folder: {e}")
        return create_error_response("Internal Server Error", 500)
