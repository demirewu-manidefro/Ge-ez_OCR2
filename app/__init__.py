from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os

# Initialize extensions
db = SQLAlchemy()

def create_app(config_class=None):
    # Load environment variables
    load_dotenv()

    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///geez_ocr.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', './static/uploads')
    app.config['CROP_FOLDER'] = os.getenv('CROP_FOLDER', './static/crops')
    app.config['MODEL_NAME'] = os.getenv('MODEL_NAME', 'trocr_v1')

    # Ensure directories exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['CROP_FOLDER'], exist_ok=True)

    # Initialize extensions
    db.init_app(app)

    # Import and register blueprints
    from app.routes import main
    app.register_blueprint(main.bp)

    # Create tables (in production you'd use migrations)
    with app.app_context():
        db.create_all()

    return app
