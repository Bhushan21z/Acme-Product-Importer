import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/productdb")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 50))
