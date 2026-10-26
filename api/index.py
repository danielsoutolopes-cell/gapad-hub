"""
GADAP Hub - ASGI Entrypoint for Vercel Serverless Functions (index.py fallback)
Exposes the FastAPI instance 'app' for Vercel Python runtime.
"""
import sys
from pathlib import Path

# Adiciona o diretorio raiz da API ao sys.path para garantir que imports 'app.*' funcionem
api_dir = str(Path(__file__).resolve().parent)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.main import app

__all__ = ["app"]
