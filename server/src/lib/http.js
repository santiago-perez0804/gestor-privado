// Utilidades para las rutas de Express.

/** Envuelve un handler: responde JSON y traduce errores de dominio (con status) a respuestas claras. */
export const handle = (fn, okStatus = 200) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (res.headersSent) return;
    if (out === undefined) res.status(204).end();
    else res.status(okStatus).json(out);
  } catch (err) {
    if (err.status) res.status(err.status).json({ error: err.message, ...(err.userMessage && { message: err.userMessage }) });
    else next(err);
  }
};
