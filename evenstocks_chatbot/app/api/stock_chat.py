"""
stock_chat.py — WebSocket endpoint for stock analysis chatbot
"""

import json
import asyncio

import anthropic
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import MODEL, MAX_TOKENS
from app.session import ChatSession
from app.stock_db import get_conn, search_stocks, build_stock_context

router = APIRouter()

client = anthropic.Anthropic()

STOCK_SYSTEM_PROMPT = """You are an expert Indian stock market analyst. You analyze stocks listed on BSE/NSE.

When given stock data (company info, financial tables, documents), provide a thorough analytical report covering:

1. **Company Overview** — What the company does, sector, market position
2. **Key Metrics Analysis** — Interpret PE, ROCE, ROE, dividend yield, book value
3. **Financial Performance** — Revenue trends, profit growth, margins from quarterly/annual data
4. **Balance Sheet Health** — Debt levels, cash flow, leverage ratios
5. **Shareholding Pattern** — Promoter holding changes, FII/DII interest
6. **Strengths & Risks** — Based on pros/cons and financial data
7. **Overall Assessment** — Bull case vs bear case, suitability for different investor types

Use the actual numbers from the data provided. Be specific, not generic.
Format your response with clear markdown headers and bullet points.
If data is missing for any section, mention what's unavailable rather than guessing."""


@router.websocket("/ws/stock-chat")
async def stock_chat_ws(ws: WebSocket):
    await ws.accept()
    session = ChatSession()
    db_conn = get_conn()

    if not db_conn:
        await ws.send_json({
            "type": "error",
            "message": "Database not found. Run scrape_tables.py first.",
        })
        await ws.close()
        return

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            action = data.get("action", "message")

            # ── Stop generation ──────────────────────────────
            if action == "stop":
                session.cancel_event.set()
                continue

            # ── Clear chat ───────────────────────────────────
            if action == "clear":
                session.clear()
                await ws.send_json({"type": "cleared"})
                continue

            # ── Search stocks ────────────────────────────────
            if action == "search":
                query = data.get("query", "").strip()
                results = search_stocks(db_conn, query)
                await ws.send_json({
                    "type": "search_results",
                    "results": results,
                })
                continue

            # ── Analyze a stock ──────────────────────────────
            if action == "analyze":
                stock_name = data.get("stock_name", "").strip()
                if not stock_name:
                    continue

                context = build_stock_context(db_conn, stock_name)
                if not context:
                    await ws.send_json({
                        "type": "error",
                        "message": f"No data found for '{stock_name}'",
                    })
                    continue

                # Build the analysis prompt
                user_msg = (
                    f"Analyze the following stock and provide a detailed investment report:\n\n"
                    f"{context}"
                )
                session.clear()
                session.add("user", user_msg)
                session.cancel_event.clear()

                await ws.send_json({"type": "stream_start"})
                full_response = ""
                input_tokens = output_tokens = 0

                try:
                    with client.messages.stream(
                        model=MODEL,
                        max_tokens=MAX_TOKENS,
                        system=STOCK_SYSTEM_PROMPT,
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
                                await ws.send_json({
                                    "type": "stream_delta",
                                    "content": chunk,
                                })
                        final = stream.get_final_message()
                        input_tokens = final.usage.input_tokens
                        output_tokens = final.usage.output_tokens
                except anthropic.APIError as e:
                    full_response = f"API Error: {e.message}"
                    await ws.send_json({"type": "stream_delta", "content": full_response})

                if full_response:
                    session.add("assistant", full_response)

                await ws.send_json({
                    "type": "stream_end",
                    "usage": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                    },
                })
                continue

            # ── Follow-up question about current stock ───────
            if action == "message":
                user_text = data.get("content", "").strip()
                if not user_text:
                    continue

                session.add("user", user_text)
                session.cancel_event.clear()

                await ws.send_json({"type": "stream_start"})
                full_response = ""
                input_tokens = output_tokens = 0

                try:
                    with client.messages.stream(
                        model=MODEL,
                        max_tokens=MAX_TOKENS,
                        system=STOCK_SYSTEM_PROMPT,
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
                                await ws.send_json({
                                    "type": "stream_delta",
                                    "content": chunk,
                                })
                        final = stream.get_final_message()
                        input_tokens = final.usage.input_tokens
                        output_tokens = final.usage.output_tokens
                except anthropic.APIError as e:
                    full_response = f"API Error: {e.message}"
                    await ws.send_json({"type": "stream_delta", "content": full_response})

                if full_response:
                    session.add("assistant", full_response)

                await ws.send_json({
                    "type": "stream_end",
                    "usage": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                    },
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        if db_conn:
            db_conn.close()
