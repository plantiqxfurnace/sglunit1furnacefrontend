import { useEffect, useMemo, useRef, useState } from "react";

const sevColor = (s) =>
  s === "critical" ? "#dc2626" : s === "warning" ? "#d69b14" : "#5925DC";

const KIND_LABEL = {
  overheat:   "Overheat",
  undercool:  "Undercool",
  high_limit: "High limit",
  low_limit:  "Low limit",
  sp_cross:   "MV crossed SP",
  buzzer:     "Buzzer alarm",
  recovery:   "Recovered"
};

const fmtRel = (iso) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

const fmtDeg = (n) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)}°C` : "—";

export function NotificationBell({
  activeAlerts = [],
  recentAlerts = [],
  lastReadAt,
  onMarkRead,
  onOpenFurnace
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const merged = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const a of [...activeAlerts, ...recentAlerts]) {
      const key = a.id || `${a.deviceId}-${a.kind}-${a.timestamp || a.lastNotifiedAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
    return out
      .filter((a) => a.kind !== "recovery")
      .sort(
        (a, b) =>
          new Date(b.timestamp || b.lastNotifiedAt || 0).getTime() -
          new Date(a.timestamp || a.lastNotifiedAt || 0).getTime()
      )
      .slice(0, 20);
  }, [activeAlerts, recentAlerts]);

  const unreadCount = useMemo(() => {
    if (!lastReadAt) return merged.length;
    const cutoff = new Date(lastReadAt).getTime();
    return merged.filter(
      (a) => new Date(a.timestamp || a.lastNotifiedAt || 0).getTime() > cutoff
    ).length;
  }, [merged, lastReadAt]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) onMarkRead?.();
  };

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        type="button"
        className={`notif-bell ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={toggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="notif-bell-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown-head">
            <div>
              <strong>Notifications</strong>
              <span className="notif-dropdown-sub">
                {merged.length === 0
                  ? "All clear"
                  : `${activeAlerts.filter((a) => a.kind !== "recovery").length} active · ${merged.length} total`}
              </span>
            </div>
          </div>

          <div className="notif-dropdown-body">
            {merged.length === 0 ? (
              <div className="notif-empty">
                <div className="notif-empty-icon">✓</div>
                <p>No alerts. Everything's running clean.</p>
              </div>
            ) : (
              merged.map((a) => {
                const color = sevColor(a.severity);
                const ts = a.timestamp || a.lastNotifiedAt;
                const isActive = activeAlerts.some(
                  (x) => x.deviceId === a.deviceId && x.kind === a.kind
                );
                return (
                  <button
                    type="button"
                    key={a.id || `${a.deviceId}-${a.kind}-${ts}`}
                    className="notif-item"
                    onClick={() => {
                      setOpen(false);
                      onOpenFurnace?.(a.deviceId);
                    }}
                  >
                    <span
                      className="notif-item-stripe"
                      style={{ background: color }}
                      aria-hidden
                    />
                    <div className="notif-item-body">
                      <div className="notif-item-head">
                        <strong>
                          {KIND_LABEL[a.kind] || a.kind} — {a.assetTag || a.deviceId}
                        </strong>
                        {isActive ? <span className="notif-pill active">Active</span> : null}
                      </div>
                      <div className="notif-item-meta">
                        <span>MV {fmtDeg(a.mv)}</span>
                        {a.sp !== undefined && a.sp !== null ? (
                          <span>SP {fmtDeg(a.sp)}</span>
                        ) : null}
                        {a.delta !== undefined && a.delta !== null ? (
                          <span>Δ {fmtDeg(a.delta)}</span>
                        ) : null}
                      </div>
                      <div className="notif-item-foot">
                        <span>{fmtRel(ts)}</span>
                        {a.assetName ? <span>· {a.assetName}</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
