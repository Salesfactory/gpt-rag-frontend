import logging
from flask import Blueprint
from routes.decorators.auth_decorator import auth_required
from shared.cosmo_db import get_all_organizations, get_all_organization_usages, update_organization_metadata, get_user_by_email, delete_organization
from utils import create_success_response, create_error_response
from http import HTTPStatus
from datetime import datetime
from flask import request
from routes.organizations import send_admin_notification_email

bp = Blueprint("platform_admin", __name__)
logger = logging.getLogger(__name__)

TIER_MAPPING = {
    'tier_free': 'Free',
    'tier_basic': 'Basic',
    'tier_premium': 'Premium',
    'tier_custom': 'Custom'
}

@bp.route("/api/platform-admin/organizations/<organization_id>", methods=["PUT"])
@auth_required
def update_platform_organization(organization_id):
    try:
        data = request.json
        name = data.get("name")
        admin_email = data.get("admin_email")

        if not name:
            return create_error_response("Organization name is required", HTTPStatus.BAD_REQUEST)

        owner_id = None
        target_user_name = "User"
        
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
        error_msg = str(e) if str(e) else "Internal Server Error"
        return create_error_response(error_msg, HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/platform-admin/organizations/<organization_id>", methods=["DELETE"])
@auth_required
def delete_platform_organization(organization_id):
    try:
        delete_organization(organization_id)
        return create_success_response({"message": "Organization deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting organization {organization_id}: {e}")
        return create_error_response("Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/platform-admin/organizations", methods=["GET"])
@auth_required
def get_platform_organizations():
    try:
        # Fetch data
        orgs = get_all_organizations()
        usages = get_all_organization_usages()

        # Map usages by organizationId
        usage_map = {u['organizationId']: u for u in usages if 'organizationId' in u}

        # Join and format
        result = []
        for org in orgs:
            org_id = org.get('id')
            usage = usage_map.get(org_id, {})
            policy = usage.get('policy', {})
            
            # Extract fields
            tier_id = policy.get('tierId', 'tier_free')
            # Use mapped name if available, otherwise return raw ID (e.g. for stripe price IDs)
            tier = TIER_MAPPING.get(tier_id, tier_id)
            
            # Expiration
            expiration_timestamp = usage.get('currentPeriodEnds')
            expiration_date = None
            if expiration_timestamp:
                try:
                    # timestamp is in seconds
                    expiration_date = datetime.fromtimestamp(float(expiration_timestamp)).isoformat()
                except Exception:
                    expiration_date = None
            
            # Additional fields for frontend compatibility
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
                # Placeholder costs as requested to ignore them for now
                "storage_cost": 0,
                "ingestion_cost": 0,
                "tokens_cost": 0,
                "total_cost": 0
            })

        return create_success_response(result)

    except Exception as e:
        logger.error(f"Error fetching platform organizations: {e}")
        return create_error_response("Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR)
from flask import Blueprint, current_app, request
import os
import tempfile
from shared.decorators import only_platform_admin
from utils import create_success_response, create_error_response
from http import HTTPStatus
import logging
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
    if not file:
        return create_error_response(
            "No file part in the request", HTTPStatus.BAD_REQUEST
        )
    if file.filename == "":
        logging.error("No file selected")
        return create_error_response("No file selected", HTTPStatus.BAD_REQUEST)
    try:
        blob_storage_manager = current_app.config["blob_storage_manager"]
        
        # Use the new memory-based upload method
        result = blob_storage_manager.upload_fileobj_to_blob(
            fileobj=file.stream, 
            filename=file.filename,
            blob_folder=CUSTOMER_PULSE_FOLDER,
            container=CUSTOMER_PULSE_CONTAINER_NAME,
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
