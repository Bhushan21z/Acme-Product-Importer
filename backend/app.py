import os
import csv
from flask import Flask, request, jsonify
from sqlalchemy.exc import IntegrityError
from db import Base, engine, SessionLocal
from models import Product

UPLOAD_FOLDER = "uploads"

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create tables
Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}, 200


# -----------------------------------------------------
# 1. Upload Endpoint
# -----------------------------------------------------
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


# -----------------------------------------------------
# 2. PARSE Endpoint
# -----------------------------------------------------
@app.post("/parse")
def parse_csv():
    filename = request.json.get("filename")

    if not filename:
        return jsonify({"error": "filename is required"}), 400

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    db = SessionLocal()

    inserted = 0
    updated = 0
    failed_rows = []

    try:
        with open(filepath, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)

            expected_columns = {"name", "sku", "description"}
            if not expected_columns.issubset(reader.fieldnames):
                return jsonify({"error": "CSV missing required columns"}), 400

            for idx, row in enumerate(reader, start=2):
                name = row.get("name", "").strip()
                sku = row.get("sku", "").strip()
                description = row.get("description", "").strip()

                if not sku or not name:
                    failed_rows.append(idx)
                    continue

                existing = db.query(Product).filter_by(sku=sku).first()

                if existing:
                    existing.name = name
                    existing.description = description
                    existing.active = True
                    updated += 1
                else:
                    p = Product(
                        name=name,
                        sku=sku,
                        description=description,
                        active=True
                    )
                    db.add(p)
                    inserted += 1

            db.commit()

        os.remove(filepath)

        return jsonify({
            "message": "CSV parsed and imported successfully",
            "inserted": inserted,
            "updated": updated,
            "failed_rows": failed_rows,
            "file_deleted": True
        }), 200

    except IntegrityError:
        db.rollback()
        return jsonify({"error": "Duplicate SKU found"}), 400

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()


# -----------------------------------------------------
# 3. GET /products  (NEW)
# -----------------------------------------------------
@app.get("/products")
def get_products():
    db = SessionLocal()
    try:
        products = db.query(Product).all()

        results = [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "description": p.description,
                "active": p.active
            }
            for p in products
        ]

        return jsonify({
            "count": len(results),
            "products": results
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        db.close()


# -----------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
