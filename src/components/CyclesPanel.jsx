import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

// Colours for the 4 furnaces in the bar chart
const FURNACE_COLORS = ["#5925DC", "#10b981", "#FF8700", "#e74c3c"];
const FURNACE_LABELS = ["F1", "F2", "F3", "F4"];

// Generate YYYY-MM string for current month
const currentMonthStr = () => new Date().toISOString().slice(0, 7);

// Fill every day of a month with defaults
const daysInMonth = (monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const d = i + 1;
    return `${monthStr}-${String(d).padStart(2, "0")}`;
  });
};

// ----- Grouped Bar Chart (pure SVG) -----
function BarChart({ days, dayKeys, deviceIds, assetTags }) {
  const BAR_W = 10;
  const GROUP_GAP = 6;
  const GROUP_W = deviceIds.length * BAR_W + GROUP_GAP;
  const CHART_H = 160;
  const LABEL_H = 30;
  const LEFT_PAD = 32;
  const RIGHT_PAD = 8;

  const totalWidth = Math.max(300, dayKeys.length * GROUP_W + LEFT_PAD + RIGHT_PAD);

  const maxCount = useMemo(() => {
    let m = 1;
    dayKeys.forEach((d) => {
      deviceIds.forEach((id) => {
        const v = days[d]?.[id] || 0;
        if (v > m) m = v;
      });
    });
    return m;
  }, [days, dayKeys, deviceIds]);

  const yTicks = useMemo(() => {
    const step = maxCount <= 5 ? 1 : maxCount <= 10 ? 2 : Math.ceil(maxCount / 5);
    const ticks = [];
    for (let v = 0; v <= maxCount; v += step) ticks.push(v);
    return ticks;
  }, [maxCount]);

  const barY = (count) => CHART_H - (count / maxCount) * CHART_H;
  const barH = (count) => (count / maxCount) * CHART_H;

  return (
    <div className="cycles-chart-wrap">
      <svg
        viewBox={`0 0 ${totalWidth} ${CHART_H + LABEL_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Y-axis grid lines + tick labels */}
        {yTicks.map((v) => {
          const y = barY(v);
          return (
            <g key={v}>
              <line
                x1={LEFT_PAD}
                y1={y}
                x2={totalWidth - RIGHT_PAD}
                y2={y}
                stroke="var(--card-border)"
                strokeWidth={1}
              />
              <text
                x={LEFT_PAD - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="var(--text-soft)"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {dayKeys.map((date, gi) => {
          const groupX = LEFT_PAD + gi * GROUP_W;
          const day = date.slice(8); // DD
          return (
            <g key={date}>
              {deviceIds.map((id, fi) => {
                const count = days[date]?.[id] || 0;
                const x = groupX + fi * BAR_W;
                const y = barY(count);
                const h = barH(count);
                return (
                  <g key={id}>
                    <rect
                      x={x}
                      y={y}
                      width={BAR_W - 2}
                      height={h}
                      fill={FURNACE_COLORS[fi % FURNACE_COLORS.length]}
                      rx={2}
                      opacity={count === 0 ? 0.15 : 0.85}
                    />
                    {count > 0 && h > 14 ? (
                      <text
                        x={x + (BAR_W - 2) / 2}
                        y={y + h - 4}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#fff"
                        fontWeight="bold"
                      >
                        {count}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {/* X-axis day label — show every 3 days to avoid crowding */}
              {(Number(day) - 1) % 3 === 0 ? (
                <text
                  x={groupX + (deviceIds.length * BAR_W) / 2}
                  y={CHART_H + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-soft)"
                >
                  {day}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={LEFT_PAD}
          y1={CHART_H}
          x2={totalWidth - RIGHT_PAD}
          y2={CHART_H}
          stroke="var(--card-border)"
          strokeWidth={1.5}
        />
      </svg>

      {/* Legend */}
      <div className="cycles-legend">
        {deviceIds.map((id, fi) => (
          <span key={id} className="cycles-legend-item">
            <span
              className="cycles-legend-dot"
              style={{ background: FURNACE_COLORS[fi % FURNACE_COLORS.length] }}
            />
            {assetTags[id] || FURNACE_LABELS[fi] || id}
          </span>
        ))}
      </div>
    </div>
  );
}

// ----- Stat Box for one furnace (live cycle count KPI) -----
function CycleStatBox({ assetTag, processCycle, cycleActive, cycleCount }) {
  const isActive = cycleActive === true || processCycle === 0;
  const displayCount = cycleCount !== null && cycleCount !== undefined ? cycleCount : "—";
  return (
    <div className={`cycle-stat-box ${isActive ? "cycle-stat-active" : "cycle-stat-idle"}`}>
      <span className="cycle-stat-tag">{assetTag || "—"}</span>
      <strong className="cycle-stat-val">{displayCount}</strong>
      <span className="cycle-stat-unit" style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 2 }}>cycles</span>
      <span className={`cycle-stat-badge ${isActive ? "status-on" : "status-off"}`}>
        {isActive ? "ON" : "OFF"}
      </span>
    </div>
  );
}

export function CyclesPanel({ liveOnlyRecords }) {
  const defaultMonth = useMemo(currentMonthStr, []);
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (m) => {
    setLoading(true);
    try {
      const result = await api.getCyclesDaily(m);
      setData(result);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  // Also refresh when live records update (every ~30 s poll)
  useEffect(() => {
    if (liveOnlyRecords?.length) load(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOnlyRecords]);

  // Build display data
  const deviceIds = useMemo(() => Object.keys(data?.current || {}).sort(), [data]);
  const assetTags = useMemo(() => {
    const m = {};
    (deviceIds).forEach((id) => { m[id] = data?.current?.[id]?.assetTag || id; });
    return m;
  }, [data, deviceIds]);

  const dayKeys = useMemo(() => daysInMonth(month), [month]);
  const days = data?.days || {};

  // Total cycles this month per furnace (sum across all days)
  const totals = useMemo(() => {
    const t = {};
    deviceIds.forEach((id) => {
      t[id] = dayKeys.reduce((sum, d) => sum + (days[d]?.[id] || 0), 0);
    });
    return t;
  }, [deviceIds, dayKeys, days]);

  // Month options: current month + last 5 months
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push(d.toISOString().slice(0, 7));
    }
    return opts;
  }, []);

  return (
    <section className="panel cycles-panel">
      <div className="panel-header open">
        <div className="panel-header-left">
          <div className="panel-icon" style={{ background: "#5925DC", color: "#fff" }}>CY</div>
          <h2>Cycle Count</h2>
          <span className="panel-badge">PROCESS_CYCLE · live + history</span>
          {loading ? <span className="panel-badge" style={{ color: "var(--brand-indigo)" }}>⟳</span> : null}
        </div>
        {/* Month filter */}
        <div className="cycles-filter">
          <label className="cycles-filter-label" htmlFor="cycle-month-select">Month</label>
          <select
            id="cycle-month-select"
            className="cycles-month-select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel-body">
        {/* Live PROCESS_CYCLE stat boxes */}
        <div className="cycle-stat-row">
          {deviceIds.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Waiting for live data…</p>
          ) : (
            deviceIds.map((id) => {
              const cur = data?.current?.[id] || {};
              return (
                <CycleStatBox
                  key={id}
                  assetTag={cur.assetTag}
                  processCycle={cur.processCycle}
                  cycleActive={cur.cycleActive}
                  cycleCount={cur.cycleCount}
                />
              );
            })
          )}
        </div>

        {/* Monthly total summary */}
        {deviceIds.length > 0 ? (
          <div className="cycles-totals">
            {deviceIds.map((id, fi) => (
              <span key={id} className="cycles-total-item">
                <span
                  className="cycles-legend-dot"
                  style={{ background: FURNACE_COLORS[fi % FURNACE_COLORS.length] }}
                />
                <strong>{assetTags[id]}</strong>
                <span className="muted">·</span>
                <strong>{totals[id] ?? 0}</strong>
                <span className="muted" style={{ fontSize: 11 }}>cycles this month</span>
              </span>
            ))}
          </div>
        ) : null}

        {/* Bar chart */}
        {deviceIds.length > 0 ? (
          <>
            <div className="cycles-chart-header">
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                Cycles per day · {month}
              </span>
            </div>
            <BarChart
              days={days}
              dayKeys={dayKeys}
              deviceIds={deviceIds}
              assetTags={assetTags}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
