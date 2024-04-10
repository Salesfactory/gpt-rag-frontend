import os
import mimetypes
import time
import logging
import requests
import json
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from urllib.parse import unquote

load_dotenv()

SPEECH_REGION = os.getenv('SPEECH_REGION')
ORCHESTRATOR_ENDPOINT = os.getenv('ORCHESTRATOR_ENDPOINT')
ORCHESTRATOR_URI = os.getenv('ORCHESTRATOR_URI', default="")
SETTINGS_ENDPOINT = ORCHESTRATOR_URI + "/settings"
FEEDBACK_ENDPOINT = ORCHESTRATOR_URI + "/feedback"
HISTORY_ENDPOINT = ORCHESTRATOR_URI + "/conversations"
STORAGE_ACCOUNT = os.getenv('STORAGE_ACCOUNT')
LOGLEVEL = os.environ.get('LOGLEVEL', 'INFO').upper()
logging.basicConfig(level=LOGLEVEL)

def get_secret(secretName):
    keyVaultName = os.environ["AZURE_KEY_VAULT_NAME"]
    KVUri = f"https://{keyVaultName}.vault.azure.net"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=KVUri, credential=credential)
    logging.info(f"[webbackend] retrieving {secretName} secret from {keyVaultName}.")   
    retrieved_secret = client.get_secret(secretName)
    return retrieved_secret.value

SPEECH_KEY = get_secret('speechKey')

SPEECH_RECOGNITION_LANGUAGE = os.getenv('SPEECH_RECOGNITION_LANGUAGE')
SPEECH_SYNTHESIS_LANGUAGE = os.getenv('SPEECH_SYNTHESIS_LANGUAGE')
SPEECH_SYNTHESIS_VOICE_NAME = os.getenv('SPEECH_SYNTHESIS_VOICE_NAME')

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
    client_principal_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    client_principal_name = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')
    logging.info("[webbackend] conversation_id: " + conversation_id)    
    logging.info("[webbackend] question: " + question)
    logging.info(f"[webbackend] User principal: {client_principal_id}")
    logging.info(f"[webbackend] User name: {client_principal_name}")

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = 'orchestrator-host--functionKey'
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--functionKey")
        return jsonify({"error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"}), 500
        
    try:
        url = ORCHESTRATOR_ENDPOINT
        payload = json.dumps({
            "conversation_id": conversation_id,
            "question": question,
            "client_principal_id": client_principal_id,
            "client_principal_name": client_principal_name
        })
        headers = {
            'Content-Type': 'application/json',
            'x-functions-key': functionKey            
        }
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")   
        return(response.text)
    except Exception as e:
        logging.exception("[webbackend] exception in /chatgpt")
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/get-chat-history", methods=["GET"])
def getChatHistory():
    client_principal_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = 'orchestrator-host--conversations'
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--functionKey")
        return jsonify({"error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"}), 500
    try:
        url = HISTORY_ENDPOINT
        headers = {
            'Content-Type': 'application/json',
            'x-functions-key': functionKey            
        }
        payload = json.dumps({
            "user_id": client_principal_id
        })
        response = requests.request("GET",url,headers=headers,data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")   
        return(response.text)
    except Exception as e:
        logging.exception("[webbackend] exception in /get-chat-history")
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/get-chat-conversation/<chat_id>", methods=["GET"])
def getChatConversation(chat_id):

    if chat_id is None:
        return jsonify({"error": "Missing chatId parameter"}), 400

    client_principal_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    try:
        keySecretName = 'orchestrator-host--conversations'
        functionKey = get_secret(keySecretName)
    except Exception as e:
        return jsonify({"error": f"Error getting function key: {e}"}), 500

    try:
        url = f"{HISTORY_ENDPOINT}/?id={chat_id}"
        headers = {
            'Content-Type': 'application/json',
            'x-functions-key': functionKey            
        }
        payload = json.dumps({
            "user_id": client_principal_id
        })
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")   
        
        return response.text, response.status_code
    except Exception as e:
        logging.exception("[webbackend] exception in /get-chat-history")
        return jsonify({"error": str(e)}), 500

# methods to provide access to speech services and blob storage account blobs

@app.route("/api/get-speech-token", methods=["GET"])
def getGptSpeechToken():
    try:
        fetch_token_url = f"https://{SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        headers = {
            'Ocp-Apim-Subscription-Key': SPEECH_KEY,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        response = requests.post(fetch_token_url, headers=headers)
        access_token = str(response.text)
        return json.dumps({'token': access_token, 'region': SPEECH_REGION, 'speechRecognitionLanguage': SPEECH_RECOGNITION_LANGUAGE, 'speechSynthesisLanguage': SPEECH_SYNTHESIS_LANGUAGE, 'speechSynthesisVoiceName': SPEECH_SYNTHESIS_VOICE_NAME})
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-speech-token")
        return jsonify({"error": str(e)}), 500

@app.route("/api/get-storage-account", methods=["GET"])
def getStorageAccount():
    if STORAGE_ACCOUNT is None or STORAGE_ACCOUNT == '':
        return jsonify({"error": "Add STORAGE_ACCOUNT to frontend app settings"}), 500
    try:
        return json.dumps({'storageaccount': STORAGE_ACCOUNT})
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-storage-account")
        return jsonify({"error": str(e)}), 500

@app.route("/api/get-blob", methods=["POST"])
def getBlob():
    logging.exception ("------------------ENTRA ------------")
    blob_name = unquote(request.json["blob_name"])
    try:
        client_credential = DefaultAzureCredential()
        blob_service_client = BlobServiceClient(
            f"https://{STORAGE_ACCOUNT}.blob.core.windows.net",
            client_credential
        )
        blob_client = blob_service_client.get_blob_client(container='documents', blob=blob_name)
        blob_data = blob_client.download_blob()
        blob_text = blob_data.readall()
        return Response(blob_text, content_type='application/octet-stream')
    except Exception as e:
        logging.exception("[webbackend] exception in /api/get-blob")
        logging.exception(blob_name)
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/settings", methods=["GET"])
def getSettings():
    client_principal_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    client_principal_name = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')

    if not client_principal_id or not client_principal_name:
        return jsonify({"error": "Missing required parameters, client_principal_id or client_principal_name"}), 400

    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = 'orchestrator-host--settings'
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--functionKey")
        return jsonify({"error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"}), 500

    try:
        url = SETTINGS_ENDPOINT
        payload = json.dumps({
            "client_principal_id": client_principal_id,
            "client_principal_name": client_principal_name
        })
        headers = {
            'Content-Type': 'application/json',
            'x-functions-key': functionKey            
        }
        response = requests.request("GET", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")   
        return(response.text)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500

@app.route("/api/settings", methods=["POST"])
def setSettings():
    client_principal_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    client_principal_name = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')

    if not client_principal_id or not client_principal_name:
        return jsonify({"error": "Missing required parameters, client_principal_id or client_principal_name"}), 400

    temperature = request.json["temperature"]
    presence_penalty = request.json["presence_penalty"]
    frequency_penalty = request.json["frequency_penalty"]
    
    if not temperature or not presence_penalty or not frequency_penalty:
        return jsonify({"error": "Missing required parameters, temperature, presence_penalty or frequency_penalty"}), 400
    
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = 'orchestrator-host--settings'
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--functionKey")
        return jsonify({"error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"}), 500

    try:
        url = SETTINGS_ENDPOINT
        payload = json.dumps({
            "client_principal_id": client_principal_id,
            "client_principal_name": client_principal_name,
            "temperature": temperature,
            "presence_penalty": presence_penalty,
            "frequency_penalty": frequency_penalty
        })
        headers = {
            'Content-Type': 'application/json',
            'x-functions-key': functionKey            
        }
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")   
        return(response.text)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/settings")
        return jsonify({"error": str(e)}), 500
    

@app.route("/api/feedback", methods=["POST"])
def setFeedback():
    client_principal_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    client_principal_name = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')

    if not client_principal_id or not client_principal_name:
        return jsonify({"error": "Missing required parameters, client_principal_id or client_principal_name"}), 400

    conversation_id = request.json["conversation_id"]
    question = request.json["question"]
    answer = request.json["answer"]
    category = request.json["category"]
    feedback = request.json["feedback"]
    rating = request.json["rating"]
    
    if not conversation_id or not question or not answer or not category:
        return jsonify({"error": "Missing required parameters, temperature, presence_penalty or frequency_penalty"}), 400
    
    try:
        # keySecretName is the name of the secret in Azure Key Vault which holds the key for the orchestrator function
        # It is set during the infrastructure deployment.
        keySecretName = 'orchestrator-host--feedback'
        functionKey = get_secret(keySecretName)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/orchestrator-host--feedback")
        return jsonify({"error": f"Check orchestrator's function key was generated in Azure Portal and try again. ({keySecretName} not found in key vault)"}), 500

    try:
        url = FEEDBACK_ENDPOINT
        payload = json.dumps({
            "conversation_id": conversation_id,
            "question": question,
            "answer": answer,
            "category": category,
            "feedback": feedback,
            "rating": rating,
        })
        headers = {
            'Content-Type': 'application/json',
            'x-functions-key': functionKey            
        }
        response = requests.request("POST", url, headers=headers, data=payload)
        logging.info(f"[webbackend] response: {response.text[:500]}...")   
        return(response.text)
    except Exception as e:
        logging.exception("[webbackend] exception in /api/feedback")
        return jsonify({"error": str(e)}), 500

    
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8000)
