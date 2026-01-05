import os
import pytest
from flask import Flask
from unittest.mock import patch, MagicMock

# Set environment variables before importing modules that check them at the top level
os.environ["AZURE_DB_ID"] = "test_db_id"
os.environ["AZURE_DB_NAME"] = "test_db_name"

from shared.decorators import (
    check_organization_limits,
    require_conversation_limits,
    require_user_conversation_limits
)

@pytest.fixture
def app():
    """Create a Flask app context for tests."""
    app = Flask(__name__)
    return app

@pytest.fixture
def mock_deps():
    """Patch all dependencies used by the decorators."""
    with patch("shared.decorators.get_organization_id_from_request") as mock_get_org_id, \
         patch("shared.decorators.get_organization_id_and_user_id_from_request") as mock_get_ids, \
         patch("shared.decorators.get_user_organizations") as mock_get_user_orgs, \
         patch("shared.decorators.get_organization_usage") as mock_get_org_usage, \
         patch("shared.decorators.get_subscription_tier_by_id") as mock_get_tier, \
         patch("shared.decorators.create_error_response") as mock_create_error, \
         patch("shared.decorators.create_error_response_with_body") as mock_create_error_with_body, \
         patch("shared.decorators.initalize_user_limits") as mock_init_user_limits:

        # Configure create_error_response to return a simple tuple for easy assertion
        # Now accepts optional error_code parameter
        mock_create_error.side_effect = lambda msg, code, error_code=None: (msg, code)

        # Configure create_error_response_with_body to return dict with error key
        mock_create_error_with_body.side_effect = lambda msg, code, body, error_code=None: ({"error": msg}, code)

        # Configure initalize_user_limits to return a default user limits structure
        mock_init_user_limits.return_value = {"userId": "user1", "totalAllocated": 100, "currentUsed": 0}
        
        yield {
            "get_org_id": mock_get_org_id,
            "get_ids": mock_get_ids,
            "get_user_orgs": mock_get_user_orgs,
            "get_org_usage": mock_get_org_usage,
            "get_tier": mock_get_tier,
            "create_error": mock_create_error,
            "create_error_with_body": mock_create_error_with_body,
            "init_user_limits": mock_init_user_limits
        }

# Tests for check_organization_limits

def test_check_org_limits_missing_org_id(app, mock_deps):
    mock_deps["get_org_id"].return_value = None

    @check_organization_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context():
        resp, code = view()
        assert code == 400
        assert "Missing required parameters" in resp

def test_check_org_limits_unauthorized_header(app, mock_deps):
    mock_deps["get_org_id"].return_value = "org1"

    @check_organization_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context():
        # No X-MS-CLIENT-PRINCIPAL-ID header
        resp, code = view()
        assert code == 401
        assert "Unauthorized" in resp

def test_check_org_limits_user_not_in_org(app, mock_deps):
    mock_deps["get_org_id"].return_value = "org1"
    mock_deps["get_user_orgs"].return_value = [{"id": "org2"}]

    @check_organization_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        resp, code = view()
        assert code == 403
        assert "Unauthorized access to organization" in resp

def test_check_org_limits_success(app, mock_deps):
    mock_deps["get_org_id"].return_value = "org1"
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {"tierId": "tier1"},
        "balance": {"currentUsed": 50, "currentStorageUsed": 100, "currentCreditsUsed": 50}
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000, "totalStorageAllocated": 500}
    }

    @check_organization_limits()
    def view(**kwargs):
        return kwargs["organization_usage"]

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        usage = view()
        assert usage["current_usage"]["currentUsed"] == 50
        assert usage["is_credits_exceeded"] is False

# Tests for require_conversation_limits

def test_require_conv_limits_exceeded(app, mock_deps):
    mock_deps["get_org_id"].return_value = "org1"
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {"tierId": "tier1"},
        "balance": {"currentUsed": 1001}
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000}
    }

    @require_conversation_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        resp, code = view()
        assert code == 403
        assert "Organization has exceeded its conversation limits" in resp

def test_require_conv_limits_success(app, mock_deps):
    mock_deps["get_org_id"].return_value = "org1"
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {"tierId": "tier1"},
        "balance": {"currentUsed": 500}
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000}
    }

    @require_conversation_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        resp = view()
        assert resp == "success"

# Tests for require_user_conversation_limits

def test_require_user_limits_missing_params(app, mock_deps):
    mock_deps["get_ids"].return_value = (None, None)

    @require_user_conversation_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context():
        resp, code = view()
        assert code == 400
        assert "Missing required parameters" in resp

def test_require_user_limits_user_not_authorized(app, mock_deps):
    """Test that users not in allowedUserIds are automatically initialized"""
    mock_deps["get_ids"].return_value = ("org1", "user1")
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {"tierId": "tier1", "allowedUserIds": []}, # User not in list
        "balance": {"currentUsed": 0}
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000},
        "policy": {"maxSeats": 10}
    }

    @require_user_conversation_limits()
    def view(**kwargs):
        return kwargs["user_limits"]

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        resp = view()
        # User should be auto-initialized and request succeeds
        assert resp == "success"
        # Verify initalize_user_limits was called
        mock_deps["init_user_limits"].assert_called_once_with("org1", "user1", 100.0)

def test_require_user_limits_user_exceeded(app, mock_deps):
    mock_deps["get_ids"].return_value = ("org1", "user1")
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {
            "tierId": "tier1",
            "allowedUserIds": [{"userId": "user1", "totalAllocated": 10, "currentUsed": 10}]
        },
        "balance": {"currentUsed": 50},
        "currentPeriodEnds": "2025-12-31"
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000},
        "policy": {"maxSeats": 10}
    }

    @require_user_conversation_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        resp, code = view()
        assert code == 403
        assert resp["error"] == "User has exceeded their conversation limits"

def test_require_user_limits_org_exceeded(app, mock_deps):
    mock_deps["get_ids"].return_value = ("org1", "user1")
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {
            "tierId": "tier1",
            "allowedUserIds": [{"userId": "user1", "totalAllocated": 10, "currentUsed": 5}]
        },
        "balance": {"currentUsed": 1000} # Org limit reached
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000},
        "policy": {"maxSeats": 10}
    }

    @require_user_conversation_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        resp, code = view()
        assert code == 403
        assert "Organization has exceeded its conversation limits" in resp

def test_require_user_limits_success(app, mock_deps):
    mock_deps["get_ids"].return_value = ("org1", "user1")
    mock_deps["get_user_orgs"].return_value = [{"id": "org1"}]
    mock_deps["get_org_usage"].return_value = {
        "policy": {
            "tierId": "tier1",
            "allowedUserIds": [{"userId": "user1", "totalAllocated": 10, "currentUsed": 5}]
        },
        "balance": {"currentUsed": 500}
    }
    mock_deps["get_tier"].return_value = {
        "quotas": {"totalCreditsAllocated": 1000},
        "policy": {"maxSeats": 10}
    }

    @require_user_conversation_limits()
    def view(**kwargs):
        return kwargs["user_limits"]

    with app.test_request_context(headers={"X-MS-CLIENT-PRINCIPAL-ID": "user1"}):
        user_limits = view()
        assert user_limits["user_limit"] == 10
        assert user_limits["user_used"] == 5

def test_internal_server_error(app, mock_deps):
    mock_deps["get_org_id"].side_effect = Exception("DB Error")

    @check_organization_limits()
    def view(**kwargs):
        return "success"

    with app.test_request_context():
        resp, code = view()
        assert code == 500
        assert "Internal server error" in resp
