import logging
from flask import Blueprint
from routes.decorators.auth_decorator import auth_required
from shared.cosmo_db import get_all_organizations, get_all_organization_usages, update_organization_metadata, get_user_by_email
from utils import create_success_response, create_error_response
from http import HTTPStatus
from datetime import datetime
from flask import request
from routes.organizations import send_admin_notification_email

bp = Blueprint("platform_admin", __name__)
logger = logging.getLogger(__name__)

TIER_MAPPING = {
    'tier_free': 'Free',
    'tier_basic': 'Basic',
    'tier_premium': 'Premium',
    'tier_custom': 'Custom'
}

@bp.route("/api/platform-admin/organizations/<organization_id>", methods=["PUT"])
@auth_required
def update_platform_organization(organization_id):
    try:
        data = request.json
        name = data.get("name")
        admin_email = data.get("admin_email")

        if not name:
            return create_error_response("Organization name is required", HTTPStatus.BAD_REQUEST)

        owner_id = None
        target_user_name = "User"
        
        if admin_email:
            user = get_user_by_email(admin_email)
            if not user:
                return create_error_response(f"User with email {admin_email} not found", HTTPStatus.BAD_REQUEST)
            owner_id = user.get('id')
            target_user_name = user.get("data", {}).get("name", "User")
        
        updated_org = update_organization_metadata(organization_id, name, owner_id)
        
        if admin_email and owner_id:
            send_admin_notification_email(admin_email, target_user_name, name)

        return create_success_response(updated_org)

    except Exception as e:
        logger.error(f"Error updating organization {organization_id}: {e}")
        error_msg = str(e) if str(e) else "Internal Server Error"
        return create_error_response(error_msg, HTTPStatus.INTERNAL_SERVER_ERROR)

@bp.route("/api/platform-admin/organizations", methods=["GET"])
@auth_required
def get_platform_organizations():
    try:
        # Fetch data
        orgs = get_all_organizations()
        usages = get_all_organization_usages()

        # Map usages by organizationId
        usage_map = {u['organizationId']: u for u in usages if 'organizationId' in u}

        # Join and format
        result = []
        for org in orgs:
            org_id = org.get('id')
            usage = usage_map.get(org_id, {})
            policy = usage.get('policy', {})
            
            # Extract fields
            tier_id = policy.get('tierId', 'tier_free')
            # Use mapped name if available, otherwise return raw ID (e.g. for stripe price IDs)
            tier = TIER_MAPPING.get(tier_id, tier_id)
            
            # Expiration
            expiration_timestamp = usage.get('currentPeriodEnds')
            expiration_date = None
            if expiration_timestamp:
                try:
                    # timestamp is in seconds
                    expiration_date = datetime.fromtimestamp(float(expiration_timestamp)).isoformat()
                except Exception:
                    expiration_date = None
            
            # Additional fields for frontend compatibility
            ts = org.get('_ts')
            updated_at = datetime.fromtimestamp(ts).isoformat() if ts else (org.get('createdAt') or datetime.now().isoformat())
            created_at = datetime.fromtimestamp(org.get('created_at')).isoformat() if org.get('created_at') else None
            result.append({
                "id": org_id,
                "name": org.get('name', 'Unknown'),
                "subscription_tier": tier,
                "expiration_date": expiration_date,
                "created_at": created_at,
                "updated_at": updated_at,
                # Placeholder costs as requested to ignore them for now
                "storage_cost": 0,
                "ingestion_cost": 0,
                "tokens_cost": 0,
                "total_cost": 0
            })

        return create_success_response(result)

    except Exception as e:
        logger.error(f"Error fetching platform organizations: {e}")
        return create_error_response("Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR)
