from flask import Blueprint

api_bp = Blueprint('api', __name__)

from .routes.user import user_bp
from .routes.bs import bs_bp
from .routes.fs import fs_bp
from .routes.tf import tf_bp
from .routes.analytics import analytics_bp
from .routes.administrator import administrator_bp
from .routes.playground import playground_api_bp

api_bp.register_blueprint(administrator_bp, url_prefix='/administrator')
api_bp.register_blueprint(user_bp, url_prefix='/user')
api_bp.register_blueprint(analytics_bp, url_prefix='/analytics')
api_bp.register_blueprint(bs_bp, url_prefix='/faas/bs')
api_bp.register_blueprint(tf_bp, url_prefix='/tf')
api_bp.register_blueprint(fs_bp, url_prefix='/faas/fs')
api_bp.register_blueprint(playground_api_bp, url_prefix='/playground')


