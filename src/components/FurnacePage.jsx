import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { formatMetricValue, metricLabel } from "../utils/metricFormat";
import { FurnaceMvSpChart } from "./FurnaceMvSpChart";

// Hidden from Latest Metrics display (internal / redundant fields)
const METRICS_HIDDEN = new Set([
  "durationMins", "intervalEnd", "intervalStart",
  "operational", "sampleCount", "timestamp", "unit"
]);

// Hidden from Record History columns
const HISTORY_HIDDEN = new Set(["timestamp", "unit"]);

// Preferred column order for the history log
const COLUMN_ORDER = [
  "mv", "sp", "mv2", "sp2", "deviation",
  "buzzer", "cycleActive", "processCycle", "programId",
  "mv_min", "mv_max", "mv_avg",
  "cycleIndex", "cycleStartTime", "cycleEndTime",
  "intervalStart", "intervalEnd", "durationMins"
];

// Fields to show in the Cycle Summary sub-panel (from latest S3 record)
const CYCLE_FIELDS = [
  { key: "cycleIndex",     label: "Cycle Count" },
  { key: "cycleStartTime", label: "Cycle Start"  },
  { key: "cycleEndTime",   label: "Cycle End"    },
  { key: "mv_max",         label: "Max Temp"     },
  { key: "mv_min",         label: "Min Temp"     },
];

const fmtTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};

export function FurnacePage({ deviceId, onBack }) {
  const [details, setDetails]           = useState(null);
  const [alerts, setAlerts]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [s3Loading, setS3Loading]       = useState(false);
  const [s3LoadInfo, setS3LoadInfo]     = useState(null); // { loaded, total }
  const [error, setError]               = useState("");
  const mountedRef                      = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Phase 1: load live records + alerts immediately
      const [detailsResult, alertsResult] = await Promise.all([
        api.getDeviceRecords(deviceId, 3000),
        api.getAlerts(200).catch(() => ({ history: [], active: [] }))
      ]);

      if (!mountedRef.current) return;
      setDetails(detailsResult);
      setAlerts([...(alertsResult.history || []), ...(alertsResult.active || [])]);
      setLoading(false);

      // Phase 2: load S3 historical files in background
      setS3Loading(true);
      setS3LoadInfo(null);
      const s3Result = await api.loadS3DeviceHistory(deviceId, 100).catch(() => null);
      if (!mountedRef.current) return;

      if (s3Result && !s3Result.error) {
        setS3LoadInfo({ loaded: s3Result.loaded, total: s3Result.total });
        // Re-fetch records now that S3 data is in the store
        const refreshed = await api.getDeviceRecords(deviceId, 3000).catch(() => null);
        if (mountedRef.current && refreshed) {
          setDetails(refreshed);
        }
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setS3Loading(false);
      }
    }
  }, [deviceId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Most recent LIVE record → powers Latest Metrics panel
  const latestLiveRecord = useMemo(() => {
    if (!details?.records) return details?.latest || null;
    return details.records.find((r) => r.sourceType === "live") || details?.latest || null;
  }, [details]);

  // Most recent S3 record → Cycle Summary sub-panel
  const latestS3Record = useMemo(() => {
    if (!details?.records) return null;
    return details.records.find((r) => r.sourceType === "s3") || null;
  }, [details]);

  // Cycle summary values from latest S3 record
  const cycleSummary = useMemo(() => {
    const pm = latestS3Record?.parsedMetrics || {};
    return CYCLE_FIELDS.map(({ key, label }) => ({ key, label, value: pm[key] ?? null }));
  }, [latestS3Record]);

  // Metric cards for Latest Metrics (live record, filtered)
  const metricEntries = useMemo(() => {
    if (!latestLiveRecord?.parsedMetrics) return [];
    return Object.entries(latestLiveRecord.parsedMetrics)
      .filter(([k]) => !METRICS_HIDDEN.has(k))
      .sort(([a], [b]) => {
        const ai = COLUMN_ORDER.indexOf(a);
        const bi = COLUMN_ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });
  }, [latestLiveRecord]);

  // Most recent 10 records across both live and S3 sources
  const recentRecords = useMemo(() => {
    const all = [...(details?.records || [])];
    // Sort newest first then take 10
    all.sort((a, b) => {
      const at = new Date(a.timestamp || a.receivedAt).getTime();
      const bt = new Date(b.timestamp || b.receivedAt).getTime();
      return bt - at;
    });
    return all.slice(0, 10);
  }, [details]);

  // All columns for the history log — ordered by COLUMN_ORDER
  const historyColumns = useMemo(() => {
    const keys = new Set();
    recentRecords.forEach((r) => {
      Object.keys(r.parsedMetrics || {}).forEach((k) => {
        if (!HISTORY_HIDDEN.has(k)) keys.add(k);
      });
    });
    const ordered = COLUMN_ORDER.filter((k) => keys.has(k));
    keys.forEach((k) => { if (!ordered.includes(k)) ordered.push(k); });
    return ordered;
  }, [recentRecords]);

  const sourceType  = details?.meta?.lastSourceType;
  const lastSeen    = details?.meta?.lastSeenAt;
  const recordCount = details?.meta?.messageCount ?? 0;
  const initials    = deviceId.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  const liveCount   = details?.records?.filter((r) => r.sourceType === "live").length ?? 0;
  const s3Count     = details?.records?.filter((r) => r.sourceType === "s3").length ?? 0;

  return (
    <div className="furnace-page">
      {/* Header */}
      <div className="furnace-page-header">
        <button className="back-btn" onClick={onBack} type="button">← Dashboard</button>
        <div className="furnace-title-group">
          <div className="furnace-page-icon">{initials}</div>
          <div>
            <h1 className="furnace-page-name">{deviceId}</h1>
            <p className="furnace-page-subtitle">
              {recordCount} records
              {lastSeen ? ` · Last seen: ${new Date(lastSeen).toLocaleString()}` : ""}
              {sourceType ? ` · Source: ${sourceType}` : ""}
            </p>
          </div>
        </div>
        <button className="btn btn-sm btn-outline" onClick={loadData} type="button">Refresh</button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <div className="furnace-loading">
          <div className="furnace-loading-spinner" />
          Loading furnace data…
        </div>
      ) : null}

      {!loading && details ? (
        <>
          {/* Temperature Trend */}
          {(() => {
            // Check if any record has lib zone data (mv2/sp2) for this furnace
            const hasLibZone = (details.records || []).some((r) => {
              const m = r.parsedMetrics || r.metrics || {};
              return m.mv2 != null || m.sp2 != null;
            });
            return (
              <section className="panel">
                <div className="panel-header open">
                  <div className="panel-header-left">
                    <div className="panel-icon purple">TR</div>
                    <h2>Temperature Trend — Last 24 Hours</h2>
                    <span className="panel-badge">
                      {hasLibZone ? "MV · SP · LIB_MV · LIB_SP" : "MV vs SP"}
                    </span>
                  </div>
                </div>
                <div className="panel-body">
                  <FurnaceMvSpChart
                    records={details.records || []}
                    alerts={alerts}
                    deviceId={deviceId}
                    deviceName={details.latest?.assetName || deviceId}
                  />
                </div>
              </section>
            );
          })()}

          {/* Latest Metrics */}
          <section className="panel">
            <div className="panel-header open">
              <div className="panel-header-left">
                <div className="panel-icon orange">MT</div>
                <h2>Latest Metrics</h2>
                {latestLiveRecord ? (
                  <span className="panel-badge">
                    {new Date(latestLiveRecord.timestamp || latestLiveRecord.receivedAt).toLocaleString()}
                  </span>
                ) : null}
                <span className="source-badge live">live</span>
              </div>
            </div>
            <div className="panel-body">
              {metricEntries.length === 0 ? (
                <div className="empty-state"><p>Waiting for live data…</p></div>
              ) : (
                <>
                  {/* Live parameter cards */}
                  <div className="furnace-metrics-grid">
                    {metricEntries.map(([key, value]) => (
                      <div key={key} className="furnace-metric-card">
                        <span className="furnace-metric-label">{metricLabel(key)}</span>
                        <strong className="furnace-metric-value">{formatMetricValue(key, value)}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Cycle & temperature summary from latest S3 record */}
                  {cycleSummary.some((f) => f.value !== null) ? (
                    <>
                      <div className="cycle-summary-header">
                        <span className="panel-badge" style={{ marginTop: 16 }}>
                          Cycle Summary
                          {latestS3Record
                            ? ` · ${new Date(latestS3Record.timestamp || latestS3Record.receivedAt).toLocaleString()}`
                            : ""}
                        </span>
                        <span className="source-badge s3" style={{ marginLeft: 6 }}>s3</span>
                      </div>
                      <div className="furnace-metrics-grid" style={{ marginTop: 8 }}>
                        {cycleSummary.map(({ key, label, value }) => {
                          if (value === null) return null;
                          const display =
                            key === "cycleStartTime" || key === "cycleEndTime"
                              ? fmtTime(value)
                              : key === "mv_min" || key === "mv_max"
                              ? formatMetricValue(key, value)
                              : String(value);
                          return (
                            <div key={key} className="furnace-metric-card">
                              <span className="furnace-metric-label">{label}</span>
                              <strong className="furnace-metric-value">{display}</strong>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </section>

          {/* Record History — log style */}
          <section className="panel">
            <div className="panel-header open">
              <div className="panel-header-left">
                <div className="panel-icon blue">LOG</div>
                <h2>Record History</h2>
                <span className="panel-badge">last {recentRecords.length} of {(liveCount + s3Count)} total</span>
                <span className="panel-badge">{liveCount} live · {s3Count} s3</span>
                {s3Loading ? (
                  <span className="panel-badge" style={{ color: "var(--brand-indigo)" }}>
                    ⟳ loading S3 history…
                  </span>
                ) : s3LoadInfo ? (
                  <span className="panel-badge">
                    {s3LoadInfo.loaded}/{s3LoadInfo.total} S3 files loaded
                  </span>
                ) : null}
                {historyColumns.length ? (
                  <span className="panel-badge">{historyColumns.length} params</span>
                ) : null}
              </div>
            </div>
            <div className="panel-body">
              {!details.records?.length ? (
                <div className="empty-state"><p>No records yet.</p></div>
              ) : (
                <div className="table-wrap log-table">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-time">Time</th>
                        <th className="col-source">Src</th>
                        {historyColumns.map((col) => (
                          <th key={col}>{metricLabel(col)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentRecords.map((record) => (
                        <tr key={record.id} className={`log-row log-src-${record.sourceType}`}>
                          <td className="col-time nowrap mono-small">
                            {new Date(record.timestamp || record.receivedAt).toLocaleString()}
                          </td>
                          <td className="col-source">
                            <span className={`source-badge ${record.sourceType}`}>
                              {record.sourceType}
                            </span>
                          </td>
                          {historyColumns.map((col) => {
                            const raw = record.parsedMetrics?.[col];
                            return (
                              <td key={col} className={raw === undefined ? "log-empty" : ""}>
                                {raw !== undefined ? formatMetricValue(col, raw) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {!loading && !details ? (
        <div className="empty-state" style={{ marginTop: "40px" }}>
          <p>No data found for <strong>{deviceId}</strong>. Wait for live data or check S3 config.</p>
        </div>
      ) : null}
    </div>
  );
}
