import os
from functools import wraps
from flask import current_app

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_instance = current_app.config.get("auth")

        if os.getenv("ENVIRONMENT") != "TEST" and auth_instance:
            def wrapper_with_context(*a, context=None, **kw):
                return f(*a, **kw)
            return auth_instance.login_required(wrapper_with_context)(*args, **kwargs)

        return f(*args, **kwargs)

    return decorated_function