import { useEffect, useMemo, useRef, useState } from "react";
import { formatMetricValue } from "../utils/metricFormat";

const HIDDEN_KEYS = new Set([
  "cycleIndex", "durationMins", "intervalEnd", "intervalStart",
  "mv_avg", "operational", "sampleCount", "sp", "timestamp"
]);

export function DeviceDetailsPanel({ selectedDeviceId, details, loading }) {
  const [open, setOpen] = useState(true);
  const panelRef = useRef(null);

  const metricEntries = useMemo(() => {
    if (!details?.latest?.parsedMetrics) return [];
    return Object.entries(details.latest.parsedMetrics)
      .filter(([key]) => !HIDDEN_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [details]);

  const columns = useMemo(() => {
    const keys = new Set();
    (details?.records || []).forEach((record) => {
      Object.keys(record.parsedMetrics || {}).forEach((key) => {
        if (!HIDDEN_KEYS.has(key)) keys.add(key);
      });
    });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [details]);

  useEffect(() => {
    if (!selectedDeviceId || loading || !panelRef.current) return;
    panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, selectedDeviceId]);

  return (
    <section className="panel" id="device-details-panel" ref={panelRef}>
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon blue">DD</div>
          <h2>Selected Device Details</h2>
          <span className="panel-badge">{selectedDeviceId || "none"}</span>
          {columns.length ? <span className="panel-badge">{columns.length} parameters</span> : null}
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        {!selectedDeviceId ? (
          <div className="empty-state">
            <p>Select a device card to open full details.</p>
          </div>
        ) : null}

        {selectedDeviceId && loading ? <p className="muted">Loading device details...</p> : null}

        {selectedDeviceId && !loading && details ? (
          <div className="stack">
            <div className="device-details-meta">
              <div>
                <span className="muted">Total Records</span>
                <strong>{details.meta?.messageCount ?? 0}</strong>
              </div>
              <div>
                <span className="muted">Last Source</span>
                <strong>{details.meta?.lastSourceType || "N/A"}</strong>
              </div>
              <div>
                <span className="muted">Last Seen</span>
                <strong>
                  {details.meta?.lastSeenAt ? new Date(details.meta.lastSeenAt).toLocaleString() : "N/A"}
                </strong>
              </div>
            </div>

            <div>
              <h3 className="sub-title">Latest Parameters</h3>
              {metricEntries.length === 0 ? (
                <p className="muted">No parameters found for latest record.</p>
              ) : (
                <div className="metric-list metric-list-full">
                  {metricEntries.map(([key, value]) => (
                    <div key={key} className="metric-item">
                      <span>{key}</span>
                      <strong>{formatMetricValue(key, value)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="sub-title">Recent Records</h3>
              {details.records?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Source</th>
                        <th>Gateway/Topic</th>
                        {columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {details.records.map((record) => (
                        <tr key={record.id}>
                          <td>{new Date(record.timestamp || record.receivedAt).toLocaleString()}</td>
                          <td>{record.sourceType}</td>
                          <td>{record.parsedMetrics?.gateway || record.topic || record.s3Key || "N/A"}</td>
                          {columns.map((column) => (
                            <td key={`${record.id}-${column}`}>
                              {record.parsedMetrics?.[column] !== undefined
                                ? formatMetricValue(column, record.parsedMetrics[column])
                                : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No records loaded for this device.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
