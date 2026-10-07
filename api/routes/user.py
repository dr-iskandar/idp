#routes/user.py
import random

from flask import Blueprint, request, jsonify
from models import db, bcrypt, UserAuth, CompanyAuth
from flask_login import login_user, logout_user, login_required
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from ..utils import generate_id, require_api_key, jwt_and_api_key_required, custom_auth_required, get_authenticated_user, try_decrypt
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

user_bp = Blueprint('user', __name__)


def send_otp_via_email(email, otp):
    # Email configuration
    sender_email = "angelpatriciads7@gmail.com"  # Replace with your email
    sender_password = "ygtk ypyc qopn oakl"  # Replace with your email password
    smtp_server = "smtp.gmail.com"  # Replace with your SMTP server
    smtp_port = 587  # Replace with your SMTP port

    # Create the email message
    message = MIMEMultipart()
    message['From'] = sender_email
    message['To'] = email
    message['Subject'] = "Your One-Time Password (OTP)"

    # Email body
    body = f"""
    Dear User,

    Your One-Time Password (OTP) is: {otp}

    This OTP is valid for 5 minutes. Please do not share it with anyone.

    If you didn't request this OTP, please ignore this email.

    Best regards,
    WideIDP
    """

    message.attach(MIMEText(body, 'plain'))

    try:
        # Create a secure SSL/TLS connection
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            # Login to the email server
            server.login(sender_email, sender_password)
            # Send the email
            server.sendmail(sender_email, email, message.as_string())
        print(f"OTP sent successfully to {email}")
    except Exception as e:
        print(f"Failed to send OTP: {str(e)}")


def get_password_age(updated_at):
    return (datetime.utcnow() - updated_at).days

def is_password_expired(updated_at):
    return get_password_age(updated_at) > 90

def days_until_expiration(updated_at):
    return max(90 - get_password_age(updated_at), 0)

@user_bp.route('/v1/detail', methods=['GET'])
@custom_auth_required
def get_user_detail():
    user = get_authenticated_user()
    if not user:
        return jsonify({"statusCode": "FAILED", "message": "User not found"}), 404
    
    user_details = {
        "id": user.id,
        "username": user.username,
        "role":user.role
    }
    return jsonify({"status_code": "SUCCESSFUL", "user_details": user_details}), 200


def generate_otp():
    return str(random.randint(100000, 999999))

@user_bp.route('/v1/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if data.get('plt')=="app":
        username = try_decrypt(username)
        password = try_decrypt(password)
    user = UserAuth.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password, password):
        if is_password_expired(user.updatedAt):
            return jsonify({
                'status_code': "FAILED",
                'message': 'Password expired. Please contact WideIDP CS.'
            }), 401
            
        if "@" in username:  # If username is an email
            otp = generate_otp()
            user.otp = otp
            user.otpExpiration = datetime.utcnow() + timedelta(minutes=5)
            db.session.commit()
            send_otp_via_email(username, otp)
            return jsonify({
                'status_code': "OTP_REQUIRED",
                'message': 'OTP sent to your email.'
            }), 200
        login_user(user)
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        if data.get('plt')!="app":
            logout_user()
        response_data = {
            'status_code': "SUCCESSFUL",
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role
        }
        days_left = days_until_expiration(user.updatedAt)
        if 5 <= days_left <= 14:
            response_data['warning'] = f'Your password will expire in {days_left} days. Please change it soon.'
        
        if data.get('plt') != "app":
            logout_user()
        
        return jsonify(response_data), 200
    
    return jsonify({'status_code': "FAILED", 'message': 'Invalid credentials'}), 401

@user_bp.route('/v1/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200

@user_bp.route('/v1/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user)
    return jsonify({
        'status_code': "SUCCESSFUL",
        'access_token': new_access_token
    }), 200
    
@user_bp.route('/v1/refresh_api_key', methods=['POST'])
@jwt_required()
def refresh_api_key():
    current_user_id = get_jwt_identity()
    user = UserAuth.query.get(current_user_id)
    if not user:
        return jsonify({"status_code": "FAILED", "message": "User not found"}), 404
    
    new_token = generate_id()
    user.token = new_token
    db.session.commit()
    
    return jsonify({
        "status_code": "SUCCESSFUL",
        "new_api_key": new_token
    }), 200
    
@user_bp.route('/v1/change_password', methods=['POST'])
@custom_auth_required
def change_password():
    user = get_authenticated_user()
    if not user:
        return jsonify({"status_code": "FAILED", "message": "User not found"}), 404
    
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    if data.get('plt')=="app":
        current_password = try_decrypt(current_password)
        new_password = try_decrypt(new_password)
    
    if not current_password or not new_password:
        return jsonify({"status_code": "FAILED", "message": "Both current and new passwords are required"}), 400
    
    if not bcrypt.check_password_hash(user.password, current_password):
        return jsonify({"status_code": "FAILED", "message": "Current password is incorrect"}), 401
    
    # Password validation
    if len(new_password) < 12:
        return jsonify({"status_code": "FAILED", "message": "Password must be at least 12 characters long"}), 400
    
    if ' ' in new_password:
        return jsonify({"status_code": "FAILED", "message": "Password cannot contain spaces"}), 400
    
    if not (any(c.isalpha() for c in new_password) and 
            any(c.isdigit() for c in new_password) and 
            any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in new_password)):
        return jsonify({"status_code": "FAILED", "message": "Password must contain a combination of letters, numbers, and special characters"}), 400
    user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    try:
        db.session.add(user)
        db.session.commit()
        print("After commit - password hash:", user.password)
        
        # Verify the change in the database
        db.session.refresh(user)
        print("After refresh - password hash:", user.password)
        
    except Exception as e:
        db.session.rollback()
        print(f"Error committing to database: {str(e)}")
        return jsonify({"status_code": "FAILED", "message": "Database error"}), 500
    
    
    return jsonify({"status_code": "SUCCESSFUL", "message": "Password changed successfully"}), 200


@user_bp.route('/v1/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    username = data.get('username')
    otp = data.get('otp')
    
    user = UserAuth.query.filter_by(username=username).first()
    
    if user and str(user.otp) == str(otp) and datetime.utcnow() <= user.otpExpiration:
        login_user(user)
        user.otp = None
        user.otpExpiration = None
        db.session.commit()
        
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        return jsonify({
            'status_code': "SUCCESSFUL",
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role
        }), 200
    
    return jsonify({'status_code': "FAILED", 'message': 'Invalid OTP or OTP expired'}), 401