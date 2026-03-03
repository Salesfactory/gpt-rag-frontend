import io
import logging
import os
import secrets

from flask import Blueprint, current_app, redirect, request, session, url_for
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from routes.decorators.auth_decorator import auth_required
from utils import create_error_response, create_success_response

bp = Blueprint("google_edit", __name__, url_prefix="/api/v1/google")

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"
GOOGLE_REDIRECT_URI_DEFAULT = ""

EDITABLE_MIME_TYPES = {
    ".pptx": {
        "source_mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "target_mime": "application/vnd.google-apps.presentation",
        "target_name": "Google Slides",
        "fallback_url": "https://docs.google.com/presentation/d/{file_id}/edit",
    },
    ".docx": {
        "source_mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "target_mime": "application/vnd.google-apps.document",
        "target_name": "Google Docs",
        "fallback_url": "https://docs.google.com/document/d/{file_id}/edit",
    },
    ".xlsx": {
        "source_mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "target_mime": "application/vnd.google-apps.spreadsheet",
        "target_name": "Google Sheets",
        "fallback_url": "https://docs.google.com/spreadsheets/d/{file_id}/edit",
    },
}

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.file",
]


class GoogleDriveCopyError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def _configure_oauth_transport_for_request() -> None:
    host = (request.host or "").split(":")[0].lower()
    is_local_host = host in {"127.0.0.1", "localhost"}

    if is_local_host:
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    else:
        os.environ.pop("OAUTHLIB_INSECURE_TRANSPORT", None)


def _redirect_uri(request_host_url: str | None = None) -> str:
    configured_uri = os.getenv("GOOGLE_REDIRECT_URI", "").strip()
    if configured_uri:
        return configured_uri

    if request_host_url:
        return f"{request_host_url.rstrip('/')}/api/v1/google/callback"

    return GOOGLE_REDIRECT_URI_DEFAULT


def _client_config(request_host_url: str | None = None) -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise ValueError("Google OAuth credentials are not configured.")

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": GOOGLE_AUTH_URI,
            "token_uri": GOOGLE_TOKEN_URI,
            "redirect_uris": [_redirect_uri(request_host_url=request_host_url)],
        }
    }


def _create_flow(state: str = None, request_host_url: str | None = None, redirect_uri: str | None = None) -> Flow:
    resolved_redirect_uri = redirect_uri or _redirect_uri(request_host_url=request_host_url)
    flow = Flow.from_client_config(
        _client_config(request_host_url=request_host_url),
        scopes=GOOGLE_SCOPES,
        state=state,
    )
    flow.redirect_uri = resolved_redirect_uri
    return flow


def _save_credentials(credentials: Credentials) -> None:
    session["google_oauth_credentials"] = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }
    session.modified = True


def _state_serializer() -> URLSafeTimedSerializer:
    secret_key = current_app.secret_key or os.getenv("FLASK_SECRET_KEY", "")
    return URLSafeTimedSerializer(secret_key=secret_key, salt="google-oauth-state")


def _encode_oauth_state(blob_name: str | None = None) -> str:
    payload = {
        "nonce": secrets.token_urlsafe(16),
        "blob_name": blob_name,
    }
    return _state_serializer().dumps(payload)


def _decode_oauth_state(state_value: str) -> dict:
    return _state_serializer().loads(state_value, max_age=900)


def _load_credentials() -> Credentials | None:
    credentials_data = session.get("google_oauth_credentials")
    if not credentials_data:
        return None

    try:
        credentials = Credentials(**credentials_data)
    except Exception:
        logger.warning("Stored Google OAuth credentials are invalid. Clearing session credentials.")
        session.pop("google_oauth_credentials", None)
        session.modified = True
        return None

    if credentials.expired and credentials.refresh_token:
        try:
            credentials.refresh(GoogleAuthRequest())
            _save_credentials(credentials)
        except Exception as refresh_error:
            logger.warning("Google OAuth token refresh failed. Clearing session credentials. Error: %s", refresh_error)
            session.pop("google_oauth_credentials", None)
            session.modified = True
            return None

    return credentials


def _is_valid_blob_name(blob_name: str) -> bool:
    if not blob_name or not isinstance(blob_name, str):
        return False
    if ".." in blob_name.split("/"):
        return False
    if not blob_name.startswith("organization_files/"):
        return False
    return any(blob_name.lower().endswith(ext) for ext in EDITABLE_MIME_TYPES.keys())


def _get_file_extension(blob_name: str) -> str:
    _, extension = os.path.splitext(blob_name)
    extension = extension.lower()
    if extension == ".":
        return ""
    return extension


def _get_editable_file_config(blob_name: str) -> dict:
    extension = _get_file_extension(blob_name)
    config = EDITABLE_MIME_TYPES.get(extension)
    if not config:
        supported_types = ", ".join(sorted(EDITABLE_MIME_TYPES.keys()))
        raise ValueError(f"Unsupported file type. Supported types: {supported_types}")
    return config


def _build_google_authorization_url(blob_name: str | None = None) -> str:
    _configure_oauth_transport_for_request()
    state = _encode_oauth_state(blob_name=blob_name)
    flow = _create_flow(state=state, request_host_url=request.host_url)

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    return authorization_url


def _create_editable_google_copy(blob_name: str, credentials: Credentials) -> str:
    file_config = _get_editable_file_config(blob_name)
    blob_storage_manager = current_app.config["blob_storage_manager"]
    container_name = os.getenv("BLOB_CONTAINER_NAME", "documents")

    container_client = blob_storage_manager.blob_service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(blob_name)

    if not blob_client.exists():
        raise FileNotFoundError("File not found in storage.")

    blob_bytes = blob_client.download_blob().readall()
    if not blob_bytes:
        raise ValueError("File is empty.")

    file_name = blob_name.split("/")[-1]
    extension = _get_file_extension(file_name)
    base_name = file_name[: -len(extension)] if extension and file_name.lower().endswith(extension) else file_name

    media = MediaIoBaseUpload(io.BytesIO(blob_bytes), mimetype=file_config["source_mime"], resumable=False)
    drive_service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    try:
        created_file = drive_service.files().create(
            body={
                "name": f"{base_name} (Editable copy)",
                "mimeType": file_config["target_mime"],
            },
            media_body=media,
            fields="id,webViewLink",
        ).execute()
    except HttpError as http_error:
        status_code = getattr(http_error.resp, "status", 500)
        error_message = str(http_error)

        if status_code == 403:
            lowered_error_message = error_message.lower()
            if "quota" in lowered_error_message or "storagequota" in lowered_error_message:
                raise GoogleDriveCopyError(
                    "Google Drive storage quota exceeded. Please free up space in Google Drive and try again.",
                    403,
                ) from http_error
            raise GoogleDriveCopyError(
                "Google Drive denied access to create an editable copy. Please verify Drive permissions and try again.",
                403,
            ) from http_error
        if status_code == 404:
            raise GoogleDriveCopyError(
                "Google Drive resource not found while creating the editable copy. Please try again.",
                404,
            ) from http_error
        if status_code == 413:
            raise GoogleDriveCopyError(
                "File is too large for Google Drive conversion. Please use a smaller file.",
                413,
            ) from http_error
        if status_code == 429:
            raise GoogleDriveCopyError(
                "Google Drive rate limit exceeded. Please wait a moment and try again.",
                429,
            ) from http_error

        raise GoogleDriveCopyError(
            "Google Drive API error while creating editable copy.",
            status_code if isinstance(status_code, int) else 500,
        ) from http_error

    web_view_link = created_file.get("webViewLink")
    file_id = created_file.get("id")
    if not web_view_link and file_id:
        web_view_link = file_config["fallback_url"].format(file_id=file_id)

    if not web_view_link:
        raise RuntimeError("Google did not return an edit link for the copied document.")

    return web_view_link


@bp.get("/connect")
def connect_google_account():
    blob_name = (request.args.get("blob_name") or "").strip()
    if blob_name and not _is_valid_blob_name(blob_name):
        return create_error_response("Invalid file path. Only .docx, .xlsx and .pptx are supported.", 400)

    try:
        authorization_url = _build_google_authorization_url(blob_name=blob_name or None)
    except ValueError as config_error:
        logger.error("Google OAuth configuration error: %s", config_error)
        return create_error_response(str(config_error), 500)
    except Exception:
        logger.exception("Unexpected error creating Google OAuth flow")
        return create_error_response("Failed to initialize Google OAuth flow.", 500)

    return redirect(authorization_url)


@bp.post("/edit-file-url")
@auth_required
def get_google_file_redirect_url():
    payload = request.get_json(silent=True) or {}
    blob_name = (payload.get("blob_name") or "").strip()

    if not _is_valid_blob_name(blob_name):
        return create_error_response("Invalid file path. Only .docx, .xlsx and .pptx are supported.", 400)

    try:
        credentials = _load_credentials()
        if not credentials:
            authorization_url = _build_google_authorization_url(blob_name=blob_name)
            return create_success_response({"redirect_url": authorization_url}, 200)

        edit_url = _create_editable_google_copy(blob_name, credentials)
        return create_success_response({"redirect_url": edit_url}, 200)
    except FileNotFoundError as file_error:
        return create_error_response(str(file_error), 404)
    except ValueError as value_error:
        logger.error("Google edit validation error: %s", value_error)
        return create_error_response(str(value_error), 400)
    except GoogleDriveCopyError as drive_error:
        logger.error("Google Drive copy error: %s", drive_error)
        return create_error_response(str(drive_error), drive_error.status_code)
    except Exception:
        logger.exception("Failed to prepare Google redirect URL for blob %s", blob_name)
        return create_error_response("Failed to prepare Google redirection URL.", 500)


@bp.get("/callback")
def google_oauth_callback():
    _configure_oauth_transport_for_request()
    incoming_state = request.args.get("state")

    if not incoming_state:
        return create_error_response("Invalid Google OAuth state.", 400)

    try:
        state_payload = _decode_oauth_state(incoming_state)
    except SignatureExpired:
        return create_error_response("Google OAuth state expired. Please try again.", 400)
    except BadSignature:
        return create_error_response("Invalid Google OAuth state.", 400)
    except Exception:
        logger.exception("Unexpected error while validating OAuth state")
        return create_error_response("Invalid Google OAuth state.", 400)

    try:
        flow = _create_flow(
            state=incoming_state,
            request_host_url=request.host_url,
            redirect_uri=request.base_url,
        )
        flow.fetch_token(authorization_response=request.url)
        _save_credentials(flow.credentials)
    except Exception as oauth_error:
        logger.exception("Google OAuth token exchange failed")
        return create_error_response(
            "Google authentication failed. Please try connecting your account again.",
            500,
        )

    pending_blob = state_payload.get("blob_name")
    if pending_blob:
        try:
            edit_url = _create_editable_google_copy(pending_blob, flow.credentials)
            return redirect(edit_url)
        except FileNotFoundError as file_error:
            return create_error_response(str(file_error), 404)
        except ValueError as value_error:
            logger.error("Google edit validation error in callback: %s", value_error)
            return create_error_response(str(value_error), 400)
        except GoogleDriveCopyError as drive_error:
            logger.error("Google Drive copy error in callback: %s", drive_error)
            return create_error_response(str(drive_error), drive_error.status_code)
        except Exception as copy_error:
            logger.exception("Unexpected error while creating editable Google copy")
            return create_error_response(
                f"Failed to create editable Google copy: {copy_error}",
                500,
            )

    return create_success_response({"message": "Google account connected successfully."}, 200)


@bp.get("/edit-file")
def open_file_in_google():
    blob_name = (request.args.get("blob_name") or "").strip()
    if not _is_valid_blob_name(blob_name):
        return create_error_response("Invalid file path. Only .docx, .xlsx and .pptx are supported.", 400)

    credentials = _load_credentials()
    if not credentials:
        return redirect(url_for("google_edit.connect_google_account", blob_name=blob_name))

    try:
        edit_url = _create_editable_google_copy(blob_name, credentials)
        return redirect(edit_url)
    except FileNotFoundError as file_error:
        return create_error_response(str(file_error), 404)
    except ValueError as value_error:
        logger.error("Google edit validation error: %s", value_error)
        return create_error_response(str(value_error), 400)
    except GoogleDriveCopyError as drive_error:
        logger.error("Google Drive copy error: %s", drive_error)
        return create_error_response(str(drive_error), drive_error.status_code)
    except Exception:
        logger.exception("Failed to create editable Google copy for blob %s", blob_name)
        return create_error_response("Failed to create an editable Google copy.", 500)


@bp.get("/status")
@auth_required
def google_connection_status():
    is_connected = bool(session.get("google_oauth_credentials"))
    return create_success_response({"connected": is_connected}, 200)