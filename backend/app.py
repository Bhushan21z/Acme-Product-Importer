import os
import uuid
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from db import Base, engine, SessionLocal
from models import Product
from tasks import process_csv_job, redis, redis_key, set_progress
from config import UPLOAD_FOLDER, REDIS_URL

# create uploads folder
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ensure tables exist
# Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

# Redis set name for jobs
JOBS_SET = "import_jobs"

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
    now = int(time.time())
    redis.hset(redis_key(job_id), mapping={
        "status": "uploaded",
        "filename": unique_name,
        "processed": "0",
        "total": "0",
        "last_message": "uploaded",
        "error": "",
        "created_at": str(now),
        "updated_at": str(now),
        "retries": "0"
    })

    # add to jobs set so we can list later
    redis.sadd(JOBS_SET, job_id)

    # enqueue celery task
    process_csv_job.delay(job_id, unique_name)

    return jsonify({"message": "file uploaded", "filename": unique_name, "job_id": job_id}), 202

# progress route to return redis data
@app.get("/progress")
def get_progress():
    job_id = request.args.get("job_id")
    if not job_id:
        return jsonify({"error": "job_id required"}), 400
    key = redis_key(job_id)
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

# list all scheduled import tasks
@app.get("/scheduled-tasks")
def list_scheduled_tasks():
    job_ids = list(redis.smembers(JOBS_SET) or [])
    tasks = []
    for jid in job_ids:
        data = redis.hgetall(redis_key(jid))
        if not data:
            # stale id: remove from set
            redis.srem(JOBS_SET, jid)
            continue
        tasks.append({
            "job_id": jid,
            "status": data.get("status", ""),
            "filename": data.get("filename", ""),
            "processed": int(data.get("processed", "0") or 0),
            "total": int(data.get("total", "0") or 0),
            "last_message": data.get("last_message", ""),
            "error": data.get("error", ""),
            "created_at": int(data.get("created_at", "0") or 0),
            "updated_at": int(data.get("updated_at", "0") or 0),
            "retries": int(data.get("retries", "0") or 0),
        })
    # sort by created_at desc
    tasks.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return jsonify({"tasks": tasks}), 200

# single task info (alias for progress but returns consistent structure)
@app.get("/task/<job_id>")
def get_task(job_id: str):
    key = redis_key(job_id)
    data = redis.hgetall(key)
    if not data:
        return jsonify({"error": "task not found"}), 404
    # prepare typed response
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
    resp = {
        "job_id": job_id,
        "status": data.get("status", ""),
        "filename": data.get("filename", ""),
        "processed": processed,
        "total": total,
        "last_message": data.get("last_message", ""),
        "error": data.get("error", ""),
        "percent": percent,
        "created_at": int(data.get("created_at", "0") or 0),
        "updated_at": int(data.get("updated_at", "0") or 0),
        "retries": int(data.get("retries", "0") or 0)
    }
    return jsonify(resp), 200

# retry a failed job
@app.post("/retry/<job_id>")
def retry_job(job_id: str):
    key = redis_key(job_id)
    data = redis.hgetall(key)
    if not data:
        return jsonify({"error": "task not found"}), 404
    status = data.get("status", "")
    filename = data.get("filename", "")
    filepath = os.path.join(UPLOAD_FOLDER, filename) if filename else None

    if status != "failed":
        return jsonify({"error": "only failed jobs can be retried"}), 400

    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "csv file for job not found, cannot retry"}), 400

    # increment retries counter
    redis.hincrby(key, "retries", 1)
    now = int(time.time())
    redis.hset(key, mapping={
        "status": "queued",
        "processed": "0",
        "last_message": "retry queued",
        "error": "",
        "updated_at": str(now)
    })

    # re-enqueue
    process_csv_job.delay(job_id, filename)
    return jsonify({"message": "retry queued", "job_id": job_id}), 202

# products listing (same as before)
@app.get("/products")
def list_products():
    db = SessionLocal()
    try:
        # Query params
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))

        sku = request.args.get("sku")
        name = request.args.get("name")
        description = request.args.get("description")
        active = request.args.get("active")  # true/false

        query = db.query(Product)

        if sku:
            query = query.filter(Product.sku.ilike(f"%{sku}%"))
        if name:
            query = query.filter(Product.name.ilike(f"%{name}%"))
        if description:
            query = query.filter(Product.description.ilike(f"%{description}%"))
        if active in ["true", "false"]:
            query = query.filter(Product.active == (active == "true"))

        total = query.count()
        products = query.offset((page - 1) * limit).limit(limit).all()

        return jsonify({
            "page": page,
            "limit": limit,
            "total": total,
            "products": [
                {
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "description": p.description,
                    "active": p.active
                }
                for p in products
            ]
        }), 200
    finally:
        db.close()

@app.post("/products")
def create_product():
    data = request.json
    required = ["name", "sku"]

    if any(field not in data for field in required):
        return jsonify({"error": "name & sku required"}), 400

    db = SessionLocal()
    try:
        product = Product(
            name=data["name"],
            sku=data["sku"],
            description=data.get("description", ""),
            active=data.get("active", True)
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        return jsonify({"message": "Product created", "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "description": product.description,
            "active": product.active
        }}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        db.close()

@app.put("/products/<int:product_id>")
def update_product(product_id):
    data = request.json
    db = SessionLocal()
    try:
        product = db.query(Product).filter_by(id=product_id).first()
        if not product:
            return jsonify({"error": "Product not found"}), 404

        product.name = data.get("name", product.name)
        product.sku = data.get("sku", product.sku)
        product.description = data.get("description", product.description)
        product.active = data.get("active", product.active)

        db.commit()
        db.refresh(product)

        return jsonify({"message": "Product updated"}), 200

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        db.close()

@app.delete("/products/<int:product_id>")
def delete_product(product_id):
    db = SessionLocal()
    try:
        product = db.query(Product).filter_by(id=product_id).first()
        if not product:
            return jsonify({"error": "Product not found"}), 404

        db.delete(product)
        db.commit()

        return jsonify({"message": "Product deleted"}), 200
    finally:
        db.close()

@app.delete("/products")
def delete_all_products():
    db = SessionLocal()
    try:
        db.query(Product).delete()
        db.commit()
        return jsonify({"message": "All products deleted"}), 200
    finally:
        db.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
