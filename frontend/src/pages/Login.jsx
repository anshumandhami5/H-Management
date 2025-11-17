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

  // Banner component (tailwind)
  function InfoBanner({ children, type = "info" }) {
    const base = "rounded-md px-4 py-2 text-sm font-semibold";
    if (type === "error") {
      return <div className={`${base} bg-red-50 text-red-700 border border-red-100`}>{children}</div>;
    }
    return <div className={`${base} bg-emerald-50 text-emerald-800 border border-emerald-100`}>{children}</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* LEFT: Brand / Illustration */}
        <div className="hidden md:flex flex-col items-start justify-center space-y-6 bg-gradient-to-br from-emerald-600 to-sky-400 text-white rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-2xl font-bold shadow">
              <span>🏥</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">Hospital Management</h1>
              <p className="text-sm opacity-90">Patient bookings, reception and doctor workflows</p>
            </div>
          </div>

          <div className="mt-4 text-sm leading-relaxed opacity-95">
            <p className="mb-2">Fast appointments — email confirmations — real-time updates.</p>
            <p className="text-xs opacity-90">Use your account to access the dashboard. New patients can create an account below.</p>
          </div>

          <div className="mt-auto text-sm opacity-90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">✓</div>
              <div>Secure & easy</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-2xl">🏥</div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Hospital Management System</h2>
                <p className="text-sm text-slate-500">
                  {mode === "login" ? "Sign in to your account" : "Create a new patient account"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setErr(""); setRegSuccess(""); setResendMsg(""); setMode("login"); }}
                className={`px-3 py-1 rounded-md text-sm font-semibold ${mode === "login" ? "bg-emerald-600 text-white" : "bg-gray-100 text-slate-700"}`}
              >
                Sign in
              </button>
              <button
                onClick={() => { setErr(""); setRegSuccess(""); setResendMsg(""); setMode("register"); }}
                className={`px-3 py-1 rounded-md text-sm font-semibold ${mode === "register" ? "bg-emerald-600 text-white" : "bg-gray-100 text-slate-700"}`}
              >
                Create account
              </button>
            </div>
          </div>

          {/* messages */}
          <div className="space-y-3 mb-4">
            {regSuccess && <InfoBanner type="info">{regSuccess}</InfoBanner>}
            {resendMsg && <InfoBanner type={resendMsg.startsWith("Could") ? "error" : "info"}>{resendMsg}</InfoBanner>}
            {err && <InfoBanner type="error">{err}</InfoBanner>}
          </div>

          {/* forms */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    placeholder="Your password"
                    type={showLoginPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-lg"
                    aria-label="toggle password visibility"
                  >
                    {showLoginPass ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2 font-semibold"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>

                <button
                  type="button"
                  onClick={() => handleResendVerification(email)}
                  disabled={resendLoading}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-slate-700 bg-white"
                >
                  {resendLoading ? "Sending..." : "Resend verification"}
                </button>
              </div>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                <input
                  placeholder="Your full name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  placeholder="you@example.com"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    placeholder="Password (min 6 chars)"
                    type={showRegPass ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass(!showRegPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-lg"
                    aria-label="toggle password visibility"
                  >
                    {showRegPass ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                <div className="relative">
                  <input
                    placeholder="Confirm password"
                    type={showRegConfirmPass ? "text" : "password"}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPass(!showRegConfirmPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-lg"
                    aria-label="toggle password visibility"
                  >
                    {showRegConfirmPass ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2 font-semibold"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>

                <button
                  type="button"
                  onClick={() => handleResendVerification(regEmail)}
                  disabled={resendLoading}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-slate-700 bg-white"
                >
                  {resendLoading ? "Sending..." : "Resend verification"}
                </button>
              </div>

              {err && <div className="text-sm font-semibold text-red-600">{err}</div>}
              {regSuccess && <div className="text-sm font-semibold text-emerald-700">{regSuccess}</div>}
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <span>
                New here?{" "}
                <button
                  onClick={() => { setErr(""); setRegSuccess(""); setMode("register"); }}
                  className="text-emerald-600 font-semibold"
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  onClick={() => { setErr(""); setRegSuccess(""); setMode("login"); }}
                  className="text-emerald-600 font-semibold"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
