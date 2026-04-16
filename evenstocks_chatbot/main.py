"""
EvenStocks AI — FastAPI + WebSocket + Anthropic Streaming
=========================================================
AI chatbot service with stock analysis via Claude API.
Frontend is served separately by evenstocks-react.

Install:  pip install -r requirements.txt
Run:      uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.stock_chat import router as stock_chat_router
from app.api.stock_detail import router as stock_detail_router
from app.api.health import router as health_router
from app.config import HOST, PORT

app = FastAPI(title="EvenStocks AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(chat_router)
app.include_router(stock_chat_router)
app.include_router(stock_detail_router)
app.include_router(health_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
