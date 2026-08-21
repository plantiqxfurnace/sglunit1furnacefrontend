import { useState } from "react";

const statusClass = (status) => {
  if (status === "connected" || status === "available") return "ok";
  if (status === "connecting" || status === "reconnecting" || status === "unknown") return "warn";
  return "bad";
};

export function ConnectionStatus({ backendOk, liveStatus, s3Status, gateway }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon green">CS</div>
          <h2>Connection Status</h2>
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>
      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        <div className="status-grid">
          <div className={`status-item ${backendOk ? "ok" : "bad"}`}>
            <span className="status-dot" />
            <div className="status-info">
              <span>Backend</span>
              <strong>{backendOk ? "Online" : "Offline"}</strong>
            </div>
          </div>

          <div className={`status-item ${statusClass(liveStatus?.status)}`}>
            <span className="status-dot" />
            <div className="status-info">
              <span>Live Gateway</span>
              <strong>{liveStatus?.status || "unknown"}</strong>
            </div>
          </div>

          <div className={`status-item ${statusClass(s3Status?.status)}`}>
            <span className="status-dot" />
            <div className="status-info">
              <span>S3 Storage</span>
              <strong>{s3Status?.status || "unknown"}</strong>
            </div>
          </div>
        </div>

        {gateway ? (
          <div className="gateway-info">
            <div>
              <span className="muted">Gateway:</span>{" "}
              <strong>{gateway.gatewayName || gateway.gatewayId}</strong>
            </div>
            <div>
              <span className="muted">Pipeline:</span>{" "}
              <strong className={gateway.pipelineStatus?.status === "online" ? "ok-text" : "bad-text"}>
                {gateway.pipelineStatus?.status || "unknown"}
              </strong>
              {gateway.pipelineStatus?.lastDataReceivedIST ? (
                <span className="muted">
                  {" "}· last data {new Date(gateway.pipelineStatus.lastDataReceivedIST).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
