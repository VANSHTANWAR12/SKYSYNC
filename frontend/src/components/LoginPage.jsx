import { useState } from "react";
import { loginUser, registerUser } from "../services/auth";

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user =
        mode === "login"
          ? await loginUser(email, password)
          : await registerUser(email, password);
      onLogin(user);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to authenticate."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-card__hero">
          <div className="login-badge">SkySync</div>
          <div>
            <h1 className="login-card__title">Secure flight operations access</h1>
            <p className="login-card__subtitle">
              Log in to access live aircraft telemetry, weather threats, and
              autonomous reroute controls.
            </p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="Enter secure password"
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <div className="login-card__footer">
          <span>
            {mode === "login"
              ? "No account yet?"
              : "Already have an account?"}
          </span>
          <button
            type="button"
            className="login-toggle"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
