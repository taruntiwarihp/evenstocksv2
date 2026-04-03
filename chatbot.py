"""
AI Chatbot Backend — FastAPI + WebSocket + Anthropic Streaming
==============================================================
Install:  pip install fastapi uvicorn anthropic python-dotenv
Run:      uvicorn main:app --reload --port 8000
Open:     http://localhost:8000

Set your API key:
  export ANTHROPIC_API_KEY=sk-ant-...
  (or create a .env file with ANTHROPIC_API_KEY=sk-ant-...)
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="Claude Chatbot")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Anthropic client ───────────────────────────────────────────────
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

SYSTEM_PROMPT = (
    "You are a helpful, friendly AI assistant. Be concise but thorough. "
    "Use markdown formatting when helpful. For code, always specify the language."
)

# ─── In-memory chat history per connection ───────────────────────────
class ChatSession:
    def __init__(self):
        self.messages: list[dict] = []
        self.created = datetime.now()
        self.cancel_event = asyncio.Event()

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def clear(self):
        self.messages.clear()


# ─── WebSocket endpoint ─────────────────────────────────────────────
@app.websocket("/ws/chat")
async def chat_ws(ws: WebSocket):
    await ws.accept()
    session = ChatSession()

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            action = data.get("action", "message")

            # ── Stop generation ──────────────────────────────────
            if action == "stop":
                session.cancel_event.set()
                continue

            # ── Clear chat ───────────────────────────────────────
            if action == "clear":
                session.clear()
                await ws.send_json({"type": "cleared"})
                continue

            # ── Send message ─────────────────────────────────────
            if action == "message":
                user_text = data.get("content", "").strip()
                if not user_text:
                    continue

                session.add("user", user_text)
                session.cancel_event.clear()

                # Signal streaming start
                await ws.send_json({"type": "stream_start"})

                full_response = ""
                input_tokens = 0
                output_tokens = 0

                try:
                    # Stream from Anthropic
                    with client.messages.stream(
                        model="claude-sonnet-4-20250514",
                        max_tokens=2048,
                        system=SYSTEM_PROMPT,
                        messages=session.messages,
                    ) as stream:
                        for event in stream:
                            # Check if client requested a stop
                            if session.cancel_event.is_set():
                                full_response += "\n\n*(generation stopped)*"
                                stream.close()
                                break

                            if hasattr(event, "type"):
                                if event.type == "content_block_delta":
                                    chunk = event.delta.text
                                    full_response += chunk
                                    await ws.send_json({
                                        "type": "stream_delta",
                                        "content": chunk,
                                    })

                        # Get final usage stats
                        final = stream.get_final_message()
                        input_tokens = final.usage.input_tokens
                        output_tokens = final.usage.output_tokens

                except anthropic.APIError as e:
                    full_response = f"⚠️ API Error: {e.message}"
                    await ws.send_json({
                        "type": "stream_delta",
                        "content": full_response,
                    })

                # Save assistant response to history
                if full_response:
                    session.add("assistant", full_response)

                # Signal streaming complete
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
        except:
            pass


# ─── Health check ────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": "claude-sonnet-4-20250514"}


# ─── Serve the frontend ─────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    return HTML_UI


# ─── Frontend HTML ───────────────────────────────────────────────────
HTML_UI = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Chatbot</title>
<style>
  :root {
    --bg: #0d0d1a; --surface: rgba(255,255,255,0.04); --border: rgba(255,255,255,0.08);
    --text: #e0e0e0; --muted: #666; --accent: #7c6ef0; --accent2: #a78bfa;
    --user-bg: linear-gradient(135deg, #3b82f6, #6366f1);
    --stop-bg: linear-gradient(135deg, #ef4444, #dc2626);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between;
            padding: 12px 20px; border-bottom: 1px solid var(--border); }
  .header h1 { font-size: 16px; color: #fff; }
  .header .status { font-size: 11px; color: var(--muted); }
  .header .status.active { color: #4ade80; }
  .btn-clear { background: var(--surface); border: 1px solid var(--border); color: #888;
               padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; }

  /* Messages */
  .messages { flex: 1; overflow-y: auto; padding: 16px 20px; }
  .msg { display: flex; gap: 12px; margin-bottom: 16px; }
  .msg .avatar { width: 32px; height: 32px; border-radius: 8px; display: flex;
                 align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
  .msg.user .avatar { background: var(--user-bg); }
  .msg.assistant .avatar { background: rgba(124,110,240,0.15); }
  .msg .body { flex: 1; min-width: 0; }
  .msg .role { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
  .msg .content { font-size: 14px; line-height: 1.65; word-break: break-word; }
  .msg .content pre { background: #1a1a2e; border: 1px solid var(--border); border-radius: 8px;
                      padding: 12px; overflow-x: auto; margin: 8px 0; font-size: 13px; }
  .msg .content code { background: rgba(124,110,240,0.12); padding: 1px 5px; border-radius: 4px;
                       font-size: 0.9em; color: #c4b5fd; }
  .msg .content pre code { background: none; padding: 0; color: #e0e0e0; }

  .cursor { display: inline-block; width: 6px; height: 16px; background: var(--accent);
            border-radius: 1px; vertical-align: text-bottom;
            animation: blink 1s infinite; }
  @keyframes blink { 0%,50% { opacity:1 } 51%,100% { opacity:0 } }

  .dots { display: flex; gap: 4px; padding: 8px 0; }
  .dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
               animation: bounce 1.4s ease-in-out infinite; }
  .dots span:nth-child(2) { animation-delay: 0.16s; }
  .dots span:nth-child(3) { animation-delay: 0.32s; }
  @keyframes bounce { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-8px) } }

  /* Input */
  .input-area { padding: 12px 16px 16px; border-top: 1px solid var(--border); }
  .input-row { display: flex; gap: 8px; max-width: 780px; margin: 0 auto; align-items: flex-end; }
  .input-row textarea { flex: 1; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--border);
                        background: var(--surface); color: #fff; font-size: 14px; resize: none;
                        outline: none; font-family: inherit; line-height: 1.5; max-height: 120px; }
  .input-row textarea:focus { border-color: rgba(124,110,240,0.5); }
  .btn-send, .btn-stop { width: 44px; height: 44px; border-radius: 12px; border: none;
                          cursor: pointer; display: flex; align-items: center; justify-content: center;
                          flex-shrink: 0; color: #fff; transition: transform 0.15s; }
  .btn-send { background: linear-gradient(135deg, #7c6ef0, #6366f1); }
  .btn-send:disabled { background: var(--surface); color: #444; cursor: default; }
  .btn-stop { background: var(--stop-bg); }
  .btn-send:active, .btn-stop:active { transform: scale(0.93); }
  .footer { text-align: center; margin-top: 8px; font-size: 11px; color: #444; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>🤖 Claude Assistant</h1>
    <div class="status" id="status">Connecting...</div>
  </div>
  <button class="btn-clear" onclick="clearChat()">Clear</button>
</div>

<div class="messages" id="messages"></div>

<div class="input-area">
  <div class="input-row">
    <textarea id="input" rows="1" placeholder="Type a message... (Shift+Enter for new line)"
              onkeydown="handleKey(event)"></textarea>
    <button class="btn-send" id="sendBtn" onclick="send()" disabled>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/>
           <polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
    <button class="btn-stop" id="stopBtn" onclick="stopGen()" style="display:none">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2"/></svg>
    </button>
  </div>
  <div class="footer">Powered by Claude API via WebSocket · Real-time streaming</div>
</div>

<script>
  const msgBox = document.getElementById('messages');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusEl = document.getElementById('status');
  let ws, streaming = false, currentBubble = null;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/chat`);
    ws.onopen = () => { statusEl.textContent = 'Online'; statusEl.className = 'status active'; };
    ws.onclose = () => { statusEl.textContent = 'Disconnected'; statusEl.className = 'status';
                         setTimeout(connect, 2000); };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'stream_start') {
        streaming = true; toggleButtons();
        currentBubble = addMessage('assistant', '');
        currentBubble.querySelector('.content').innerHTML = '<span class="cursor"></span>';
      }
      if (data.type === 'stream_delta' && currentBubble) {
        const el = currentBubble.querySelector('.content');
        // Remove cursor, append text, re-add cursor
        el.innerHTML = el.textContent + data.content;
        el.innerHTML = el.innerHTML + '<span class="cursor"></span>';
        msgBox.scrollTop = msgBox.scrollHeight;
      }
      if (data.type === 'stream_end') {
        streaming = false; toggleButtons();
        if (currentBubble) {
          // Remove cursor
          const c = currentBubble.querySelector('.cursor');
          if (c) c.remove();
        }
        currentBubble = null;
        inputEl.focus();
      }
      if (data.type === 'cleared') { msgBox.innerHTML = ''; }
      if (data.type === 'error') { addMessage('assistant', '⚠️ ' + data.message); }
    };
  }

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.innerHTML = `
      <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="body">
        <div class="role">${role === 'user' ? 'You' : 'Claude'}</div>
        <div class="content">${text}</div>
      </div>`;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
    return div;
  }

  function send() {
    const text = inputEl.value.trim();
    if (!text || streaming) return;
    addMessage('user', text);
    ws.send(JSON.stringify({ action: 'message', content: text }));
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  function stopGen() {
    ws.send(JSON.stringify({ action: 'stop' }));
  }

  function clearChat() {
    ws.send(JSON.stringify({ action: 'clear' }));
  }

  function toggleButtons() {
    sendBtn.style.display = streaming ? 'none' : 'flex';
    stopBtn.style.display = streaming ? 'flex' : 'none';
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    sendBtn.disabled = !inputEl.value.trim();
  }

  inputEl.addEventListener('input', () => {
    sendBtn.disabled = !inputEl.value.trim();
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  connect();
</script>
</body>
</html>
"""

# ─── Run directly ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)