"""
Subscription tier configuration and helper functions.

This module defines the subscription tiers for the GPT-RAG application,
including conversation time limits, feature access, and pricing information.
"""

from typing import Dict, Optional, Any

# Subscription tier definitions
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "conversation_time_minutes_per_month": 60,  # 1 hour
        "max_conversation_duration_minutes": 30,  # 30 min per session
        "max_users": 1,
        "features": {
            "max_pages": 50,
            "max_documents": 5,
            "max_spreadsheets": 0,
            "web_scraping_single_page": 0,
            "web_scraping_multipage": 0,
            "reports_per_month": 0,
            "multimodal_images": 0,
            "api_access": False,
        },
    },
    "basic": {
        "name": "Basic",
        "price_monthly": 29,
        "conversation_time_minutes_per_month": 300,  # 5 hours
        "max_conversation_duration_minutes": 60,  # 1 hour per session
        "max_users": 3,
        "features": {
            "max_pages": 500,
            "max_documents": 50,
            "max_spreadsheets": 10,
            "web_scraping_single_page": 50,
            "web_scraping_multipage": 0,
            "reports_per_month": 0,
            "multimodal_images": 100,
            "api_access": False,
        },
    },
    "professional": {
        "name": "Professional",
        "price_monthly": 99,
        "conversation_time_minutes_per_month": 1200,  # 20 hours
        "max_conversation_duration_minutes": 120,  # 2 hours per session
        "max_users": 10,
        "features": {
            "max_pages": 2000,
            "max_documents": 200,
            "max_spreadsheets": 20,
            "web_scraping_single_page": 200,
            "web_scraping_multipage": 10,
            "reports_per_month": 5,
            "multimodal_images": 500,
            "api_access": True,
        },
    },
    "enterprise": {
        "name": "Enterprise",
        "price_monthly": 499,  # Base price, custom pricing negotiated
        "conversation_time_minutes_per_month": -1,  # Unlimited (-1 indicates no limit)
        "max_conversation_duration_minutes": -1,  # Unlimited
        "max_users": -1,  # Unlimited
        "features": {
            "max_pages": -1,  # Unlimited
            "max_documents": -1,
            "max_spreadsheets": -1,
            "web_scraping_single_page": -1,
            "web_scraping_multipage": 50,
            "reports_per_month": 20,
            "multimodal_images": -1,
            "api_access": True,
            "sla_support": True,
            "priority_support": True,
        },
    },
}

# Default tier for new organizations
DEFAULT_TIER = "free"


def get_tier_config(tier_name: str) -> Optional[Dict[str, Any]]:
    """
    Get the configuration for a specific subscription tier.

    Args:
        tier_name: The name of the tier (e.g., "free", "basic", "professional", "enterprise")

    Returns:
        Dictionary containing tier configuration, or None if tier doesn't exist
    """
    return SUBSCRIPTION_TIERS.get(tier_name.lower())


def get_tier_by_price(price_monthly: int) -> Optional[str]:
    """
    Get the tier name by monthly price.

    Args:
        price_monthly: The monthly price in dollars

    Returns:
        Tier name, or None if no matching tier found
    """
    for tier_name, config in SUBSCRIPTION_TIERS.items():
        if config["price_monthly"] == price_monthly:
            return tier_name
    return None


def is_feature_allowed(
    tier_name: str, feature_name: str, current_usage: int = 0
) -> bool:
    """
    Check if a feature is allowed for a given tier.

    Args:
        tier_name: The subscription tier name
        feature_name: The feature to check (e.g., "max_documents")
        current_usage: Current usage count for the feature

    Returns:
        True if feature is allowed, False otherwise
    """
    tier = get_tier_config(tier_name)
    if not tier:
        return False

    feature_limit = tier.get("features", {}).get(feature_name)

    # If feature doesn't exist in tier, deny access
    if feature_limit is None:
        return False

    # -1 means unlimited
    if feature_limit == -1:
        return True

    # For boolean features
    if isinstance(feature_limit, bool):
        return feature_limit

    # For numeric limits
    return current_usage < feature_limit


def get_conversation_time_limit_seconds(tier_name: str) -> int:
    """
    Get the conversation time limit in seconds for a tier.

    Args:
        tier_name: The subscription tier name

    Returns:
        Time limit in seconds, or -1 for unlimited
    """
    tier = get_tier_config(tier_name)
    if not tier:
        # Default to free tier if tier not found
        tier = SUBSCRIPTION_TIERS[DEFAULT_TIER]

    minutes = tier.get("conversation_time_minutes_per_month", 60)
    return minutes * 60 if minutes != -1 else -1


def get_max_session_duration_seconds(tier_name: str) -> int:
    """
    Get the maximum conversation session duration in seconds for a tier.

    Args:
        tier_name: The subscription tier name

    Returns:
        Max session duration in seconds, or -1 for unlimited
    """
    tier = get_tier_config(tier_name)
    if not tier:
        tier = SUBSCRIPTION_TIERS[DEFAULT_TIER]

    minutes = tier.get("max_conversation_duration_minutes", 30)
    return minutes * 60 if minutes != -1 else -1


def format_time_remaining(seconds: int) -> str:
    """
    Format seconds into a human-readable time string.

    Args:
        seconds: Time in seconds

    Returns:
        Formatted string like "2h 30m" or "45m"
    """
    if seconds < 0:
        return "Unlimited"

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60

    if hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"


def calculate_usage_percentage(used_seconds: int, limit_seconds: int) -> float:
    """
    Calculate the percentage of time limit used.

    Args:
        used_seconds: Time used in seconds
        limit_seconds: Time limit in seconds (-1 for unlimited)

    Returns:
        Percentage from 0.0 to 100.0, or 0.0 for unlimited tiers
    """
    if limit_seconds == -1:
        return 0.0

    if limit_seconds == 0:
        return 100.0

    return min(100.0, (used_seconds / limit_seconds) * 100)


def should_show_warning(
    used_seconds: int, limit_seconds: int, warning_threshold: float = 80.0
) -> bool:
    """
    Determine if a usage warning should be shown.

    Args:
        used_seconds: Time used in seconds
        limit_seconds: Time limit in seconds
        warning_threshold: Percentage threshold for showing warning (default 80%)

    Returns:
        True if warning should be shown
    """
    if limit_seconds == -1:
        return False

    percentage = calculate_usage_percentage(used_seconds, limit_seconds)
    return percentage >= warning_threshold


def get_tier_display_info(tier_name: str) -> Dict[str, Any]:
    """
    Get display-friendly information about a tier for UI.

    Args:
        tier_name: The subscription tier name

    Returns:
        Dictionary with formatted display information
    """
    tier = get_tier_config(tier_name)
    if not tier:
        tier = SUBSCRIPTION_TIERS[DEFAULT_TIER]

    time_limit = tier["conversation_time_minutes_per_month"]
    session_limit = tier["max_conversation_duration_minutes"]

    return {
        "name": tier["name"],
        "tier_id": tier_name,
        "price": (
            f"${tier['price_monthly']}/month" if tier["price_monthly"] > 0 else "Free"
        ),
        "conversation_time": (
            format_time_remaining(time_limit * 60) if time_limit != -1 else "Unlimited"
        ),
        "max_session": (
            format_time_remaining(session_limit * 60)
            if session_limit != -1
            else "Unlimited"
        ),
        "users": tier["max_users"] if tier["max_users"] != -1 else "Unlimited",
        "features": tier["features"],
    }


def get_all_tiers_comparison() -> list:
    """
    Get a comparison of all subscription tiers for display.

    Returns:
        List of tier display information dictionaries
    """
    return [
        get_tier_display_info("free"),
        get_tier_display_info("basic"),
        get_tier_display_info("professional"),
        get_tier_display_info("enterprise"),
    ]
