import { useState } from "react";
import Login from "./pages/Login";
import Dispatcher from "./pages/Dispatcher";
import Technician from "./pages/Technician";
import ITPortal from "./pages/ITPortal";

export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <Login onLogin={setUser} />;
  if (user.role === "dispatcher") return <Dispatcher user={user} onLogout={() => setUser(null)} />;
  if (user.role === "technician") return <Technician user={user} onLogout={() => setUser(null)} />;
  if (user.role === "it") return <ITPortal user={user} onLogout={() => setUser(null)} />;
}
