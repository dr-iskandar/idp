from flask import Blueprint, render_template
from flask_login import login_required

playground_bp = Blueprint(
    'playground',
    __name__,
    template_folder='templates',
    static_folder='static'
)

@playground_bp.route('/')
@login_required
def playground_index():
    return render_template('playground.html')
