import logging
from flask import Blueprint, request
from azure.cosmos.exceptions import CosmosResourceNotFoundError

from shared.cosmo_db import (
    get_all_notifications,
    create_notification as db_create_notification,
    update_notification as db_update_notification,
    delete_notification as db_delete_notification
)
from shared.decorators import only_platform_admin
from utils import create_success_response, create_error_response

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")
logger = logging.getLogger(__name__)

@bp.route("", methods=["GET"])
def get_notifications():
    """
    Get all notifications.
    """
    try:
        notifications = get_all_notifications()
        return create_success_response(notifications)
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return create_error_response("Failed to fetch notifications", 500)

@bp.route("", methods=["POST"])
@only_platform_admin()
def create_notification_endpoint():
    """
    Create a new notification.
    """
    try:
        data = request.get_json()
        title = data.get("title")
        message = data.get("message")
        enabled = data.get("enabled", False)
        
        if not title or not message:
             return create_error_response("Title and Message are required", 400)
             
        new_item = db_create_notification(title, message, enabled)
        return create_success_response(new_item, 201)

    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        return create_error_response("Failed to create notification", 500)

@bp.route("/<notification_id>", methods=["PATCH"])
@only_platform_admin()
def update_notification_endpoint(notification_id):
    """
    Update a notification.
    """
    try:
        data = request.get_json()
        item = db_update_notification(notification_id, data)
        return create_success_response(item)
    except CosmosResourceNotFoundError:
        return create_error_response("Notification not found", 404)
    except Exception as e:
        logger.error(f"Error updating notification: {e}")
        return create_error_response("Failed to update notification", 500)

@bp.route("/<notification_id>", methods=["DELETE"])
@only_platform_admin()
def delete_notification_endpoint(notification_id):
    """
    Delete a notification.
    """
    try:
        db_delete_notification(notification_id)
        return create_success_response({"message": "Notification deleted successfully"})
    except CosmosResourceNotFoundError:
        return create_error_response("Notification not found", 404)
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        return create_error_response("Failed to delete notification", 500)