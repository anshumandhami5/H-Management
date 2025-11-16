// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  // login/register mode
  const [mode, setMode] = useState("login");

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // show/hide password toggles
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirmPass, setShowRegConfirmPass] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [regSuccess, setRegSuccess] = useState(""); // message after register
  const [resendMsg, setResendMsg] = useState(""); // message after resend
  const [resendLoading, setResendLoading] = useState(false);

  // If frontend receives ?verified=1, show success message
  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      setRegSuccess("Email verified — you can now sign in.");
      setMode("login");
    }
  }, [searchParams]);

  // ---------------- LOGIN SUBMIT ----------------
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await login({ email, password });
      // If server tells us forcedPasswordChange, redirect to change-password
      if (res?.forcedPasswordChange) {
        navigate("/change-password");
        return;
      }

      const role = res.user?.role;
      if (role === "admin") navigate("/admin");
      else if (role === "doctor") navigate("/doctor");
      else if (role === "reception") navigate("/reception");
      else if (role === "patient") navigate("/patient");
      else navigate("/");
    } catch (error) {
      setErr(error.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  // ---------------- REGISTER SUBMIT ----------------
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setErr("");
    setRegSuccess("");
    setResendMsg("");

    if (!regName.trim()) return setErr("Name is required");
    if (!regEmail.trim()) return setErr("Email is required");
    if (!regPassword) return setErr("Password is required");
    if (regPassword.length < 6) return setErr("Password must be at least 6 characters");
    if (regPassword !== regConfirm) return setErr("Passwords do not match");

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword
        })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(body.message || "Registration failed");

      // show clear message asking user to check email
      setRegSuccess(
        "Account created — please check your email for the verification link. If you didn't receive it, use Resend verification."
      );

      // prefill login email and switch to login mode
      setEmail(regEmail.trim().toLowerCase());
      setMode("login");

      // clear register form fields
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegConfirm("");
    } catch (error) {
      setErr(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // ---------------- RESEND VERIFICATION ----------------
  async function handleResendVerification(targetEmail) {
    setResendMsg("");
    setErr("");
    setResendLoading(true);

    const mail = (targetEmail || email || regEmail || "").trim().toLowerCase();
    if (!mail) {
      setResendMsg("Please enter your email in the login form to resend verification.");
      setResendLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not resend verification");
      setResendMsg("Verification link resent — check your inbox (and spam).");
    } catch (error) {
      setResendMsg(error.message || "Could not resend verification");
    } finally {
      setResendLoading(false);
    }
  }

  // small UI for banner
  function InfoBanner({ children, type = "info" }) {
    const bg = type === "error" ? "#fee2e2" : "#ecfdf5";
    const color = type === "error" ? "#991b1b" : "#065f46";
    return (
      <div style={{ background: bg, color, padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "48px auto",
        padding: "28px",
        background: "white",
        borderRadius: "14px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)"
      }}
    >
      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: "18px" }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            margin: "0 auto 12px",
            background: "linear-gradient(135deg, #0ea5a4, #4dd0e1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 22,
            fontWeight: "700"
          }}
        >
          🏥
        </div>

        <h2 style={{ margin: 0 }}>Hospital Management System</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          {mode === "login" ? "Sign in to your account" : "Create a new patient account"}
        </p>
      </div>

      {/* show registration success / verification messages */}
      {regSuccess && <InfoBanner type="info">{regSuccess}</InfoBanner>}
      {resendMsg && <InfoBanner type={resendMsg.startsWith("Could") ? "error" : "info"}>{resendMsg}</InfoBanner>}
      {err && <InfoBanner type="error">{err}</InfoBanner>}

      {/* TOGGLE BUTTONS */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => { setErr(""); setRegSuccess(""); setResendMsg(""); setMode("login"); }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "none",
            background: mode === "login" ? "#0ea5a4" : "#f1f5f9",
            color: mode === "login" ? "#fff" : "#0f172a",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Sign in
        </button>
        <button
          onClick={() => { setErr(""); setRegSuccess(""); setResendMsg(""); setMode("register"); }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "none",
            background: mode === "register" ? "#0ea5a4" : "#f1f5f9",
            color: mode === "register" ? "#fff" : "#0f172a",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Create account
        </button>
      </div>

      {/* LOGIN FORM */}
      {mode === "login" && (
        <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* EMAIL */}
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              fontSize: "15px"
            }}
          />

          {/* PASSWORD WITH EYE */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="Password"
              type={showLoginPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                paddingRight: "40px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                fontSize: "15px"
              }}
            />
            <button
              type="button"
              onClick={() => setShowLoginPass(!showLoginPass)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px"
              }}
            >
              {showLoginPass ? "👁" : "👁‍🗨"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                background: "#0ea5a4",
                color: "white",
                border: "none",
                padding: "12px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "15px"
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            {/* Resend verification quick button (uses entered email or prefills) */}
            <button
              type="button"
              onClick={() => handleResendVerification(email)}
              disabled={resendLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              {resendLoading ? "Sending..." : "Resend verification"}
            </button>
          </div>
        </form>
      )}

      {/* REGISTER FORM */}
      {mode === "register" && (
        <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            placeholder="Full name"
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              fontSize: "15px"
            }}
          />

          <input
            placeholder="Email"
            type="email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              fontSize: "15px"
            }}
          />

          {/* REGISTER PASSWORD */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="Password (min 6 chars)"
              type={showRegPass ? "text" : "password"}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                paddingRight: "40px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                fontSize: "15px"
              }}
            />

            <button
              type="button"
              onClick={() => setShowRegPass(!showRegPass)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px"
              }}
            >
              {showRegPass ? "👁" : "👁‍🗨"}
            </button>
          </div>

          {/* CONFIRM PASSWORD */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="Confirm password"
              type={showRegConfirmPass ? "text" : "password"}
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                paddingRight: "40px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                fontSize: "15px"
              }}
            />

            <button
              type="button"
              onClick={() => setShowRegConfirmPass(!showRegConfirmPass)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px"
              }}
            >
              {showRegConfirmPass ? "👁" : "👁‍🗨"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                background: "#0ea5a4",
                color: "white",
                border: "none",
                padding: "12px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "15px"
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                // quick shortcut: if user created account but didn't get email, allow resend using regEmail
                handleResendVerification(regEmail);
              }}
              disabled={resendLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              {resendLoading ? "Sending..." : "Resend verification"}
            </button>
          </div>

          {err && <div style={{ color: "#ef4444", fontWeight: 600 }}>{err}</div>}
          {regSuccess && <div style={{ color: "#059669", fontWeight: 600 }}>{regSuccess}</div>}
        </form>
      )}

      {/* FOOTER TOGGLE */}
      <div style={{ marginTop: 16, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
        {mode === "login" ? (
          <span>
            New here?{" "}
            <button
              onClick={() => { setErr(""); setRegSuccess(""); setMode("register"); }}
              style={{
                background: "transparent",
                border: "none",
                color: "#0ea5a4",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Create an account
            </button>
          </span>
        ) : (
          <span>
            Already have an account?{" "}
            <button
              onClick={() => { setErr(""); setRegSuccess(""); setMode("login"); }}
              style={{
                background: "transparent",
                border: "none",
                color: "#0ea5a4",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Sign in
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
