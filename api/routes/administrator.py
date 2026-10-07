#routes/administrator.py

from flask import Blueprint, request, jsonify
from models import db, bcrypt, UserAuth, CompanyAuth
from flask_login import login_user, logout_user, login_required
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from ..utils import generate_id, require_api_key, jwt_and_api_key_required, custom_auth_required, get_authenticated_user

administrator_bp = Blueprint('administrator', __name__)

@administrator_bp.route('/v1/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = UserAuth.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password, password):
        login_user(user)
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        if user.role!="administrator":
            return jsonify({"status_code": "FAILED", "message": "UNAUTHORIZED"}), 403
        if data.get('plt')!="app":
            logout_user()
        return jsonify({
            'status_code': "SUCCESSFUL",
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role
        }), 200
    
    return jsonify({'status_code': "FAILED", 'message': 'Invalid credentials'}), 401

@administrator_bp.route('/v1/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200


@administrator_bp.route('/v1/company', methods=['POST'])
@custom_auth_required
def create_company():
    try:
        user = get_authenticated_user()
        if not user or user.role != "administrator":
            return jsonify({"status_code": "FAILED", "message": "Administrator access required"}), 403
        data = request.get_json()
        id = generate_id()
        name = data['name']
        limit = data['limit']
        existing_company = CompanyAuth.query.filter_by(name=name).first()
        if existing_company:
            return jsonify({"status_code": "FAILED", "message": "Company name already exists"}), 409
        user = CompanyAuth(
            id=id,
            name=name,
            limit=limit,
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({"status_code": "SUCCESSFUL", "company_id": id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status_code": "FAILED", "message": "INTERNAL SERVER ERROR"}), 500

@administrator_bp.route('/v1/user', methods=['POST'])
@custom_auth_required
def create_user():
    try:
        user = get_authenticated_user()
        if not user or user.role != "administrator":
            return jsonify({"status_code": "FAILED", "message": "Administrator access required"}), 403
        
        data = request.get_json()
        if not data or not all(key in data for key in ('username', 'password')):
            return jsonify({"status_code": "FAILED", "message": "Invalid request data"}), 400
        
        id = generate_id()
        token = generate_id() 
        username = data['username']
        password = data['password']
        role = data['role']
        company_id = data['companyId']
        if UserAuth.query.filter_by(username=username).first():
            return jsonify({"status_code": "FAILED", "message": "Username already exists"}), 409
        company = CompanyAuth.query.get(company_id)
        if not company:
            return jsonify({"statusCode": "FAILED", "message": "Company not found"}), 404

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        hashed_token = bcrypt.generate_password_hash(token).decode('utf-8')
        user = UserAuth(
            id=id,
            username=username,
            password=hashed_password,
            token=hashed_token,
            role=role,
            companyId=company_id
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({"status_code": "SUCCESSFUL", "api_key": token}), 201
    except Exception as e:
        print(e)
        db.session.rollback()
        return jsonify({"status_code": "FAILED", "message": "INTERNAL SERVER ERROR"}), 500

@administrator_bp.route('/v1/companies', methods=['GET'])
@custom_auth_required
def get_company_list():
    try:
        user = get_authenticated_user()
        if not user or user.role != "administrator":
            return jsonify({"status_code": "FAILED", "message": "Administrator access required"}), 403
        
        companies = CompanyAuth.query.filter(CompanyAuth.name != "administrator").all()
        
        company_list = [{
            'createdAt': company.createdAt.strftime('%Y-%m-%d %H:%M:%S'),
            'id': company.id,
            'name': company.name,
            'limit': company.limit,
            'usage': company.usage,
            'percentage': f"{(company.usage / company.limit * 100) if company.limit > 0 else 0:.2f}%"
        } for company in companies]
        
        return jsonify({"status_code": "SUCCESSFUL", "companies": company_list}), 200
    except Exception as e:
        return jsonify({"status_code": "FAILED", "message": str(e)}), 500

@administrator_bp.route('/v1/company', methods=['GET'])
@custom_auth_required
def get_company_detail():
    try:
        user = get_authenticated_user()
        if not user or user.role != "administrator":
            return jsonify({"status_code": "FAILED", "message": "Administrator access required"}), 403
        
        company_id = request.args.get('companyId')
        if not company_id:
            return jsonify({"statusCode": "FAILED", "message": "Invalid request data"}), 400
        
        user_list = UserAuth.query.filter_by(companyId=company_id).all()

        if not user_list:
            return jsonify({"statusCode": "FAILED", "message": "No role found"}), 404
        
        user_list_serialized = [
            {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "createdAt": user.createdAt.strftime('%Y-%m-%d %H:%M:%S'),
                "updatedAt": user.updatedAt.strftime('%Y-%m-%d %H:%M:%S')
            }
            for user in user_list
        ]

        return jsonify({"statusCode": "SUCCESSFUL", "userRole": user_list_serialized}), 200
    except Exception as e:
        print(e)
        return jsonify({"statusCode": "FAILED", "message": "INTERNAL SERVER ERROR."}), 500
    
@administrator_bp.route('/v1/user/<user_id>', methods=['DELETE'])
@custom_auth_required
def delete_user(user_id):
    try:
        auth_user = get_authenticated_user()
        if not auth_user or auth_user.role != "administrator":
            return jsonify({"status_code": "FAILED", "message": "Administrator access required"}), 403
        
        user_to_delete = UserAuth.query.get(user_id)
        if not user_to_delete:
            return jsonify({"status_code": "FAILED", "message": "User not found"}), 404

        # Prevent deleting the last administrator
        if user_to_delete.role == "administrator":
            admin_count = UserAuth.query.filter_by(role="administrator").count()
            if admin_count <= 1:
                return jsonify({"status_code": "FAILED", "message": "Cannot delete the last administrator"}), 400

        db.session.delete(user_to_delete)
        db.session.commit()
        
        return jsonify({"status_code": "SUCCESSFUL", "message": "User deleted successfully"}), 200
    except Exception as e:
        print(e)
        db.session.rollback()
        return jsonify({"status_code": "FAILED", "message": "INTERNAL SERVER ERROR"}), 500
    
    
# Backend: Update your Flask routes file (e.g., routes.py)

# Backend: Update your Flask routes file (e.g., routes.py)

from sqlalchemy.exc import IntegrityError

@administrator_bp.route('/v1/company/<string:company_id>', methods=['DELETE'])
@custom_auth_required
def delete_company(company_id):
    try:
        auth_user = get_authenticated_user()
        if not auth_user or auth_user.role != "administrator":
            return jsonify({"status_code": "FAILED", "message": "Administrator access required"}), 403
        
        company = CompanyAuth.query.get(company_id)
        if not company:
            return jsonify({"status_code": "FAILED", "message": "Company not found"}), 404
        
        # Get all users associated with this company
        users_to_delete = UserAuth.query.filter_by(companyId=company_id).all()
        
        # Delete all associated users first
        for user in users_to_delete:
            db.session.delete(user)
        
        # Flush the session to ensure all user deletions are processed
        db.session.flush()
        
        # Now delete the company
        db.session.delete(company)
        
        # Commit the changes
        db.session.commit()
        
        return jsonify({
            "status_code": "SUCCESSFUL", 
            "message": f"Company '{company.name}' and {len(users_to_delete)} associated users deleted successfully"
        }), 200
    except IntegrityError as e:
        db.session.rollback()
        print(f"IntegrityError: {str(e)}")
        return jsonify({"status_code": "FAILED", "message": "Failed to delete company due to data integrity constraints"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Unexpected error: {str(e)}")
        return jsonify({"status_code": "FAILED", "message": "INTERNAL SERVER ERROR"}), 500
