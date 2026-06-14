from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from dotenv import load_dotenv
import os

# Initialize extensions
db = SQLAlchemy()
login_manager = LoginManager()

def create_app(config_class=None):
    # Load environment variables
    load_dotenv()
    
    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    app = Flask(
        __name__,
        template_folder=os.path.join(base_dir, 'templates'),
        static_folder=os.path.join(base_dir, 'static')
    )

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
    login_manager.init_app(app)
    login_manager.login_view = 'main.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'error'

    # User loader
    from app.models import User
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Import and register blueprints
    from app.routes import main
    app.register_blueprint(main.bp)

    # Create tables (in production you'd use migrations)
    with app.app_context():
        db.create_all()
        try:
            inspector = db.inspect(db.engine)
            columns = [c['name'] for c in inspector.get_columns('users')]
            if 'role' not in columns:
                db.session.execute(db.text("ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'"))
                db.session.commit()
                print("Migration: Added 'role' column to 'users' table.")
        except Exception as e:
            db.session.rollback()
            print(f"Migration error: {e}")

    return app
