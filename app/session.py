import asyncio
from datetime import datetime


class ChatSession:
    def __init__(self):
        self.messages: list[dict] = []
        self.created = datetime.now()
        self.cancel_event = asyncio.Event()

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def clear(self):
        self.messages.clear()
