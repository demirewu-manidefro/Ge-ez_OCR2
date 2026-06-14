from datetime import datetime
from app import db

class OCRDataset(db.Model):
    __tablename__ = 'ocr_dataset'

    id = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String(255), nullable=False)
    predicted_text = db.Column(db.Text, nullable=False)
    ground_truth = db.Column(db.Text, nullable=True)
    confidence_score = db.Column(db.Float, nullable=True)
    model_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'image_path': self.image_path,
            'predicted_text': self.predicted_text,
            'ground_truth': self.ground_truth,
            'confidence_score': self.confidence_score,
            'model_name': self.model_name,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self):
        return f'<OCRDataset {self.id}: {self.image_path}>'
