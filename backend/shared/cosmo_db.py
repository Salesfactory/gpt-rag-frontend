import os
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
from azure.cosmos.exceptions import CosmosResourceNotFoundError, AzureError
import uuid
import logging
from datetime import datetime
from werkzeug.exceptions import NotFound

AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")
AZURE_DB_URI = f"https://{AZURE_DB_ID}.documents.azure.com:443/"

def get_cosmos_container_report():
    """
    Establishes the connection to the Cosmos DB `reports` container.
    """
    credential = DefaultAzureCredential()
    client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("reports")

    try:
        logging.info("Connection to Cosmos DB established successfully.")
        return container
    
    except AzureError as az_err:
        logging.error(f"AzureError encountered while connecting to Cosmos DB: {az_err}")
        raise Exception(f"Azure connection error: {az_err}") from az_err

    except Exception as e:
        logging.error(f"Unexpected error while connecting to Cosmos DB: {e}")
        raise Exception(f"Unexpected connection error: {e}") from e

def create_report(data):
    """
    Creates a new document in the container.
    """
    try:
        container = get_cosmos_container_report()
        data["id"] = str(uuid.uuid4())
        data["generatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
    container = get_cosmos_container_report()
    
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

def get_report_by_type(report_type):
    """
    Retrieves documents from the Cosmos DB container using the `type` attribute.

    Parameters:
        report_type (str): The type of reports to retrieve.

    Returns:
        list: A list of report documents matching the specified type.

    Raises:
        CosmosResourceNotFoundError: If no reports with the specified type are found.
        Exception: For any other unexpected error that occurs during retrieval.
    """
    container = get_cosmos_container_report()

    query = "SELECT * FROM c WHERE c.type = @type"
    parameters = [{"name": "@type", "value": report_type}]
    
    try:
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        if not items:
            logging.warning(f"No reports found with type '{report_type}'.")
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
    container = get_cosmos_container_report()
    
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
    container = get_cosmos_container_report()
    
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


def get_all_reports():
    """
    Retrieves all reports from the Cosmos DB container.

    Returns:
        list: A list of all report documents in the database.

    Raises:
        Exception: For any unexpected errors that occur during retrieval.
    """
    container = get_cosmos_container_report()
    
    try:
        # Query to retrieve all items in the container
        query = "SELECT * FROM c"
        reports = list(container.query_items(query=query, enable_cross_partition_query=True))
        logging.info(f"Successfully retrieved {len(reports)} reports.")
        return reports

    except CosmosResourceNotFoundError:
        logging.warning("No reports found in the Cosmos DB container.")
        raise NotFound

    except Exception as e:
        logging.error(f"Unexpected error retrieving all reports: {e}")
        raise