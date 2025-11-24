import pytest
from flask import Response, jsonify

@pytest.fixture
def client():
    from flask import Flask
    from shared.secure_response import secure_response
    app = Flask("test_app")
    app.after_request(secure_response)
    @app.route('/api/test-html')
    def api_test_html():
        return Response('<html>Login</html>', content_type='text/html; charset=utf-8')
    @app.route('/nonapi/test-html')
    def nonapi_test_html():     
        return Response('<html>Public</html>', content_type='text/html; charset=utf-8')
    @app.route('/api/test-json')
    def api_test_json():
        return jsonify({"ok": True})

    return app.test_client()

def test_api_html_converted_to_401(client):
    resp = client.get('/api/test-html')
    assert resp.status_code == 401
    data = resp.get_json()
    assert data is not None
    assert data.get('error') == 'Unauthorized'

def test_non_api_html_not_converted(client):
    resp = client.get('/nonapi/test-html')
    assert resp.status_code == 200
    assert b'Public' in resp.data
    assert resp.content_type.startswith('text/html')

def test_api_json_pass_through(client):
    resp = client.get('/api/test-json')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data == {"ok": True}