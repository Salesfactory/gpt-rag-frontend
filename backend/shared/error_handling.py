# Error Handling: Custom exception hierarchy for subscription-specific errors
class SubscriptionError(Exception):
    """Base exception for subscription-related errors"""

    pass

class InvalidSubscriptionError(SubscriptionError):
    """Raised when subscription modification fails"""

    pass


class MissingJSONPayloadError(Exception):
    """Raised when JSON payload is missing"""

    pass


class MissingRequiredFieldError(Exception):
    """Raised when a required field is missing"""

    pass


class InvalidParameterError(Exception):
    """Raised when an invalid parameter is provided"""

    pass


class InvalidFileType(Exception):
    """Raised when a invalid file type is recieved"""

class IncompleteConfigurationError(SubscriptionError):
    """Raised when subscription modification fails"""

    pass

class MissingParameterError(Exception):
    """Raised when a required parameter is missing"""

    pass