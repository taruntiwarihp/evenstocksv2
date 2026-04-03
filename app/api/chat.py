import json
import anthropic
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import MODEL, MAX_TOKENS, SYSTEM_PROMPT
from app.session import ChatSession

router = APIRouter()
client = anthropic.Anthropic()


@router.websocket("/ws/chat")
async def chat_ws(ws: WebSocket):
    await ws.accept()
    session = ChatSession()

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            action = data.get("action", "message")

            if action == "stop":
                session.cancel_event.set()
                continue

            if action == "clear":
                session.clear()
                await ws.send_json({"type": "cleared"})
                continue

            if action == "message":
                user_text = data.get("content", "").strip()
                if not user_text:
                    continue

                session.add("user", user_text)
                session.cancel_event.clear()

                await ws.send_json({"type": "stream_start"})

                full_response = ""
                input_tokens = 0
                output_tokens = 0

                try:
                    with client.messages.stream(
                        model=MODEL,
                        max_tokens=MAX_TOKENS,
                        system=SYSTEM_PROMPT,
                        messages=session.messages,
                    ) as stream:
                        for event in stream:
                            if session.cancel_event.is_set():
                                full_response += "\n\n*(generation stopped)*"
                                stream.close()
                                break

                            if hasattr(event, "type") and event.type == "content_block_delta":
                                chunk = event.delta.text
                                full_response += chunk
                                await ws.send_json({"type": "stream_delta", "content": chunk})

                        final = stream.get_final_message()
                        input_tokens = final.usage.input_tokens
                        output_tokens = final.usage.output_tokens

                except anthropic.APIError as e:
                    full_response = f"⚠️ API Error: {e.message}"
                    await ws.send_json({"type": "stream_delta", "content": full_response})

                if full_response:
                    session.add("assistant", full_response)

                await ws.send_json({
                    "type": "stream_end",
                    "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
