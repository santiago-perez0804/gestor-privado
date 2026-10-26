import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Sin esto, un error al renderizar desmonta toda la app y queda la pantalla en blanco.
 * `resetKey`: si cambia (p. ej. la ruta), se vuelve a intentar. `fallback`: qué mostrar en vez
 * del aviso (el widget prefiere no mostrar nada). `retryMs`: reintenta solo pasado ese tiempo.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
    if (this.props.retryMs) {
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.setState({ error: null }), this.props.retryMs);
    }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentWillUnmount() {
    clearTimeout(this.retryTimer);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <AlertTriangle size={22} style={{ color: "var(--status-warning)" }} />
        <div>
          <p className="text-sm font-semibold">Algo falló al mostrar esta pantalla</p>
          <p className="text-xs mt-1 font-mono break-all" style={{ color: "var(--text-faint)" }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <RotateCcw size={14} />
          Reintentar
        </button>
      </div>
    );
  }
}
