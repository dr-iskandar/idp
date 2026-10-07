#utils.py

import uuid
import base64
import json
from flask import Flask, request, jsonify,session

from functools import wraps
from flask_jwt_extended import verify_jwt_in_request,get_jwt_identity
from models import UserAuth, bcrypt
from flask_login import current_user


def generate_id():
    return str(uuid.uuid4())

ALLOWED_EXTENSIONS = {'jpeg', 'jpg', 'png', 'pdf'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_extension(filename):
   return filename.rsplit('.', 1)[1].lower()

def encode_image(image_path):
  with open(image_path, "rb") as image_file:
    return base64.b64encode(image_file.read()).decode('utf-8')
  
def decode_response(response):
  prompt_tokens = response.usage.prompt_tokens
  completion_tokens = response.usage.completion_tokens
  json_response = json.loads(response.choices[0].message.content)
  return prompt_tokens, completion_tokens, json_response

    
def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('IDP-API-Key')
        if not api_key:
            return jsonify({"status_code": "FAILED", "message": "API Key is missing"}), 401
        user = UserAuth.query.filter_by(token=api_key).first()
        if not user:
            return jsonify({"status_code": "FAILED", "message": "Invalid API Key"}), 401
        return f(*args, **kwargs)
    return decorated

def jwt_and_api_key_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Verify JWT token
        try:
            verify_jwt_in_request()
        except Exception as e:
            return jsonify({"status_code": "FAILED", "message": "Invalid or missing JWT"}), 401

        # Verify API Key
        return require_api_key(f)(*args, **kwargs)
    return decorated

def get_authenticated_user():
    if current_user.is_authenticated:
        return current_user
    try:
        verify_jwt_in_request()
        jwt_identity = get_jwt_identity()
        api_key = request.headers.get('IDP-API-Key')

        if not api_key:
            return None

        user = UserAuth.query.filter_by(id=jwt_identity).first()
        if user.token.startswith("$2b$"):  
            try:
                if bcrypt.check_password_hash(user.token, api_key):
                    print("Authenticated using hashed token.")
                    return user
            except ValueError as e:
                print(f"Error during bcrypt verification: {str(e)}")
                return None
        else:
            if user.token == api_key:
                return user

        print("Invalid API Key.")
        return None
    except Exception as e:
        print(f"Error retrieving user from JWT: {str(e)}")
        return None
    
    
def custom_auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_authenticated_user()
        if user:
            return f(*args, **kwargs)
        else:
            return jsonify({
                "status_code": "FAILED", 
                "message": "Authentication failed. Please provide both valid JWT and matching API Key."
            }), 401

    return decorated


from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
import json
import base64

with open("private_key.pem", "rb") as f:
    private_key = serialization.load_pem_private_key(
        f.read(),
        password=None,
        backend=default_backend()
    )

with open("public_key.pem", "rb") as f:
    public_key = serialization.load_pem_public_key(
        f.read(),
        backend=default_backend()
    )

from datetime import datetime

def convert_to_string(data):
    if isinstance(data, (int, float, str)):
        return str(data)
    elif isinstance(data, datetime):
        return data.isoformat()  # ISO 8601 format for datetime
    else:
        raise ValueError(f"Unsupported data type: {type(data)}")

    
def encrypt(data):
    data_str = convert_to_string(data)
    json_bytes = data.encode('utf-8')
    encrypted_data = public_key.encrypt(
        json_bytes,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return base64.b64encode(encrypted_data).decode('utf-8')

def decrypt(encrypted_data):
    encrypted_data = base64.b64decode(encrypted_data)
    decrypted_data = private_key.decrypt(
        encrypted_data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    decrypted_string = decrypted_data.decode('utf-8')
    return decrypted_string

import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def try_decrypt(encrypted_title):
    try:
        return decrypt(encrypted_title)
    except Exception as e:
        # Optionally log the error for debugging purposes
        # logger.error(f"Decryption failed for title {encrypted_title}: {e}")
        return encrypted_title
