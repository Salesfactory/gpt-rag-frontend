import logging
from flask import Blueprint, request
from azure.cosmos.exceptions import CosmosResourceNotFoundError

from datetime import datetime

from shared.cosmo_db import (
    get_all_notifications,
    get_active_notifications,
    create_notification as db_create_notification,
    update_notification as db_update_notification,
    delete_notification as db_delete_notification,
    acknowledge_notification as db_acknowledge_notification
)
from shared.decorators import only_platform_admin
from utils import create_success_response, create_error_response, require_client_principal

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")
logger = logging.getLogger(__name__)

@bp.route("", methods=["GET"])
@only_platform_admin()
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


@bp.route("/user", methods=["GET"])
@require_client_principal
def get_user_notifications():
    """
    Get active notifications for the current user (non-admin view).
    Filters: enabled, within start/end window if present, and not acknowledged by the user.
    """
    try:
        user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not user_id:
            return create_error_response("Missing user id", 401)

        items = get_active_notifications()
        now = datetime.utcnow()

        def within_window(item):
            start_raw = item.get("startAt") or item.get("start_at")
            end_raw = item.get("endAt") or item.get("end_at")
            if start_raw:
                try:
                    if datetime.fromisoformat(start_raw.replace("Z", "+00:00")) > now:
                        return False
                except Exception:
                    return False
            if end_raw:
                try:
                    if datetime.fromisoformat(end_raw.replace("Z", "+00:00")) < now:
                        return False
                except Exception:
                    return False
            return True

        def not_acknowledged(item):
            ack_list = item.get("acknowledgedBy") or item.get("acknowledged_by") or []
            return user_id not in ack_list

        filtered = [item for item in items if within_window(item) and not_acknowledged(item)]
        return create_success_response(filtered)
    except Exception as e:
        logger.error(f"Error fetching user notifications: {e}")
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

    except ValueError as e:
        return create_error_response(str(e), 400)
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
        data = request.get_json() or {}
        allowed_fields = {"title", "message", "enabled"}
        filtered_data = {key: value for key, value in data.items() if key in allowed_fields}
        if not filtered_data:
            return create_error_response("No valid fields provided for update", 400)
        item = db_update_notification(notification_id, filtered_data)
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


@bp.route("/<notification_id>/acknowledge", methods=["POST"])
@require_client_principal
def acknowledge_notification_endpoint(notification_id):
    """
    Mark a notification as acknowledged for the current user.
    """
    try:
        user_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not user_id:
            return create_error_response("Missing user id", 401)
        item = db_acknowledge_notification(notification_id, user_id)
        return create_success_response(item)
    except CosmosResourceNotFoundError:
        return create_error_response("Notification not found", 404)
    except Exception as e:
        logger.error(f"Error acknowledging notification: {e}")
        return create_error_response("Failed to acknowledge notification", 500)