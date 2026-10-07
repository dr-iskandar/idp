from flask import Blueprint, render_template, session, current_app

login_bp = Blueprint('login', __name__, template_folder='templates', static_folder='static')

@login_bp.route('/', methods=['GET'])
def login():
    # Render the login page
    session['API_TOKEN'] = current_app.config['API_TOKEN']
    return render_template('login.html')
