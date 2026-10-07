# config.py

import os
import secrets
from datetime import timedelta

class Config:
    SECRET_KEY = secrets.token_hex(16)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql+psycopg2://postgres:123456@localhost:5432/docidp'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_TYPE = 'filesystem' 
    API_TOKEN = secrets.token_hex(16)
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcyNDMyMDAzOSwiaWF0IjoxNzI0MzIwMDM5fQ.3hCdBEdlSwJbaMWyzRQluubOCut4HgO7xWQ20UVy_uM'
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  
    API_TOKEN_HEADER = 'IDP-API-Key'
    REMEMBER_COOKIE_DURATION = timedelta(minutes=30)
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=30)