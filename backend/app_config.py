# app_config.py
import os

# Flask configuration
SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "default-secret-key-change-in-production")
SESSION_TYPE = "filesystem"

# Azure AD B2C details
B2C_TENANT_NAME = os.getenv("AAD_TENANT_NAME")  # e.g. "contoso"
SIGNUPSIGNIN_USER_FLOW = os.getenv("AAD_POLICY_NAME")  # e.g. "B2C_1_signupsignin1"
EDITPROFILE_USER_FLOW = os.getenv(
    "EDITPROFILE_USER_FLOW"
)  # e.g. "B2C_1_profileediting1"
RESETPASSWORD_USER_FLOW = os.getenv(
    "RESETPASSWORD_USER_FLOW"
)  # e.g. "B2C_1_passwordreset1"

# Application (client) registration details
CLIENT_ID = os.getenv("AAD_CLIENT_ID")
CLIENT_SECRET = os.getenv("AAD_CLIENT_SECRET")

# Endpoint configuration
AUTHORITY = f"https://{B2C_TENANT_NAME}.b2clogin.com/{B2C_TENANT_NAME}.onmicrosoft.com"
REDIRECT_PATH = "/"  # The absolute URL must match your app's redirect_uri

# B2C policy configuration
B2C_POLICY = SIGNUPSIGNIN_USER_FLOW  # Default policy

# financial ingestion config.py
ALLOWED_FILING_TYPES = ["10-Q", "10-K", "8-K", "DEF 14A"]
FILING_TYPES = ["10-Q", "10-K", "8-K", "DEF 14A"]
BLOB_CONTAINER_NAME = "documents"
BASE_FOLDER = "financial"

# Paths in financial summarization
IMAGE_PATH = 'images'
PDF_PATH = './pdf'


