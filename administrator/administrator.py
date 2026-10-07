# administrator.py

from flask import Blueprint, render_template, session, current_app
from flask_login import login_required, current_user
from models import UserAuth

administrator_bp = Blueprint('administrator', __name__, template_folder='templates', static_folder='static')

@administrator_bp.route('/login', methods=['GET'])
def login():
    session['API_TOKEN'] = current_app.config['API_TOKEN']
    return render_template('administrator_login.html')

@administrator_bp.route('/')
@login_required
def administrator():
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('administrator_dashboard.html', user_id=user_id)

@administrator_bp.route('/details/<company_id>')
@login_required
def details(company_id):
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('administrator_company_detail.html', user_id=user_id,company_id=company_id)