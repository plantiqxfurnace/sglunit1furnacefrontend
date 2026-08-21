// Keys that represent temperatures (format with °C)
const TEMP_KEYS = new Set(["mv", "sp", "mv2", "sp2", "mv_min", "mv_max", "mv_avg", "deviation"]);

// Keys that are boolean ON/OFF (1/true = ON, 0/false = OFF)
const BOOL_ON_OFF_KEYS = new Set(["buzzer", "cycleactive"]);

// Keys that are boolean cycle active (true/false → ON/OFF)
const BOOL_CYCLE_KEYS = new Set(["cycleactive"]);

const TEMP_METRIC_PATTERN = /^F\d+_(SV|PV)$/i;
const DIRECT_TEMP_KEYS = new Set(["pv", "sv", "temperature", "temp"]);

export const formatMetricValue = (key, value) => {
  const normalizedKey = String(key || "").toLowerCase();

  // Boolean ON/OFF fields
  if (BOOL_ON_OFF_KEYS.has(normalizedKey)) {
    return value === 1 || value === true ? "ON" : "OFF";
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  // Named temperature keys
  if (Number.isFinite(numericValue) && TEMP_KEYS.has(normalizedKey)) {
    return `${numericValue.toFixed(1)} °C`;
  }

  // Pattern-matched temperature keys (Fx_SV / Fx_PV legacy)
  if (Number.isFinite(numericValue) && TEMP_METRIC_PATTERN.test(key)) {
    return `${(numericValue / 10).toFixed(1)} °C`;
  }

  // Misc direct temp keys
  if (Number.isFinite(numericValue) && DIRECT_TEMP_KEYS.has(normalizedKey)) {
    return `${numericValue.toFixed(1)} °C`;
  }

  // processCycle as readable label
  if (normalizedKey === "processcycle") {
    return numericValue === 1 ? "Active" : numericValue === 0 ? "Idle" : String(value);
  }

  return String(value ?? "—");
};

// Human-readable column header for a metric key
export const metricLabel = (key) => {
  const map = {
    mv: "MV (°C)",
    sp: "SP (°C)",
    mv2: "LIB_MV (°C)",
    sp2: "LIB_SP (°C)",
    mv_min: "Min Temp",
    mv_max: "Max Temp",
    mv_avg: "Avg Temp",
    buzzer: "Buzzer",
    cycleActive: "Cycle",
    processCycle: "Process Cycle",
    programId: "Program ID",
    cycleIndex: "Cycle Count",
    cycleStartTime: "Cycle Start",
    cycleEndTime: "Cycle End",
    deviation: "Deviation (°C)",
    unit: "Unit",
  };
  return map[key] || key;
};
