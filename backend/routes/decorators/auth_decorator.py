import os
from functools import wraps
from flask import current_app

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_instance = current_app.config.get("auth")
        if not os.getenv("ENVIRONMENT") == "TEST":
            return auth_instance.login_required(f)(*args, **kwargs)
        return f(*args, **kwargs)
    return decorated_function