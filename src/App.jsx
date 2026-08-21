import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertsPanel } from "./components/AlertsPanel";
import { AlertToasts } from "./components/AlertToasts";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { CyclesPanel } from "./components/CyclesPanel";
import { DeviceCards } from "./components/DeviceCards";
import { FurnacePage } from "./components/FurnacePage";
import { LoginPage } from "./components/LoginPage";
import { NotificationBell } from "./components/NotificationBell";
import { api } from "./services/api";
import { connectSocket } from "./services/socket";

const liveLimit = 50;

const parseHash = (hash) => {
  if (!hash || hash === "#" || hash === "#/") return { page: "dashboard" };
  const m = hash.match(/^#\/furnace\/(.+)$/);
  if (m) return { page: "furnace", deviceId: decodeURIComponent(m[1]) };
  return { page: "dashboard" };
};

function App() {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem("plantiqx.auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user ? parsed : null;
    } catch {
      return null;
    }
  });
  const [logoFailed, setLogoFailed] = useState(false);
  const [backendOk, setBackendOk] = useState(false);
  const [connection, setConnection] = useState({ live: null, s3: null });
  const [gateway, setGateway] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [latestRecords, setLatestRecords] = useState([]);
  const [debug, setDebug] = useState({});
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const hasLoadedLatestS3Ref = useRef(false);

  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertToasts, setAlertToasts] = useState([]);
  const [lastReadAt, setLastReadAt] = useState(() => {
    try {
      return localStorage.getItem("plantiqx.notif.lastReadAt") || null;
    } catch {
      return null;
    }
  });

  const dismissToast = useCallback((id) => {
    setAlertToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markNotificationsRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    try {
      localStorage.setItem("plantiqx.notif.lastReadAt", now);
    } catch {
      /* ignore */
    }
  }, []);

  const [topError, setTopError] = useState("");
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  const selectDevice = useCallback((deviceId) => {
    if (!deviceId) return;
    setSelectedDeviceId(deviceId);
    const url = new URL(window.location.href);
    url.searchParams.set("device", deviceId);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const navigateToFurnace = useCallback((deviceId) => {
    if (!deviceId) return;
    window.location.hash = `#/furnace/${encodeURIComponent(deviceId)}`;
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      setBackendOk(true);
      setConnection(health.connection || {});
      setGateway(health.gateway || null);
      setDebug(health.debug || {});
      setTopError("");
    } catch (error) {
      setBackendOk(false);
      setTopError(error.message);
    }
  }, []);

  const refreshLatest = useCallback(async () => {
    try {
      const [live, latest] = await Promise.all([api.getLiveMessages(liveLimit), api.getCombinedLatest()]);
      setLiveMessages(live.items || []);
      setLatestRecords(latest.items || []);
    } catch (error) {
      setTopError(error.message);
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const r = await api.getAlerts(50);
      setActiveAlerts(r.active || []);
      setAlertHistory(r.history || []);
    } catch (error) {
      if (!topError) setTopError(error.message);
    }
  }, [topError]);

  const discoverLatestS3ByDevice = useCallback(async () => {
    try {
      await api.discoverLatestS3PerDevice();
      await refreshLatest();
      await refreshHealth();
    } catch (error) {
      setTopError(error.message);
    }
  }, [refreshHealth, refreshLatest]);

  const sortedRecords = useMemo(
    () =>
      [...latestRecords].sort((a, b) =>
        (a.assetTag || a.deviceId || "").localeCompare(b.assetTag || b.deviceId || "")
      ),
    [latestRecords]
  );

  const liveOnlyRecords = useMemo(
    () => sortedRecords.filter((r) => r.sourceType === "live"),
    [sortedRecords]
  );

  useEffect(() => {
    if (!authUser) return;
    refreshHealth();
    refreshLatest();
    refreshAlerts();

    const interval = setInterval(() => {
      refreshHealth();
      refreshLatest();
      refreshAlerts();
    }, 12000);

    return () => clearInterval(interval);
  }, [authUser, refreshHealth, refreshLatest, refreshAlerts]);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    if (hasLoadedLatestS3Ref.current) return;
    hasLoadedLatestS3Ref.current = true;
    discoverLatestS3ByDevice();
  }, [authUser, discoverLatestS3ByDevice]);

  useEffect(() => {
    if (!authUser) return;
    const socket = connectSocket();

    socket.on("connect", () => setBackendOk(true));

    socket.on("initial_snapshot", (snapshot) => {
      setConnection(snapshot.connection || {});
      setGateway(snapshot.gateway || null);
      setLiveMessages(snapshot.liveMessages || []);
      setLatestRecords(snapshot.latestByDevice || []);
      setDebug(snapshot.debug || {});
      if (snapshot.alerts) {
        setActiveAlerts(snapshot.alerts.active || []);
        setAlertHistory(snapshot.alerts.history || []);
      }
    });

    socket.on("live_status", (status) => {
      setConnection((prev) => ({ ...prev, live: status }));
    });

    socket.on("live_message", (record) => {
      setLiveMessages((previous) => [record, ...previous].slice(0, liveLimit));
      setLatestRecords((previous) => {
        const others = previous.filter((item) => item.deviceId !== record.deviceId);
        return [record, ...others];
      });
    });

    socket.on("latest_snapshot", (payload) => {
      if (payload.latestByDevice) setLatestRecords(payload.latestByDevice);
      if (payload.gateway) setGateway(payload.gateway);
      if (payload.debug) setDebug(payload.debug);
    });

    socket.on("alert_triggered", (alert) => {
      setAlertHistory((prev) => [alert, ...prev].slice(0, 100));
      setActiveAlerts((prev) => {
        const others = prev.filter(
          (a) => !(a.deviceId === alert.deviceId && a.kind === alert.kind)
        );
        return [alert, ...others];
      });
      setAlertToasts((prev) => [alert, ...prev.filter((t) => t.id !== alert.id)].slice(0, 4));
    });

    socket.on("alert_recovered", (recovery) => {
      setActiveAlerts((prev) =>
        prev.filter(
          (a) => !(a.deviceId === recovery.deviceId && a.kind === recovery.previousKind)
        )
      );
      setAlertHistory((prev) => [recovery, ...prev].slice(0, 100));
    });

    socket.on("alerts_cleared", ({ keepActive }) => {
      setAlertHistory([]);
      if (!keepActive) setActiveAlerts([]);
      setAlertToasts([]);
    });

    socket.on("notification_dispatched", ({ alertId, results }) => {
      const merge = (a) => (a.id === alertId ? { ...a, dispatch: results } : a);
      setAlertHistory((prev) => prev.map(merge));
      setActiveAlerts((prev) => prev.map(merge));
    });

    socket.on("disconnect", () => setBackendOk(false));

    return () => {
      socket.close();
    };
  }, [authUser]);

  const handleLogout = useCallback(() => {
    try {
      sessionStorage.removeItem("plantiqx.auth");
    } catch {
      /* ignore */
    }
    setAuthUser(null);
    setBackendOk(false);
    setLiveMessages([]);
    setLatestRecords([]);
    setActiveAlerts([]);
    setAlertHistory([]);
    setAlertToasts([]);
    hasLoadedLatestS3Ref.current = false;
  }, []);

  if (!authUser) {
    return <LoginPage onLoginSuccess={(payload) => setAuthUser(payload)} />;
  }

  const liveStatus = connection.live?.status || "unknown";
  const s3Status = connection.s3?.status || "unknown";

  const dotClass = (status) => {
    if (status === "connected" || status === "available" || status === true) return "green";
    if (status === "connecting" || status === "reconnecting" || status === "unknown") return "yellow";
    return "red";
  };

  return (
    <>
      <AlertToasts
        toasts={alertToasts}
        onDismiss={dismissToast}
        onOpenFurnace={navigateToFurnace}
      />
      <nav className="navbar">
        <div className="navbar-brand">
          {!logoFailed ? (
            <img
              src="/PlantiqX-final-logo.png"
              alt="PlantiqX"
              className="navbar-logo"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="navbar-logo-fallback">PlantiqX</div>
          )}
          <div className="home-menu">
            <span className="home-menu-label">
              <span className="dot green" />
              <span>SGL Unit-1</span>
            </span>
          </div>
        </div>
        <div className="navbar-status">
          <NotificationBell
            activeAlerts={activeAlerts}
            recentAlerts={alertHistory}
            lastReadAt={lastReadAt}
            onMarkRead={markNotificationsRead}
            onOpenFurnace={navigateToFurnace}
          />
          <div className="navbar-indicator">
            <span className={`dot ${dotClass(backendOk)}`} />
            <span>Backend</span>
          </div>
          <div className="navbar-indicator">
            <span className={`dot ${dotClass(liveStatus)}`} />
            <span>Live</span>
          </div>
          <div className="navbar-indicator">
            <span className={`dot ${dotClass(s3Status)}`} />
            <span>S3</span>
          </div>
          {activeAlerts.length > 0 ? (
            <div className="navbar-indicator">
              <span className="dot red" />
              <span>{activeAlerts.length} alerts</span>
            </div>
          ) : null}
          <div className="navbar-user">
            <span className="navbar-user-email" title={authUser.user}>{authUser.user}</span>
            <button type="button" className="navbar-logout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {route.page === "furnace" ? (
        <main className="app">
          <FurnacePage
            deviceId={route.deviceId}
            onBack={() => {
              window.location.hash = "#/";
            }}
          />
        </main>
      ) : (
        <main className="app">
          {topError ? <div className="error-banner">Warning: {topError}</div> : null}

          <div className="dashboard-grid">
            <ConnectionStatus
              backendOk={backendOk}
              liveStatus={connection.live}
              s3Status={connection.s3}
              gateway={gateway}
            />
            <CyclesPanel liveOnlyRecords={liveOnlyRecords} />
          </div>

          <AlertsPanel activeAlerts={activeAlerts} recentAlerts={alertHistory} devices={sortedRecords} />

          <DeviceCards
            records={liveOnlyRecords}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={selectDevice}
            onOpenFurnace={navigateToFurnace}
          />
        </main>
      )}
    </>
  );
}

export default App;
