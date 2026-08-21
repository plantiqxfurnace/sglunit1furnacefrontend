import { useState } from "react";

export function DebugPanel({ debug }) {
  const [open, setOpen] = useState(false);
  const lastError = debug?.lastError || "None";
  const lastTopic = debug?.lastTopic || "N/A";

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon orange">DB</div>
          <h2>Debug Info</h2>
          <span className="panel-badge">{debug?.totalMessages ?? 0} msgs</span>
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        <div className="debug-grid debug-grid-primary">
          <div>
            <span className="muted">Last Topic</span>
            <strong className="debug-topic">{lastTopic}</strong>
          </div>
          <div>
            <span className="muted">Source Type</span>
            <strong>{debug?.lastSourceType || "N/A"}</strong>
          </div>
          <div>
            <span className="muted">Total Messages</span>
            <strong>{debug?.totalMessages ?? 0}</strong>
          </div>
          <div>
            <span className="muted">MQTT Messages</span>
            <strong>{debug?.mqttMessages ?? 0}</strong>
          </div>
          <div>
            <span className="muted">S3 Records</span>
            <strong>{debug?.s3Records ?? 0}</strong>
          </div>
        </div>

        <div className={`debug-error-panel ${lastError === "None" ? "is-clear" : "has-error"}`}>
          <span className="muted">Last Error</span>
          <div className="debug-error-text" title={lastError}>
            {lastError}
          </div>
        </div>
      </div>
    </section>
  );
}
