import logging
from flask import Blueprint
from routes.decorators.auth_decorator import auth_required
from shared.cosmo_db import get_all_organizations, get_all_organization_usages
from utils import create_success_response, create_error_response
from http import HTTPStatus
from datetime import datetime

bp = Blueprint("platform_admin", __name__)
logger = logging.getLogger(__name__)

TIER_MAPPING = {
    'tier_free': 'Free',
    'tier_basic': 'Basic',
    'tier_premium': 'Premium',
    'tier_custom': 'Custom'
}

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
