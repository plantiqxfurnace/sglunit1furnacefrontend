import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const fmt = (n) => (typeof n === "number" ? `${n.toFixed(1)}°C` : "—");
const sevClass = (s) => (s === "critical" ? "sev-critical" : s === "warning" ? "sev-warning" : "sev-info");

const KIND_LABEL = {
  overheat: "Overheat",
  undercool: "Undercool",
  high_limit: "High limit",
  low_limit: "Low limit",
  recovery: "Recovered"
};

const KIND_ORDER = ["overheat", "undercool", "high_limit", "low_limit"];

const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
};

const fmtRel = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleString();
};

export function AlertsPanel({ activeAlerts = [], recentAlerts = [], devices = [] }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("alerts");
  const [config, setConfig] = useState(null);
  const [assetLimits, setAssetLimits] = useState({});
  const [limitsDraft, setLimitsDraft] = useState({});
  const [subs, setSubs] = useState({ emails: [], whatsapp: [] });
  const [notifierStatus, setNotifierStatus] = useState(null);
  const [email, setEmail] = useState("");
  const [number, setNumber] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [limitsBusy, setLimitsBusy] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const refreshAll = useCallback(async () => {
    try {
      const [cfg, sub] = await Promise.all([api.getAlertConfig(), api.getAlertSubscribers()]);
      setConfig(cfg.config);
      setDraft(cfg.config);
      setAssetLimits(cfg.assetLimits || {});
      setLimitsDraft(cfg.assetLimits || {});
      setSubs(sub.subscribers || { emails: [], whatsapp: [] });
      setNotifierStatus(sub.status || null);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const saveConfig = async () => {
    if (!draft) return;
    try {
      setBusy(true);
      const result = await api.updateAlertConfig({
        thresholdDeg: Number(draft.thresholdDeg),
        sustainMinutes: Number(draft.sustainMinutes),
        cooldownMinutes: Number(draft.cooldownMinutes),
        thresholdLowDeg: Number(draft.thresholdLowDeg),
        enableUndercool: Boolean(draft.enableUndercool)
      });
      setConfig(result.config);
      setDraft(result.config);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAssetLimits = async () => {
    try {
      setLimitsBusy(true);
      const payload = {};
      Object.entries(limitsDraft).forEach(([id, lim]) => {
        payload[id] = {
          high: lim?.high === "" || lim?.high === null || lim?.high === undefined ? null : Number(lim.high),
          low: lim?.low === "" || lim?.low === null || lim?.low === undefined ? null : Number(lim.low)
        };
      });
      const result = await api.updateAssetLimits(payload);
      setAssetLimits(result.assetLimits);
      setLimitsDraft(result.assetLimits);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLimitsBusy(false);
    }
  };

  const updateLimit = (assetId, field, value) => {
    setLimitsDraft((prev) => ({
      ...prev,
      [assetId]: { ...(prev[assetId] || {}), [field]: value }
    }));
  };

  // Build asset rows: prefer real device metadata (assetTag/name), fall back to ID order
  const assetRows = Object.keys(limitsDraft).map((assetId) => {
    const meta = devices.find((d) => d.deviceId === assetId) || {};
    return {
      assetId,
      assetTag: meta.assetTag || "",
      assetName: meta.assetName || ""
    };
  });

  const addEmail = async () => {
    if (!email) return;
    try {
      const r = await api.addEmailSubscriber(email);
      setSubs(r.subscribers);
      setEmail("");
    } catch (err) {
      setError(err.message);
    }
  };
  const removeEmail = async (e) => {
    try {
      const r = await api.removeEmailSubscriber(e);
      setSubs(r.subscribers);
    } catch (err) {
      setError(err.message);
    }
  };
  const addWhatsapp = async () => {
    if (!number) return;
    try {
      const r = await api.addWhatsappSubscriber(number);
      setSubs(r.subscribers);
      setNumber("");
    } catch (err) {
      setError(err.message);
    }
  };
  const removeWhatsapp = async (n) => {
    try {
      const r = await api.removeWhatsappSubscriber(n);
      setSubs(r.subscribers);
    } catch (err) {
      setError(err.message);
    }
  };

  const sendTest = async (channel) => {
    try {
      setTesting(true);
      setTestResult(null);
      const r = await api.sendAlertTest(channel);
      setTestResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const [clearing, setClearing] = useState(false);
  const clearHistory = async () => {
    const hasHistory = recentAlerts.length > 0 || activeAlerts.length > 0;
    if (!hasHistory) return;
    if (!window.confirm("Clear all active and recent alerts? Active breaches will re-trigger on the next poll if still out of range.")) {
      return;
    }
    try {
      setClearing(true);
      await api.clearAlertHistory(false);
      // Parent state will update via the socket "alerts_cleared" event.
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon red">AL</div>
          <h2>Alerts &amp; Notifications</h2>
          {activeAlerts.length > 0 ? (
            <span className="panel-badge danger">{activeAlerts.length} active</span>
          ) : (
            <span className="panel-badge">All clear</span>
          )}
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        <div className="tab-bar">
          <button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}>
            Active &amp; Recent
          </button>
          <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}>
            Rule
          </button>
          <button className={tab === "subs" ? "active" : ""} onClick={() => setTab("subs")}>
            Recipients
          </button>
          <button className={tab === "test" ? "active" : ""} onClick={() => setTab("test")}>
            Test
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {tab === "alerts" ? (
          <AlertsTab
            activeAlerts={activeAlerts}
            recentAlerts={recentAlerts}
            devices={devices}
            clearing={clearing}
            onClear={clearHistory}
          />
        ) : null}

        {tab === "config" && draft ? (
          <div className="stack">
            <h3 className="section-h">Deviation rule (vs. recipe set point)</h3>
            <p className="muted">
              Fires when the measured value (MV) deviates from the setpoint (SP) by at least the
              threshold for the sustained duration. <strong>Overheat</strong> = MV is above SP;{" "}
              <strong>undercool</strong> = MV is below SP (e.g. control loop failing to reach the
              recipe). Only evaluated while the furnace is operational.
            </p>
            <div className="form-grid">
              <label>
                Overheat threshold (°C above SP)
                <input
                  type="number"
                  value={draft.thresholdDeg}
                  onChange={(e) => setDraft({ ...draft, thresholdDeg: e.target.value })}
                />
              </label>
              <label>
                Sustain duration (minutes)
                <input
                  type="number"
                  value={draft.sustainMinutes}
                  onChange={(e) => setDraft({ ...draft, sustainMinutes: e.target.value })}
                />
              </label>
              <label>
                Cooldown between notifications (minutes)
                <input
                  type="number"
                  value={draft.cooldownMinutes}
                  onChange={(e) => setDraft({ ...draft, cooldownMinutes: e.target.value })}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!draft.enableUndercool}
                  onChange={(e) => setDraft({ ...draft, enableUndercool: e.target.checked })}
                />
                Also alert on undercool
              </label>
              <label>
                Undercool threshold (°C below SP)
                <input
                  type="number"
                  value={draft.thresholdLowDeg}
                  disabled={!draft.enableUndercool}
                  onChange={(e) => setDraft({ ...draft, thresholdLowDeg: e.target.value })}
                />
              </label>
            </div>
            <div className="row-actions">
              <button className="btn" onClick={saveConfig} disabled={busy}>
                {busy ? "Saving…" : "Save Rule"}
              </button>
              <button className="btn btn-outline" onClick={() => setDraft(config)} disabled={busy}>
                Reset
              </button>
            </div>

            <h3 className="section-h" style={{ marginTop: 24 }}>
              Per-furnace absolute limits
            </h3>
            <p className="muted">
              Fires when MV crosses an absolute high or low temperature limit, regardless of SP.
              Useful for catching thermocouple runaway, wiring failures, or a wrong recipe. Leave a
              field blank to disable that limit. Uses the same sustain &amp; cooldown above.
              Evaluated whether the furnace is operational or on standby.
            </p>
            <div className="table-wrap">
              <table className="limits-table">
                <thead>
                  <tr>
                    <th>Furnace</th>
                    <th>Asset ID</th>
                    <th>High limit (°C)</th>
                    <th>Low limit (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {assetRows.map((row) => {
                    const d = limitsDraft[row.assetId] || { high: null, low: null };
                    return (
                      <tr key={row.assetId}>
                        <td>
                          <strong>{row.assetTag || row.assetId}</strong>
                          {row.assetName ? (
                            <span className="muted small"> · {row.assetName}</span>
                          ) : null}
                        </td>
                        <td className="mono-small">{row.assetId}</td>
                        <td>
                          <input
                            type="number"
                            placeholder="—"
                            value={d.high ?? ""}
                            onChange={(e) =>
                              updateLimit(
                                row.assetId,
                                "high",
                                e.target.value === "" ? null : e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            placeholder="—"
                            value={d.low ?? ""}
                            onChange={(e) =>
                              updateLimit(
                                row.assetId,
                                "low",
                                e.target.value === "" ? null : e.target.value
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {assetRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No assets configured.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="row-actions">
              <button className="btn" onClick={saveAssetLimits} disabled={limitsBusy}>
                {limitsBusy ? "Saving…" : "Save Per-furnace Limits"}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setLimitsDraft(assetLimits)}
                disabled={limitsBusy}
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}

        {tab === "subs" ? (
          <div className="stack">
            <div>
              <h3 className="section-h">Email recipients</h3>
              <div className="row-input">
                <input
                  type="email"
                  placeholder="ops@plantiqx.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="btn btn-sm" onClick={addEmail}>
                  Add
                </button>
              </div>
              <ul className="chip-list">
                {(subs.emails || []).map((e) => (
                  <li key={e} className="chip">
                    {e}
                    <button onClick={() => removeEmail(e)} aria-label="remove">
                      ×
                    </button>
                  </li>
                ))}
                {(subs.emails || []).length === 0 ? <p className="muted">No email recipients.</p> : null}
              </ul>
            </div>

            <div>
              <h3 className="section-h">WhatsApp recipients</h3>
              <div className="row-input">
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <button className="btn btn-sm" onClick={addWhatsapp}>
                  Add
                </button>
              </div>
              <ul className="chip-list">
                {(subs.whatsapp || []).map((n) => (
                  <li key={n} className="chip">
                    {n}
                    <button onClick={() => removeWhatsapp(n)} aria-label="remove">
                      ×
                    </button>
                  </li>
                ))}
                {(subs.whatsapp || []).length === 0 ? (
                  <p className="muted">No WhatsApp recipients.</p>
                ) : null}
              </ul>
            </div>

            {notifierStatus ? (
              <div className="muted small">
                Email channel: <strong>{notifierStatus.email?.enabled ? "enabled" : "disabled"}</strong>
                {" · "}
                WhatsApp channel:{" "}
                <strong>{notifierStatus.whatsapp?.enabled ? "enabled" : "disabled"}</strong>
                {!notifierStatus.email?.nodemailerAvailable ? (
                  <span> · Install nodemailer to enable email.</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "test" ? (
          <div className="stack">
            <p className="muted">
              Send a sample alert to current recipients. Configured channels must be enabled in the
              backend .env to actually deliver.
            </p>
            <div className="row-actions">
              <button className="btn" disabled={testing} onClick={() => sendTest("email")}>
                Test Email
              </button>
              <button className="btn" disabled={testing} onClick={() => sendTest("whatsapp")}>
                Test WhatsApp
              </button>
              <button className="btn" disabled={testing} onClick={() => sendTest("all")}>
                Test Both
              </button>
            </div>
            {testResult ? (
              <pre className="json-block">{JSON.stringify(testResult, null, 2)}</pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AlertsTab({ activeAlerts, recentAlerts, devices, clearing, onClear }) {
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterKind, setFilterKind] = useState("all");
  const [filterDevice, setFilterDevice] = useState("all");

  const applyFilters = (list) =>
    list.filter((a) => {
      if (filterSeverity !== "all" && (a.severity || "info") !== filterSeverity) return false;
      if (filterKind !== "all" && a.kind !== filterKind) return false;
      if (filterDevice !== "all" && a.deviceId !== filterDevice) return false;
      return true;
    });

  const filteredActive = useMemo(() => applyFilters(activeAlerts), [
    activeAlerts,
    filterSeverity,
    filterKind,
    filterDevice
  ]);

  const filteredRecent = useMemo(
    () => applyFilters(recentAlerts.filter((a) => a.kind !== "recovery")),
    [recentAlerts, filterSeverity, filterKind, filterDevice]
  );

  const recovered = useMemo(
    () => recentAlerts.filter((a) => a.kind === "recovery"),
    [recentAlerts]
  );

  const todayList = filteredRecent.filter((a) => isToday(a.timestamp));
  const earlierList = filteredRecent.filter((a) => !isToday(a.timestamp));

  const hasAnyHistory = activeAlerts.length > 0 || recentAlerts.length > 0;
  const hasFilters =
    filterSeverity !== "all" || filterKind !== "all" || filterDevice !== "all";

  const counts = {
    critical: recentAlerts.filter((a) => a.severity === "critical").length,
    warning: recentAlerts.filter((a) => a.severity === "warning").length,
    info: recentAlerts.filter((a) => (a.severity || "info") === "info" && a.kind !== "recovery").length,
    recovered: recovered.length
  };

  return (
    <div className="stack">
      <div className="alerts-summary">
        <div className="alerts-summary-card crit">
          <span className="alerts-summary-label">Active</span>
          <strong className="alerts-summary-value">{activeAlerts.length}</strong>
        </div>
        <div className="alerts-summary-card">
          <span className="alerts-summary-label">Critical (24h*)</span>
          <strong className="alerts-summary-value">{counts.critical}</strong>
        </div>
        <div className="alerts-summary-card">
          <span className="alerts-summary-label">Warning</span>
          <strong className="alerts-summary-value">{counts.warning}</strong>
        </div>
        <div className="alerts-summary-card">
          <span className="alerts-summary-label">Recovered</span>
          <strong className="alerts-summary-value">{counts.recovered}</strong>
        </div>
      </div>

      <div className="alerts-toolbar">
        <div className="alerts-filters">
          <label className="alerts-filter">
            <span>Severity</span>
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </label>
          <label className="alerts-filter">
            <span>Type</span>
            <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
              <option value="all">All</option>
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="alerts-filter">
            <span>Furnace</span>
            <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
              <option value="all">All</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.assetTag || d.deviceId} {d.assetName ? `— ${d.assetName}` : ""}
                </option>
              ))}
            </select>
          </label>
          {hasFilters ? (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => {
                setFilterSeverity("all");
                setFilterKind("all");
                setFilterDevice("all");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline btn-danger"
          onClick={onClear}
          disabled={clearing || !hasAnyHistory}
          title="Wipe active breaches and recent history"
        >
          {clearing ? "Clearing…" : "Clear History"}
        </button>
      </div>

      <section className="alerts-section">
        <div className="alerts-section-head">
          <h3 className="section-h">
            Active
            <span className="alerts-section-count">{filteredActive.length}</span>
          </h3>
        </div>
        {filteredActive.length === 0 ? (
          <div className="alerts-empty">
            <span className="alerts-empty-icon">✓</span>
            <p>No active breaches{hasFilters ? " match the current filters" : ""}.</p>
          </div>
        ) : (
          <div className="alert-list">
            {filteredActive.map((a) => (
              <AlertRow
                key={a.id || `${a.deviceId}-${a.kind}-${a.lastNotifiedAt}`}
                alert={a}
                isActive
              />
            ))}
          </div>
        )}
      </section>

      <section className="alerts-section">
        <div className="alerts-section-head">
          <h3 className="section-h">
            Today
            <span className="alerts-section-count">{todayList.length}</span>
          </h3>
        </div>
        {todayList.length === 0 ? (
          <p className="muted alerts-empty-line">No alerts today.</p>
        ) : (
          <div className="alert-list">
            {todayList.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        )}
      </section>

      {earlierList.length > 0 ? (
        <section className="alerts-section">
          <div className="alerts-section-head">
            <h3 className="section-h">
              Earlier
              <span className="alerts-section-count">{earlierList.length}</span>
            </h3>
          </div>
          <div className="alert-list">
            {earlierList.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const DispatchBadge = ({ channel, result }) => {
  if (!result) {
    return (
      <span className="dispatch-badge pending">
        {channel === "email" ? "✉" : channel === "whatsapp" ? "WA" : channel} pending
      </span>
    );
  }
  if (result.ok) {
    return (
      <span className="dispatch-badge ok">
        {channel === "email" ? "✉" : channel === "whatsapp" ? "WA" : channel} sent
      </span>
    );
  }
  if (result.skipped) {
    return (
      <span className="dispatch-badge skipped" title={result.skipped}>
        {channel === "email" ? "✉" : channel === "whatsapp" ? "WA" : channel} skipped
      </span>
    );
  }
  return (
    <span className="dispatch-badge fail" title={result.error || ""}>
      {channel === "email" ? "✉" : channel === "whatsapp" ? "WA" : channel} failed
    </span>
  );
};

function AlertRow({ alert, isActive = false }) {
  const [expanded, setExpanded] = useState(false);
  const ts = alert.timestamp || alert.lastNotifiedAt;
  const kindLabel = KIND_LABEL[alert.kind] || alert.kind?.toUpperCase();
  const isRecovery = alert.kind === "recovery";

  if (isRecovery) {
    return (
      <div className="alert-row sev-recovery">
        <span className="alert-row-stripe" aria-hidden />
        <div className="alert-row-main">
          <div className="alert-row-head">
            <strong>
              Recovered — {alert.previousKind ? KIND_LABEL[alert.previousKind] : ""} ·{" "}
              {alert.deviceId}
            </strong>
            <span className="muted" title={ts ? new Date(ts).toLocaleString() : ""}>
              {fmtRel(ts)}
            </span>
          </div>
          {alert.message ? <div className="alert-row-msg">{alert.message}</div> : null}
        </div>
      </div>
    );
  }

  const hasDispatch = Boolean(alert.dispatch);

  return (
    <div className={`alert-row ${sevClass(alert.severity)} ${isActive ? "is-active" : ""}`}>
      <span className="alert-row-stripe" aria-hidden />
      <div className="alert-row-main">
        <div className="alert-row-head">
          <div className="alert-row-title">
            <span className={`sev-chip sev-chip-${alert.severity || "info"}`}>
              {(alert.severity || "info").toUpperCase()}
            </span>
            <strong>
              {kindLabel} — {alert.assetTag || alert.deviceId}
              {alert.assetName ? <span className="muted"> · {alert.assetName}</span> : null}
            </strong>
          </div>
          <span className="muted alert-row-time" title={ts ? new Date(ts).toLocaleString() : ""}>
            {fmtRel(ts)}
          </span>
        </div>

        <div className="alert-row-body">
          <span>
            <span className="muted">MV</span> <strong>{fmt(alert.mv)}</strong>
          </span>
          {alert.sp !== undefined && alert.sp !== null ? (
            <span>
              <span className="muted">SP</span> <strong>{fmt(alert.sp)}</strong>
            </span>
          ) : null}
          {alert.delta !== undefined && alert.delta !== null ? (
            <span>
              <span className="muted">Δ</span> <strong>{fmt(alert.delta)}</strong>
            </span>
          ) : null}
          <span>
            <span className="muted">Sustained</span>{" "}
            <strong>{alert.sustainedMinutes ?? "—"} min</strong>
          </span>
        </div>

        {hasDispatch ? (
          <div className="alert-row-dispatch">
            <DispatchBadge channel="email" result={alert.dispatch?.email} />
            <DispatchBadge channel="whatsapp" result={alert.dispatch?.whatsapp} />
          </div>
        ) : null}

        {expanded ? (
          <div className="alert-row-detail">
            {alert.message ? <p className="alert-row-msg">{alert.message}</p> : null}
            <dl className="alert-row-kv">
              <dt>Asset ID</dt>
              <dd>{alert.assetId || alert.deviceId}</dd>
              {alert.location?.org ? (
                <>
                  <dt>Plant</dt>
                  <dd>
                    {alert.location.org}/{alert.location.plant}
                  </dd>
                </>
              ) : null}
              <dt>Threshold</dt>
              <dd>{fmt(alert.threshold ?? alert.thresholdDeg)}</dd>
              <dt>Detected</dt>
              <dd>{ts ? new Date(ts).toLocaleString() : "—"}</dd>
              {alert.id ? (
                <>
                  <dt>Alert ID</dt>
                  <dd className="mono-small">{alert.id}</dd>
                </>
              ) : null}
            </dl>
          </div>
        ) : null}

        <button
          type="button"
          className="alert-row-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>
    </div>
  );
}
