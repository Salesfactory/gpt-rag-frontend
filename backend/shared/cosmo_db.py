import os
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
from azure.cosmos.exceptions import CosmosResourceNotFoundError, AzureError, CosmosHttpResponseError
import uuid
import logging
import time
from datetime import datetime, timezone, timedelta
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
        logging.info(
            f"Connection to Cosmos DB container '{container_name}' established successfully."
        )
        return container

    except AzureError as az_err:
        logging.error(
            f"AzureError encountered while connecting to Cosmos DB container '{container_name}': {az_err}"
        )
        raise Exception(f"Azure connection error: {az_err}") from az_err

    except Exception as e:
        logging.error(
            f"Unexpected error while connecting to Cosmos DB container '{container_name}': {e}"
        )
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
        items = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )

        if not items:
            logging.warning(f"No reports found.")
            raise NotFound

        logging.info(
            f"Reports successfully retrieved for type '{report_type}': {items}"
        )
        return items

    except CosmosResourceNotFoundError:
        logging.warning(f"No reports found with type '{report_type}'.")
        raise NotFound

    except Exception as e:
        logging.error(
            f"Unexpected error retrieving reports with type '{report_type}': {e}"
        )
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
        logging.error(
            f"Failed to upsert item: Report ID '{report_id}' not found during upsert."
        )
        raise NotFound(
            f"Cannot upsert report because it does not exist with id '{report_id}'"
        )

    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise Exception("Error with Azure Cosmos DB operation.") from az_err

    except Exception as e:
        logging.error(
            f"Unexpected error while updating report with id '{report_id}': {e}"
        )
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
        items = list(
            container.query_items(
                query="SELECT * FROM c", enable_cross_partition_query=True
            )
        )

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
        logging.error(
            f"Unexpected error retrieving template with id '{template_id}': {e}"
        )


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

def get_invitation(invited_user_email):
    if not invited_user_email:
        return {"error": "User ID not found."}

    logging.info("[get_invitation] Getting invitation for user: " + invited_user_email)

    container = get_cosmos_container("invitations")
    try:
        query = "SELECT * FROM c WHERE c.invited_user_email = @invited_user_email AND c.active = true"
        parameters = [{"name": "@invited_user_email", "value": invited_user_email}]
        result = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )
        if result:
            logging.info(
                f"[get_invitation] active invitation found for user {invited_user_email}"
            )
            invitation = result[0]
            container.replace_item(item=invitation["id"], body=invitation)
            logging.info(
                f"[get_invitation] Successfully updated invitation status for user {invited_user_email}"
            )
            return invitation
        else:
            logging.info(
                f"[get_invitation] no active invitation found for user {invited_user_email}"
            )
            return None
    except Exception as e:
        logging.error(f"[get_invitation] something went wrong. {str(e)}")


def set_user(client_principal):
    user = {}
    user_id = client_principal.get("id")
    email = client_principal.get("email")
    user_email = email.lower() if email else None

    if not user_id or not user_email:
        logging.error("[set_user] Missing required user information.")
        return {"error": "Missing required user information."}, 400

    container = get_cosmos_container("users")
    is_new_user = False

    try:
        user = container.read_item(item=user_id, partition_key=user_id)
        logging.info(f"[get_user] user_id {user_id} found.")
    except CosmosHttpResponseError:
        logging.info(f"[get_user] User {user_id} not found. Creating new user.")
        is_new_user = True

        logging.info("[get_user] Checking user invitations for new user registration")
        user_invitation = get_invitation(user_email)

        user = container.create_item(
            body={
                "id": user_id,
                "data": {
                    "name": client_principal.get("name"),
                    "email": user_email,
                    "role": user_invitation["role"] if user_invitation else "admin",
                    "organizationId": (
                        user_invitation["organization_id"] if user_invitation else None
                    ),
                },
            }
        )
        if user_invitation:
                try:
                    invitation_id = user_invitation["id"]
                    user_invitation["invited_user_id"] = client_principal["id"]

                    container_inv = get_cosmos_container("invitations")
                    updated_invitation = container_inv.replace_item(
                        item=invitation_id,
                        body=user_invitation
                    )
                    logging.info(f"[get_user] Invitation {invitation_id} updated successfully with user_id {client_principal['id']}")
                except Exception as e:
                    logging.error(f"[get_user] Failed to update invitation with user_id: {e}")
        else:
            logging.info(f"[get_user] No invitation found for user {client_principal['id']}")
    except Exception as e:
        logging.error(f"[get_user] Error creating the user: {e}")
        return {"is_new_user": None, "user_data": None}

    return {"is_new_user": is_new_user, "user_data": user["data"]}

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
        raise Exception

    try:
        current_user.update(updated_data)

        current_user["id"] = user_id

        # Perform the upsert operation
        container.upsert_item(current_user)
        logging.info(f"Report updated successfully: {current_user}")
        return current_user

    except CosmosResourceNotFoundError:
        logging.error(
            f"Failed to upsert item: Report ID '{user_id}' not found during upsert."
        )
        raise NotFound(
            f"Cannot upsert report because it does not exist with id '{user_id}'"
        )

    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise Exception("Error with Azure Cosmos DB operation.") from az_err

    except Exception as e:
        logging.error(
            f"Unexpected error while updating report with id '{user_id}': {e}"
        )
        raise

def patch_organization_data(org_id, patch_data):
    """
    Updates or adds 'brandInformation', 'industryInformation' and 'segmentSynonyms' to the organization.
    """
    container = get_cosmos_container("organizations")

    try:
        org = container.read_item(item=org_id, partition_key=org_id)
    except CosmosResourceNotFoundError:
        logging.warning(f"Organization with id '{org_id}' not found.")
        raise NotFound(f"Organization not found")

    allowed_fields = {"brandInformation", "industryInformation", "segmentSynonyms","additionalInstructions"}

    for key in allowed_fields:
        if key in patch_data:
            org[key] = patch_data[key]

    container.upsert_item(org)
    logging.info(f"Organization {org_id} updated successfully.")
    return org

def update_invitation_role(invited_user_id, organization_id, new_role):
    """
    Updates the 'role' field in the invitations container for a given invited_user_id and organization_id.
    """
    container = get_cosmos_container("invitations")
    query = """
        SELECT * FROM c
        WHERE c.invited_user_id = @invited_user_id AND c.organization_id = @organization_id
    """
    parameters = [
        {"name": "@invited_user_id", "value": invited_user_id},
        {"name": "@organization_id", "value": organization_id}
    ]
    items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
    if not items:
        logging.warning(f"No invitation found for user {invited_user_id} in org {organization_id}")
        return None
    invitation = items[0]
    invitation["role"] = new_role
    container.replace_item(item=invitation["id"], body=invitation)
    logging.info(f"Invitation {invitation['id']} updated with new role: {new_role}")
    return invitation

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
        
        organization_id = patch_data.get("organizationId") or user_data.get("organizationId")
        new_role = patch_data.get("role")
        if organization_id and new_role:
            update_invitation_role(user_id, organization_id, new_role)

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


def get_audit_logs(organization_id):
    """Get the 10 most recent audit logs in a cosmosDB container"""
    container = get_cosmos_container("auditLogs")
    try:
        items = list(container.query_items(
            query="""
                SELECT TOP 10 * FROM c 
                WHERE c.organization_id = @organization_id 
                ORDER BY c._ts DESC
            """,
            parameters=[{"name": "@organization_id", "value": organization_id}],
            enable_cross_partition_query=True
        ))

        if not items:
            logging.warning(f"No audit logs found.")
            return []

        logging.info(f"Audit logs successfully retrieved: {items}")
        return items
    except CosmosResourceNotFoundError:
        logging.warning(f"No audit logs found.")
        raise NotFound
    except CosmosHttpResponseError as ch_err:
        logging.error(f"HTTP error while retrieving audit logs: {ch_err}")
        raise Exception("Error with Cosmos DB HTTP operation.")
    except Exception as e:
        logging.error(f"Unexpected error retrieving audit logs: {e}")
        raise
    
def get_organization_subscription(organizationId):
    """
    Retrieves a specific document (organizationId) from the Cosmos DB container using its `id` as partition key.

    Parameters:
        organizationId (str): The ID of the organization to retrieve.

    Returns:
        dict: The organization document retrieved from the database.

    Raises:
    Exception: For any other unexpected error that occurs during retrieval.
    CosmosResourceNotFoundError: If the organization with the specified ID does not exist in the database.
    """
    if not organizationId:
        logging.error(f"Organization ID not provided.")
        raise ValueError("Organization ID is required.")
    container = get_cosmos_container("organizations")
    
    try:
        organization = container.read_item(item=organizationId, partition_key=organizationId)
        logging.info(f"Organization successfully retrieved: {organization}")
        return organization

    except CosmosResourceNotFoundError:
        logging.warning(f"Organization with id '{organizationId}' not found in Cosmos DB.")
        raise NotFound
    
    except CosmosHttpResponseError as ch_err:
        logging.error(f"CosmosHttpError encountered while retrieving organization with id '{organizationId}': {ch_err}")
        raise Exception(f"Error retrieving organization with id '{organizationId}': {ch_err}") from ch_err

    except Exception as e:
        logging.error(f"Unexpected error retrieving organization with id '{organizationId}': {e}")
        raise

def get_user_organizations(user_id):
    """
    Retrieves simplified organization information for a specific user ID.

    Parameters:
        user_id (str): The ID of the user to find organizations for.

    Returns:
        list: A list of simplified organization documents associated with the user.

    Raises:
        NotFound: If no organizations are found for the user.
        Exception: For any other unexpected error that occurs during retrieval.
    """
    if not user_id or not user_id.strip():
        logging.error("User ID not provided.")
        raise ValueError("User ID is required.")

    organizations_container = get_cosmos_container("organizations")
    invitations_container = get_cosmos_container("invitations")

    try:
        # Search for active invitations for the user
        query = "SELECT * FROM c WHERE c.invited_user_id = @user_id AND c.active = true"
        parameters = [{"name": "@user_id", "value": user_id}]
        invitations = list(
            invitations_container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )

        invited_org_ids = set(
            inv["organization_id"] for inv in invitations if "organization_id" in inv
        )

        # Search for organizations where the user is the owner
        owner_query = "SELECT * FROM c WHERE c.owner = @user_id"
        owner_parameters = [{"name": "@user_id", "value": user_id}]
        owned_organizations = list(
            organizations_container.query_items(
                query=owner_query, parameters=owner_parameters, enable_cross_partition_query=True
            )
        )

        # Save IDs of organizations already included
        returned_org_ids = set()

        # Recover organizations by invitations
        organizations = []
        for org_id in invited_org_ids:
            if org_id in returned_org_ids:
                continue
            try:
                org = organizations_container.read_item(item=org_id, partition_key=org_id)
                simplified_org = {
                    "id": org.get("id", ""),
                    "name": org.get("name", ""),
                    "owner": org.get("owner", ""),
                    "sessionId": org.get("sessionId", ""),
                    "subscriptionExpirationDate": org.get("subscriptionExpirationDate", ""),
                    "subscriptionId": org.get("subscriptionId", ""),
                    "subscriptionStatus": org.get("subscriptionStatus", []),
                }
                organizations.append(simplified_org)
                returned_org_ids.add(org_id)
            except CosmosResourceNotFoundError:
                logging.warning(f"Organization with ID '{org_id}' not found.")
            except Exception as e:
                logging.error(f"Error retrieving organization with ID '{org_id}': {e}")

        # Add organizations where the user is owner
        for org in owned_organizations:
            org_id = org.get("id", "")
            if org_id in returned_org_ids:
                continue  # Avoid duplicates
            simplified_org = {
                "id": org.get("id", ""),
                "name": org.get("name", ""),
                "owner": org.get("owner", ""),
                "sessionId": org.get("sessionId", ""),
                "subscriptionExpirationDate": org.get("subscriptionExpirationDate", ""),
                "subscriptionId": org.get("subscriptionId", ""),
                "subscriptionStatus": org.get("subscriptionStatus", []),
            }
            organizations.append(simplified_org)
            returned_org_ids.add(org_id)

        logging.info(f"Successfully retrieved {len(organizations)} organizations for user ID '{user_id}'.")
        return organizations

    except Exception as e:
        logging.error(f"Unexpected error retrieving organizations for user ID '{user_id}': {e}")
        raise

def get_invitation_role(user_id, organization_id):
    """
    Gets the role of a user in an organization based on the active invitation.

    Parameters:
        user_id (str): The ID of the user for which you want to get the role.
        organization_id (str): The ID of the organization.

    Returns:
        str: The user's role in the organization if the invitation is active.
        
    Raises:
        NotFound: If no active invitation is found for the user and organization.
    """
    invitations_container = get_cosmos_container('invitations')
    organizations_container = get_cosmos_container('organizations')

    # Check ownership
    org_query = "SELECT * FROM c WHERE c.id = @organization_id"
    org_params = [{"name": "@organization_id", "value": organization_id}]
    org_result = list(organizations_container.query_items(
        query=org_query, parameters=org_params, enable_cross_partition_query=True
    ))

    if org_result and org_result[0].get("owner") == user_id:
        return "admin"

    # Query to find the active invitation
    query = """
        SELECT * FROM c 
        WHERE c.invited_user_id = @user_id 
        AND c.organization_id = @organization_id 
        AND c.active = true
    """
    parameters = [
        {"name": "@user_id", "value": user_id},
        {"name": "@organization_id", "value": organization_id}
    ]

    invitations = list(invitations_container.query_items(
        query=query, parameters=parameters, enable_cross_partition_query=True
    ))

    if invitations:
        return invitations[0].get('role')

    raise ValueError("No role found: user is not owner nor has active invitation")

def create_invitation(invited_user_email, organization_id, role, nickname):
    """
    Creates a new Invitation in the container.
    """
    if not invited_user_email:
        return {"error": "User email is required."}

    if not organization_id:
        return {"error": "Organization ID is required."}

    if not role:
        return {"error": "Role is required."}
    container = get_cosmos_container("invitations")
    invitation = {}

    user_id = None
    
    try:
        user_container = get_cosmos_container("users")
        user = user_container.query_items(
            query="SELECT TOP 1 * FROM c WHERE c.data.email = @invited_user_email",
            parameters=[{"name": "@invited_user_email", "value": invited_user_email}],
            enable_cross_partition_query=True,
        )
        for u in user:
            user_id=u["id"]
            if u["data"].get("organizationId") is None:
                u["data"]["organizationId"] = organization_id
                u["data"]["role"] = role
                user_container.replace_item(item=u["id"], body=u)
                logging.info(
                    f"[create_invitation] Updated user {invited_user_email} organizationId to {organization_id}"
                )

        token = str(uuid.uuid4())
        expiry_time = datetime.now(timezone.utc) + timedelta(days=7)  # Token valid for 7 days
        token_expiry = int(expiry_time.timestamp())

        invitation = {
            "id": str(uuid.uuid4()),
            "invited_user_email": invited_user_email,
            "nickname": nickname,
            "organization_id": organization_id,
            "role": role,
            "active": False,
            "invited_user_id": user_id,
            "token": token,
            "token_used": False,
            "token_expiry": token_expiry
        }
        result = container.create_item(body=invitation)
    except Exception as e:
        logging.info(
            f"create_invitation: something went wrong. {str(e)}"
        )
        raise e
    except ValueError as ve:
        logging.error(str(ve))
        raise ve

def get_invitation_by_email_and_org(invited_user_email, organizationId):
    """
    Get the most recent, non-expired, unused invitation for a given email and organization.
    """
    if not invited_user_email or not organizationId:
        return None

    try:
        container = get_cosmos_container("invitations")

        current_ts = int(time.time())

        query = """
            SELECT * FROM c
            WHERE c.invited_user_email = @invited_user_email
              AND c.organization_id = @organization_id
              AND c.token_used = false
              AND c.token_expiry > @current_ts
            ORDER BY c._ts DESC
        """
        parameters = [
            {"name": "@invited_user_email", "value": invited_user_email},
            {"name": "@organization_id", "value": organizationId},
            {"name": "@current_ts", "value": current_ts}
        ]

        result = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        return result[0] if result else None

    except Exception as e:
        logging.error(f"Error in get_invitation_by_email_and_org: {e}")
        return None


def create_organization(user_id, organization_name):
    """
    Creates a new organization in the container.
    """
    try:
        if not user_id:
            raise ValueError("User ID cannot be empty.")
        if not organization_name:
            raise ValueError("Organization name cannot be empty.")
        container = get_cosmos_container("organizations")
        result = container.create_item(
        body={
            "id": str(uuid.uuid4()),
            "name": organization_name,
            "owner": user_id,
            "sessionId": None,
            "subscriptionStatus": "inactive",
            "subscriptionExpirationDate": None,
        }
    )
        if not result:
            logging.warning(f"Organization with name '{organization_name}' not created in Cosmos DB.")
            raise RuntimeError(f"Organization not created")
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise e
    except RuntimeError as re:
        logging.error(f"Organization with name '{organization_name}' not created in Cosmos DB.")
        raise re
    try:
        user = get_user_container(user_id)
        user["data"]["organizationId"] = result["id"]
        update_user(user_id, user)
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise
    except CosmosResourceNotFoundError as nf:
        logging.error(f"User with id '{user_id}' not found during upsert.")
        raise NotFound(f"User not found")
    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise az_err

    return result

    return invitation

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
        items = list(
            container.query_items(
                query="SELECT * FROM c",
                enable_cross_partition_query=True,
            )
        )

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

def create_new_brand(brand_name, brand_description, organization_id):
    """
    Creates a new brand entry in the Cosmos DB 'brandsContainer'.

    Args:
        brand_name (str): The name of the brand to create.
        brand_description (str): A description of the brand.
        organization_id (str): The ID of the organization to which the brand belongs.

    Returns:
        dict: The created brand item as returned by Cosmos DB.

    Raises:
        ValueError: If any of the required parameters are empty.
        RuntimeError: If the brand was not created in Cosmos DB.
        Exception: For errors related to Cosmos DB operations.
    """
    container = get_cosmos_container("brandsContainer")
    try:
        if not brand_name or not brand_description or not organization_id:
            raise ValueError("Brand name, description, and organization ID cannot be empty.")
        result = container.create_item(
            body={
                "id": str(uuid.uuid4()),
                "name": brand_name,
                "description": brand_description,
                "organizationId": organization_id,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        )
        logging.info(f"Brand created successfully: {result}")
        if not result:
            logging.warning(f"Brand with name '{brand_name}' not created in Cosmos DB.")
            raise RuntimeError(f"Brand not created")
        return result
    except CosmosHttpResponseError as e:
        logging.error(f"CosmosDB HTTP error while creating brand: {e}")
        raise Exception("Error with Cosmos DB HTTP operation.") from e
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise e

def get_brands_by_organization(organization_id):
    """
    Retrieves all brands associated with a specific organization ID.

    Parameters:
        organization_id (str): The ID of the organization to filter brands by.

    Returns:
        list: A list of brand documents associated with the specified organization.

    Raises:
        NotFound: If no brands are found for the specified organization.
        Exception: For any unexpected errors during retrieval.
    """
    container = get_cosmos_container("brandsContainer")

    try:
        query = "SELECT * FROM c WHERE c.organizationId = @organizationId"
        parameters = [{"name": "@organizationId", "value": organization_id}]
        items = list(
            container.query_items(
                query=query, parameters=parameters, enable_cross_partition_query=True
            )
        )

        if not items:
            logging.warning(f"No brands found for organization ID '{organization_id}'.")
            raise NotFound

        logging.info(f"Brands successfully retrieved for organization ID '{organization_id}': {items}")
        return items

    except CosmosResourceNotFoundError:
        logging.warning(f"No brands found for organization ID '{organization_id}'.")
        raise NotFound

    except Exception as e:
        logging.error(f"Unexpected error retrieving brands for organization ID '{organization_id}': {e}")
        raise

def delete_brand_by_id(brand_id):
    """
    Deletes a specific brand document using its `id` as partition key.
    """
    container = get_cosmos_container("brandsContainer")

    try:
        container.delete_item(item=brand_id, partition_key=brand_id)
        logging.info(f"Brand with id {brand_id} deleted successfully.")
        return {"message": f"Brand with id {brand_id} deleted successfully."}

    except CosmosResourceNotFoundError:
        logging.warning(f"Brand with id '{brand_id}' not found in Cosmos DB.")
        raise NotFound

    except Exception as e:
        logging.error(f"Error deleting brand with id {brand_id}: {e}")
        raise

def update_brand_by_id(brand_id, brand_name, brand_description):
    """
    Updates an existing brand document using its `id` as the partition key.

    Handles database errors and raises exceptions as needed.
    """
    container = get_cosmos_container("brandsContainer")

    try:
        current_brand = container.read_item(item=brand_id, partition_key=brand_id)

    except CosmosResourceNotFoundError:
        logging.warning(f"Brand with id '{brand_id}' not found in Cosmos DB.")
        raise NotFound

    except Exception as e:
        logging.error(f"Unexpected error while retrieving brand with id '{brand_id}'")
        raise Exception

    try:
        current_brand.update({
            "name": brand_name,
            "description": brand_description,
        })

        current_brand["id"] = brand_id
        current_brand["updatedAt"] = datetime.now(timezone.utc).isoformat()

        # Perform the upsert operation
        container.upsert_item(current_brand)
        logging.info(f"Brand updated successfully: {current_brand}")
        return current_brand

    except CosmosResourceNotFoundError:
        logging.error(
            f"Failed to upsert item: Brand ID '{brand_id}' not found during upsert."
        )
        raise NotFound(
            f"Cannot upsert brand because it does not exist with id '{brand_id}'"
        )

    except AzureError as az_err:
        logging.error(f"AzureError while performing upsert: {az_err}")
        raise Exception("Error with Azure Cosmos DB operation.") from az_err

    except ValueError as ve:
        logging.error(str(ve))
        raise ve
    
def create_prod(name, description, category, brand_id, organization_id):
    """    Creates a new product entry in the Cosmos DB 'productsContainer'. """
    container = get_cosmos_container("productsContainer")

    try:
        if not name or not description or not brand_id:
            raise ValueError("Product name, description, and brand ID cannot be empty.")
        
        result = container.create_item(
            body={
                "id": str(uuid.uuid4()),
                "name": name,
                "description": description,
                "brandId": brand_id,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "organizationId": organization_id,
                "category": category
            }
        )
        
        logging.info(f"Product created successfully: {result}")
        if not result:
            logging.warning(f"Product with name '{name}' not created in Cosmos DB.")
            raise RuntimeError(f"Product not created")
        return result
    except CosmosHttpResponseError as e:
        logging.error(f"CosmosDB HTTP error while creating product: {e}")
        raise Exception("Error with Cosmos DB HTTP operation.") from e
    except Exception as e:
        logging.error(f"Error inserting data into Cosmos DB: {e}")
        raise e