import os
from flask import Blueprint, current_app
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

from utils import create_success_response, create_error_response
from azure.core.exceptions import ResourceNotFoundError, AzureError

DESCRIPTION_VALID_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls"]
BLOB_CONTAINER_NAME = "documents"
ORG_FILES_PREFIX = "organization_files"

bp = Blueprint("organizations", __name__, url_prefix="/api/organizations/")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@bp.route("<organization_id>/<file_name>/business-describe", methods=["POST"])
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

        business_description = create_description(
            blob_temp_path, llm, BUSINESS_DESCRIPTION
        )

        blob_metadata["business_description"] = str(business_description)

        updated_metadata = update_blob_metadata(
            blob_name, blob_metadata, BLOB_CONTAINER_NAME
        )

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
