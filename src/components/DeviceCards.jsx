import { useState } from "react";

const fmt = (n, unit = "°C") =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)} ${unit}` : "—";

const deviationClass = (delta) => {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "ok";
  if (delta > 20) return "high";
  if (delta < -20) return "low";
  return "ok";
};

// Header badge from raw assetStatus string in the live payload
const resolveAssetStatusBadge = (assetStatusStr, buzzer) => {
  if (buzzer === 1) return { label: "ALARM", cls: "status-alarm" };
  if (!assetStatusStr) return null;
  const s = assetStatusStr.toLowerCase();
  if (s === "idle")                          return { label: "Idle", cls: "status-idle" };
  if (s === "on" || s === "running" || s === "active") return { label: assetStatusStr, cls: "status-on" };
  if (s === "off")                           return { label: "OFF",  cls: "status-off"  };
  return { label: assetStatusStr, cls: "status-idle" };
};

// Cycle row badge — computed from PROCESS_CYCLE truth table (cross-asset, set by liveService)
const resolveCycleBadge = (cycleActive) => {
  if (cycleActive === true)  return { label: "ON",  cls: "status-on"  };
  if (cycleActive === false) return { label: "OFF", cls: "status-off" };
  return null;
};

// True when every furnace with an assetStatus is idle or off
const allFurnacesOffOrIdle = (records) =>
  records.length > 0 &&
  records.every((r) => {
    const as = r.metrics?.assetStatus;
    if (!as) return true; // no status data = treat as idle
    const s = as.toLowerCase();
    return s === "idle" || s === "off";
  });

export function DeviceCards({ records, selectedDeviceId, onSelectDevice, onOpenFurnace }) {
  const [open, setOpen] = useState(true);
  const forceAllOff = allFurnacesOffOrIdle(records);

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon blue">FN</div>
          <h2>Furnace Overview</h2>
          <span className="panel-badge">{records.length} furnaces</span>
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        {records.length === 0 ? (
          <div className="empty-state">
            <p>Waiting for live gateway data…</p>
          </div>
        ) : (
          <div className="device-grid">
            {records.map((record) => {
              const m = record.metrics || {};
              const mv = m.mv ?? m.mv_avg ?? null;
              const sp = m.sp ?? null;
              const mv2 = m.mv2 ?? null;
              const sp2 = m.sp2 ?? null;
              const buzzer = m.buzzer;
              const cycleActive = m.cycleActive;
              const tag = record.assetTag || "";
              const hasProgZone = mv2 !== null || sp2 !== null;
              const delta = m.deviation ?? (typeof mv === "number" && typeof sp === "number" ? mv - sp : null);
              const libDelta = (mv2 !== null && sp2 !== null) ? +(mv2 - sp2).toFixed(2) : null;
              // Header badge: raw assetStatus string from live URL
              const statusBadge = resolveAssetStatusBadge(m.assetStatus, buzzer);
              // Cycle row badge: OFF when all furnaces are off/idle, else use computed cycleActive
              const cycleBadge = forceAllOff
                ? { label: "OFF", cls: "status-off" }
                : resolveCycleBadge(cycleActive);

              return (
                <article
                  key={`${record.deviceId}-${record.id}`}
                  className={`device-card ${selectedDeviceId === record.deviceId ? "selected" : ""}${buzzer === 1 ? " buzzer-alert" : ""}`}
                  onClick={() => onSelectDevice(record.deviceId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectDevice(record.deviceId);
                    }
                  }}
                >
                  <div className="device-card-header">
                    <h3 className="device-card-title">
                      {tag || record.deviceId}
                      <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                        {record.assetName || ""}
                      </span>
                    </h3>
                    {/* Asset status badge — raw string from live URL */}
                    {statusBadge ? (
                      <span className={`asset-status-badge ${statusBadge.cls}`}>{statusBadge.label}</span>
                    ) : null}
                  </div>
                  <p className="timestamp">
                    {record.timestamp ? new Date(record.timestamp).toLocaleString() : "—"}
                  </p>
                  <div className="metric-list">
                    <div className="metric-item">
                      <span className="metric-key">MV</span>
                      <strong className="metric-val">{fmt(mv)}</strong>
                    </div>
                    <div className="metric-item">
                      <span className="metric-key">SP</span>
                      <strong className="metric-val">{fmt(sp)}</strong>
                    </div>
                    {hasProgZone ? (
                      <>
                        {mv2 !== null ? (
                          <div className="metric-item">
                            <span className="metric-key">LIB_MV</span>
                            <strong className="metric-val">{fmt(mv2)}</strong>
                          </div>
                        ) : null}
                        {sp2 !== null ? (
                          <div className="metric-item">
                            <span className="metric-key">LIB_SP</span>
                            <strong className="metric-val">{fmt(sp2)}</strong>
                          </div>
                        ) : null}
                        {libDelta !== null ? (
                          <div className="metric-item">
                            <span className="metric-key">LIB Dev</span>
                            <strong className={`metric-val furnace-deviation ${deviationClass(libDelta)}`}>
                              {fmt(libDelta)}
                            </strong>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div className="metric-item">
                      <span className="metric-key">Deviation</span>
                      <strong className={`metric-val furnace-deviation ${deviationClass(delta)}`}>
                        {fmt(delta)}
                      </strong>
                    </div>
                    {/* Status row: raw assetStatus from live URL */}
                    {statusBadge ? (
                      <div className="metric-item">
                        <span className="metric-key">Status</span>
                        <strong className="metric-val">
                          <span className={`asset-status-badge ${statusBadge.cls}`}>{statusBadge.label}</span>
                        </strong>
                      </div>
                    ) : null}
                    {/* Cycle row: computed from PROCESS_CYCLE truth table */}
                    {cycleBadge ? (
                      <div className="metric-item">
                        <span className="metric-key">Cycle</span>
                        <strong className="metric-val">
                          <span className={`asset-status-badge ${cycleBadge.cls}`}>{cycleBadge.label}</span>
                        </strong>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm open-furnace-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFurnace(record.deviceId);
                    }}
                  >
                    View Full Details →
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
