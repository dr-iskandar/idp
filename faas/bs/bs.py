# bs.py

from flask import Blueprint, render_template, session, current_app
from flask_login import login_required, current_user
from models import UserAuth

bs_bp = Blueprint('bs', __name__, template_folder='templates', static_folder='static')

@bs_bp.route('/')
@login_required
def dashboard():
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('dashboard.html', user_id=user_id)

@bs_bp.route('/details/<statement_id>')
@login_required
def details(statement_id):
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('details.html', user_id=user_id, statement_id=statement_id)