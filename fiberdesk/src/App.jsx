import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dispatcher from "./pages/Dispatcher";
import Technician from "./pages/Technician";
import ITPortal from "./pages/ITPortal";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for persisted user on app load
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#07090f',
        color: '#dde3ff',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              user.role === "dispatcher" ? <Navigate to="/dispatcher" replace /> :
              user.role === "technician" ? <Navigate to="/technician" replace /> :
              user.role === "it" ? <Navigate to="/it" replace /> :
              <Login onLogin={handleLogin} />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/dispatcher"
          element={
            user?.role === "dispatcher" ? (
              <Dispatcher user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/technician"
          element={
            user?.role === "technician" ? (
              <Technician user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/it"
          element={
            user?.role === "it" ? (
              <ITPortal user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* Catch all route - redirect to appropriate dashboard or login */}
        <Route
          path="*"
          element={
            user ? (
              user.role === "dispatcher" ? <Navigate to="/dispatcher" replace /> :
              user.role === "technician" ? <Navigate to="/technician" replace /> :
              user.role === "it" ? <Navigate to="/it" replace /> :
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}
