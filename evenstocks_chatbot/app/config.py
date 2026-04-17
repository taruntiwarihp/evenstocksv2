import os
from dotenv import load_dotenv

load_dotenv("../.env")

ANTHROPIC_API_KEY: str = os.environ["ANTHROPIC_API_KEY"]
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
MODEL: str = os.getenv("MODEL", "claude-sonnet-4-20250514")
MAX_TOKENS: int = int(os.getenv("MAX_TOKENS", "4096"))

SYSTEM_PROMPT = (
    "You are a helpful, friendly AI assistant. Be concise but thorough. "
    "Use markdown formatting when helpful. For code, always specify the language."
)
