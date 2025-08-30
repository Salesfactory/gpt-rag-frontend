# /routes/voice-customer.py

from flask import Blueprint, current_app, request
import logging

from utils import (create_success_response, create_error_response)
from shared.cosmo_db import (
    create_competitor,
    create_new_brand,
    create_prod,
    delete_brand_by_id,
    delete_competitor_by_id,
    get_brands_by_organization,
    get_competitors_by_organization,
    get_items_to_delete_by_brand,
    get_organization_data,
    get_prods_by_organization,
    patch_organization_data,
    update_brand_by_id,
    update_competitor_by_id,
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

    required_fields = ["product_name", "brand_id", "organization_id", "category"]
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
        category = data["category"]

        result = create_prod(name, description, category, brand_id, organization_id)
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

    required_fields = ["product_name", "product_description", "category", "brand_id", "organization_id"]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )

    try:
        name = data["product_name"]
        description = data["product_description"]
        category = data["category"]
        brand_id = data["brand_id"]

        result = update_prod_by_id(
            product_id=product_id,
            name=name,
            category=category,
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
    

@bp.route("/competitors", methods=["POST"])
def add_competitor():
    """
    Handles the creation of a new competitor and associates it with specified brands.
    Expects a JSON payload with the following required fields:
        - competitor_name (str): Name of the competitor.
        - competitor_description (str): Description of the competitor.
        - industry (str): Industry of the competitor.
        - brands_id (list): List of brand IDs to associate with the competitor.
        - organization_id (str): ID of the organization.
    Returns:
        - On success: JSON response with the created competitor object and HTTP status 201.
        - On error: JSON error response with appropriate HTTP status code.
    Error Handling:
        - Returns 400 if required fields are missing or if brands_id is not a list.
        - Returns 400 for value errors during competitor creation.
        - Returns 500 for database or unexpected errors.
    """
    data = request.get_json()

    if not data:
        return create_error_response("No JSON data provided.", 400)

    required_fields = ["competitor_name", "industry", "organization_id"]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )

    try:
        name = data["competitor_name"]
        description = data.get("competitor_description", "")
        industry = data["industry"]
        organization_id = data["organization_id"]

        competitor = create_competitor(
            name=name,
            description=description,
            industry=industry,
            organization_id=organization_id,
        )
    
        return create_success_response(competitor, 201)

    except ValueError as ve:
        logger.error(f"Value error creating competitor: {str(ve)}")
        return create_error_response(f"Value error creating competitor: {str(ve)}", 400)

    except Exception as e:
        logger.exception(f"Error creating competitor: {str(e)}")
        return create_error_response(f"Error creating competitor", 500)

@bp.route("/competitors/<competitor_id>", methods=["PATCH"])
def update_competitor(competitor_id):
    """
    Updates a competitor's information based on the provided competitor ID and JSON payload.
    Args:
        competitor_id (str or int): The unique identifier of the competitor to update.
    Request JSON Body:
        competitor_name (str): The name of the competitor.
        competitor_description (str): A description of the competitor.
        industry (str): The industry in which the competitor operates.
        brands_id (list): A list of brand IDs associated with the competitor.
    Returns:
        Response: A Flask response object containing either the updated competitor data (on success)
        or an error message (on failure), with the appropriate HTTP status code.
    Error Codes:
        400: If required data is missing or invalid.
        500: If an internal server error occurs during the update process.
    """
    data = request.get_json()
    if not data:
        return create_error_response("No JSON data provided", 400)
    if not competitor_id:
        return create_error_response("Competitor ID is required", 400)
    required_fields = [
        "competitor_name",
        "competitor_description",
        "industry",
        "organization_id",
    ]
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return create_error_response(
            f"Missing required fields: {', '.join(missing_fields)}", 400
        )

    try:
        name = data["competitor_name"]
        description = data["competitor_description"]
        industry = data["industry"]
        organization_id = data["organization_id"]

        result = update_competitor_by_id(
            competitor_id=competitor_id,
            name=name,
            description=description,
            industry=industry,
            organization_id=organization_id
        )
        return create_success_response(result, 200)
    except Exception as e:
        return create_error_response(f"Error updating competitor: {str(e)}", 500)

@bp.route("/competitors/<competitor_id>", methods=["DELETE"])
def delete_competitor(competitor_id):
    """
    Deletes a competitor by their unique identifier.

    Args:
        competitor_id (str or int): The unique identifier of the competitor to delete.

    Returns:
        Response: A success response with status 200 if deletion is successful,
                  or an error response with appropriate status code and message if not.

    Raises:
        Exception: If an unexpected error occurs during deletion.
    """
    organization_id = request.json.get("organization_id")
    if not organization_id:
        return create_error_response("Organization_id is required", 400)
    if not competitor_id:
        return create_error_response("Competitor ID is required", 400)
    try:
        response = delete_competitor_by_id(competitor_id, organization_id)
        return create_success_response(response, 200)
    except Exception as e:
        return create_error_response(f"Error deleting competitor: {str(e)}", 500)
    



@bp.route(
    "/organizations/<organization_id>/competitors", methods=["GET"]
)
def get_competitors(organization_id):
    """
    Retrieve competitors for a given organization.

    Args:
        organization_id (str or int): The unique identifier of the organization.

    Returns:
        Response: A success response containing the list of competitors and a 200 status code,
                  or an error response with an appropriate error message and status code.

    Raises:
        Exception: If an error occurs while retrieving competitors, returns a 500 error response.
    """
    if not organization_id:
        return create_error_response("Organization ID is required", 400)
    try:
        competitors = get_competitors_by_organization(organization_id)
        return create_success_response(competitors, 200)
    except Exception as e:
        return create_error_response(f"Error retrieving competitors: {str(e)}", 500)



@bp.route("/organization/<organization_id>/brands/<brand_id>/items-to-delete/", methods=["GET"])
def get_items_to_delete(organization_id,brand_id):
    """
    Endpoint to retrieve items that are marked for deletion.

    Returns:
        JSON response with a list of items to delete or an error message.
    """
    try:
        items = get_items_to_delete_by_brand(brand_id, organization_id)
        return create_success_response(items, 200)
    except Exception as e:
        logger.exception(f"Error retrieving items to delete: {e}")
        return create_error_response("Internal Server Error", 500)
    
@bp.route("/organization/<organization_id>/industry", methods=["POST"])
def add_industry(organization_id):
    """
    Endpoint to add a new industry for a specific organization.

    Expects a JSON payload with the following required fields:
        - industry_name (str): The name of the industry.
        - industry_description (str): A description of the industry.

    Returns:
        JSON response with the created industry object or an error message.
    """
    data = request.get_json()
    if not data:
        return create_error_response("No JSON data provided", 400)
    
    if not data["industry_description"]:
        return create_error_response("Missing required field: industry_description", 400)

    try:
        industry_description = data["industry_description"]

        response = patch_organization_data(
            org_id=organization_id,
            patch_data={"industry_description": industry_description}
        )

        return create_success_response(response, 201)
    
    except Exception as e:
        logger.exception(f"Error creating industry: {e}")
        return create_error_response("Internal Server Error", 500)
    
@bp.route("/organization/<organization_id>/industry", methods=["GET"])
def get_industry_by_organization(organization_id):
    """
    Endpoint to add a new industry for a specific organization.

    Expects a JSON payload with the following required fields:
        - industry_name (str): The name of the industry.
        - industry_description (str): A description of the industry.

    Returns:
        JSON response with the created industry object or an error message.
    """
    try:

        response = get_organization_data(organization_id)

        data = response["industry_description"] if "industry_description" in response else ""

        return create_success_response(data, 200)

    except Exception as e:
        logger.exception(f"Error creating industry: {e}")
        return create_error_response("Internal Server Error", 500)
