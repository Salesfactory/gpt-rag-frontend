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

from shared.cosmo_db import create_organization

from utils import create_success_response, create_error_response

from azure.core.exceptions import ResourceNotFoundError, AzureError
from shared.error_handling import (
    MissingRequiredFieldError,
)
from werkzeug.exceptions import NotFound

from routes.decorators.auth_decorator import auth_required

DESCRIPTION_VALID_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls"]
BLOB_CONTAINER_NAME = "documents"
ORG_FILES_PREFIX = "organization_files"

bp = Blueprint("organizations", __name__, url_prefix="/api")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@bp.route("/organizations/<organization_id>/<file_name>/business-describe", methods=["POST"])
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

@bp.route("/create-organization", methods=["POST"])
@auth_required
def createOrganization():
    default_storage_capacity = 500  # Default storage capacity in GB

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return create_error_response({"error": "Missing required parameters, client_principal_id"}, HTTPStatus.BAD_REQUEST)
    try:
        organizationName = request.json["organizationName"]
        storage_capacity = request.json["storage_capacity"]
        if not storage_capacity:
            storage_capacity = default_storage_capacity

        response = create_organization(client_principal_id, organizationName)
        if not response:
            return create_error_response(
                "Failed to create organization", HTTPStatus.INTERNAL_SERVER_ERROR
            )
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

