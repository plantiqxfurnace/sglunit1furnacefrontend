import { useState } from "react";
import { JsonBlock } from "./JsonBlock";
import { formatMetricValue } from "../utils/metricFormat";

export function LiveDataViewer({ messages }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? messages : messages.slice(0, 1);

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon blue">MQ</div>
          <h2>Live Data Viewer</h2>
          <span className="panel-badge">LIVE</span>
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No live MQTT messages yet.</p>
          </div>
        ) : (
          <>
            <div className="live-viewer-controls">
              <span className="count">
                {messages.length} message{messages.length !== 1 ? "s" : ""} buffered
              </span>
              <button
                className={`btn btn-sm ${showAll ? "" : "btn-outline"}`}
                onClick={() => setShowAll(!showAll)}
                type="button"
              >
                {showAll ? "Show Latest Only" : `Show All History (${messages.length})`}
              </button>
            </div>

            <div className="stack">
              {displayed.map((item, index) => (
                <article key={item.id} className={`message-card ${index === 0 && !showAll ? "latest" : ""}`}>
                  <div className="message-head">
                    <div className="message-head-left">
                      <strong>{item.deviceId}</strong>
                      <span className="topic">{item.topic || "no-topic"}</span>
                    </div>
                    <div className="message-meta">
                      <span className={`source-badge ${item.sourceType}`}>{item.sourceType}</span>
                      <span>{new Date(item.receivedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {item.parseError ? (
                    <p className="error" style={{ padding: "0 14px" }}>
                      Parse error: {item.parseError}
                    </p>
                  ) : null}

                  <div className="message-body">
                    <div className="live-metric-preview">
                      {Object.entries(item.parsedMetrics || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <div className="live-metric-chip" key={`${item.id}-${key}`}>
                            <span>{key}</span>
                            <strong>{formatMetricValue(key, value)}</strong>
                          </div>
                        ))}
                    </div>
                    <div className="split">
                      <JsonBlock label="Raw Payload" value={item.rawPayload} />
                      <JsonBlock label="Parsed Payload" value={item.parsedPayload || {}} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
