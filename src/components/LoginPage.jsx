import { useState } from "react";

const VALID_USERNAME = "admin@plantiqx.com";
const VALID_PASSWORD = "Admin@2026";

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [heroBgFailed, setHeroBgFailed] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const u = username.trim().toLowerCase();
      const p = password;
      if (u === VALID_USERNAME && p === VALID_PASSWORD) {
        try {
          sessionStorage.setItem("plantiqx.auth", JSON.stringify({
            user: VALID_USERNAME,
            loggedInAt: new Date().toISOString()
          }));
        } catch {
          /* ignore */
        }
        onLoginSuccess({ user: VALID_USERNAME });
      } else {
        setError("Invalid credentials. Please verify your username and password.");
        setLoading(false);
      }
    }, 450);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <aside className={`login-hero ${heroBgFailed ? "login-hero--fire" : ""}`}>
          {!heroBgFailed ? (
            <img
              src="/Enhance-Blast-Furnace-Operations-in-the-Steel-Production-Process.webp"
              alt=""
              className="login-hero-bg"
              aria-hidden="true"
              onError={() => setHeroBgFailed(true)}
            />
          ) : (
            <div className="login-hero-fire" aria-hidden="true">
              <div className="ember ember--1" />
              <div className="ember ember--2" />
              <div className="ember ember--3" />
              <div className="ember ember--4" />
              <div className="ember ember--5" />
              <div className="ember ember--6" />
              <div className="ember ember--7" />
              <div className="ember ember--8" />
              <div className="ember ember--9" />
              <div className="flame-glow flame-glow--a" />
              <div className="flame-glow flame-glow--b" />
              <div className="flame-glow flame-glow--c" />
            </div>
          )}
          <div className="login-hero-overlay" />

          <div className="login-hero-content">
            <div className="login-hero-badge">Industrial IoT Platform</div>
            <h2 className="login-hero-title">PlantiqX Furnace Monitoring</h2>
            <p className="login-hero-text">
              Real-time visibility into your furnaces — temperature, pressure, and operational health,
              streamed live with alerts that get to the right people, fast.
            </p>
            <ul className="login-hero-list">
              <li><span className="dot-orange" /> Live telemetry from every furnace</li>
              <li><span className="dot-orange" /> Threshold-based alerting &amp; recovery</li>
              <li><span className="dot-orange" /> Historical S3 data exploration</li>
            </ul>
          </div>
        </aside>

        <section className="login-form-side">
          <div className="login-form-inner">
            <div className="login-brand">
              {!logoFailed ? (
                <img
                  src="/plantiqx-brand-logo.svg"
                  alt="PlantiqX"
                  className="login-logo"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="login-logo-fallback">PlantiqX</div>
              )}
            </div>

            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">
              Sign in to access the PlantiqX Furnace Monitoring dashboard.
            </p>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <label className="login-field">
                <span className="login-label">Email address</span>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2.5-.5a.5.5 0 0 0-.5.5v.4l7 4.2 7-4.2v-.4a.5.5 0 0 0-.5-.5h-13Zm13.5 2.766-6.486 3.892a1 1 0 0 1-1.028 0L5 8.766V17.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V8.766Z"
                      fill="currentColor"
                    />
                  </svg>
                  <input
                    type="email"
                    autoComplete="username"
                    className="login-input"
                    placeholder="you@plantiqx.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="login-field">
                <span className="login-label">Password</span>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Zm3 4a2 2 0 0 1 1 3.732V19a1 1 0 1 1-2 0v-1.268A2 2 0 0 1 12 14Z"
                      fill="currentColor"
                    />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="login-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="login-input-action"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {error ? <div className="login-error">{error}</div> : null}

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="login-footer">
              <span>© {new Date().getFullYear()} PlantiqX · Industrial IoT</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
