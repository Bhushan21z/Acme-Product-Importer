import os
import uuid
from flask import Flask, request, jsonify
from db import Base, engine, SessionLocal
from models import Product
from tasks import process_csv_job, redis, redis_key
from config import UPLOAD_FOLDER, REDIS_URL

# create uploads folder
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ensure tables exist
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

# health
@app.get("/health")
def health():
    return {"status": "ok"}, 200

# upload -> enqueue job
@app.post("/upload")
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "File must be a CSV"}), 400

    # generate unique filename to avoid collisions
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file.save(filepath)

    # create job id and set initial progress in redis
    job_id = uuid.uuid4().hex
    redis.hset(f"progress:{job_id}", mapping={
        "status": "uploaded",
        "filename": unique_name,
        "processed": "0",
        "total": "0",
        "last_message": "uploaded",
        "error": ""
    })

    # enqueue celery task
    process_csv_job.delay(job_id, unique_name)

    return jsonify({"message": "file uploaded", "filename": unique_name, "job_id": job_id}), 202

# progress route to return redis data
@app.get("/progress")
def get_progress():
    job_id = request.args.get("job_id")
    if not job_id:
        return jsonify({"error": "job_id required"}), 400
    key = f"progress:{job_id}"
    data = redis.hgetall(key)
    if not data:
        return jsonify({"error": "job not found"}), 404
    # convert numeric fields
    try:
        total = int(data.get("total", "0"))
    except:
        total = 0
    try:
        processed = int(data.get("processed", "0"))
    except:
        processed = 0
    percent = 0
    if total > 0:
        percent = round((processed / total) * 100, 2)
    data["percent"] = percent
    return jsonify(data), 200

# products listing (same as before)
@app.get("/products")
def get_products():
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        results = [{"id": p.id, "name": p.name, "sku": p.sku, "description": p.description, "active": p.active} for p in products]
        return jsonify({"count": len(results), "products": results}), 200
    finally:
        db.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
