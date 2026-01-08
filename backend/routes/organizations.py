import os
from flask import Blueprint, current_app, request, jsonify
import logging

from http import HTTPStatus

import pandas as pd
from data_summary.file_utils import detect_extension
from data_summary.summarize import create_description
from data_summary.blob_utils import (
    download_blob_to_temp,
    update_blob_metadata,
    build_blob_name,
)
from data_summary.custom_prompts import BUSINESS_DESCRIPTION

from shared.cosmo_db import create_organization, get_user_by_email
from shared.decorators import check_organization_limits, check_organization_upload_limits, require_organization_storage_limits

from utils import create_success_response, create_error_response, create_organization_usage, get_organization_usage_by_id, EmailService

from azure.core.exceptions import ResourceNotFoundError, AzureError
from shared.error_handling import (
    MissingRequiredFieldError,
)
from werkzeug.exceptions import NotFound

from routes.decorators.auth_decorator import auth_required

DESCRIPTION_VALID_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls"]
BLOB_CONTAINER_NAME = "documents"
ORG_FILES_PREFIX = "organization_files"

bp = Blueprint("organizations", __name__)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PORT = os.getenv("EMAIL_PORT")


def send_admin_notification_email(admin_email, admin_name, organization_name):
    """
    Sends an email to the new organization administrator.
    """
    if not all([EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS]):
        logger.critical("Email configuration missing, cannot send admin notification email. Aborting notification.")
        raise RuntimeError("Email configuration missing, cannot send admin notification email.")

    try:
        email_service = EmailService(EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
        
        subject = f"You have been assigned as Administrator for {organization_name}"
        
        body = f"""
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; }}
            .container {{ padding: 20px; max-width: 600px; margin: 0 auto; }}
            .footer {{ margin-top: 20px; font-size: 12px; color: #666; }}
            .button {{ background-color: #0078d4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px; }}
        </style>
        </head>
        <body>
        <div class="container">
            <h2>Hello {admin_name},</h2>
            <p>You have been designated as the Administrator for the new organization: <strong>{organization_name}</strong> on FreddAid.</p>
            <p>You now have full access to manage this organization, invite members, and configure settings.</p>
            
            <p>If you did not expect this, please contact support.</p>
            
            <p class="footer">Best regards,<br>The FreddAid Team</p>
        </div>
        </body>
        </html>
        """
        
        email_service.send_email(subject, body, [admin_email])
        logger.info(f"Admin notification email sent to {admin_email}")
        
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {e}")



@bp.route("/api/organizations/<organization_id>/<file_name>/business-describe", methods=["POST"])
@auth_required
def generate_business_description(organization_id, file_name):
    blob_temp_path = None

    if not organization_id or not file_name:
        return create_error_response(
            "organization_id and file_name are required", HTTPStatus.BAD_REQUEST
        )

    try:

        valid_file_extensions = [".csv", ".xlsx", ".xls"]
        file_ext = detect_extension(file_name)

        if file_ext not in valid_file_extensions:
            raise ValueError(
                f"Invalid file type '{file_ext}'. Allowed types are: {', '.join(valid_file_extensions)}."
            )

        llm = current_app.config["llm"]

        blob_name = build_blob_name(organization_id, file_name, ORG_FILES_PREFIX)

        blob_temp_path, blob_metadata = download_blob_to_temp(
            blob_name, BLOB_CONTAINER_NAME
        )

        logger.info(f"Downloaded blob '{blob_name}' to temporary path '{blob_temp_path}'")

        business_description = create_description(
            blob_temp_path, llm, BUSINESS_DESCRIPTION
        )

        blob_metadata["business_description"] = str(business_description)

        updated_metadata = update_blob_metadata(
            blob_name, blob_metadata, BLOB_CONTAINER_NAME
        )

        logger.info(f"Updated blob metadata for '{blob_name}': {updated_metadata}")

        return create_success_response(updated_metadata)

    except ValueError as e:
        return create_error_response(str(e), HTTPStatus.BAD_REQUEST)

    except ValueError as e:
        return create_error_response(str(e), HTTPStatus.BAD_REQUEST)

    except ResourceNotFoundError:
        return create_error_response(
            "The document does not exist", HTTPStatus.NOT_FOUND
        )

    except AzureError as e:
        return create_error_response(
            f"Azure storage error: {str(e)}", HTTPStatus.SERVICE_UNAVAILABLE
        )

    except (OSError, IOError) as e:
        return create_error_response(
            f"File processing error: {str(e)}", HTTPStatus.INTERNAL_SERVER_ERROR
        )

    except pd.errors.ParserError as e:
        return create_error_response(
            f"Error parsing file: {str(e)}", HTTPStatus.BAD_REQUEST
        )

    except Exception as e:
        logger.exception("Unexpected error")
        return create_error_response(
            f"Unexpected error: {str(e)}", HTTPStatus.INTERNAL_SERVER_ERROR
        )

    finally:
        if blob_temp_path and os.path.exists(blob_temp_path):
            os.remove(blob_temp_path)


@bp.route("/api/create-organization-usage", methods=["POST"])
@auth_required
def createOrganizationUsage():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    subscriptionId = request.json.get("subscriptionId", None)
    currentPeriodEnds = request.json.get("currentPeriodEnds", None)
    if not client_principal_id:
        return create_error_response({"error": "Missing required parameters, client_principal_id"}, HTTPStatus.BAD_REQUEST)
    try:
        organizationId = request.json["organizationId"]
        subscriptionTierId = request.json["subscriptionTierId"]
        if not organizationId or not subscriptionTierId:
            return create_error_response({"error": "Missing required parameters, organizationId or subscriptionTierId"}, HTTPStatus.BAD_REQUEST)
        organizationUsage = create_organization_usage(organizationId, subscriptionId, subscriptionTierId, client_principal_id, currentPeriodEnds)
        if not organizationUsage:
            return create_error_response({"error": "Failed to create organization usage"}, HTTPStatus.INTERNAL_SERVER_ERROR)
        return create_success_response(organizationUsage)
    except Exception as e:
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/create-organization", methods=["POST"])
@auth_required
def createOrganization():
    default_storage_capacity = 500  # Default storage capacity in GB

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return create_error_response({"error": "Missing required parameters, client_principal_id"}, HTTPStatus.BAD_REQUEST)
    try:
        organizationName = request.json["organizationName"]
        admin_email = request.json.get("admin_email")
        
        target_user_id = client_principal_id

        if admin_email:
            user = get_user_by_email(admin_email)
            if not user:
                return create_error_response(f"User with email {admin_email} not found in the database.", HTTPStatus.BAD_REQUEST)
            target_user_id = user.get('id')
            if not target_user_id:
                return create_error_response(f"User retrieved for {admin_email} has no ID.", HTTPStatus.INTERNAL_SERVER_ERROR)
            target_user_name = user.get("data", {}).get("name", "User")

        if not request.json.get("storageCapacity"):
            storage_capacity = default_storage_capacity
        else:
            storage_capacity = request.json["storageCapacity"]

        response = create_organization(target_user_id, organizationName, storage_capacity)
        if not response:
            return create_error_response(
                "Failed to create organization", HTTPStatus.INTERNAL_SERVER_ERROR
            )
            
        # Send email notification if admin was assigned via email
        if admin_email:
            send_admin_notification_email(admin_email, target_user_name, organizationName)
            
        return jsonify(response), HTTPStatus.CREATED
    except NotFound as e:
        return create_error_response(
            f"User {client_principal_id} not found", HTTPStatus.NOT_FOUND
        )
    except MissingRequiredFieldError as field:
        return create_error_response(
            f"Missing required parameters, {field}", HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/organizations/<organization_id>/storage-usage", methods=["GET"])
@require_organization_storage_limits()
def getOrganizationStorageCapacity(organization_id, **kwargs):
    try:
        return create_success_response(kwargs["upload_limits"], HTTPStatus.OK)
    except: 
        return create_error_response("Internal server error", HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/organizations/<organization_id>/get-organization-usage", methods=["GET"])
@auth_required
def getOrgUsage(organization_id: str):
    if not organization_id:
        return create_error_response({"error": "Missing required parameters, organization_id"}, HTTPStatus.BAD_REQUEST)
    try:
        organizationUsage = get_organization_usage_by_id(organization_id)
        return create_success_response(organizationUsage)
    except Exception as e:
        return create_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/organizations/<organization_id>/usage", methods=["GET"])
@check_organization_limits()
def getOrganizationUsage(organization_id, **kwargs):
    try:
        return create_success_response(kwargs["organization_usage"], HTTPStatus.OK)
    except NotFound:
        return create_error_response("Organization not found", HTTPStatus.NOT_FOUND)
    except Exception as e:
        logging.exception(f"Error fetching organization usage: {e}")
        return create_error_response("Internal server error", HTTPStatus.INTERNAL_SERVER_ERROR)
