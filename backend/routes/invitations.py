import os
import re

from flask import Blueprint, current_app, jsonify, request

from functools import wraps

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import logging

from shared.cosmo_db import create_invitation, get_invitation_by_email_and_org, get_invitation

from utils import delete_invitation, create_error_response, get_invitations

from shared.error_handling import (
    MissingJSONPayloadError,
    MissingRequiredFieldError,
)

from http import HTTPStatus

bp = Blueprint("invitations", __name__, url_prefix="/api")

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_instance = current_app.config.get("auth")
        return auth_instance.login_required(f)(*args, **kwargs)
    return decorated_function

EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PORT = os.getenv("EMAIL_PORT")

INVITATION_LINK = os.getenv("INVITATION_LINK")

@bp.route("/inviteUser", methods=["POST"])
@auth_required
def sendEmail(*, context):
    if (
        not request.json
        or "username" not in request.json
        or "email" not in request.json
        or "organizationName" not in request.json
        or "organizationId" not in request.json
    ):
        return jsonify({"error": "Missing username or email"}), 400

    username = request.json["username"]
    email = request.json["email"]
    organizationName = request.json["organizationName"]
    organizationId = request.json["organizationId"]

    invitation = get_invitation_by_email_and_org(email, organizationId)
    if invitation:
        unique_id = invitation["id"]
        token = invitation["token"]
        if unique_id and token:
            activation_link = (
                f"{INVITATION_LINK}/api/invitations/{unique_id}/redeemed?token={token}"
            )
    else:
        return jsonify({"error": "No invitation found"}), 404

    # Validate email format
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400

    try:
        # Email account credentials
        gmail_user = EMAIL_USER
        gmail_password = EMAIL_PASS

        # Email details
        sent_from = gmail_user
        to = [email]
        subject = "SalesFactory Chatbot Invitation"
        body = (
            """
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to FreddAid - Your Marketing Powerhouse</title>
        <style>
            body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            }
            .container {
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
            }
            h1, h2 {
            margin: 10px 0;
            color: #000000;
            }
            p {
            line-height: 1.5;
            color: #000000;
            }
            a {
            color: #337ab7;
            text-decoration: none;
            }
            .cta-button {
            background-color: #337ab7;
            color: #fff !important;
            padding: 10px 20px;
            border-radius: 5px;
            text-align: center;
            display: inline-block;
            }
            .cta-button:hover {
            background-color: #23527c;
            }
            .cta-button a {
            color: #fff !important;
            }
                       .cta-button a:visited {
            color: #fff !important;
            }
            .ii a[href] {
            color: #fff !important;
            }
            .footer {
            text-align: center;
            margin-top: 20px;
            }
        </style>
        </head>
        <body>
        <div class="container">
            <h1>Dear [Recipient's Name],</h1>
            <h2>Congratulations and Welcome to FreddAid!</h2>
            <p>You now have exclusive access to <strong>[Recipient's Organization]'s FreddAid</strong>, your new marketing powerhouse. It's time to unlock smarter strategies, deeper insights, and a faster path to success.</p>
            <h2>Ready to Get Started?</h2>
            <p>Click the link below and follow the easy steps to create your FreddAid account:</p>
            <a href="[link to activate account]" class="cta-button">Activate Your FreddAid Account Now</a>
            <p>Unlock FreddAid's full potential and start enjoying unparalleled insights, real-time data, and a high-speed advantage in all your marketing efforts.</p>
            <p>If you need any assistance, our support team is here to help you every step of the way.</p>
            <p>Welcome to the future of marketing. Welcome to FreddAid.</p>
            <p class="footer">Best regards,<br>Juan Hernandez<br>Chief Technology Officer<br>Sales Factory AI<br>juan.hernandez@salesfactory.com</p>
        </div>
        </body>
        </html>
        """.replace(
                "[Recipient's Name]", username
            )
            .replace("[link to activate account]", activation_link)
            .replace("[Recipient's Organization]", organizationName)
        )

        # Create a multipart message and set headers
        message = MIMEMultipart()
        message["From"] = sent_from
        message["To"] = ", ".join(to)
        message["Subject"] = subject

        # Add body to email
        message.attach(MIMEText(body, "html"))

        # Connect to Gmail's SMTP server
        server = smtplib.SMTP_SSL(EMAIL_HOST, EMAIL_PORT)
        server.ehlo()
        server.login(gmail_user, gmail_password)

        # Send email
        server.sendmail(sent_from, to, message.as_string())
        server.close()

        logging.error("Email sent!")
        return jsonify({"message": "Email sent!"})
    except Exception as e:
        logging.error("Something went wrong...", e)
        return jsonify({"error": str(e)}), 500


@bp.route("/getInvitations", methods=["GET"])
@auth_required
def getInvitations(*, context):
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )

    user_id = request.args.get("user_id")
    organization_id = request.args.get("organizationId")

    if not organization_id and not user_id:
        return (
            jsonify({"error": "Either 'organization_id' or 'user_id' is required"}),
            400,
        )

    try:
        if organization_id:
            return jsonify(get_invitations(organization_id))
        return get_invitation(user_id)
    except Exception as e:
        logging.exception("[webbackend] exception in /getInvitation")
        return jsonify({"error": str(e)}), 500


@bp.route("/createInvitation", methods=["POST"])
@auth_required
def createInvitation(*, context):
    try:
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        if not client_principal_id:
            raise MissingRequiredFieldError("client_principal_id")
        data = request.get_json()
        if not data:
            raise MissingJSONPayloadError()
        if not "invitedUserEmail" in data:
            raise MissingRequiredFieldError("invitedUserEmail")
        if not "organizationId" in data:
            raise MissingRequiredFieldError("organizationId")
        if not "role" in data:
            raise MissingRequiredFieldError("role")
        if not "nickname" in data:
            raise MissingRequiredFieldError("nickname")
        invitedUserEmail = data["invitedUserEmail"]
        organizationId = data["organizationId"]
        role = data["role"]
        nickname = data["nickname"]
        response = create_invitation(invitedUserEmail, organizationId, role, nickname)
        return jsonify(response), HTTPStatus.CREATED
    except MissingRequiredFieldError as field:
        return create_error_response(
            f"Field '{field}' is required", HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        logging.exception(str(e))
        return create_error_response(
            f"An unexpected error occurred. Please try again later. {e}",
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/deleteInvitation", methods=["DELETE"])
@auth_required
def deleteInvitation(*, context):
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            create_error_response("Missing required parameters, client_principal_id"),
            400,
        )

    invitation_id = request.args.get("invitationId")
    if not invitation_id:
        return create_error_response("Missing required parameters, invitationId"), 400

    try:
        response = delete_invitation(invitation_id)
        return jsonify(response), HTTPStatus.OK
    except Exception as e:
        logging.exception("[webbackend] exception in /deleteInvitation")
        return jsonify({"error": str(e)}), 500
