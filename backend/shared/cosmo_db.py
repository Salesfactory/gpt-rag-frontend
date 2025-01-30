import os
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
from azure.cosmos.exceptions import CosmosResourceNotFoundError, AzureError
import uuid
import logging
from datetime import datetime, timezone
from werkzeug.exceptions import NotFound

AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")
AZURE_DB_URI = f"https://{AZURE_DB_ID}.documents.azure.com:443/"

def get_cosmos_container(container_name):
    """
    Establishes the connection to the Cosmos DB container specified by `container_name`.
    """
    credential = DefaultAzureCredential()
    client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client(container_name)

    try:
        logging.info(f"Connection to Cosmos DB container '{container_name}' established successfully.")
        return container
    
    except AzureError as az_err:
        logging.error(f"AzureError encountered while connecting to Cosmos DB container '{container_name}': {az_err}")
        raise Exception(f"Azure connection error: {az_err}") from az_err

    except Exception as e:
        logging.error(f"Unexpected error while connecting to Cosmos DB container '{container_name}': {e}")
        raise Exception(f"Unexpected connection error: {e}") from e

def create_report(data):
    """
    Creates a new document in the container.
    """
    try:
        container = get_cosmos_container("reports")
        data["id"] = str(uuid.uuid4())
        data["createAt"] = datetime.now(timezone.utc).isoformat()
        data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        container.upsert_item(data)
        logging.info(f"Document created: {data}")
        return data
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise

def get_report(report_id):
    """
    Retrieves a specific document (report) from the Cosmos DB container using its `id` as partition key.

    Parameters:
        report_id (str): The ID of the report to retrieve.

    Returns:
        dict: The report document retrieved from the database.

    Raises:
    Exception: For any other unexpected error that occurs during retrieval.
    CosmosResourceNotFoundError: If the report with the specified ID does not exist in the database.
    """
    container = get_cosmos_container("reports")
    
    
    try:
        report = container.read_item(item=report_id, partition_key=report_id)
        logging.info(f"Report successfully retrieved: {report}")
        return report

    except CosmosResourceNotFoundError:
        logging.warning(f"Report with id '{report_id}' not found in Cosmos DB.")
        raise NotFound

    except Exception as e:
        logging.error(f"Unexpected error retrieving report with id '{report_id}'")
        raise

def get_filtered_reports(report_type=None):
    """
    Retrieves documents from the Cosmos DB container using the `type` attribute or returns all reports.

    Parameters:
        report_type (str, optional): The type of reports to retrieve. If None, retrieves all reports.

    Returns:
        list: A list of report documents.

    Raises:
        CosmosResourceNotFoundError: If no reports with the specified type are found (when filtered).
        Exception: For any other unexpected error that occurs during retrieval.
    """
    container = get_cosmos_container("reports")
    if report_type:
        query = "SELECT * FROM c WHERE c.type = @type"
        parameters = [{"name": "@type", "value": report_type}]
    else:
        query = "SELECT * FROM c"
        parameters = []

    try:
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        if not items:
            logging.warning(f"No reports found.")
            raise NotFound

        logging.info(f"Reports successfully retrieved for type '{report_type}': {items}")
        return items

    except CosmosResourceNotFoundError:
        logging.warning(f"No reports found with type '{report_type}'.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Unexpected error retrieving reports with type '{report_type}': {e}")
        raise

def update_report(report_id, updated_data):
    """
    Updates an existing document using its `id` as the partition key.

    Handles database errors and raises exceptions as needed.
    """
    container = get_cosmos_container("reports")
    
    try:
        current_report = get_report(report_id)

    except CosmosResourceNotFoundError:
        logging.warning(f"Report with id '{report_id}' not found in Cosmos DB.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Unexpected error while retrieving report with id '{report_id}'")
        raise

    try:
        current_report.update(updated_data)

        current_report["id"] = report_id  

        # Perform the upsert operation
        container.upsert_item(current_report)
        logging.info(f"Report updated successfully: {current_report}")
        return current_report

    except CosmosResourceNotFoundError:
        logging.error(f"Failed to upsert item: Report ID '{report_id}' not found during upsert.")
        raise NotFound(f"Cannot upsert report because it does not exist with id '{report_id}'")

    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise Exception("Error with Azure Cosmos DB operation.") from az_err

    except Exception as e:
        logging.error(f"Unexpected error while updating report with id '{report_id}': {e}")
        raise

def delete_report(report_id):
    """
    Deletes a specific document using its `id` as partition key.
    """
    container = get_cosmos_container("reports")
    
    try:
        container.delete_item(item=report_id, partition_key=report_id)
        logging.info(f"Report with id {report_id} deleted successfully.")
        return {"message": f"Report with id {report_id} deleted successfully."}
    
    except CosmosResourceNotFoundError:
        logging.warning(f"Report with id '{report_id}' not found in Cosmos DB.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Error deleting report with id {report_id}: {e}")
        raise

# Template management

def create_template(data):
    """
    Creates a new document in the container.
    """
    try:
        container = get_cosmos_container("templates")
        data["id"] = str(uuid.uuid4())
        data["createAt"] = datetime.now(timezone.utc).isoformat()
        data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        container.upsert_item(data)
        logging.info(f"Document created: {data}")
        return data
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise

def delete_template(template_id):
    """
    Deletes a specific document using its `id` as partition key.
    """
    container = get_cosmos_container("templates")
    
    try:
        container.delete_item(item=template_id, partition_key=template_id)
        logging.info(f"Template with id {template_id} deleted successfully.")
        return {"message": f"Template with id {template_id} deleted successfully."}
    
    except CosmosResourceNotFoundError:
        logging.warning(f"Template with id '{template_id}' not found in Cosmos DB.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Error deleting template with id {template_id}: {e}")
        raise

def get_templates():
    """Get all the templates in a cosmosDB container"""
    container = get_cosmos_container("templates")
    try:
        items = list(container.query_items(
            query="SELECT * FROM c",
            enable_cross_partition_query=True
        ))

        if not items:
            logging.warning(f"No templates found.")
            raise NotFound

        logging.info(f"Templates successfully retrieved: {items}")
        print(items)
        return items

    except CosmosResourceNotFoundError:
        logging.warning(f"No templates found.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Unexpected error retrieving templates: {e}")
        raise


def get_template_by_ID(template_id):
    """Get a template by its ID"""
    container = get_cosmos_container("templates")
    try:
        template = container.read_item(item=template_id, partition_key=template_id)
        logging.info(f"Template successfully retrieved: {template}")
        return template

    except CosmosResourceNotFoundError:
        logging.warning(f"Template with id '{template_id}' not found in Cosmos DB.")
        raise NotFound

    except Exception as e:
        logging.error(f"Unexpected error retrieving template with id '{template_id}': {e}")


def get_user_container(user_id):
    """
    Retrieves a specific document (user_id) from the Cosmos DB container using its `id` as partition key.

    Parameters:
        user_id (str): The ID of the user to retrieve.

    Returns:
        dict: The user document retrieved from the database.

    Raises:
    Exception: For any other unexpected error that occurs during retrieval.
    CosmosResourceNotFoundError: If the user with the specified ID does not exist in the database.
    """
    container = get_cosmos_container("users")
    
    try:
        user = container.read_item(item=user_id, partition_key=user_id)
        logging.info(f"User successfully retrieved: {user}")
        return user

    except CosmosResourceNotFoundError:
        logging.warning(f"Report with id '{user_id}' not found in Cosmos DB.")
        raise NotFound

    except Exception as e:
        logging.error(f"Unexpected error retrieving report with id '{user_id}'")
        raise

def update_user(user_id, updated_data):
    """
    Updates an existing document using its `id` as the partition key.

    Handles database errors and raises exceptions as needed.
    """
    container = get_cosmos_container("users")
    
    try:
        current_user = get_user_container(user_id)

    except CosmosResourceNotFoundError:
        logging.warning(f"User with id '{user_id}' not found in Cosmos DB.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Unexpected error while retrieving user with id '{user_id}'")
        raise

    try:
        current_user.update(updated_data)

        current_user["id"] = user_id

        # Perform the upsert operation
        container.upsert_item(current_user)
        logging.info(f"Report updated successfully: {current_user}")
        return current_user

    except CosmosResourceNotFoundError:
        logging.error(f"Failed to upsert item: Report ID '{user_id}' not found during upsert.")
        raise NotFound(f"Cannot upsert report because it does not exist with id '{user_id}'")

    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise Exception("Error with Azure Cosmos DB operation.") from az_err

    except Exception as e:
        logging.error(f"Unexpected error while updating report with id '{user_id}': {e}")
        raise

def patch_user_data(user_id, patch_data):
    """
    Updates the 'name', 'email' and role fields in the 'data' object of an existing user.

    Handles database errors and raises exceptions as needed.
    """
    container = get_cosmos_container("users")

    try:
        
        current_user = get_user_container(user_id)

        if current_user is None:
            logging.warning(f"User with id '{user_id}' not found in Cosmos DB.")
            raise NotFound(f"User not found")

        allowed_keys = {"name", "email", "role"}
        user_data = current_user.get("data", {})

        for key in patch_data:
            if key in allowed_keys:
                user_data[key] = patch_data[key]
        
        for key in allowed_keys:
            if not user_data.get(key):
                logging.error(f"Field '{key}' cannot be empty.")
                raise ValueError(f"Field '{key}' cannot be empty.")

        current_user["data"] = user_data
        current_user["id"] = user_id


        container.upsert_item(current_user)
        logging.info(f"User data updated successfully: {current_user}")
        return current_user

    except CosmosResourceNotFoundError as nf:
        logging.error(f"User with id '{user_id}' not found during upsert.")
        raise nf

    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise az_err

    except ValueError as ve:
        logging.error(str(ve))
        raise ve

    except Exception as e:
        logging.error(f"Unexpected error while updating user data with id '{user_id}': {e}")
        raise e


def get_company_list():
    """
    Retrieve all companies from the CosmosDB 'companyAnalysis' container.

    Returns:
        list: A list of company records from the database.

    Raises:
        NotFound: If no companies are found in the container.
        Exception: For any unexpected errors during retrieval.
    """

    container = get_cosmos_container("companyAnalysis")

    try:
        items = list(container.query_items(
            query="SELECT c.id, c.name, c.ticker, c.is_active, c.created_at, c.lastRun FROM c",
            enable_cross_partition_query=True
        ))

        if not items:
            logging.warning(f"No companies found in the 'companyAnalysis' container.")
            return []

        return items

    except CosmosResourceNotFoundError:
        logging.warning(f"CosmosDB container not found or inaccessible.")
        raise NotFound
    
    except Exception as e:
        logging.error(f"Unexpected error retrieving Companies: {e}")
        raise