# /routes/brands.py

from flask import Blueprint, current_app, request
import logging

from utils import create_success_response, create_error_response
from shared.cosmo_db import (
    create_new_brand,
    delete_brand_by_id,
    get_brands_by_organization,
    update_brand_by_id,
)

bp = Blueprint("voice_customer", __name__, url_prefix="/api/voice-customer")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@bp.route("/brands", methods=["POST"])
def create_brand():
    """
    Handles the creation of a new brand.

    Expects a JSON payload with the following required fields:
        - brand_name (str): The name of the brand.
        - brand_description (str): A description of the brand.
        - organization_id (int or str): The ID of the associated organization.

    Returns:
        - On success: A JSON response with the created brand data and HTTP status 201.
        - On failure: A JSON error response with an appropriate error message and HTTP status code.
    """
    data = request.get_json()
    if not data:
        return create_error_response("No JSON data provided", 400)
    required_fields = ["brand_name", "organization_id"]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )
    try:
        brand_name = data["brand_name"]
        brand_description = data.get("brand_description", "")
        organization_id = data["organization_id"]

        result = create_new_brand(
            brand_name=brand_name,
            brand_description=brand_description,
            organization_id=organization_id,
        )
        return create_success_response(result, 201)
    except Exception as e:
        return create_error_response(f"Error creating brand: {str(e)}", 500)


@bp.route("/organizations/<organization_id>/brands", methods=["GET"])
def get_brands(organization_id):
    """
    Retrieve brands associated with a given organization.

    Args:
        organization_id (str or int): The unique identifier of the organization.

    Returns:
        Response: A success response containing the list of brands (HTTP 200),
                  or an error response with an appropriate message and status code (HTTP 400 or 500).

    Raises:
        Exception: If an unexpected error occurs during brand retrieval.
    """
    if not organization_id:
        return create_error_response("Organization ID is required", 400)
    try:
        brands = get_brands_by_organization(organization_id)
        return create_success_response(brands, 200)
    except Exception as e:
        return create_error_response(f"Error retrieving brands: {str(e)}", 500)

@bp.route("/brands/<brand_id>", methods=["PATCH"])
def update_brand(brand_id):
    """
    Updates the details of a brand with the specified brand_id.
    Expects a JSON payload with the following required fields:
        - brand_name (str): The new name of the brand.
        - brand_description (str): The new description of the brand.
    Args:
        brand_id (int or str): The unique identifier of the brand to update.
    Returns:
        Response: A JSON response indicating success with the updated brand data and HTTP 200 status,
                  or an error message with the appropriate HTTP status code if the request is invalid
                  or an error occurs during the update process.
    """
    data = request.get_json()
    
    if not data:
        return create_error_response("No JSON data provided", 400)

    required_fields = ["brand_name", "brand_description", "organization_id"]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )

    try:
        brand_name = data["brand_name"]
        brand_description = data["brand_description"]
        organization_id = data["organization_id"]

        result = update_brand_by_id(
            brand_id=brand_id,
            brand_name=brand_name,
            brand_description=brand_description,
            organization_id=organization_id
        )
        return create_success_response(result, 200)
    except Exception as e:
        return create_error_response(f"Error updating brand: {str(e)}", 500)


@bp.route("/brands/<brand_id>", methods=["DELETE"])
def delete_brand(brand_id):
    """
    Deletes a brand by its ID.

    Args:
        brand_id (str or int): The unique identifier of the brand to delete.

    Returns:
        Response: A success response with the result of the deletion and HTTP status 200,
                  or an error response with an appropriate message and status code.

    Raises:
        Exception: If an error occurs during the deletion process.
    """

    organization_id = request.json.get("organization_id")

    if not organization_id:
        return create_error_response("Organization ID is required", 400)

    if not brand_id:
        return create_error_response("Brand ID is required", 400)
    try:
        response = delete_brand_by_id(brand_id, organization_id)
        return create_success_response(response, 200)
    except Exception as e:
        return create_error_response(f"Error deleting brand: {str(e)}", 500)
