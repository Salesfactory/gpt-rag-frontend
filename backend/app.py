from functools import wraps
import os
import re
import mimetypes
import time
import logging
import requests
import json
import stripe
import datetime
from flask import Flask, request, jsonify, Response, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from urllib.parse import unquote
import uuid
from typing import Dict, Any, Tuple
from http import HTTPStatus  # Best Practice: Use standard HTTP status codes
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound
from api_utils import create_error_response, create_success_response, SubscriptionError, InvalidSubscriptionError, InvalidFinancialPriceError, require_client_principal
import stripe.error

load_dotenv()

SPEECH_REGION = os.getenv("SPEECH_REGION")
ORCHESTRATOR_ENDPOINT = os.getenv("ORCHESTRATOR_ENDPOINT")
ORCHESTRATOR_URI = os.getenv("ORCHESTRATOR_URI", default="")
SETTINGS_ENDPOINT = ORCHESTRATOR_URI + "/settings"
FEEDBACK_ENDPOINT = ORCHESTRATOR_URI + "/feedback"
HISTORY_ENDPOINT = ORCHESTRATOR_URI + "/conversations"
CHECK_USER_ENDPOINT = ORCHESTRATOR_URI + "/checkUser"
SUBSCRIPTION_ENDPOINT = ORCHESTRATOR_URI + "/subscriptions"
INVITATIONS_ENDPOINT = ORCHESTRATOR_URI + "/invitations"
STORAGE_ACCOUNT = os.getenv("STORAGE_ACCOUNT")

PRODUCT_ID_DEFAULT = os.getenv("STRIPE_PRODUCT_ID")

# email
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PORT = os.getenv("EMAIL_PORT")

# stripe
stripe.api_key = os.getenv("STRIPE_API_KEY")
FINANCIAL_ASSISTANT_PRICE_ID = os.getenv("STRIPE_FA_PRICE_ID")

INVITATION_LINK = os.getenv("INVITATION_LINK")

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)


def get_secret(secretName):
    keyVaultName = os.environ["AZURE_KEY_VAULT_NAME"]
    KVUri = f"https://{keyVaultName}.vault.azure.net"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=KVUri, credential=credential)
    logging.info(f"[webbackend] retrieving {secretName} secret from {keyVaultName}.")
    retrieved_secret = client.get_secret(secretName)
    return retrieved_secret.value


SPEECH_KEY = get_secret("speechKey")

SPEECH_RECOGNITION_LANGUAGE = os.getenv("SPEECH_RECOGNITION_LANGUAGE")
SPEECH_SYNTHESIS_LANGUAGE = os.getenv("SPEECH_SYNTHESIS_LANGUAGE")
SPEECH_SYNTHESIS_VOICE_NAME = os.getenv("SPEECH_SYNTHESIS_VOICE_NAME")
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CSV_STORAGE_NAME = os.getenv("AZURE_CSV_STORAGE_CONTAINER", "files")

app = Flask(__name__)
CORS(app)


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)


@app.route("/chatgpt", methods=["POST"])
def chatgpt():
    conversation_id = request.json["conversation_id"]
    question = request.json["query"]
    file_blob_url = request.json["url"]
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")
    logging.info("[webbackend] conversation_id: " + conversation_id)
    logging.info("[webbackend] question: " + question)
    logging.info(f"[webbackend] file_blob_url: {file_blob_url}")
    logging.info(f"[webbackend] User principal: {client_principal_id}")
    logging.info(f"[webbackend] User name: {client_principal_name}")

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--functionKey"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--functionKey"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = ORCHESTRATOR_ENDPOINT
        payload = json.dumps(
            {
                "conversation_id": conversation_id,
                "question": question,
                "url": file_blob_url,
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /chatgpt")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat-history", methods=["GET"])
def getChatHistory():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--conversations"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--functionKey"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        url = HISTORY_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps({"user_id": client_principal_id})
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /chat-history")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat-conversation/<chat_id>", methods=["GET"])
def getChatConversation(chat_id):

    if chat_id is None:
        return jsonify({"error": "Missing chatId parameter"}), 400

    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    try:
        keySecretName = "orchestrator-host--conversations"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        return jsonify({"error": f"Error getting function key: {e}"}), 500

    try:
        url = f"{HISTORY_ENDPOINT}/?id={chat_id}"
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps({"user_id": client_principal_id})
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")

        return response.text, response.status_code
    except Exception as e:
        logging.exception("[webbackend] exception in /get-chat-history")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat-conversations/<chat_id>", methods=["DELETE"])
def deleteChatConversation(chat_id):
    try:
        client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
        keySecretName = "orchestrator-host--conversations"
        functionKey = get_secret(keySecretName)

        url = f"{HISTORY_ENDPOINT}/?id={chat_id}"
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps({"user_id": client_principal_id})

        response = requests.delete(url, headers=headers, data=payload)
        return response.text, response.status_code
    except Exception as e:
        logging.exception("[webbackend] exception in /delete-chat-conversation")
        return jsonify({"error": str(e)}), 500


# methods to provide access to speech services and blob storage account blobs


@app.route("/api/get-speech-token", methods=["GET"])
def getGptSpeechToken():
    try:
        fetch_token_url = (
            f"https://{SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        )
        headers = {
            "Ocp-Apim-Subscription-Key": SPEECH_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        response = requests.post(fetch_token_url, headers=headers)
        access_token = str(response.text)
        return json.dumps(
            {
                "token": access_token,
                "region": SPEECH_REGION,
                "speechRecognitionLanguage": SPEECH_RECOGNITION_LANGUAGE,
                "speechSynthesisLanguage": SPEECH_SYNTHESIS_LANGUAGE,
                "speechSynthesisVoiceName": SPEECH_SYNTHESIS_VOICE_NAME,
            }
        )
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-speech-token")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-storage-account", methods=["GET"])
def getStorageAccount():
    if STORAGE_ACCOUNT is None or STORAGE_ACCOUNT == "":
        return jsonify({"error": "Add STORAGE_ACCOUNT to frontend app settings"}), 500
    try:
        return json.dumps({"storageaccount": STORAGE_ACCOUNT})
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-storage-account")
        return jsonify({"error": str(e)}), 500


@app.route("/create-checkout-session", methods=["POST"])
def create_checkout_session():
    price = request.json["priceId"]
    userId = request.json["userId"]
    success_url = request.json["successUrl"]
    cancel_url = request.json["cancelUrl"]
    organizationId = request.json["organizationId"]
    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {"price": price, "quantity": 1},
            ],
            mode="subscription",
            client_reference_id=userId,
            metadata={"userId": userId, "organizationId": organizationId},
            success_url=success_url,
            cancel_url=cancel_url,
            automatic_tax={"enabled": True},
            custom_fields=[
                (
                    {
                        "key": "organization_name",
                        "label": {"type": "custom", "custom": "Organization Name"},
                        "type": "text",
                        "text": {"minimum_length": 5, "maximum_length": 100},
                    }
                    if organizationId == ""
                    else {}
                )
            ],
        )
    except Exception as e:
        return str(e)

    return jsonify({"url": checkout_session.url})


@app.route("/api/stripe", methods=["GET"])
def getStripe():
    try:
        keySecretName = "stripeKey"
        functionKey = get_secret(keySecretName)
        return functionKey
    except Exception as e:
        logging.exception("[webbackend] exception in /api/stripe")
        return jsonify({"error": str(e)}), 500


@app.route("/webhook", methods=["POST"])
def webhook():
    stripe.api_key = os.getenv("STRIPE_API_KEY")
    endpoint_secret = os.getenv("STRIPE_SIGNING_SECRET")

    event = None
    payload = request.data

    try:
        event = json.loads(payload)
    except json.decoder.JSONDecodeError as e:
        print("⚠️  Webhook error while parsing basic request." + str(e))
        return jsonify(success=False)
    if endpoint_secret:
        # Only verify the event if there is an endpoint secret defined
        # Otherwise use the basic event deserialized with json
        sig_header = request.headers["STRIPE_SIGNATURE"]
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except stripe.error.SignatureVerificationError as e:
            print("⚠️  Webhook signature verification failed. " + str(e))
            return jsonify(success=False)

    # Handle the event
    if event["type"] == "checkout.session.completed":
        print("🔔  Webhook received!", event["type"])
        userId = event["data"]["object"]["client_reference_id"]
        organizationId = event["data"]["object"]["metadata"]["organizationId"]
        sessionId = event["data"]["object"]["id"]
        subscriptionId = event["data"]["object"]["subscription"]
        paymentStatus = event["data"]["object"]["payment_status"]
        organizationName = event["data"]["object"]["custom_fields"][0]["text"]["value"]
        expirationDate = event["data"]["object"]["expires_at"]
        try:
            # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
            # It is set during the infrastructure deployment.
            keySecretName = "orchestrator-host--subscriptions"
            functionKey = get_secret(keySecretName)
        except Exception as e:
            logging.exception(
                "[webbackend] exception in /api/orchestrator-host--subscriptions"
            )
            return (
                jsonify(
                    {
                        "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                    }
                ),
                500,
            )
        try:
            url = SUBSCRIPTION_ENDPOINT
            payload = json.dumps(
                {
                    "id": userId,
                    "organizationId": organizationId,
                    "sessionId": sessionId,
                    "subscriptionId": subscriptionId,
                    "paymentStatus": paymentStatus,
                    "organizationName": organizationName,
                    "expirationDate": expirationDate,
                }
            )
            headers = {
                "Content-Type": "application/json",
                "x-functions-key": functionKey,
            }
            response = requests.request("POST", url, headers=headers, data=payload)
            logging.info(f"[webbackend] RESPONSE: {response.text[:500]}...")
        except Exception as e:
            logging.exception("[webbackend] exception in /api/checkUser")
            return jsonify({"error": str(e)}), 500
    else:
        # Unexpected event type
        print("Unexpected event type")

    return jsonify(success=True)


@app.route("/api/upload-blob", methods=["POST"])
def uploadBlob():
    if "file" not in request.files:
        print("No file sent")
        return jsonify({"error": "No file sent"}), 400

    valid_file_extensions = [".csv", ".xlsx", ".xls"]

    file = request.files["file"]

    extension = os.path.splitext(file.filename)[1]

    if extension not in valid_file_extensions:
        return jsonify({"error": "Invalid file type"}), 400

    filename = str(uuid.uuid4()) + extension

    try:
        blob_service_client = BlobServiceClient.from_connection_string(
            AZURE_STORAGE_CONNECTION_STRING
        )
        blob_client = blob_service_client.get_blob_client(
            container=AZURE_CSV_STORAGE_NAME, blob=filename
        )
        blob_client.upload_blob(data=file, blob_type="BlockBlob")

        return jsonify({"blob_url": blob_client.url}), 200
    except Exception as e:
        logging.exception("[webbackend] exception in /api/upload-blob")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-blob", methods=["POST"])
def getBlob():
    logging.exception("------------------ENTRA ------------")
    blob_name = unquote(request.json["blob_name"])
    try:
        client_credential = DefaultAzureCredential()
        blob_service_client = BlobServiceClient(
            f"https://{STORAGE_ACCOUNT}.blob.core.windows.net", client_credential
        )
        blob_client = blob_service_client.get_blob_client(
            container="documents", blob=blob_name
        )
        blob_data = blob_client.download_blob()
        blob_text = blob_data.readall()
        return Response(blob_text, content_type="application/octet-stream")
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-blob")
        logging.exception(blob_name)
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["GET"])
def getSettings():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--settings"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--functionKey"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = SETTINGS_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["POST"])
def setSettings():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        temperature = float(request.json["temperature"])
    except:
        temperature = 0

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--settings"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--functionKey"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = SETTINGS_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "temperature": temperature,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500


@app.route("/api/feedback", methods=["POST"])
def setFeedback():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    conversation_id = request.json["conversation_id"]
    question = request.json["question"]
    answer = request.json["answer"]
    category = request.json["category"]
    feedback = request.json["feedback"]
    rating = request.json["rating"]

    if not conversation_id or not question or not answer or not category:
        return (
            jsonify(
                {
                    "error": "Missing required parameters conversation_id, question, answer or category"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--feedback"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--feedback")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = FEEDBACK_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "conversation_id": conversation_id,
                "question": question,
                "answer": answer,
                "category": category,
                "feedback": feedback,
                "rating": rating,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/feedback")
        return jsonify({"error": str(e)}), 500


@app.route("/api/getusers", methods=["GET"])
def getUsers():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        organizationId = request.args.get("organizationId")
        url = CHECK_USER_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"organizationId": organizationId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/deleteuser", methods=["DELETE"])
def deleteUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        userId = request.args.get("userId")
        url = CHECK_USER_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "DELETE", url, headers=headers, params={"id": userId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/inviteUser", methods=["POST"])
def sendEmail():
    if (
        not request.json
        or "username" not in request.json
        or "email" not in request.json
    ):
        return jsonify({"error": "Missing username or email"}), 400

    username = request.json["username"]
    email = request.json["email"]

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
        body = """
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
            }
            p {
            line-height: 1.5;
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
            <h2>Congratulations!</h2>
            <p>You now have exclusive access to FreddAid, your new marketing powerhouse. Get ready to transform your approach to marketing and take your strategies to the next level.</p>
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
        ).replace(
            "[link to activate account]", INVITATION_LINK
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


@app.route("/api/getInvitations", methods=["GET"])
def getInvitations():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    try:
        keySecretName = "orchestrator-host--invitations"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--subscriptions"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        organizationId = request.args.get("organizationId")
        url = INVITATIONS_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"organizationId": organizationId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /get-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/createInvitation", methods=["POST"])
def createInvitation():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    try:
        keySecretName = "orchestrator-host--invitations"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--subscriptions"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        organizationId = request.json["organizationId"]
        invitedUserEmail = request.json["invitedUserEmail"]
        role = request.json["role"]
        url = INVITATIONS_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        payload = json.dumps(
            {
                "invited_user_email": invitedUserEmail,
                "organization_id": organizationId,
                "role": role,
            }
        )
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /getUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/checkuser", methods=["POST"])
def checkUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        email = request.json["email"]
        url = CHECK_USER_ENDPOINT
        payload = json.dumps(
            {
                "client_principal_id": client_principal_id,
                "client_principal_name": client_principal_name,
                "id": client_principal_id,
                "name": client_principal_name,
                "email": email,
            }
        )
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /api/checkUser")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-organization-subscription", methods=["GET"])
def getOrganization():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    if not client_principal_id:
        return (
            jsonify({"error": "Missing required parameters, client_principal_id"}),
            400,
        )
    try:
        keySecretName = "orchestrator-host--subscriptions"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--subscriptions"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        organizationId = request.args.get("organizationId")
        url = SUBSCRIPTION_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"organizationId": organizationId}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /get-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/create-organization", methods=["POST"])
def createOrganization():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")

    if not client_principal_id:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--subscriptions"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception(
            "[webbackend] exception in /api/orchestrator-host--subscriptions"
        )
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )
    try:
        organizationName = request.json["organizationName"]
        payload = json.dumps(
            {
                "id": client_principal_id,
                "organizationName": organizationName,
            }
        )
        url = SUBSCRIPTION_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /post-organization")
        return jsonify({"error": str(e)}), 500


@app.route("/api/getUser", methods=["GET"])
def getUser():
    client_principal_id = request.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    client_principal_name = request.headers.get("X-MS-CLIENT-PRINCIPAL-NAME")

    if not client_principal_id or not client_principal_name:
        return (
            jsonify(
                {
                    "error": "Missing required parameters, client_principal_id or client_principal_name"
                }
            ),
            400,
        )

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = "orchestrator-host--checkuser"
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--checkuser")
        return (
            jsonify(
                {
                    "error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"
                }
            ),
            500,
        )

    try:
        url = CHECK_USER_ENDPOINT
        headers = {"Content-Type": "application/json", "x-functions-key": functionKey}
        response = requests.request(
            "GET", url, headers=headers, params={"id": client_principal_id}
        )
        logging.info(f"[webbackend] response: {response.text[:500]}...")
        return response.text
    except Exception as e:
        logging.exception("[webbackend] exception in /getUser")
        return jsonify({"error": str(e)}), 500


def get_product_prices(product_id):

    if not product_id:
        raise ValueError("Product ID is required to fetch prices")

    try:
        # Fetch all prices associated with a product
        prices = stripe.Price.list(
            product=product_id, active=True  # Optionally filter only active prices
        )
        return prices.data
    except Exception as e:
        logging.error(f"Error fetching prices: {e}")
        raise


@app.route("/api/prices", methods=["GET"])
def get_product_prices_endpoint():
    product_id = request.args.get("product_id", PRODUCT_ID_DEFAULT)

    if not product_id:
        return jsonify({"error": "Missing product_id parameter"}), 400

    try:
        prices = get_product_prices(product_id)
        return jsonify({"prices": prices}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"Failed to retrieve prices: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/subscription/<subscriptionId>/financialAssistant", methods=["PUT"])
@require_client_principal  # Security: Enforce authentication
def financial_assistant(subscriptionId):
    """
    Add Financial Assistant to an existing subscription.

    Args:
        subscription_id (str): Unique Stripe Subscription ID
    Returns:
        JsonResponse: Response containing a new updated subscription with the new new Item
        Success format: {
            "data": {
                "message": "Financial Assistant added to subscription successfully.",
                 "subscription": {
                    "application": null, ...
                },
                status: 200
            }
        }

    Raises:
        BadRequest: If the request is invalid. HttpCode: 400
        NotFound: If the subscription is not found. HttpCode: 404
        Unauthorized: If client principal ID is missing. HttpCode: 401
    """
    if not subscriptionId or not isinstance(subscriptionId, str):
        raise BadRequest("Invalid subscription ID")

    # Logging: Info level for normal operations
    logging.info(f"Modifying subscription {subscriptionId} to add Financial Assistant")
    if not FINANCIAL_ASSISTANT_PRICE_ID:
        raise InvalidFinancialPriceError("Financial Assistant price ID not configured")

    try:
        updated_subscription = stripe.Subscription.modify(
            subscriptionId,
            items=[{"price": FINANCIAL_ASSISTANT_PRICE_ID}],
            metadata={
                "modified_by": request.headers.get("X-MS-CLIENT-PRINCIPAL-ID"),
                "modification_type": "add_financial_assistant",
                "modification_time": datetime.datetime.now().isoformat(),
            },
        )
        # Logging: Success confirmation
        logging.info(f"Successfully modified subscription {subscriptionId}")

        # Response Formatting: Clean, structured success response
        return create_success_response(
            {
                "message": "Financial Assistant added to subscription successfully.",
                "subscription": {
                    "id": updated_subscription.id,
                    "status": updated_subscription.status,
                    "current_period_end": updated_subscription.current_period_end,
                },
            }
        )

    # Error Handling: Specific error types with proper status codes
    except InvalidFinancialPriceError as e:
        # Logging: Error level for operation failures
        logging.error(f"Stripe invalid request error: {str(e)}")
        return create_error_response(
            f"Invalid subscription request: {str(e)}", HTTPStatus.NOT_FOUND
        )
    except stripe.error.InvalidRequestError as e:
                logging.error(f"Stripe API error: {str(e)}")
                return create_error_response(
            "Invalid Subscription ID", HTTPStatus.NOT_FOUND
        )
    except stripe.error.StripeError as e:
        # Logging: Error level for API failures
        logging.error(f"Stripe API error: {str(e)}")
        return create_error_response(
            "An error occurred while processing your request", HTTPStatus.BAD_REQUEST
        )

    except BadRequest as e:
        # Logging: Warning level for invalid requests
        logging.warning(f"Bad request: {str(e)}")
        return create_error_response(str(e), HTTPStatus.BAD_REQUEST)

    except Exception as e:
        # Logging: Exception level for unexpected errors
        logging.exception(f"Unexpected error: {str(e)}")
        return create_error_response(
            "An unexpected error occurred", HTTPStatus.INTERNAL_SERVER_ERROR
        )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
