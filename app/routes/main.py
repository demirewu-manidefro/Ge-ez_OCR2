from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from PIL import Image
import numpy as np
import cv2
from app import db
from app.models import OCRDataset

bp = Blueprint('main', __name__)

# Keep our existing OCR model loaded globally for reuse
processor = None
model = None

def load_model():
    global processor, model
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    model_dir = current_app.config.get('MODEL_DIR', './geez_model_web_lite')
    if processor is None or model is None:
        processor = TrOCRProcessor.from_pretrained(model_dir)
        model = VisionEncoderDecoderModel.from_pretrained(model_dir)
    return processor, model

def segment_lines(image):
    img_array = np.array(image)
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 1))
    morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    lines = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if h > 10 and w > 50:
            lines.append((x, y, w, h))
    lines.sort(key=lambda x: x[1])
    
    line_images = []
    for idx, (x, y, w, h) in enumerate(lines):
        y_pad = max(0, y - 5)
        y_end_pad = min(img_bgr.shape[0], y + h + 5)
        line_img = img_bgr[y_pad:y_end_pad, :]
        line_img_rgb = cv2.cvtColor(line_img, cv2.COLOR_BGR2RGB)
        line_pil = Image.fromarray(line_img_rgb)
        line_images.append(line_pil)
    
    return line_images

@bp.route('/')
def index():
    from flask import render_template
    return render_template('index.html')

@bp.route('/about')
def about():
    from flask import render_template
    return render_template('about.html')

@bp.route('/github')
def github():
    from flask import render_template
    return render_template('github.html')

@bp.route('/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Save original image
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(upload_path)
        
        # Open and process image
        image = Image.open(upload_path).convert('RGB')
        line_images = segment_lines(image)
        
        # Load model and run predictions
        processor, model = load_model()
        
        results = []
        for idx, line_img in enumerate(line_images):
            # Generate unique filename for crop
            crop_filename = f"{uuid.uuid4()}_line_{idx}.png"
            crop_path = os.path.join(current_app.config['CROP_FOLDER'], crop_filename)
            line_img.save(crop_path)
            
            # Run prediction
            pixel_values = processor(images=line_img, return_tensors='pt').pixel_values
            generated_ids = model.generate(
                pixel_values,
                max_new_tokens=200,
                num_beams=1,
                use_cache=True,
                early_stopping=True
            )
            predicted_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            # Create database entry
            dataset_entry = OCRDataset(
                image_path=f"/static/crops/{crop_filename}",
                predicted_text=predicted_text,
                ground_truth=predicted_text,  # Set initial ground truth to prediction
                confidence_score=None,
                model_name=current_app.config['MODEL_NAME']
            )
            db.session.add(dataset_entry)
            
            results.append({
                'id': dataset_entry.id,
                'image_path': dataset_entry.image_path,
                'predicted_text': predicted_text
            })
        
        db.session.commit()
        
        return jsonify({
            'message': 'Image processed successfully',
            'results': results
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/save_label', methods=['POST'])
def save_label():
    data = request.get_json()
    if not data or 'id' not in data or 'ground_truth' not in data:
        return jsonify({'error': 'Missing required fields (id, ground_truth)'}), 400
    
    try:
        entry = OCRDataset.query.get(data['id'])
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404
        
        entry.ground_truth = data['ground_truth']
        db.session.commit()
        
        return jsonify({
            'message': 'Label saved successfully',
            'entry': entry.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/dataset', methods=['GET'])
def get_dataset():
    try:
        entries = OCRDataset.query.order_by(OCRDataset.created_at.desc()).all()
        return jsonify({
            'count': len(entries),
            'dataset': [entry.to_dict() for entry in entries]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/download_dataset', methods=['GET'])
def download_dataset():
    import zipfile
    import io
    import os
    from flask import send_file
    
    try:
        entries = OCRDataset.query.order_by(OCRDataset.created_at.desc()).all()
        
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for idx, entry in enumerate(entries):
                # Get the image path from static/crops
                img_filename = os.path.basename(entry.image_path)
                img_path = os.path.join(current_app.config['CROP_FOLDER'], img_filename)
                
                if os.path.exists(img_path):
                    # Add image to zip with simpler filename
                    arc_img_name = f"img_{idx}.png"
                    zipf.write(img_path, arcname=arc_img_name)
                    
                    # Add corresponding text file
                    txt_filename = f"img_{idx}.gt.txt"
                    txt_content = entry.ground_truth or ''
                    zipf.writestr(txt_filename, txt_content)
        
        zip_buffer.seek(0)
        
        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name='geez_ocr_dataset.zip',
            mimetype='application/zip'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Keep existing predict endpoint for backward compatibility
@bp.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        image = Image.open(file).convert('RGB')
        line_images = segment_lines(image)
        processor, model = load_model()
        
        all_predictions = []
        for line_img in line_images:
            pixel_values = processor(images=line_img, return_tensors='pt').pixel_values
            generated_ids = model.generate(
                pixel_values,
                max_new_tokens=200,
                num_beams=1,
                use_cache=True,
                early_stopping=True
            )
            text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            all_predictions.append(text)
        
        final_text = '\n'.join(all_predictions)
        return jsonify({'text': final_text}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Keep existing download_pdf endpoint for backward compatibility
@bp.route('/download_pdf', methods=['POST'])
def download_pdf():
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    import io
    
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        title = Paragraph("<b>Ge'ez OCR Output</b>", styles["Title"])
        story.append(title)
        story.append(Spacer(1, 12))
        
        lines = text.split('\n')
        for line in lines:
            if line.strip():
                safe_line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                p = Paragraph(safe_line, styles["BodyText"])
                story.append(p)
            else:
                story.append(Spacer(1, 12))
        
        doc.build(story)
        buffer.seek(0)
        
        from flask import send_file
        return send_file(
            buffer,
            as_attachment=True,
            download_name='geez_ocr_output.pdf',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
