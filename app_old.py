from flask import Flask, request, render_template, jsonify, send_file
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import io
import cv2
import numpy as np
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

app = Flask(__name__)

# Disable browser caching
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

model_dir = "./geez_model_web_lite"
processor = TrOCRProcessor.from_pretrained(model_dir)
model = VisionEncoderDecoderModel.from_pretrained(model_dir)

temp_dir = "./temp_lines"
os.makedirs(temp_dir, exist_ok=True)


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
    for i, (x, y, w, h) in enumerate(lines):
        y_pad = max(0, y - 5)
        y_end_pad = min(img_bgr.shape[0], y + h + 5)
        line_img = img_bgr[y_pad:y_end_pad, :]
        line_img_rgb = cv2.cvtColor(line_img, cv2.COLOR_BGR2RGB)
        line_pil = Image.fromarray(line_img_rgb)
        line_images.append(line_pil)
        
        line_path = os.path.join(temp_dir, f"line_{i}.png")
        line_pil.save(line_path)
    
    return line_images


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/github")
def github():
    return render_template("github.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"})
        file = request.files["file"]
        image = Image.open(io.BytesIO(file.read())).convert("RGB")
        
        line_images = segment_lines(image)
        
        all_predictions = []
        for line_img in line_images:
            pixel_values = processor(images=line_img, return_tensors="pt").pixel_values
            generated_ids = model.generate(
                pixel_values,
                max_new_tokens=200,
                num_beams=1,
                use_cache=True,
                early_stopping=True
            )
            text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            all_predictions.append(text)
        
        final_text = "\n".join(all_predictions)
        return jsonify({"text": final_text})
    except Exception as e:
        return jsonify({"error": str(e)})


@app.route("/download_pdf", methods=["POST"])
def download_pdf():
    try:
        data = request.get_json()
        text = data.get("text", "")
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Add title
        title = Paragraph("<b>Ge'ez OCR Output</b>", styles["Title"])
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Add each line
        lines = text.split("\n")
        for line in lines:
            if line.strip():
                # Escape any HTML-like characters
                safe_line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                p = Paragraph(safe_line, styles["BodyText"])
                story.append(p)
            else:
                story.append(Spacer(1, 12))
        
        # Build the PDF
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name="geez_ocr_output.pdf",
            mimetype="application/pdf"
        )
    except Exception as e:
        print(f"PDF Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
