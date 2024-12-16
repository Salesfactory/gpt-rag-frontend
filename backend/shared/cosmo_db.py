import os
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
import uuid
import logging
from datetime import datetime


AZURE_DB_ID = os.environ.get("AZURE_DB_ID")
AZURE_DB_NAME = os.environ.get("AZURE_DB_NAME")
AZURE_DB_URI = f"https://{AZURE_DB_ID}.documents.azure.com:443/"

def get_cosmos_container():
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
    except Exception as e:
        logging.error(f"Error connecting to Cosmos DB: {e}")
        raise

def create_report(data):
    """
    Creates a new document in the container.
    """
    try:
        credential = DefaultAzureCredential()
        client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
        db = client.get_database_client(database=AZURE_DB_NAME)
        container = db.get_container_client("reports")
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
    Gets a specific document using its `id` as partition key.
    """
    credential = DefaultAzureCredential()
    client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("reports")

    try:
        report = container.read_item(
            item=report_id, partition_key=report_id
        )
        logging.info(f"Report retrieved: {report}")
        return report
    except Exception as e:
        logging.error(f"Error retrieving report with id {report_id}: {e}")
        raise

def get_report_by_type(report_type):
    """
    Gets a specific document using its `type` attribute.
    """
    credential = DefaultAzureCredential()
    client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("reports")

    query = "SELECT * FROM c WHERE c.type = @type"
    parameters = [{"name": "@type", "value": report_type}]
    
    try:
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True  # Necessary if you are not sure about the partition key
        ))
        logging.info(f"Reports retrieved: {items}")
        return items
    except Exception as e:
        logging.error(f"Error retrieving reports with type {report_type}: {e}")
        raise

def update_report(report_id, updated_data):
    """
    Updates an existing document using its `id` as the partition key.
    """
    credential = DefaultAzureCredential()
    client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("reports")
    
    try:
        # Recuperar el documento actual
        current_report = get_report(report_id)

        # Actualizar campos específicos con los datos proporcionados
        current_report.update(updated_data)

        # Asegurar que `id` permanece constante
        current_report["id"] = report_id  

        # Guardar el documento actualizado
        container.upsert_item(current_report)
        logging.info(f"Report updated: {current_report}")
        return current_report
    except Exception as e:
        logging.error(f"Error updating report with id {report_id}: {e}")
        raise

def delete_report(report_id):
    """
    Deletes a specific document using its `id` as partition key.
    """
    credential = DefaultAzureCredential()
    client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
    db = client.get_database_client(database=AZURE_DB_NAME)
    container = db.get_container_client("reports")
    
    try:
        container.delete_item(item=report_id, partition_key=report_id)
        logging.info(f"Report with id {report_id} deleted successfully.")
        return {"message": f"Report with id {report_id} deleted successfully."}
    except Exception as e:
        logging.error(f"Error deleting report with id {report_id}: {e}")
        raise