from flask import Flask, request, render_template, jsonify
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import io

app = Flask(__name__)

model_dir = "./geez_model_web_lite"
processor = TrOCRProcessor.from_pretrained(model_dir)
model = VisionEncoderDecoderModel.from_pretrained(model_dir)

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
        pixel_values = processor(images=image, return_tensors="pt").pixel_values
        generated_ids = model.generate(
            pixel_values,
            max_new_tokens=200,
            num_beams=1,
            use_cache=True,
            early_stopping=True
        )
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
