# /routes/brands.py

from flask import Blueprint, current_app, request
import logging

from utils import (create_success_response, create_error_response)
from shared.cosmo_db import (
    create_new_brand,
    create_prod,
    delete_brand_by_id,
    get_brands_by_organization,
    get_prods_by_organization,
    update_brand_by_id,
    update_prod_by_id,
    delete_prod_by_id,
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


@bp.route("/products", methods=["POST"])
def create_product():
    """
    Creates a new product using the provided JSON payload.
    Expects a JSON object in the request body with the following required fields:
        - product_name (str): The name of the product.
        - product_description (str): A description of the product.
        - brand_id (int or str): The identifier for the brand.
        - organization_id (int or str): The identifier for the organization.
        - category (str): The category of the product.
    Returns:
        - On success: A JSON response with the created product data and HTTP status 201.
        - On failure: A JSON error response with an appropriate error message and HTTP status code.
    """
    data = request.get_json()
    if not data:
        return create_error_response("No JSON data provided", 400)

    required_fields = ["product_name", "brand_id", "organization_id", "industry"]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )

    try:
        name = data["product_name"]
        description = data.get("product_description", "")
        brand_id = data["brand_id"]
        organization_id = data["organization_id"]
        industry = data["industry"]

        result = create_prod(name, description, industry, brand_id, organization_id)
        return create_success_response(result, 201)
    except Exception as e:
        return create_error_response(f"Error creating product: {str(e)}", 500)
    
@bp.route(
    "/organizations/<organization_id>/products", methods=["GET"]
)
def get_products(organization_id):
    """
    Retrieve products for a given organization.

    Args:
        organization_id (str or int): The unique identifier of the organization.

    Returns:
        Response: A success response containing the list of products (status code 200),
                  or an error response with an appropriate message and status code (400 or 500).

    Raises:
        None: All exceptions are handled internally and returned as error responses.
    """
    if not organization_id:
        return create_error_response("Organization ID is required", 400)
    try:
        products = get_prods_by_organization(organization_id)
        return create_success_response(products, 200)
    except Exception as e:
        return create_error_response(f"Error retrieving products: {str(e)}", 500)
    
@bp.route("/products/<product_id>", methods=["PATCH"])
def update_product(product_id):
    """
    Update an existing product with new data.
    Args:
        product_id (int or str): The unique identifier of the product to update.
    Request JSON Body:
        product_name (str): The new name of the product.
        product_description (str): The new description of the product.
        category (str): The category to which the product belongs.
        brand_id (int or str): The identifier of the brand associated with the product.
    Returns:
        Response: A JSON response indicating success with the updated product data and HTTP 200 status,
                  or an error message with the appropriate HTTP status code.
    Error Codes:
        400: If no JSON data is provided or required fields are missing.
        500: If an unexpected error occurs during the update process.
    """
    data = request.get_json()
    if not data:
        return create_error_response("No JSON data provided", 400)

    required_fields = ["product_name", "product_description", "industry", "brand_id", "organization_id"]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )

    try:
        name = data["product_name"]
        description = data["product_description"]
        industry = data["industry"]
        brand_id = data["brand_id"]

        result = update_prod_by_id(
            product_id=product_id,
            name=name,
            industry=industry,
            brand_id=brand_id,
            description=description,
            organization_id=data["organization_id"]
        )
        return create_success_response(result, 200)
    except Exception as e:
        return create_error_response(f"Error updating product: {str(e)}", 500)

@bp.route("/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    """
    Deletes a product by its ID.

    Args:
        product_id (str or int): The unique identifier of the product to be deleted.

    Returns:
        Response: A success response with the result of the deletion and HTTP status 200,
                  or an error response with an appropriate message and HTTP status code.

    Raises:
        None: All exceptions are caught and handled internally, returning an error response.
    """
    organization_id = request.json.get("organization_id")
    if not organization_id:
        return create_error_response("Organization ID is required", 400)
    if not product_id:
        return create_error_response("Product ID is required", 400)
    try:
        response = delete_prod_by_id(product_id, organization_id)
        return create_success_response(response, 200)
    except Exception as e:
        return create_error_response(f"Error deleting product: {str(e)}", 500)