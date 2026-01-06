
from flask import request, Response, make_response, jsonify

def secure_response(response: Response) -> Response:
    """
    Secures API responses by converting authentication redirects to JSON errors.

    When an API endpoint decorated with @login_required fails authentication,
    it typically returns an HTML redirect response. This hook intercepts such
    redirects for API requests and converts them to proper 401 JSON error responses,
    allowing frontend clients to handle authentication failures gracefully.

    Args:
        response: The Flask response object

    Returns:
        Response: Either a 401 JSON error (for auth failures on API endpoints)
                  or the original response (for all other cases)
    """
    is_api_request = request.path.startswith("/api/")

    is_invitation_request = "/api/invitations/" in request.path

    if is_invitation_request:
        return response

    content_type = getattr(response, "content_type", None)
    is_login_redirect = content_type == "text/html; charset=utf-8"

    if is_api_request and is_login_redirect:
        return make_response(jsonify({"error": "Unauthorized"}), 401)

    return response