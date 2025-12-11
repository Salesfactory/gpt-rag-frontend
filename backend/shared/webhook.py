import logging
from utils import create_organization_usage, get_organization_usage_by_subscription_id, get_subscription_tier_by_id, update_organization_usage
from shared.cosmo_db import create_new_subscription_logs, get_organization_data
def handle_checkout_session_completed(event):
    try:
        logging.info("🔔  Webhook received! handle_checkout_session_completed")
        userId = event["data"]["object"]["client_reference_id"]
        organizationId = event["data"]["object"]["metadata"]["organizationId"]
        organizationName = event["data"]["object"]["metadata"]["organizationName"]
        subscriptionTierId = event["data"]["object"]["metadata"]["subscriptionTierId"]
        sessionId = event["data"]["object"]["id"]
        subscriptionId = event["data"]["object"]["subscription"]
        paymentStatus = event["data"]["object"]["payment_status"]
        expirationDate = event["data"]["object"]["expires_at"]
        userName = event["data"]["object"].get(
            "metadata", {}).get("userName", "") or ""

        create_organization_usage(
            organizationId, subscriptionId, subscriptionTierId, userId)
        create_new_subscription_logs(
            userId=userId,
            organizationId=organizationId,
            userName=userName,
            organizationName=organizationName,
            action="Subscription created"
        )
    except Exception as e:
        logging.exception(
            "[webbackend] exception in handle_checkout_session_completed")
        raise Exception(f"Failed to handle checkout session completed: {e}")


def handle_subscription_updated(event):
    try:
        logging.info("🔔 Webhook received! handle_subscription_updated")
        data = event.get("data", {}).get("object", {})
        previous_data = event.get("data", {}).get("previous_attributes", {})
        planId = data.get("plan", {}).get("id", "")
        metadata = data.get("metadata", {})

        subscriptionId = data.get("id", "")
        status = data.get("status", "")
        expirationDate = data.get("current_period_end", None)

        modification_type = metadata.get("modification_type",None)
        modified_by = metadata.get("modified_by", "Unknown")
        modified_by_name = metadata.get("modified_by_name", "Unknown")
        client_principal_id = metadata.get("client_principal_id", "Unknown")
        organization_id = metadata.get("organization_id", "Unknown")
        
        if modification_type == "subscription_tier_change":
            organizationUsage = get_organization_usage_by_subscription_id(
                subscriptionId)
            if not organizationUsage:
                logging.error(
                    f"No organization usage found for subscription: {subscriptionId}")
                raise Exception(
                    f"No organization usage found for subscription: {subscriptionId}")
            
            tier = get_subscription_tier_by_id(planId)
            if not tier:
                logging.error(f"No subscription tier found for plan: {planId}")
                raise Exception(f"No subscription tier found for plan: {planId}")
            
            create_organization_usage(
                organizationUsage["organizationId"], subscriptionId, planId, client_principal_id, expirationDate)
            
            organization = get_organization_data(organization_id)
            
            create_new_subscription_logs(
                userId=modified_by,
                organizationId=organizationUsage["organizationId"],
                userName=modified_by_name,
                organizationName=organization.get("name", "Unknown"),
                action="Subscription updated" if modification_type is None else "Subscription tier changed",
            )

        # The subscription is an automatic renewal
        if modification_type is None:
            organizationUsage = get_organization_usage_by_subscription_id(
                subscriptionId)
            if not organizationUsage:
                logging.error(
                    f"No organization usage found for subscription: {subscriptionId}")
                raise Exception(
                    f"No organization usage found fortier subscription: {subscriptionId}")

            tier = get_subscription_tier_by_id(planId)
            if not tier:
                logging.error(f"No subscription tier found for plan: {planId}")
                raise Exception(f"No subscription tier found for plan: {planId}")

            totalAllocated = tier.get("quotas", {}).get("totalCreditsAllocated", 0)
            organizationUsage["balance"]["currentUsed"] += totalAllocated
            organizationUsage["balance"]["totalAllocated"] += totalAllocated

            update_organization_usage(
                organizationUsage["organizationId"], subscriptionId, planId, organizationUsage)
            
            organization = get_organization_data(organizationUsage.get("organizationId"))
            
            create_new_subscription_logs(
                userId=modified_by,
                organizationId=organization.get("id", "Unknown"),
                userName=modified_by_name,
                organizationName=organization.get("name", "Unknown"),
                action="Subscription updated"
            )

    except Exception as e:
        logging.exception(
            "[webbackend] exception in handle_subscription_updated")
        raise Exception(f"Failed to handle subscription updated: {e}")


def handle_subscription_paused(event):
    try:
        logging.info("🔔  Webhook received! handle_subscription_paused")
    except Exception as e:
        logging.exception(
            "[webbackend] exception in handle_subscription_paused")
        raise Exception(f"Failed to handle subscription paused: {e}")


def handle_subscription_resumed(event):
    try:
        logging.info("🔔  Webhook received! handle_subscription_resumed")
    except Exception as e:
        logging.exception(
            "[webbackend] exception in handle_subscription_resumed")
        raise Exception(f"Failed to handle subscription resumed: {e}")


def handle_subscription_deleted(event):
    try:
        logging.info("🔔  Webhook received! handle_subscription_deleted")
    except Exception as e:
        logging.exception(
            "[webbackend] exception in handle_subscription_deleted")
        raise Exception(f"Failed to handle subscription deleted: {e}")
