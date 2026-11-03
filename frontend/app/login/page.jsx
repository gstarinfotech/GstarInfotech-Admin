"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../components/api";

export default function Login() {
  const [email, setEmail] = useState("admin@gstarinfotech.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("gstar_admin_token", result.token);
      router.push("/seo");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">G</div>
            <span>GSTAR INFOTECH</span>
          </div>

          <h1>Welcome back</h1>
          <p className="login-description">
            Sign in to manage your website SEO, blogs, leads and settings.
          </p>

          <form onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gstarinfotech.com"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="login-footer">
            Secure access · GStar Infotech Admin Panel
          </div>
        </section>
      </main>

      <style jsx global>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          background:
            radial-gradient(ellipse at 15% 10%, rgba(14,165,233,.14), transparent 38%),
            radial-gradient(ellipse at 90% 90%, rgba(2,132,199,.11), transparent 35%),
            #070d14;
        }
        .login-card {
          width: 100%;
          max-width: 440px;
          padding: 38px;
          background: linear-gradient(145deg, #111d29, #0d1721);
          border: 1px solid #26394a;
          border-radius: 20px;
          box-shadow: 0 24px 80px rgba(0,0,0,.42);
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 28px;
          color: #9bdcf8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .18em;
        }
        .login-logo {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: white;
          font-size: 19px;
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          box-shadow: 0 8px 22px rgba(14,165,233,.25);
        }
        .login-card h1 {
          margin: 0;
          color: #f3f8fc;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
        }
        .login-description {
          margin: 9px 0 27px;
          color: #91a6b8;
          font-size: 14px;
          line-height: 1.6;
        }
        .login-card form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .login-field label {
          color: #c3d1dc;
          font-size: 13px;
          font-weight: 600;
        }
        .login-field input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #2a3d4d;
          border-radius: 10px;
          background: #09131d;
          color: #f1f7fb;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }
        .login-field input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14,165,233,.13);
        }
        .login-card form button {
          width: 100%;
          height: 48px;
          margin-top: 5px;
          border: 0;
          border-radius: 10px;
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(100deg, #0284c7, #0ea5e9);
          box-shadow: 0 8px 22px rgba(2,132,199,.2);
        }
        .login-card form button:disabled {
          opacity: .65;
          cursor: not-allowed;
        }
        .login-error {
          margin: 0;
          padding: 10px 12px;
          border-radius: 9px;
          background: #451f29;
          color: #fecdd3;
          font-size: 13px;
        }
        .login-footer {
          margin-top: 23px;
          padding-top: 17px;
          border-top: 1px solid #243442;
          color: #71879a;
          font-size: 11px;
          line-height: 1.6;
          text-align: center;
        }
        @media (max-width: 480px) {
          .login-card { padding: 27px 22px; }
          .login-card h1 { font-size: 25px; }
        }
      `}</style>
    </>
  );
}
