// src/components/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as authService from "../services/auth";

const AuthContext = createContext();

// Small JWT payload decoder (no signature verification) — used only to read exp
function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = authService.getAuth?.();
    return raw?.user || null;
  });
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (function init() {
      try {
        const raw = authService.getAuth?.();
        if (raw?.token && raw.token !== "demo.jwt.token") {
          try {
            const payload = decodeJwt(raw.token);
            if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
              authService.clearAuth?.();
              setUser(null);
            } else {
              setUser(raw.user || null);
            }
          } catch (err) {
            authService.clearAuth?.();
            setUser(null);
          }
        } else {
          setUser(raw?.user || null);
        }
      } catch (e) {
        try { authService.clearAuth?.(); } catch {}
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // login wrapper - expects authService.loginApi to return { user, token, forcedPasswordChange? }
  async function login(creds) {
    const res = await authService.loginApi(creds);
    // res typically: { token, user, forcedPasswordChange }
    authService.saveAuth?.(res);
    setUser(res.user || null);

    // If the server signals the user must change password, redirect to change password page
    if (res.forcedPasswordChange) {
      // navigate after a tiny delay to ensure auth saved
      setTimeout(() => navigate("/change-password"), 50);
    }

    return res;
  }

  function logout() {
    try {
      authService.clearAuth?.();
    } catch (e) { /* ignore */ }
    setUser(null);
    try { navigate("/login"); } catch (e) { /* ignore */ }
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
