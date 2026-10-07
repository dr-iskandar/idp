from flask import Blueprint, request, jsonify
from models import db, CompanyAuth, UserAuth, TradeFinance, FaasBs, FaasFs
from datetime import datetime, timedelta
from sqlalchemy import desc
from ..utils import get_authenticated_user, custom_auth_required
from sqlalchemy.orm import aliased
from sqlalchemy import func

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/v1/limit', methods=['GET'])
@custom_auth_required
def get_user_analytics():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"status_code": "FAILED", "message": "User not found"}), 404

        if user.role != "operational":
            return jsonify({"status_code": "FAILED", "message": "Operational access required"}), 403
        
        company = CompanyAuth.query.get(user.companyId)
        if not company:
            return jsonify({"status_code": "FAILED", "message": "Company not found"}), 404
        
        limit = company.limit
        usage = company.usage

        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        # Create aliases for UserAuth to avoid ambiguity in joins
        UserAuth1 = aliased(UserAuth)
        UserAuth2 = aliased(UserAuth)
        UserAuth3 = aliased(UserAuth)

        # Query recent TradeFinance entries
        trade_finance_history = db.session.query(TradeFinance, UserAuth1.username).join(
            UserAuth1, TradeFinance.userId == UserAuth1.id
        ).filter(
            TradeFinance.companyId == company.id,
            TradeFinance.createdAt >= thirty_days_ago
        ).order_by(desc(TradeFinance.createdAt)).limit(10).all()

        # Query recent FaasBs entries
        faasbs_history = db.session.query(FaasBs, UserAuth2.username).join(
            UserAuth2, FaasBs.userId == UserAuth2.id
        ).filter(
            FaasBs.companyId == company.id,
            FaasBs.createdAt >= thirty_days_ago
        ).order_by(desc(FaasBs.createdAt)).limit(10).all()

        # Query recent FaasFs entries
        faasfs_history = db.session.query(FaasFs, UserAuth3.username).join(
            UserAuth3, FaasFs.userId == UserAuth3.id
        ).filter(
            FaasFs.companyId == company.id,
            FaasFs.createdAt >= thirty_days_ago
        ).order_by(desc(FaasFs.createdAt)).limit(10).all()

        # Combine and sort the history
        combined_history = (
            [{'type': 'TradeFinance', 'id': item.TradeFinance.id, 'title': item.TradeFinance.title, 'created_at': item.TradeFinance.createdAt, 'status': item.TradeFinance.status, 'username': item.username, 'pages': item.TradeFinance.totalPages} for item in trade_finance_history] +
            [{'type': 'FaasBs', 'id': item.FaasBs.id, 'title': item.FaasBs.title, 'created_at': item.FaasBs.createdAt, 'status': item.FaasBs.status, 'username': item.username, 'pages': item.FaasBs.totalPages} for item in faasbs_history] +
            [{'type': 'FaasFs', 'id': item.FaasFs.id, 'title': item.FaasFs.title, 'created_at': item.FaasFs.createdAt, 'status': item.FaasFs.status, 'username': item.username, 'pages': item.FaasFs.totalPages} for item in faasfs_history]
        )

        combined_history.sort(key=lambda x: x['created_at'], reverse=True)
        combined_history = combined_history[:10]

        response_data = {
            "statusCode": "SUCCESSFUL",
            "data": {
                "limit": limit,
                "usage": usage,
                "recent_history": combined_history
            }
        }
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error in get_user_analytics: {str(e)}")
        return jsonify({"status_code": "FAILED", "message": "An error occurred while fetching analytics data"}), 500
    

@analytics_bp.route('/v1/usage_summary', methods=['GET'])
@custom_auth_required
def get_usage_summary():
    try:
        user = get_authenticated_user()
        if not user:
            return jsonify({"status_code": "FAILED", "message": "User not found"}), 404

        if user.role != "operational":
            return jsonify({"status_code": "FAILED", "message": "Operational access required"}), 403
        
        company = CompanyAuth.query.get(user.companyId)
        if not company:
            return jsonify({"status_code": "FAILED", "message": "Company not found"}), 404
        
        # Query for FaasBs
        faasbs_summary = db.session.query(
            UserAuth.username,
            func.count(FaasBs.id).label('record_count'),
            func.sum(FaasBs.totalPages).label('page_count')
        ).join(FaasBs, UserAuth.id == FaasBs.userId)\
        .filter(FaasBs.companyId == company.id)\
        .group_by(UserAuth.username).all()

        # Query for FaasFs
        faasfs_summary = db.session.query(
            UserAuth.username,
            func.count(FaasFs.id).label('record_count'),
            func.sum(FaasFs.totalPages).label('page_count')
        ).join(FaasFs, UserAuth.id == FaasFs.userId)\
        .filter(FaasFs.companyId == company.id)\
        .group_by(UserAuth.username).all()

        # Query for TradeFinance
        tradefinance_summary = db.session.query(
            UserAuth.username,
            func.count(TradeFinance.id).label('record_count'),
            func.sum(TradeFinance.totalPages).label('page_count')
        ).join(TradeFinance, UserAuth.id == TradeFinance.userId)\
        .filter(TradeFinance.companyId == company.id)\
        .group_by(UserAuth.username).all()

        # Combine the results
        summary = {
            'FaasBs': [{'user': item[0], 'records': item[1], 'pages': item[2]} for item in faasbs_summary],
            'FaasFs': [{'user': item[0], 'records': item[1], 'pages': item[2]} for item in faasfs_summary],
            'TradeFinance': [{'user': item[0], 'records': item[1], 'pages': item[2]} for item in tradefinance_summary]
        }

        response_data = {
            "statusCode": "SUCCESSFUL",
            "data": summary
        }
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error in get_usage_summary: {str(e)}")
        return jsonify({"status_code": "FAILED", "message": "An error occurred while fetching summary data"}), 500
