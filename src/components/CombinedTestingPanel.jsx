import { useState } from "react";

export function CombinedTestingPanel({ records, onSelectDevice }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon purple">CB</div>
          <h2>Combined Testing Panel</h2>
          <span className="panel-badge">{records.length} records</span>
        </div>
        <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        {records.length === 0 ? (
          <div className="empty-state">
            <p>No combined records yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device / Furnace</th>
                  <th>Source</th>
                  <th>Timestamp</th>
                  <th>Received At</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr
                    key={`combined-${item.id}`}
                    className="clickable-row"
                    onClick={() => onSelectDevice(item.deviceId)}
                  >
                    <td>
                      <strong>{item.deviceId}</strong>
                    </td>
                    <td>
                      <span className={`source-badge ${item.sourceType}`}>{item.sourceType}</span>
                    </td>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                    <td>{new Date(item.receivedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
