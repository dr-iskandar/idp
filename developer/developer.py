import secrets
import hashlib
import uuid
from flask import Blueprint, render_template, jsonify, request, session
from flask_login import login_required, current_user
from models import db, UserAuth, CompanyAuth, ApiKey, ApiRequestLog, FaasBs, FaasFs, TradeFinance

developer_bp = Blueprint('developer', __name__, template_folder='templates', static_folder='static')

@developer_bp.route('/')
@login_required
def portal():
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    return render_template('developer_portal.html')

@developer_bp.route('/v1/summary', methods=['GET'])
@login_required
def get_summary():
    try:
        company = CompanyAuth.query.get(current_user.companyId)
        if not company:
            return jsonify({"statusCode": "FAILED", "message": "Company not found"}), 404

        total_bs = FaasBs.query.filter_by(companyId=company.id).count()
        total_fs = FaasFs.query.filter_by(companyId=company.id).count()
        total_tf = TradeFinance.query.filter_by(companyId=company.id).count()
        total_executions = total_bs + total_fs + total_tf

        limit = company.limit if company.limit is not None else 5000
        usage = company.usage if company.usage is not None else total_executions
        balance = max(0, limit - usage)

        return jsonify({
            "statusCode": "SUCCESSFUL",
            "companyName": company.name,
            "hitBalance": balance,
            "hitLimit": limit,
            "usedHits": usage,
            "pricePerHit": 250, # Rp 250 / Hit
            "totalExecutions": total_executions,
            "successRate": "99.8%"
        }), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500

@developer_bp.route('/v1/keys/list', methods=['GET'])
@login_required
def list_keys():
    try:
        keys = ApiKey.query.filter_by(companyId=current_user.companyId).order_by(ApiKey.createdAt.desc()).all()
        result = []
        for k in keys:
            result.append({
                "id": k.id,
                "name": k.name,
                "keyPrefix": k.keyPrefix,
                "status": k.status,
                "lastUsedAt": k.lastUsedAt.strftime("%Y-%m-%d %H:%M:%S") if k.lastUsedAt else "Never",
                "createdAt": k.createdAt.strftime("%Y-%m-%d %H:%M:%S") if k.createdAt else "-"
            })
        return jsonify({"statusCode": "SUCCESSFUL", "keys": result}), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500

@developer_bp.route('/v1/keys/create', methods=['POST'])
@login_required
def create_key():
    try:
        data = request.get_json() or {}
        name = data.get("name", "").strip() or "Default API Key"

        raw_secret = "doc_live_" + secrets.token_hex(16)
        key_prefix = raw_secret[:12] + "..."
        key_hash = hashlib.sha256(raw_secret.encode("utf-8")).hexdigest()

        new_key = ApiKey(
            id=str(uuid.uuid4()),
            companyId=current_user.companyId,
            name=name,
            keyPrefix=key_prefix,
            keyHash=key_hash,
            status="Active"
        )
        db.session.add(new_key)
        db.session.commit()

        return jsonify({
            "statusCode": "SUCCESSFUL",
            "message": "API Key successfully created",
            "apiKey": raw_secret,
            "keyName": name,
            "keyPrefix": key_prefix
        }), 201
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500

@developer_bp.route('/v1/keys/revoke', methods=['POST'])
@login_required
def revoke_key():
    try:
        data = request.get_json() or {}
        key_id = data.get("keyId")
        if not key_id:
            return jsonify({"statusCode": "FAILED", "message": "Key ID is required"}), 400

        target_key = ApiKey.query.filter_by(id=key_id, companyId=current_user.companyId).first()
        if not target_key:
            return jsonify({"statusCode": "FAILED", "message": "API Key not found"}), 404

        target_key.status = "Revoked"
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "API Key revoked successfully"}), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500

@developer_bp.route('/v1/keys/delete', methods=['DELETE', 'POST'])
@login_required
def delete_key():
    try:
        data = request.get_json() or {}
        key_id = data.get("keyId") or request.args.get("keyId")
        if not key_id:
            return jsonify({"statusCode": "FAILED", "message": "Key ID is required"}), 400

        target_key = ApiKey.query.filter_by(id=key_id, companyId=current_user.companyId).first()
        if not target_key:
            return jsonify({"statusCode": "FAILED", "message": "API Key not found"}), 404

        db.session.delete(target_key)
        db.session.commit()

        return jsonify({"statusCode": "SUCCESSFUL", "message": "API Key deleted successfully"}), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500

@developer_bp.route('/v1/logs/list', methods=['GET'])
@login_required
def list_logs():
    try:
        logs = ApiRequestLog.query.filter_by(companyId=current_user.companyId).order_by(ApiRequestLog.createdAt.desc()).limit(50).all()
        result = []
        for l in logs:
            result.append({
                "id": l.id,
                "endpoint": l.endpoint,
                "method": l.method,
                "statusCode": l.statusCode,
                "latencyMs": l.latencyMs,
                "hitsCount": l.hitsCount,
                "createdAt": l.createdAt.strftime("%Y-%m-%d %H:%M:%S") if l.createdAt else "-"
            })
        return jsonify({"statusCode": "SUCCESSFUL", "logs": result}), 200
    except Exception as e:
        return jsonify({"statusCode": "FAILED", "message": str(e)}), 500
