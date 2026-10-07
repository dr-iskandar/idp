# tf.py

from flask import Blueprint, render_template, session, current_app
from flask_login import login_required, current_user
from models import UserAuth

tf_bp = Blueprint('tf', __name__, template_folder='templates', static_folder='static')

@tf_bp.route('/')
@login_required
def dsa():
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('tf_dashboard.html', user_id=user_id)

@tf_bp.route('/details/<record_id>')
@login_required
def details(record_id):
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('tf_details.html', user_id=user_id, record_id=record_id)

