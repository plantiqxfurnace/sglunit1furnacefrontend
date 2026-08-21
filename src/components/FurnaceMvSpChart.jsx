import { useMemo } from "react";
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Scatter,
  ComposedChart
} from "recharts";

const HOURS = 24;
const WINDOW_MS = HOURS * 60 * 60 * 1000;

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtTime = (ms) => {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const fmtFull = (ms) =>
  new Date(ms).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

const ALERT_KINDS = new Set(["overheat", "undercool", "high_limit", "low_limit"]);

const AlertIcon = (props) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  const kind = payload?.kind || "overheat";
  const isWarning = kind === "undercool" || kind === "low_limit";
  const fill = isWarning ? "#d69b14" : "#dc2626";
  return (
    <g transform={`translate(${cx - 11}, ${cy - 24})`} style={{ pointerEvents: "none" }}>
      {/* Pin / drop body */}
      <path
        d="M11 0 L21 16 Q21 22 11 22 Q1 22 1 16 Z"
        fill={fill}
        stroke="#ffffff"
        strokeWidth="1.5"
        opacity="0.96"
      />
      {/* Warning bang */}
      <path d="M11 6 L11 13" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="11" cy="16.5" r="1.3" fill="#ffffff" />
    </g>
  );
};

const TEMP_KEYS = new Set(["mv", "sp", "mv2", "sp2"]);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const alertPoint = payload.find((p) => p.payload?.kind && ALERT_KINDS.has(p.payload.kind));

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{fmtFull(label)}</div>
      {payload
        .filter((p) => TEMP_KEYS.has(p.dataKey))
        .map((p) => (
          <div key={p.dataKey} className="chart-tooltip-row">
            <span className="chart-tooltip-swatch" style={{ background: p.color }} />
            <span className="chart-tooltip-label">{p.name}</span>
            <strong className="chart-tooltip-value">
              {typeof p.value === "number" ? `${p.value.toFixed(1)}°C` : "—"}
            </strong>
          </div>
        ))}
      {alertPoint ? (
        <div className="chart-tooltip-alert">
          <strong>⚠ {alertPoint.payload.label}</strong>
          {alertPoint.payload.detail ? (
            <span className="chart-tooltip-alert-detail">{alertPoint.payload.detail}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const ALERT_LABELS = {
  overheat: "Overheat triggered",
  undercool: "Undercool triggered",
  high_limit: "High-limit triggered",
  low_limit: "Low-limit triggered"
};

export function FurnaceMvSpChart({ records, alerts = [], deviceId, deviceName }) {
  const { series, stats, hasLib } = useMemo(() => {
    if (!records?.length) return { series: [], stats: null, hasLib: false };

    const cutoff = Date.now() - WINDOW_MS;
    const points = [];
    let libSeen = false;

    for (const r of records) {
      const ts = new Date(r.timestamp || r.receivedAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;

      const metrics = r.parsedMetrics || r.metrics || {};
      const mv = num(metrics.mv);
      const sp = num(metrics.sp);
      const mv2 = num(metrics.mv2);
      const sp2 = num(metrics.sp2);
      if (mv === null && sp === null && mv2 === null && sp2 === null) continue;
      if (mv2 !== null || sp2 !== null) libSeen = true;

      points.push({ t: ts, mv, sp, mv2, sp2 });
    }

    points.sort((a, b) => a.t - b.t);

    if (!points.length) return { series: [], stats: null, hasLib: false };

    const allTempVals = points.flatMap((p) =>
      [p.mv, p.sp, p.mv2, p.sp2].filter((v) => v !== null)
    );
    const min = Math.min(...allTempVals);
    const max = Math.max(...allTempVals);
    const mvVals = points.map((p) => p.mv).filter((v) => v !== null);
    const lastMv  = [...points].reverse().find((p) => p.mv  !== null)?.mv  ?? null;
    const lastSp  = [...points].reverse().find((p) => p.sp  !== null)?.sp  ?? null;
    const lastMv2 = [...points].reverse().find((p) => p.mv2 !== null)?.mv2 ?? null;
    const lastSp2 = [...points].reverse().find((p) => p.sp2 !== null)?.sp2 ?? null;
    const avgMv = mvVals.length ? mvVals.reduce((a, b) => a + b, 0) / mvVals.length : null;

    return {
      series: points,
      hasLib: libSeen,
      stats: {
        count: points.length,
        from: points[0].t,
        to: points[points.length - 1].t,
        min,
        max,
        lastMv,
        lastSp,
        lastMv2,
        lastSp2,
        avgMv
      }
    };
  }, [records]);

  const alertMarkers = useMemo(() => {
    if (!series.length || !alerts?.length) return [];
    const cutoff = Date.now() - WINDOW_MS;
    return alerts
      .filter((a) => a && ALERT_KINDS.has(a.kind))
      .filter((a) => !deviceId || a.deviceId === deviceId)
      .map((a) => {
        const t = new Date(a.timestamp).getTime();
        if (!Number.isFinite(t) || t < cutoff) return null;
        const mv = num(a.mv);
        if (mv === null) return null;
        const delta = num(a.delta);
        return {
          t,
          mv,
          kind: a.kind,
          label: ALERT_LABELS[a.kind] || "Alert triggered",
          detail:
            delta !== null && a.kind === "overheat"
              ? `MV ${mv.toFixed(1)}°C — ${delta.toFixed(1)}°C above SP`
              : delta !== null && a.kind === "undercool"
              ? `MV ${mv.toFixed(1)}°C — ${delta.toFixed(1)}°C below SP`
              : `MV ${mv.toFixed(1)}°C`
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
  }, [alerts, deviceId, series.length]);

  if (!series.length) {
    return (
      <div className="chart-empty">
        <p>No MV/SP data available in the last 24 hours for this furnace.</p>
      </div>
    );
  }

  const markerVals = alertMarkers.map((m) => m.mv);
  const yPad = Math.max(5, (stats.max - stats.min) * 0.1);
  const yMin = Math.floor(Math.min(stats.min, ...markerVals) - yPad);
  const yMax = Math.ceil(Math.max(stats.max, ...markerVals) + yPad);

  return (
    <div className="mv-sp-chart">
      <div className="chart-stats">
        <div className="chart-stat">
          <span className="chart-stat-label">Latest MV</span>
          <strong className="chart-stat-value mv">
            {stats.lastMv !== null ? `${stats.lastMv.toFixed(1)}°C` : "—"}
          </strong>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Latest SP</span>
          <strong className="chart-stat-value sp">
            {stats.lastSp !== null ? `${stats.lastSp.toFixed(1)}°C` : "—"}
          </strong>
        </div>
        {hasLib ? (
          <>
            <div className="chart-stat">
              <span className="chart-stat-label">Latest LIB_MV</span>
              <strong className="chart-stat-value" style={{ color: "#10b981" }}>
                {stats.lastMv2 !== null ? `${stats.lastMv2.toFixed(1)}°C` : "—"}
              </strong>
            </div>
            <div className="chart-stat">
              <span className="chart-stat-label">Latest LIB_SP</span>
              <strong className="chart-stat-value" style={{ color: "#e74c3c" }}>
                {stats.lastSp2 !== null ? `${stats.lastSp2.toFixed(1)}°C` : "—"}
              </strong>
            </div>
          </>
        ) : null}
        <div className="chart-stat">
          <span className="chart-stat-label">24h Avg MV</span>
          <strong className="chart-stat-value">
            {stats.avgMv !== null ? `${stats.avgMv.toFixed(1)}°C` : "—"}
          </strong>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">24h Min / Max</span>
          <strong className="chart-stat-value">
            {stats.min.toFixed(1)} / {stats.max.toFixed(1)}°C
          </strong>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Samples</span>
          <strong className="chart-stat-value">{stats.count}</strong>
        </div>
      </div>

      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart
            data={series}
            margin={{ top: 28, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke="#e8e3f5" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={fmtTime}
              stroke="#6b6685"
              tick={{ fontSize: 12, fill: "#6b6685" }}
              minTickGap={48}
              allowDuplicatedCategory={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="#6b6685"
              tick={{ fontSize: 12, fill: "#6b6685" }}
              tickFormatter={(v) => `${v}°`}
              width={56}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#5925DC", strokeDasharray: "3 3" }} />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              wrapperStyle={{ fontSize: 13, color: "#1b1235", paddingBottom: 4 }}
              payload={[
                { value: "MV (Measured)", type: "line", color: "#5925DC" },
                { value: "SP (Setpoint)", type: "line", color: "#FF8700" },
                ...(hasLib
                  ? [
                      { value: "LIB_MV", type: "line", color: "#10b981" },
                      { value: "LIB_SP", type: "line", color: "#e74c3c" }
                    ]
                  : []),
                ...(alertMarkers.length
                  ? [{ value: `Alerts (${alertMarkers.length})`, type: "circle", color: "#dc2626" }]
                  : [])
              ]}
            />
            {stats.lastSp !== null ? (
              <ReferenceLine
                y={stats.lastSp}
                stroke="#FF8700"
                strokeDasharray="6 4"
                strokeOpacity={0.4}
                ifOverflow="extendDomain"
              />
            ) : null}
            {hasLib && stats.lastSp2 !== null ? (
              <ReferenceLine
                y={stats.lastSp2}
                stroke="#e74c3c"
                strokeDasharray="4 3"
                strokeOpacity={0.35}
                ifOverflow="extendDomain"
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="mv"
              name="MV (Measured)"
              stroke="#5925DC"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: "#5925DC" }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="sp"
              name="SP (Setpoint)"
              stroke="#FF8700"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "#FF8700" }}
              connectNulls
              isAnimationActive={false}
            />
            {hasLib ? (
              <>
                <Line
                  type="monotone"
                  dataKey="mv2"
                  name="LIB_MV"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="sp2"
                  name="LIB_SP"
                  stroke="#e74c3c"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#e74c3c" }}
                  connectNulls
                  isAnimationActive={false}
                />
              </>
            ) : null}
            {alertMarkers.length ? (
              <Scatter
                name="Alerts"
                data={alertMarkers}
                dataKey="mv"
                xAxisId={0}
                yAxisId={0}
                shape={<AlertIcon />}
                isAnimationActive={false}
                legendType="none"
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="chart-footnote">
        Showing {fmtFull(stats.from)} → {fmtFull(stats.to)}
        {deviceName ? ` · ${deviceName}` : ""}
      </p>
    </div>
  );
}
