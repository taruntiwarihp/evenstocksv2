"""
Claude Chatbot — FastAPI + WebSocket + Anthropic Streaming
==========================================================
Install:  pip install -r requirements.txt
Run:      uvicorn main:app --reload --port 8000
Open:     http://localhost:8000
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.config import HOST, PORT

FRONTEND_DIR = Path(__file__).parent / "frontend"

app = FastAPI(title="Claude Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend static assets (css, js) under /static
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# Register API routers
app.include_router(chat_router)
app.include_router(health_router)


@app.get("/")
async def serve_ui():
    return FileResponse(FRONTEND_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
