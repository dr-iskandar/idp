# home.py

from flask import Blueprint, render_template, session, current_app
from flask_login import login_required, current_user
from models import UserAuth

home_bp = Blueprint('home', __name__, template_folder='templates', static_folder='static')

@home_bp.route('/')
@login_required
def home():
    user_id = current_user.id
    user_auth = UserAuth.query.filter_by(id=user_id).first()
    if user_auth:
        session['API_TOKEN'] = user_auth.token
    else:
        session['API_TOKEN'] = None
    return render_template('home.html', user_id=user_id)