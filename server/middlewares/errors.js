export function notFound(req, res, next) {
  if (res.headersSent) return next();
  res.status(404).json({ error: "Not Found" });
}

export function errorHandler(err, _req, res, _next) {
  console.error("[error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message || "Server error" });
}
