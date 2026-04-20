import { useState, useEffect } from "react";
import { auth } from "./firebase/config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login      from "./pages/Login";
import Dispatcher from "./pages/Dispatcher";
import Technician from "./pages/Technician";
import ITPortal   from "./pages/ITPortal";

const SESSION_KEY = "kc_session";

export default function App() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage immediately
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch(_) {}

    // Firebase Auth state listener
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      const saved = (() => {
        try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch(_) { return null; }
      })();

      if (!firebaseUser) {
        // Firebase session expired
        // Technician/CSR: keep session (PIN/DB based, not full Firebase Auth)
        if (saved?.role === "technician" || saved?.role === "csr") {
          setUser(saved);
        } else if (saved) {
          // Dispatcher/IT Firebase session expired — force re-login
          localStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      } else {
        // Firebase session valid — restore saved role info
        if (saved) setUser(saved);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  function handleLogin(userData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    setUser(userData);
  }

  async function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    try { await signOut(auth); } catch(_) {}
  }

  if (loading) {
    return (
      <div style={{
        display:"flex", flexDirection:"column", justifyContent:"center",
        alignItems:"center", height:"100vh", background:"#07090f", gap:16,
        fontFamily:"'Plus Jakarta Sans',sans-serif"
      }}>
        <div style={{fontSize:22,fontWeight:800,color:"#dde3ff",letterSpacing:-1}}>
          KEY<span style={{color:"#4d8ef5"}}>CONNECT</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#4d8ef5",
              animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`,opacity:.4}}/>
          ))}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    );
  }

  // ── BUG FIX 1: CSR uses "csr" role — treated same as dispatcher ──
  const isDispatcherOrCsr = user?.role === "dispatcher" || user?.role === "csr";

  return (
    <Router>
      <Routes>
        {/* Root — redirect logged-in users to their dashboard */}
        <Route path="/" element={
          !user ? <Login onLogin={handleLogin} /> :
          isDispatcherOrCsr       ? <Navigate to="/dispatcher" replace /> :
          user.role === "technician" ? <Navigate to="/technician" replace /> :
          user.role === "it"         ? <Navigate to="/it" replace /> :
          <Login onLogin={handleLogin} />
        }/>

        {/* Dispatcher + CSR share the same page */}
        <Route path="/dispatcher" element={
          isDispatcherOrCsr
            ? <Dispatcher user={user} onLogout={handleLogout} />
            : <Navigate to="/" replace />
        }/>

        {/* Technician */}
        <Route path="/technician" element={
          user?.role === "technician"
            ? <Technician user={user} onLogout={handleLogout} />
            : <Navigate to="/" replace />
        }/>

        {/* IT Portal */}
        <Route path="/it" element={
          user?.role === "it"
            ? <ITPortal user={user} onLogout={handleLogout} />
            : <Navigate to="/" replace />
        }/>

        {/* Catch-all */}
        <Route path="*" element={
          !user ? <Navigate to="/" replace /> :
          isDispatcherOrCsr       ? <Navigate to="/dispatcher" replace /> :
          user.role === "technician" ? <Navigate to="/technician" replace /> :
          user.role === "it"         ? <Navigate to="/it" replace /> :
          <Navigate to="/" replace />
        }/>
      </Routes>
    </Router>
  );
}