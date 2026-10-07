# documentation.py

from flask import Blueprint, render_template

documentation_bp = Blueprint('documentation', __name__, template_folder='templates', static_folder='static')

@documentation_bp.route('/')
def index():
    return render_template('documentation.html')