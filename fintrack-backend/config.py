import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))

SECTORS_API_KEY = os.getenv("SECTORS_API_KEY")

# Kunci OpenRouter untuk endpoint /api/chat. Dibaca dari .env, tidak pernah
# ditulis di kode: berkas ini ikut masuk repositori, sedangkan .env tidak.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Demo lewat `expo start --web` berjalan di browser sehingga butuh CORS,
# sementara Expo Go di HP tidak. Default "*" aman untuk demo lokal karena
# backend hanya menyajikan data pasar publik tanpa cookie maupun kredensial.
# Isi beberapa origin dipisah koma bila ingin membatasinya.
_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*")
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in _cors_origins.split(",") if origin.strip()
]
