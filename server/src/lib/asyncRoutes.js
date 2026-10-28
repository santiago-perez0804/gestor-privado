// Express 4 no atrapa los errores de los handlers async: el pedido queda colgado. Esto envuelve cada
// handler que se registre en la app para que un error (o una promesa rechazada) llegue al manejador
// de errores como siempre.
const METHODS = ["get", "post", "put", "patch", "delete", "all", "use"];

const wrap = (fn) =>
  typeof fn !== "function" || fn.length === 4 || fn.handle
    ? fn // manejadores de error y sub-apps/routers quedan como están
    : function asyncSafe(req, res, next) {
        try {
          const out = fn.call(this, req, res, next);
          if (out && typeof out.then === "function") out.catch(next);
        } catch (err) {
          next(err);
        }
      };

export function asyncRoutes(app) {
  for (const m of METHODS) {
    const original = app[m].bind(app);
    app[m] = (...args) => {
      // app.get("setting") con un solo argumento es leer un ajuste, no una ruta.
      if (m === "get" && args.length === 1 && typeof args[0] === "string") return original(...args);
      return original(...args.map((a) => (Array.isArray(a) ? a.map(wrap) : wrap(a))));
    };
  }
  return app;
}
