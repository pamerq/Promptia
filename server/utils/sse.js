// server/utils/sse.js
import { OPENAI_API_KEY, OPENAI_MODEL } from "./config.js";

/**
 * Proxy de streaming hacia el navegador:
 * - Pide a OpenAI Responses API con stream=true
 * - Reenvía SOLO texto como líneas SSE:  data: "<chunk>\n\n"
 * - Si viene error, manda event:error para que el cliente lo muestre.
 */
export async function streamOpenAI({ messages, res, systemPrompt }) {
  // 1) Encabezados SSE al cliente
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // 2) Llamada a OpenAI
  const body = JSON.stringify({
    model: OPENAI_MODEL,
    stream: true,
    input: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body,
    });
  } catch (netErr) {
    console.error("[openai] network error:", netErr);
    res.write(`event: error\ndata: ${JSON.stringify("No hay red o la petición fue bloqueada")}\n\n`);
    return res.end();
  }

  const ct = upstream.headers.get("content-type") || "";
  console.log("[openai] status:", upstream.status, "| content-type:", ct);

  // 3) Si upstream vino mal, envía el texto de error y cierra
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    console.error("[openai] upstream not ok:", upstream.status, text);
    res.write(`event: error\ndata: ${JSON.stringify(text || `HTTP ${upstream.status}`)}\n\n`);
    return res.end();
  }

  // 4) Función común para parsear trozos y reenviar al cliente
  const decoder = new TextDecoder();
  let buffer = "";
  const pump = (chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const evt of events) {
      // form: "data: {...}" o "event: error\ndata: ...\n\n"
      const lines = evt.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      const type = eventLine ? eventLine.slice(6).trim() : "message";
      const payload = (dataLine ? dataLine.slice(5).trim() : "");

      if (!payload || payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload);
        if (type === "error") {
          console.error("[openai] error event:", json);
          res.write(`event: error\ndata: ${JSON.stringify(json)}\n\n`);
          continue;
        }
        if (
          json?.type === "response.output_text.delta" &&
          typeof json.delta === "string"
        ) {
          res.write(`data: ${JSON.stringify(json.delta)}\n\n`);
        } else if (json?.type === "response.completed") {
          res.write("data: [DONE]\n\n");
        } else if (json?.type === "response.error" && json.error?.message) {
          console.error("[openai] response.error:", json.error.message);
          res.write(`event: error\ndata: ${JSON.stringify(json.error.message)}\n\n`);
        }
      } catch {
        // Si no era JSON (raro), ignóralo
      }
    }
  };

  // 5) Lee el stream de OpenAI (soporta WebStream y Node stream)
  const bodyStream = upstream.body;
  try {
    if (bodyStream?.getReader) {
      // Web ReadableStream (fetch nativo)
      const reader = bodyStream.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pump(value);
      }
    } else if (bodyStream && Symbol.asyncIterator in bodyStream) {
      // Node stream (por si algún runtime lo expone así)
      for await (const chunk of bodyStream) {
        pump(chunk);
      }
    } else {
      // No es stream: lee todo
      const txt = await upstream.text();
      console.warn("[openai] no-stream body:", txt.slice(0, 200));
      try {
        const j = JSON.parse(txt);
        if (j?.error?.message) {
          res.write(`event: error\ndata: ${JSON.stringify(j.error.message)}\n\n`);
        } else {
          res.write(`event: error\ndata: ${JSON.stringify("Respuesta no-stream inesperada")}\n\n`);
        }
      } catch {
        res.write(`event: error\ndata: ${JSON.stringify("Respuesta texto inesperada")}\n\n`);
      }
    }
  } catch (readErr) {
    console.error("[openai] read error:", readErr);
    res.write(`event: error\ndata: ${JSON.stringify(readErr.message || "Fallo leyendo stream")}\n\n`);
  }

  res.end();
}
