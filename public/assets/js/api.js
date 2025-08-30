/** Devuelve un async-iterable con chunks de texto del stream */
export async function* chatStream({ messages, signal } = {}) {
  const r = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || `HTTP ${r.status}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const evt of events) {
      // Cada "evt" puede tener varias líneas: event: ..., data: ...
      const lines = evt.split("\n");
      const eventLine = lines.find(l => l.startsWith("event:"));
      const dataLine  = lines.find(l => l.startsWith("data:"));

      const type = eventLine ? eventLine.slice(6).trim() : "message";
      const payload = (dataLine ? dataLine.slice(5).trim() : "");

      if (!payload || payload === "[DONE]") continue;

      // Los datos vienen como JSON string. Ej: "hola " (entre comillas)
      let parsed;
      try { parsed = JSON.parse(payload); } catch { parsed = payload; }

      if (type === "error") {
        // Si el servidor envía event:error, levanta el error con su mensaje
        throw new Error(typeof parsed === "string" ? parsed : "Error remoto");
      }

      if (typeof parsed === "string") {
        yield parsed; // chunk de texto normal
      }
    }
  }
}

export async function health() {
  try {
    const r = await fetch("/health");
    return r.ok;
  } catch {
    return false;
  }
}
