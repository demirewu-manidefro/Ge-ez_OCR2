from flask import Flask, request, render_template, jsonify
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import io
import cv2
import numpy as np
import os

app = Flask(__name__)

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


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
