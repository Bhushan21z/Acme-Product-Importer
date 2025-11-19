import os
from flask import Flask, request, jsonify
from db import Base, engine
from models import Product

UPLOAD_FOLDER = "uploads"

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create tables on startup (temporary; Alembic later)
Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}, 200


# ---------------------------------------------
# File Upload Endpoint (previous step)
# ---------------------------------------------
@app.post("/upload")
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "File must be a CSV"}), 400

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
    file.save(filepath)

    return jsonify({
        "message": "File uploaded successfully",
        "filename": file.filename
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
