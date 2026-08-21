import { useState } from "react";
import { JsonBlock } from "./JsonBlock";

export function S3DataViewer({
  files,
  selectedFile,
  fileContent,
  loading,
  onRefresh,
  onDiscoverLatest,
  onSelect
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="panel">
      <div className={`panel-header ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <div className="panel-header-left">
          <div className="panel-icon purple">S3</div>
          <h2>S3 Data Viewer</h2>
          <span className="panel-badge">{files.length} files</span>
        </div>
        <div className="panel-header-actions">
          <button
            className="btn btn-sm btn-outline"
            onClick={(event) => {
              event.stopPropagation();
              onDiscoverLatest?.();
            }}
            type="button"
          >
            Load Latest Per Device
          </button>
          <button
            className="btn btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              onRefresh();
            }}
            type="button"
          >
            Refresh
          </button>
          <span className={`panel-chevron ${open ? "open" : ""}`}>v</span>
        </div>
      </div>

      <div className={`panel-body ${open ? "" : "collapsed"}`}>
        <div className="split">
          <div className="file-list">
            {files.length === 0 ? (
              <div className="empty-state">
                <p>No files found or S3 unavailable.</p>
              </div>
            ) : null}
            {files.map((file) => (
              <button
                type="button"
                key={file.key}
                className={selectedFile === file.key ? "active" : ""}
                onClick={() => onSelect(file.key)}
              >
                <span>{file.key}</span>
                <small>{file.size} bytes</small>
              </button>
            ))}
          </div>

          <div>
            {loading ? <p className="muted">Loading file...</p> : null}
            {!loading && !fileContent ? (
              <div className="empty-state">
                <p>Select a file to inspect raw + parsed views.</p>
              </div>
            ) : null}
            {fileContent ? (
              <div className="stack">
                <p className="muted">
                  Parse mode: <strong>{fileContent.parseMode || "raw"}</strong>
                </p>
                {fileContent.parseError ? <p className="error">Parse error: {fileContent.parseError}</p> : null}
                <JsonBlock label="Raw File Content" value={fileContent.rawPayload} />
                <JsonBlock label="Parsed File Content" value={fileContent.parsedContent || {}} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
