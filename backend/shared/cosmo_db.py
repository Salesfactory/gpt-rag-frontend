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
    try:
        credential = DefaultAzureCredential()
        client = CosmosClient(AZURE_DB_URI, credential, consistency_level="Session")
        db = client.get_database_client(database=AZURE_DB_NAME)
        container = db.get_container_client("reports")
        logging.info("Connection to Cosmos DB established successfully.")
        return container
    except Exception as e:
        logging.error(f"Error connecting to Cosmos DB: {e}")
        raise

def create_reports(container, data):
    try:
        data["id"] = str(uuid.uuid4())
        container.upsert_item(data)
        logging.info(f"Document insert: {data}")
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise

def get_reports(container, query):
    
    try:
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        logging.info(f"Successful query: {len(items)} items found.")
        return items
    except Exception as e:
        logging.error(f"Error querying Cosmos DB: {e}")
        raise