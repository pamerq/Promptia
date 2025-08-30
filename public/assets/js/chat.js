import { chatStream } from "./api.js";

/** Widget de chat desacoplado del transporte (usa chatStream) */
export class ChatWidget {
  constructor(opts = {}) {
    this.$open   = document.querySelector(opts.openBtn  ?? "#open-chat");
    this.$panel  = document.querySelector(opts.panel    ?? "#chat-panel");
    this.$close  = document.querySelector(opts.closeBtn ?? "#chat-close");
    this.$log    = document.querySelector(opts.log      ?? "#chat-log");
    this.$input  = document.querySelector(opts.input    ?? "#chat-input");
    this.$send   = document.querySelector(opts.sendBtn  ?? "#chat-send");

    this.userLabel = opts.userLabel ?? "Tú";
    this.botLabel  = opts.botLabel  ?? "B";

    this.history = [];
    this.maxHistory = opts.maxHistory ?? 30;
    this.controller = null;

    if (!this.$panel || !this.$log || !this.$input || !this.$send) {
      throw new Error("Faltan elementos requeridos del chat en el DOM.");
    }
    this._bind();
  }

  _bind() {
    this.$open && (this.$open.onclick = () => this.open());
    this.$close && (this.$close.onclick = () => this.close());

    this.$send.onclick = () => this._sendFromInput();
    this.$input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._sendFromInput(); }
    });
  }

  open(){ this.$panel.style.display = "block"; this.$input.focus(); }
  close(){ this.$panel.style.display = "none"; this.abort(); }

  abort(){ if (this.controller) { try { this.controller.abort(); } catch {} this.controller = null; } }

  _append(role, text=""){
    const row = document.createElement("div");
    row.className = `row ${role === "user" ? "user" : "bot"}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? this.userLabel : this.botLabel;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    this.$log.appendChild(row);
    queueMicrotask(() => { this.$log.scrollTop = this.$log.scrollHeight; });
    return bubble;
  }

  _sendFromInput(){
    const text = this.$input.value.trim();
    if (!text) return;
    this.$input.value = "";
    this.send(text);
  }

  async send(text){
    // pinta usuario
    this._append("user", text);
    this.history.push({ role: "user", content: text });
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    // burbuja del bot
    const botBubble = this._append("assistant", "");

    // bloqueo de inputs y abort controller
    this.$send.disabled = true; this.$input.disabled = true;
    this.controller = new AbortController();

    try {
      for await (const chunk of chatStream({ messages: this.history, signal: this.controller.signal })) {
        botBubble.textContent += chunk;
        this.$log.scrollTop = this.$log.scrollHeight;
      }
      // guardar respuesta en historial
      this.history.push({ role: "assistant", content: botBubble.textContent });
      if (this.history.length > this.maxHistory) {
        this.history.splice(0, this.history.length - this.maxHistory);
      }
    } catch (err) {
      botBubble.textContent = `Error: ${err?.message || "Fallo desconocido"}`;
      botBubble.setAttribute("data-error", "1");
    } finally {
      this.$send.disabled = false; this.$input.disabled = false;
      this.controller = null;
      this.$input.focus();
    }
  }
}
