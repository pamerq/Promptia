import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import chatRouter from "./routes/chat.js";
import { notFound, errorHandler } from "./middlewares/errors.js";
import { PORT } from "./utils/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// servir estáticos
app.use(express.static(path.join(__dirname, "../public")));

// healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// rutas API
app.use("/chat", chatRouter);

// 404 y errores
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Promptia listo en http://localhost:${PORT}`);
});
