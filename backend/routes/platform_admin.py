import logging
import os
import json
from datetime import datetime
from http import HTTPStatus
from io import BytesIO
from pathlib import Path

from flask import Blueprint, request, current_app

from shared.cosmo_db import (
    get_all_organizations,
    get_all_organization_usages,
    update_organization_metadata,
    get_user_by_email,
    delete_organization
)

from shared.blob_storage import BlobStorageManager
from shared.decorators import only_platform_admin
from shared.pulse_excel_to_json import serialize_excel, ExcelParserError
from routes.decorators.auth_decorator import auth_required
from routes.organizations import send_admin_notification_email
from utils import create_success_response, create_error_response


bp = Blueprint("platform_admin", __name__, url_prefix="/api/platform-admin")
logger = logging.getLogger(__name__)


CUSTOMER_PULSE_CONTAINER_NAME = os.getenv("CUSTOMER_PULSE_CONTAINER_NAME", "survey-data")
CUSTOMER_PULSE_JSON_CONTAINER_NAME = os.getenv("CUSTOMER_PULSE_JSON_CONTAINER_NAME", "survey-json-intermediate")
CUSTOMER_PULSE_FOLDER = "consumer-pulse"

TIER_MAPPING = {
    'tier_free': 'Free',
    'tier_basic': 'Basic',
    'tier_premium': 'Premium',
    'tier_custom': 'Custom'
}

@bp.route("/organizations", methods=["GET"])
@only_platform_admin()
def get_platform_organizations():
    """
    Retrieve all organizations with aggregated usage and billing metadata for
    platform administrators.
    This endpoint is secured by the ``auth_required`` decorator and is intended
    to be used by platform-level administrators to view organization-level
    information in a single response.
    Returns:
        flask.Response: A JSON success response containing a list of
        organizations, each enriched with usage statistics, tier information,
        limits, and billing-related fields on success.
    Error responses:
        401/403: If authentication or authorization fails (enforced by
            ``auth_required``).
        500: If an unexpected error occurs while fetching or aggregating
            organization data.
    """
    try:
        orgs = get_all_organizations()
        usages = get_all_organization_usages()
        usage_map = {u['organizationId']: u for u in usages if 'organizationId' in u}

        result = []
        for org in orgs:
            org_id = org.get('id')
            usage = usage_map.get(org_id, {})
            policy = usage.get('policy', {})
            
            tier_id = policy.get('tierId', 'tier_free')
            tier = TIER_MAPPING.get(tier_id, tier_id)
            
            expiration_timestamp = usage.get('currentPeriodEnds')
            expiration_date = None
            if expiration_timestamp:
                try:
                    expiration_date = datetime.fromtimestamp(float(expiration_timestamp)).isoformat()
                except Exception:
                    expiration_date = None
            
            ts = org.get('_ts')
            updated_at = datetime.fromtimestamp(ts).isoformat() if ts else (org.get('createdAt') or datetime.now().isoformat())
            created_at = datetime.fromtimestamp(org.get('created_at')).isoformat() if org.get('created_at') else None
            
            result.append({
                "id": org_id,
                "name": org.get('name', 'Unknown'),
                "subscription_tier": tier,
                "expiration_date": expiration_date,
                "created_at": created_at,
                "updated_at": updated_at,
                "storage_cost": 0,
                "ingestion_cost": 0,
                "tokens_cost": 0,
                "total_cost": 0
            })
        return create_success_response(result)
    except Exception as e:
        logger.error(f"Error fetching platform organizations: {e}")
        return create_error_response("Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/organizations/<organization_id>", methods=["PUT"])
@only_platform_admin()
def update_platform_organization(organization_id):
    """
    Update an organization's metadata and optionally assign an admin user.
    This endpoint updates the organization's name and, if an admin email is
    provided, associates the organization with that user and sends a
    notification email to the new admin.
    Parameters
    ----------
    organization_id : str
        The unique identifier of the organization to update, provided as a
        path parameter.
    Request JSON Body
    -----------------
    name : str
        The new name for the organization. This field is required.
    admin_email : str, optional
        The email address of the user to set as the organization's owner.
    Returns
    -------
    flask.Response
        A JSON response created by ``create_success_response`` containing the
        updated organization metadata on success, or by
        ``create_error_response`` containing an error message on failure.
    Error Responses
    ---------------
    400 BAD REQUEST
        Returned if the organization name is missing from the request body
        or if the provided admin email does not correspond to an existing
        user.
    500 INTERNAL SERVER ERROR
        Returned if an unexpected error occurs while processing the
        request.
    """
    try:
        data = request.json
        name = data.get("name")
        admin_email = data.get("admin_email")

        if not name:
            return create_error_response("Organization name is required", HTTPStatus.BAD_REQUEST)

        owner_id = None
        
        if admin_email:
            user = get_user_by_email(admin_email)
            if not user:
                return create_error_response(f"User with email {admin_email} not found", HTTPStatus.BAD_REQUEST)
            owner_id = user.get('id')
            target_user_name = user.get("data", {}).get("name", "User")
        
        updated_org = update_organization_metadata(organization_id, name, owner_id)
        
        if admin_email and owner_id:
            send_admin_notification_email(admin_email, target_user_name, name)

        return create_success_response(updated_org)
    except Exception as e:
        logger.error(f"Error updating organization {organization_id}: {e}")
        return create_error_response(str(e) or "Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/organizations/<organization_id>", methods=["DELETE"])
@only_platform_admin()
def delete_platform_organization(organization_id):
    """
    Delete an organization by its identifier.
    This endpoint deletes the organization identified by the given
    ``organization_id``. On success, it returns a JSON response with
    a confirmation message.
    Parameters
    ----------
    organization_id : str
        The unique identifier of the organization to delete, provided
        as a path parameter in the request URL.
    Returns
    -------
    flask.Response
        A JSON response created by ``create_success_response`` with a
        confirmation message on success (typically HTTP 200 OK), or a
        JSON error response created by ``create_error_response`` with
        HTTP 500 Internal Server Error if an unexpected error occurs.
    Potential Errors
    ----------------
    - 500 Internal Server Error:
      Returned if an unexpected exception is raised while attempting
      to delete the organization. The error is logged with the
      organization identifier for diagnostics.
    """
    try:
        delete_organization(organization_id)
        return create_success_response({"message": "Organization deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting organization {organization_id}: {e}")
        return create_error_response("Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/data-ingestion", methods=["POST"])
@only_platform_admin()
def ingest_global_data():
    """
    Upload and store customer pulse data file.

    Endpoint for platform administrators to upload customer pulse data files.
    The file is uploaded to blob storage in the customer-pulse folder, then
    converted from Excel to JSON and uploaded to the intermediate JSON container.

    Args:
        file: File uploaded via multipart/form-data with key 'file'
        metadata: Optional JSON string with metadata key-value pairs

    Returns:
        JSON response with success message and HTTP 201 on successful upload,
        or error message with appropriate HTTP status code on failure.

    Raises:
        400: If no file is provided, no file is selected, or Excel format is invalid
        500: If there's an error during file processing or upload

    Example:
        POST /api/platform-admin/data-ingestion
        Content-Type: multipart/form-data

        Response:
        {
            "message": "Global data ingested successfully",
            "excel_uploaded": true,
            "json_uploaded": true,
        }
    """
    file = request.files.get("file")
    form_metadata: list(dict) = request.form.get("metadata", [])

    if not file:
        return create_error_response(
            "No file part in the request", HTTPStatus.BAD_REQUEST
        )
    if file.filename == "":
        logger.error("No file selected")
        return create_error_response("No file selected", HTTPStatus.BAD_REQUEST)

    try:
        file_content = file.stream.read()

        blob_storage_manager = current_app.config["blob_storage_manager"]

        excel_metadata = {
            "upload_date": datetime.now().isoformat(),
        }

        if form_metadata:
            form_metadata = json.loads(form_metadata)
            for item in form_metadata:
                excel_metadata[item["key"]] = item["value"]

        # 1. Upload original Excel file
        excel_blob_path = f"{CUSTOMER_PULSE_FOLDER}/{file.filename}"
        excel_result = blob_storage_manager.upload_fileobj_to_blob(
            fileobj=BytesIO(file_content),
            filename=file.filename,
            blob_folder=CUSTOMER_PULSE_FOLDER,
            container=CUSTOMER_PULSE_CONTAINER_NAME,
            metadata=excel_metadata
        )

        if excel_result["status"] != "success":
            return create_error_response(
                excel_result.get("error", "Excel upload failed"),
                HTTPStatus.INTERNAL_SERVER_ERROR
            )

        # 2. Convert Excel to JSON
        try:
            json_data = serialize_excel(BytesIO(file_content))
        except ExcelParserError as e:
            logger.error(f"Excel conversion failed: {str(e)}")
            return create_error_response(
                f"Excel file format error: {str(e)}",
                HTTPStatus.BAD_REQUEST
            )

        # 3. Upload JSON to intermediate container 
        json_filename = Path(file.filename).with_suffix('.json').name
        json_bytes = json.dumps(json_data, indent=2, ensure_ascii=False).encode('utf-8')

        json_metadata = {
            "source_file_directory": excel_blob_path,
            "source_file_name": file.filename,
            "processed_at": datetime.now().isoformat()
        }

        json_result = blob_storage_manager.upload_fileobj_to_blob(
            fileobj=BytesIO(json_bytes),
            filename=json_filename,
            blob_folder=CUSTOMER_PULSE_FOLDER,
            container=CUSTOMER_PULSE_JSON_CONTAINER_NAME,
            metadata=json_metadata
        )

        if json_result["status"] != "success":
            logger.warning(f"JSON upload failed but Excel uploaded: {json_result.get('error')}")

        return create_success_response({
            "message": "Global data ingested successfully",
            "excel_uploaded": True,
            "json_uploaded": json_result["status"] == "success",
        }, HTTPStatus.CREATED)

    except Exception as e:
        logger.error(f"Error ingesting global data: {str(e)}")
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
        blob_storage_manager: BlobStorageManager = current_app.config["blob_storage_manager"]
        files = blob_storage_manager.list_blobs_in_container(
            CUSTOMER_PULSE_CONTAINER_NAME,
            prefix=CUSTOMER_PULSE_FOLDER + "/",
        )
        return create_success_response(files, HTTPStatus.OK)
    except Exception as e:
        logger.exception("Error retrieving global data files")
        return create_error_response("Failed to retrieve global data files.", HTTPStatus.INTERNAL_SERVER_ERROR)