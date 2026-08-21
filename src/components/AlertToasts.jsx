import { useEffect } from "react";

const TOAST_TTL_MS = 8000;

const sevColor = (s) =>
  s === "critical" ? "#dc2626" : s === "warning" ? "#d69b14" : "#5925DC";

const KIND_LABEL = {
  overheat: "Overheat triggered",
  undercool: "Undercool triggered",
  high_limit: "High-limit breach",
  low_limit: "Low-limit breach"
};

const fmtDeg = (n) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)}°C` : "—";

export function AlertToasts({ toasts = [], onDismiss, onOpenFurnace }) {
  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss?.(t.id), TOAST_TTL_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  return (
    <div className="alert-toast-stack" role="region" aria-label="New alerts">
      {toasts.map((alert) => {
        const color = sevColor(alert.severity);
        const label = KIND_LABEL[alert.kind] || "Alert triggered";
        return (
          <div
            key={alert.id}
            className={`alert-toast sev-${alert.severity || "info"}`}
            style={{ "--toast-accent": color }}
            role="alert"
          >
            <div className="alert-toast-stripe" />
            <div className="alert-toast-body">
              <div className="alert-toast-head">
                <strong>{label}</strong>
                <button
                  type="button"
                  className="alert-toast-close"
                  onClick={() => onDismiss?.(alert.id)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
              <div className="alert-toast-asset">
                {alert.assetTag || alert.deviceId}
                {alert.assetName ? <span> · {alert.assetName}</span> : null}
              </div>
              <div className="alert-toast-meta">
                <span>MV {fmtDeg(alert.mv)}</span>
                {alert.sp !== undefined && alert.sp !== null ? (
                  <span>SP {fmtDeg(alert.sp)}</span>
                ) : null}
                {alert.delta !== undefined && alert.delta !== null ? (
                  <span>Δ {fmtDeg(alert.delta)}</span>
                ) : null}
                {alert.sustainedMinutes !== undefined ? (
                  <span>{alert.sustainedMinutes} min</span>
                ) : null}
              </div>
              <div className="alert-toast-actions">
                <button
                  type="button"
                  className="alert-toast-btn"
                  onClick={() => {
                    onOpenFurnace?.(alert.deviceId);
                    onDismiss?.(alert.id);
                  }}
                >
                  View furnace
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
