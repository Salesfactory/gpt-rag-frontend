import requests
import webbrowser
from urllib.parse import urlencode
import json

BASE_URL = "http://localhost:8000"


def test_auth_flow():
    # Get login URL
    login_response = requests.get(f"{BASE_URL}/api/auth/login")
    login_url = login_response.json()["loginUrl"]

    print("Opening browser for login...")
    print(login_url)
    webbrowser.open(login_url)

    # Wait for user to complete login
    print("\nAfter logging in, copy the code from the URL and paste it here:")
    code = input("Code: ")

    # Complete authentication
    callback_url = f"{BASE_URL}/api/auth/callback?code={code}"
    callback_response = requests.get(callback_url)

    if callback_response.status_code == 200:
        token = callback_response.json()["token"]

        # Test protected route
        protected_response = requests.get(
            f"{BASE_URL}/api/protected", headers={"Authorization": f"Bearer {token}"}
        )

        print("\nProtected Route Response:")
        print(json.dumps(protected_response.json(), indent=2))
    else:
        print("Authentication failed:", callback_response.json())


if __name__ == "__main__":
    test_auth_flow()
