const msgBox = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");

let ws, streaming = false, currentBubble = null;

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/chat`);

  ws.onopen = () => {
    statusEl.textContent = "Online";
    statusEl.className = "status active";
    sendBtn.disabled = !inputEl.value.trim();
  };

  ws.onclose = () => {
    statusEl.textContent = "Disconnected";
    statusEl.className = "status";
    sendBtn.disabled = true;
    setTimeout(connect, 2000);
  };

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);

    if (data.type === "stream_start") {
      streaming = true;
      toggleButtons();
      currentBubble = addMessage("assistant", "");
      currentBubble.querySelector(".content").innerHTML = '<span class="cursor"></span>';
    }

    if (data.type === "stream_delta" && currentBubble) {
      const el = currentBubble.querySelector(".content");
      el.innerHTML = el.textContent + data.content;
      el.innerHTML += '<span class="cursor"></span>';
      msgBox.scrollTop = msgBox.scrollHeight;
    }

    if (data.type === "stream_end") {
      streaming = false;
      toggleButtons();
      if (currentBubble) {
        const cursor = currentBubble.querySelector(".cursor");
        if (cursor) cursor.remove();
      }
      currentBubble = null;
      inputEl.focus();
    }

    if (data.type === "cleared") {
      msgBox.innerHTML = "";
    }

    if (data.type === "error") {
      addMessage("assistant", "⚠️ " + data.message);
    }
  };
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerHTML = `
    <div class="avatar">${role === "user" ? "👤" : "🤖"}</div>
    <div class="body">
      <div class="role">${role === "user" ? "You" : "Claude"}</div>
      <div class="content">${text}</div>
    </div>`;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
  return div;
}

function send() {
  const text = inputEl.value.trim();
  if (!text || streaming) return;
  addMessage("user", text);
  ws.send(JSON.stringify({ action: "message", content: text }));
  inputEl.value = "";
  inputEl.style.height = "auto";
}

function stopGen() {
  ws.send(JSON.stringify({ action: "stop" }));
}

function clearChat() {
  ws.send(JSON.stringify({ action: "clear" }));
}

function toggleButtons() {
  sendBtn.style.display = streaming ? "none" : "flex";
  stopBtn.style.display = streaming ? "flex" : "none";
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
  sendBtn.disabled = !inputEl.value.trim();
}

inputEl.addEventListener("input", () => {
  sendBtn.disabled = !inputEl.value.trim();
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
});

connect();
