# app.py
from flask import Flask, current_app, redirect, url_for
from config import Config
from models import db, bcrypt, UserAuth
from flask_login import LoginManager
from flask_session import Session
import logging
from flask_cors import CORS  
from api.api import api_bp
from auth.login.login import login_bp
from faas.bs.bs import bs_bp
from faas.fs.fs import fs_bp
from tf.tf import tf_bp
from home.home import home_bp
from administrator.administrator import administrator_bp
from documentation.documentation import documentation_bp
from playground.playground import playground_bp


from flask_jwt_extended import JWTManager

if __name__ == '__main__':
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app) 
    bcrypt.init_app(app)
    jwt = JWTManager(app)

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'login.login'

    Session(app)

    CORS(app, resources={r"/*": {"origins": "*"}})
    
    @app.route('/')
    def index():
        return redirect(url_for('login.login'))

    @login_manager.user_loader
    def load_user(user_id):
        with current_app.app_context():
            return db.session.get(UserAuth, user_id)
    
    app.json.sort_keys = False

    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(home_bp, url_prefix='/home')
    app.register_blueprint(login_bp, url_prefix='/login')
    app.register_blueprint(bs_bp, url_prefix='/bank-statement')
    app.register_blueprint(fs_bp, url_prefix='/financial-statement')
    app.register_blueprint(tf_bp, url_prefix='/trade-finance')
    app.register_blueprint(administrator_bp, url_prefix='/administrator')
    app.register_blueprint(documentation_bp, url_prefix='/documentation')
    app.register_blueprint(playground_bp, url_prefix='/playground')

    with app.app_context():
        db.create_all() 
    app.run(debug=True, host='0.0.0.0', port=3336)

