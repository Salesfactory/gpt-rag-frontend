import base64
import json
import logging
import re
from datetime import datetime, timedelta, timezone

import markdown
from azure.storage.blob import (
    BlobServiceClient,
    BlobSasPermissions,
    ContentSettings,
    generate_blob_sas,
)

from _secrets import get_secret
from shared.blob_storage import BlobStorageManager
from shared.clients import get_blob_service_client
from utils import get_conversation


def extract_image_urls_from_markdown(text):
    """
    Extract image URLs from markdown text.
    Matches: ![alt text](image_url)
    """
    if not text:
        return []

    pattern = r"!\[([^\]]*)\]\(([^\)]+)\)"
    return re.findall(pattern, text)


def fetch_image_from_blob(image_path):
    """
    Fetch image bytes from Blob Storage.
    """
    try:
        blob_service_client = get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(
            container="documents", blob=image_path
        )
        image_data = blob_client.download_blob().readall()
        logging.info(
            "Successfully fetched image from container documents: %s", image_path
        )
        return image_data
    except Exception as e:
        logging.error("Error fetching image from blob storage (%s): %s", image_path, str(e))
        return None


def image_to_base64(image_data, image_path):
    """
    Convert image bytes to base64 data URI.
    """
    if not image_data:
        return None

    try:
        extension = image_path.lower().split(".")[-1]
        mime_types = {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
            "bmp": "image/bmp",
            "webp": "image/webp",
            "svg": "image/svg+xml",
        }
        mime_type = mime_types.get(extension, "image/png")
        base64_data = base64.b64encode(image_data).decode("utf-8")
        return f"data:{mime_type};base64,{base64_data}"
    except Exception as e:
        logging.error("Error converting image to base64: %s", str(e))
        return None


def embed_images_in_markdown(text):
    """
    Replace markdown image paths with base64 data URIs.
    """
    if not text:
        return text

    image_matches = extract_image_urls_from_markdown(text)
    if not image_matches:
        return text

    modified_text = text

    for alt_text, image_url in image_matches:
        logging.info("Processing image: %s", image_url)

        if image_url.startswith("http://") or image_url.startswith("https://"):
            logging.warning("Skipping external URL: %s", image_url)
            continue

        image_data = fetch_image_from_blob(image_url)
        if not image_data:
            logging.warning("Failed to fetch image from blob: %s", image_url)
            continue

        data_uri = image_to_base64(image_data, image_url)
        if not data_uri:
            logging.warning("Failed to convert image to base64: %s", image_url)
            continue

        old_pattern = f"![{alt_text}]({image_url})"
        new_pattern = f"![{alt_text}]({data_uri})"
        modified_text = modified_text.replace(old_pattern, new_pattern)
        logging.info("Successfully embedded image: %s", image_url)

    return modified_text


def parse_markdown_to_html(text):
    """
    Convert markdown content to HTML.
    """
    if not text:
        return ""

    text = embed_images_in_markdown(text)

    md = markdown.Markdown(
        extensions=[
            "fenced_code",
            "tables",
            "toc",
            "nl2br",
            "sane_lists",
        ]
    )
    return md.convert(text)


def format_conversation_as_html(conversation_data):
    """
    Convert conversation data to exportable HTML.
    """
    html_template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shared Conversation</title>
        <style>
            * {{
                box-sizing: border-box;
            }}

            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 900px;
                margin: 0 auto;
                padding: 32px;
                background-color: #fafbfc;
                color: #1f2937;
                line-height: 1.6;
                min-height: 100vh;
            }}

            .conversation-header {{
                background: white;
                padding: 32px;
                border-radius: 16px;
                margin-bottom: 32px;
                border: 1px solid #e5e7eb;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }}

            .conversation-header h1 {{
                margin: 0 0 20px 0;
                font-size: 28px;
                font-weight: 600;
                color: #111827;
                letter-spacing: -0.025em;
            }}

            .conversation-header p {{
                margin: 8px 0;
                color: #6b7280;
                font-size: 15px;
                font-weight: 500;
            }}

            .conversation-header strong {{
                color: #374151;
                font-weight: 600;
            }}

            .message {{
                background: white;
                margin: 20px 0;
                padding: 24px;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }}

            .message:hover {{
                border-color: #d1d5db;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                transform: translateY(-1px);
            }}

            .user-message {{
                background: #f8fafc;
                border-left: 3px solid #3b82f6;
                margin-left: 32px;
            }}

            .freddaid-message {{
                background: #f9fafb;
                border-left: 3px solid #6b7280;
                margin-right: 32px;
            }}

            .role {{
                font-weight: 600;
                font-size: 13px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                letter-spacing: 0.025em;
                color: #374151;
                text-transform: uppercase;
            }}

            .role::before {{
                content: '';
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #9ca3af;
            }}

            .user-message .role::before {{
                background: #3b82f6;
            }}

            .freddaid-message .role::before {{
                background: #6b7280;
            }}

            .content {{
                line-height: 1.7;
                color: #1f2937;
                font-size: 15px;
                font-weight: 400;
            }}

            .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {{
                margin: 20px 0 12px 0;
                font-weight: 600;
                color: #111827;
                line-height: 1.3;
            }}

            .content h1 {{ font-size: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }}
            .content h2 {{ font-size: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }}
            .content h3 {{ font-size: 18px; }}
            .content h4 {{ font-size: 16px; }}
            .content h5 {{ font-size: 15px; }}
            .content h6 {{ font-size: 14px; }}

            .content p {{
                margin: 12px 0;
            }}

            .content strong {{
                font-weight: 600;
                color: #111827;
            }}

            .content em {{
                font-style: italic;
                color: #374151;
            }}

            .content code {{
                background-color: #f3f4f6;
                color: #dc2626;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                border: 1px solid #e5e7eb;
            }}

            .content pre {{
                background-color: #1f2937;
                color: #f9fafb;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 16px 0;
                border: 1px solid #374151;
            }}

            .content pre code {{
                background: none;
                color: inherit;
                padding: 0;
                border: none;
                font-size: 14px;
            }}

            .content ul, .content ol {{
                margin: 12px 0;
                padding-left: 24px;
            }}

            .content li {{
                margin: 6px 0;
                line-height: 1.6;
            }}

            .content ul li {{
                list-style-type: disc;
            }}

            .content ol li {{
                list-style-type: decimal;
            }}

            .content blockquote {{
                border-left: 4px solid #d1d5db;
                padding-left: 16px;
                margin: 16px 0;
                font-style: italic;
                color: #6b7280;
                background-color: #f9fafb;
                padding: 12px 16px;
                border-radius: 4px;
            }}

            .content a {{
                color: #3b82f6;
                text-decoration: none;
                border-bottom: 1px solid transparent;
                transition: border-color 0.2s;
                display: none;
            }}

            .content a:hover {{
                border-bottom-color: #3b82f6;
            }}

            .content table {{
                border-collapse: collapse;
                width: 100%;
                margin: 16px 0;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                overflow: hidden;
            }}

            .content th, .content td {{
                border: 1px solid #e5e7eb;
                padding: 8px 12px;
                text-align: left;
            }}

            .content th {{
                background-color: #f9fafb;
                font-weight: 600;
                color: #374151;
            }}

            .content tr:nth-child(even) {{
                background-color: #f9fafb;
            }}

            .content hr {{
                border: none;
                height: 1px;
                background-color: #e5e7eb;
                margin: 24px 0;
            }}

            .content img {{
                max-width: 100%;
                height: auto;
                border-radius: 8px;
                margin: 16px 0;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                display: block;
            }}

            .timestamp {{
                color: #9ca3af;
                font-size: 12px;
                margin-top: 16px;
                font-weight: 500;
            }}

            .export-info {{
                background: #f3f4f6;
                padding: 16px 20px;
                border-radius: 12px;
                margin-bottom: 32px;
                font-size: 14px;
                color: #4b5563;
                border: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 500;
            }}

            .messages {{
                animation: fadeIn 0.6s ease-out;
            }}

            @keyframes fadeIn {{
                from {{ opacity: 0; transform: translateY(20px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}

            ::-webkit-scrollbar {{
                width: 6px;
            }}

            ::-webkit-scrollbar-track {{
                background: #f1f5f9;
            }}

            ::-webkit-scrollbar-thumb {{
                background: #cbd5e1;
                border-radius: 3px;
            }}

            ::-webkit-scrollbar-thumb:hover {{
                background: #94a3b8;
            }}

            @media (max-width: 768px) {{
                body {{
                    padding: 20px;
                }}

                .conversation-header {{
                    padding: 24px;
                }}

                .message {{
                    padding: 20px;
                }}

                .user-message {{
                    margin-left: 16px;
                }}

                .freddaid-message {{
                    margin-right: 16px;
                }}
            }}

            @media (max-width: 480px) {{
                .user-message {{
                    margin-left: 8px;
                }}

                .freddaid-message {{
                    margin-right: 8px;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="export-info">
            This conversation was exported on {export_date}
        </div>

        <div class="conversation-header">
            <h1>Conversation Export</h1>
            <p><strong>Started:</strong> {start_date}</p>
            <p><strong>Conversation ID:</strong> {conversation_id}</p>
            <p><strong>Total Messages:</strong> {message_count}</p>
        </div>

        <div class="messages">
            {messages_html}
        </div>
    </body>
    </html>
    """

    messages_html = ""
    messages = conversation_data.get("messages", [])
    for message in messages:
        role = message.get("role", "unknown")
        content = message.get("content", "")
        formatted_content = parse_markdown_to_html(content)

        css_class = "user-message" if role == "user" else "freddaid-message"
        role_display = "User" if role == "user" else "PRO-ACTIVE"

        messages_html += f"""
        <div class="message {css_class}">
            <div class="role">{role_display}</div>
            <div class="content">{formatted_content}</div>
        </div>
        """

    return html_template.format(
        export_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        start_date=conversation_data.get("start_date", "Unknown"),
        conversation_id=conversation_data.get("id", "Unknown"),
        message_count=len(messages),
        messages_html=messages_html,
    )


def format_conversation_as_json(conversation_data):
    """
    Convert conversation data to formatted JSON.
    """
    messages = conversation_data.get("messages", [])
    export_data = {
        "conversation_id": conversation_data.get("id"),
        "export_date": datetime.now().isoformat(),
        "start_date": conversation_data.get("start_date"),
        "message_count": len(messages),
        "messages": [],
    }

    for message in messages:
        export_message = {
            "role": message.get("role"),
            "content": message.get("content"),
        }
        export_data["messages"].append(export_message)

    return json.dumps(export_data, indent=2, ensure_ascii=False)


def upload_to_blob_storage(content, filename, user_id, content_type="text/html"):
    """
    Upload content to Azure Blob Storage and return a shareable URL.
    """
    try:
        blob_storage_manager = BlobStorageManager(
            default_container_name="shared-conversations"
        )
        blob_service_client = blob_storage_manager.blob_service_client
        connection_string = get_secret(
            "storageConnectionString", env_name="AZURE_STORAGE_CONNECTION_STRING"
        )
        sas_blob_service_client = BlobServiceClient.from_connection_string(
            connection_string
        )
        account_name = sas_blob_service_client.account_name
        account_key = getattr(sas_blob_service_client.credential, "account_key", None)
        if not account_key:
            raise ValueError(
                "Unable to read AccountKey from AZURE_STORAGE_CONNECTION_STRING"
            )

        container_name = "shared-conversations"
        blob_path = f"{user_id}/{filename}"

        try:
            blob_service_client.create_container(container_name)
        except Exception:
            pass

        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_path
        )
        blob_client.upload_blob(
            content,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )

        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_path,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(days=3652),
        )

        return f"{blob_client.url}?{sas_token}"
    except Exception as e:
        logging.error("Error uploading to blob storage: %s", str(e))
        raise


def export_conversation(conversation_id, user_id, export_format="html"):
    """
    Export a conversation file and upload it to Blob Storage.
    """
    try:
        conversation_data = get_conversation(conversation_id, user_id)
        if not conversation_data:
            raise ValueError("Conversation not found or access denied")

        conversation_data["id"] = conversation_id
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{conversation_id}/Freddaid_{timestamp}.{export_format}"

        if export_format.lower() == "html":
            content = format_conversation_as_html(conversation_data)
            content_type = "text/html"
        elif export_format.lower() == "json":
            content = format_conversation_as_json(conversation_data)
            content_type = "application/json"
        else:
            raise ValueError(f"Unsupported export format: {export_format}")

        share_url = upload_to_blob_storage(content, filename, user_id, content_type)

        return {
            "success": True,
            "share_url": share_url,
            "filename": filename,
            "format": export_format,
            "message_count": len(conversation_data.get("messages", [])),
            "export_date": datetime.now().isoformat(),
        }
    except Exception as e:
        logging.error("Error exporting conversation %s: %s", conversation_id, str(e))
        return {"success": False, "error": str(e)}