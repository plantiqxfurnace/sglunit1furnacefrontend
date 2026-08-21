export function JsonBlock({ label, value }) {
  return (
    <div className="json-block">
      <h4>{label}</h4>
      <pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
