const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Request failed");
  }
  return payload;
};

export const api = {
  baseUrl: API_BASE_URL,
  getHealth: () => request("/api/health"),
  getGateway: () => request("/api/gateway"),
  getLiveMessages: (limit = 50) => request(`/api/messages/live?limit=${limit}`),
  getLatestMessages: () => request("/api/messages/latest"),
  getDevices: () => request("/api/devices"),
  getCombinedLatest: () => request("/api/combined/latest"),
  getDeviceRecords: (deviceId, limit = 120) =>
    request(`/api/device/${encodeURIComponent(deviceId)}/records?limit=${limit}`),

  // S3
  getS3Files: () => request("/api/s3/files"),
  getS3File: (key) => request(`/api/s3/file/${encodeURIComponent(key)}`),
  getS3Devices: () => request("/api/s3/devices"),
  getS3DeviceDates: (deviceId) => request(`/api/s3/device/${encodeURIComponent(deviceId)}/dates`),
  getS3DeviceFiles: (deviceId, date) =>
    request(
      `/api/s3/device/${encodeURIComponent(deviceId)}/files${
        date ? `?date=${encodeURIComponent(date)}` : ""
      }`
    ),
  discoverLatestS3PerDevice: () => request("/api/s3/discover/latest"),
  loadS3DeviceHistory: (deviceId, limit = 100) =>
    request(`/api/s3/device/${encodeURIComponent(deviceId)}/load-recent?limit=${limit}`),
  getS3DeviceHistory: (deviceId, date) =>
    request(`/api/s3/device/${encodeURIComponent(deviceId)}/history?date=${encodeURIComponent(date)}`),

  // Cycles
  getCyclesDaily: (month) =>
    request(`/api/cycles/daily${month ? `?month=${encodeURIComponent(month)}` : ""}`),

  // Alerts
  getAlerts: (limit = 50) => request(`/api/alerts?limit=${limit}`),
  getAlertConfig: () => request("/api/alerts/config"),
  updateAlertConfig: (patch) =>
    request("/api/alerts/config", { method: "PUT", body: JSON.stringify(patch) }),
  getAssetLimits: () => request("/api/alerts/asset-limits"),
  updateAssetLimits: (patch) =>
    request("/api/alerts/asset-limits", { method: "PUT", body: JSON.stringify(patch) }),
  getAlertSubscribers: () => request("/api/alerts/subscribers"),

  // Email subscribers
  addEmailSubscriber: (email) =>
    request("/api/alerts/subscribers/email", { method: "POST", body: JSON.stringify({ email }) }),
  removeEmailSubscriber: (email) =>
    request(`/api/alerts/subscribers/email?email=${encodeURIComponent(email)}`, { method: "DELETE" }),

  // WhatsApp subscribers
  addWhatsappSubscriber: (number) =>
    request("/api/alerts/subscribers/whatsapp", { method: "POST", body: JSON.stringify({ number }) }),
  removeWhatsappSubscriber: (number) =>
    request(`/api/alerts/subscribers/whatsapp?number=${encodeURIComponent(number)}`, {
      method: "DELETE"
    }),

  // SMS subscribers
  addSmsSubscriber: (number) =>
    request("/api/alerts/subscribers/sms", { method: "POST", body: JSON.stringify({ number }) }),
  removeSmsSubscriber: (number) =>
    request(`/api/alerts/subscribers/sms?number=${encodeURIComponent(number)}`, {
      method: "DELETE"
    }),

  sendAlertTest: (channel = "all") =>
    request("/api/alerts/test", { method: "POST", body: JSON.stringify({ channel }) }),
  clearAlertHistory: (keepActive = false) =>
    request("/api/alerts/clear", { method: "POST", body: JSON.stringify({ keepActive }) })
};