import os
import csv
import uuid
import tempfile
import shutil
import time
from celery import Celery
from redis import Redis
from sqlalchemy.dialects.postgresql import insert
from config import REDIS_URL, CHUNK_SIZE, UPLOAD_FOLDER, DATABASE_URL
from db import SessionLocal, engine
from models import Product

# Celery
celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.task_soft_time_limit = 1800  # 30m task soft limit; tune as needed

# Redis client (for progress)
redis = Redis.from_url(REDIS_URL, decode_responses=True)

def redis_key(job_id):
    return f"progress:{job_id}"

def set_progress(job_id, **kwargs):
    key = redis_key(job_id)
    # add updated_at automatically
    if "updated_at" not in kwargs:
        kwargs["updated_at"] = str(int(time.time()))
    redis.hset(key, mapping=kwargs)

def update_progress_inc(job_id, field, n=1):
    redis.hincrby(redis_key(job_id), field, n)
    # update timestamp
    redis.hset(redis_key(job_id), "updated_at", str(int(time.time())))

def get_progress(job_id):
    data = redis.hgetall(redis_key(job_id))
    return data

# Helper: remove first n data rows (not header)
def remove_first_n_rows(filepath, n):
    # Read header + remainder, write remainder (skipping first n data rows)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".csv")
    os.close(tmp_fd)
    try:
        with open(filepath, newline="", encoding="utf-8") as src, open(tmp_path, "w", newline="", encoding="utf-8") as out:
            reader = csv.reader(src)
            writer = csv.writer(out)
            try:
                header = next(reader)
            except StopIteration:
                # empty file
                return
            writer.writerow(header)
            skipped = 0
            for row in reader:
                if skipped < n:
                    skipped += 1
                    continue
                writer.writerow(row)
        # replace original
        shutil.move(tmp_path, filepath)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

# Upsert function using SQLAlchemy Core insert...on_conflict
def upsert_products(session, rows):
    """
    rows: list of dicts with keys: name, sku, description, active
    """
    products_table = Product.__table__
    stmt = insert(products_table).values(rows)
    update_cols = {c.name: getattr(stmt.excluded, c.name) for c in products_table.c if c.name not in ("id", "created_at")}
    stmt = stmt.on_conflict_do_update(index_elements=["sku"], set_=update_cols)
    session.execute(stmt)

@celery_app.task(bind=True)
def process_csv_job(self, job_id, filename):
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    # initialize progress
    set_progress(job_id,
                 status="queued",
                 filename=filename,
                 processed="0",
                 total="0",
                 last_message="queued",
                 error="")

    if not os.path.exists(filepath):
        set_progress(job_id, status="failed", last_message="file not found", error="file not found")
        return {"error": "file not found"}

    # Count total rows (excluding header) for accurate progress
    try:
        with open(filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            total = 0
            for row in reader:
                name = (row.get("name") or "").strip()
                sku = (row.get("sku") or "").strip()
                if name and sku:
                    total += 1
    except Exception as e:
        set_progress(job_id, status="failed", last_message="count failed", error=str(e))
        return {"error": str(e)}

    set_progress(job_id, status="parsing", total=str(total), processed="0", last_message="starting parsing")

    processed = 0
    db = SessionLocal()
    try:
        while True:
            # Read next CHUNK_SIZE rows from file (preserve header)
            rows_chunk = []
            with open(filepath, newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                # read CHUNK_SIZE rows into list
                for i, row in enumerate(reader):
                    if i >= CHUNK_SIZE:
                        break
                    rows_chunk.append(row)

            if not rows_chunk:
                # nothing to process
                break

            set_progress(job_id, status="processing", last_message=f"parsing rows {processed+1}-{processed+len(rows_chunk)}")

            # validate and prepare rows for upsert
            prepared = []
            errors = []
            for idx, r in enumerate(rows_chunk, start=1):
                name = (r.get("name") or "").strip()
                sku = (r.get("sku") or "").strip()
                description = (r.get("description") or "").strip()
                if not sku or not name:
                    errors.append({"row_index": processed + idx, "reason": "missing name or sku"})
                    continue
                prepared.append({
                    "name": name,
                    "sku": sku,
                    "description": description,
                    "active": True
                })

            if prepared:
                # upsert
                try:
                    upsert_products(db, prepared)
                    db.commit()
                except Exception as e:
                    db.rollback()
                    set_progress(job_id, status="failed", last_message="db error", error=str(e))
                    return {"error": str(e)}

            # update counts
            processed += len(rows_chunk)
            update_progress_inc(job_id, "processed", len(rows_chunk))
            # record last message for UI
            set_progress(job_id, last_message=f"updated rows {processed - len(rows_chunk)+1}-{processed}")

            # Remove first N rows (N = len(rows_chunk)) from file
            try:
                remove_first_n_rows(filepath, len(rows_chunk))
            except Exception as e:
                # if file rewrite fails, mark failed
                set_progress(job_id, status="failed", last_message="file rewrite failed", error=str(e))
                return {"error": str(e)}

            # continue loop until file empty
        # finished
        set_progress(job_id, status="complete", last_message="Import complete", error="")
        # delete file
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
            set_progress(job_id, last_message="file deleted")
        except Exception:
            # non-fatal
            set_progress(job_id, last_message="import complete, failed to delete file")

        return {"status": "complete", "processed": processed}

    except Exception as e:
        db.rollback()
        set_progress(job_id, status="failed", last_message="unexpected error", error=str(e))
        raise
    finally:
        db.close()
