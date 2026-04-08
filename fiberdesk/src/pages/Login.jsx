import { useState } from "react";
import { db } from "../firebase/config";
import { ref, get, set } from "firebase/database";
import { DEFAULT_TECHS, DEFAULT_MATERIALS } from "../constants";

// ── STAFF ACCOUNTS ──
const DISPATCHER_ACCOUNTS = [
  { name: "Aeriel", password: "aeriel123" },
  { name: "Riki",   password: "riki123"   },
  { name: "Jeff",   password: "jeff123"   },
];

const IT_ACCOUNTS = [
  { name: "Aeriel",           password: "aeriel123" },
  { name: "Riki",             password: "riki123"   },
  { name: "Jeff",             password: "jeff123"   },
  { name: "Gedion (Head IT)", password: "gedion123" },
];

export default function Login({ onLogin }) {
  const [screen, setScreen] = useState("home"); // home | dispatcher | it | tech | tech-pin
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundTech, setFoundTech] = useState(null);

  async function seedData() {
    const techSnap = await get(ref(db, "technicians"));
    if (!techSnap.exists()) await set(ref(db, "technicians"), DEFAULT_TECHS);
    const matSnap = await get(ref(db, "materials"));
    if (!matSnap.exists()) {
      const mats = {};
      DEFAULT_MATERIALS.forEach((m, i) => { mats["M" + String(i + 1).padStart(2, "0")] = m; });
      await set(ref(db, "materials"), mats);
    }
  }

  function goHome() {
    setScreen("home"); setName(""); setPassword(""); setPin("");
    setError(""); setFoundTech(null); setShowPass(false);
  }

  // ── DISPATCHER LOGIN ──
  async function handleDispatcherLogin() {
    if (!name || !password) { setError("Ilagay ang username at password"); return; }
    setLoading(true); setError("");
    const account = DISPATCHER_ACCOUNTS.find(
      a => a.name.toLowerCase() === name.trim().toLowerCase() && a.password === password
    );
    if (account) {
      try {
        await seedData();
        onLogin({ role: "dispatcher", name: account.name });
      } catch (err) { setError("Error: " + err.message); }
    } else {
      setError("Mali ang username o password.");
    }
    setLoading(false);
  }

  // ── IT LOGIN ──
  async function handleITLogin() {
    if (!name || !password) { setError("Ilagay ang username at password"); return; }
    setLoading(true); setError("");
    const account = IT_ACCOUNTS.find(
      a => a.name.toLowerCase() === name.trim().toLowerCase() && a.password === password
    );
    if (account) {
      try {
        await seedData();
        onLogin({ role: "it", name: account.name });
      } catch (err) { setError("Error: " + err.message); }
    } else {
      setError("Mali ang username o password.");
    }
    setLoading(false);
  }

  // ── TECH: FIND BY USERNAME ──
  async function findTech() {
    if (!name.trim()) { setError("Ilagay ang username"); return; }
    setLoading(true); setError("");
    try {
      await seedData();
      const snap = await get(ref(db, "technicians"));
      if (snap.exists()) {
        const techs = snap.val();
        const found = Object.entries(techs).find(([, t]) =>
          t.loginName?.toLowerCase() === name.trim().toLowerCase() ||
          t.name?.toLowerCase().includes(name.trim().toLowerCase())
        );
        if (found) {
          setFoundTech({ id: found[0], data: found[1] });
          setScreen("tech-pin");
          setError("");
        } else {
          setError("Hindi nahanap ang technician.");
        }
      }
    } catch (err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  // ── TECH: VERIFY PIN ──
  function handlePinInput(digit) {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) verifyPin(newPin);
    }
  }

  function deletePin() { setPin(p => p.slice(0, -1)); setError(""); }

  async function verifyPin(inputPin) {
    const techPin = foundTech.data.pin || "1234";
    if (inputPin === techPin) {
      onLogin({ role: "technician", name: foundTech.data.name, techId: foundTech.id, techData: foundTech.data });
    } else {
      setError("Mali ang PIN. Subukan ulit.");
      setTimeout(() => setPin(""), 600);
    }
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────

  // ── HOME: ROLE SELECTION ──
  if (screen === "home") {
    return (
      <div style={s.bg}>
        <div style={s.grid} />
        <div style={s.box}>
          <div style={s.logo}>KEY<span style={{ color: "#4d8ef5" }}>CONNECT</span></div>
          <div style={s.sub}>KeyConnect · Real-time Dispatch</div>
          <div style={{ marginBottom: 20 }}>
            <div style={s.secLabel}>Pumili ng iyong role</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <RoleCard
                icon="🎧" title="Dispatcher / CSR"
                desc="Mag-create at mag-assign ng job orders"
                color="#4d8ef5" bg="#0d1e42"
                onClick={() => { setScreen("dispatcher"); setError(""); setName(""); setPassword(""); }}
              />
              <RoleCard
                icon="💻" title="IT / Network"
                desc="Mag-activate ng internet ng mga clients"
                color="#20c8b0" bg="#052220"
                onClick={() => { setScreen("it"); setError(""); setName(""); setPassword(""); }}
              />
              <RoleCard
                icon="🔧" title="Technician"
                desc="Tingnan ang mga task at i-update ang status"
                color="#2dcc7a" bg="#081e13"
                onClick={() => { setScreen("tech"); setError(""); setName(""); }}
              />
            </div>
          </div>
          <div style={s.footer}>KeyConnect ISP · LAWA OFFICE</div>
        </div>
      </div>
    );
  }

  // ── DISPATCHER LOGIN ──
  if (screen === "dispatcher") {
    return (
      <div style={s.bg}>
        <div style={s.grid} />
        <div style={s.box}>
          <button style={s.backBtn} onClick={goHome}>← Bumalik</button>
          <div style={s.roleHeader}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🎧</div>
            <div style={s.roleTitle}>Dispatcher / Admin</div>
            <div style={s.roleSub2}>Mag-login gamit ang iyong account</div>
          </div>

          <div style={s.accountList}>
            <div style={s.accountListLabel}>Mga authorized na accounts:</div>
            {DISPATCHER_ACCOUNTS.map(a => (
              <div key={a.name} style={{ ...s.accountChip, ...(name === a.name ? s.accountChipActive : {}) }} onClick={() => { setName(a.name); setError(""); }}>
                <div style={s.accountDot} />
                {a.name}
              </div>
            ))}
          </div>

          <div style={s.fg}>
            <label style={s.lbl}>Username</label>
            <input style={s.input} placeholder="Piliin o i-type ang pangalan" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleDispatcherLogin()} />
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Password</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...s.input, paddingRight: 40, marginBottom: 0 }} type={showPass ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleDispatcherLogin()} />
              <button style={s.eyeBtn} onClick={() => setShowPass(p => !p)}>{showPass ? "🙈" : "👁"}</button>
            </div>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={s.btn} onClick={handleDispatcherLogin} disabled={loading}>
            {loading ? "Loading..." : "Pumasok →"}
          </button>
        </div>
      </div>
    );
  }

  // ── IT LOGIN ──
  if (screen === "it") {
    return (
      <div style={s.bg}>
        <div style={s.grid} />
        <div style={s.box}>
          <button style={s.backBtn} onClick={goHome}>← Bumalik</button>
          <div style={s.roleHeader}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>💻</div>
            <div style={s.roleTitle}>IT / Network</div>
            <div style={s.roleSub2}>Mag-login gamit ang iyong account</div>
          </div>

          <div style={s.accountList}>
            <div style={s.accountListLabel}>Mga authorized na accounts:</div>
            {IT_ACCOUNTS.map(a => (
              <div key={a.name} style={{ ...s.accountChip, ...(name === a.name ? s.accountChipActive : {}) }} onClick={() => { setName(a.name); setError(""); }}>
                <div style={s.accountDot} />
                {a.name}
              </div>
            ))}
          </div>

          <div style={s.fg}>
            <label style={s.lbl}>Username</label>
            <input style={s.input} placeholder="Piliin o i-type ang pangalan" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleITLogin()} />
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Password</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...s.input, paddingRight: 40, marginBottom: 0 }} type={showPass ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleITLogin()} />
              <button style={s.eyeBtn} onClick={() => setShowPass(p => !p)}>{showPass ? "🙈" : "👁"}</button>
            </div>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={{ ...s.btn, background: "#20c8b0" }} onClick={handleITLogin} disabled={loading}>
            {loading ? "Loading..." : "Pumasok →"}
          </button>
        </div>
      </div>
    );
  }

  // ── TECH: USERNAME SEARCH ──
  if (screen === "tech") {
    return (
      <div style={s.bg}>
        <div style={s.grid} />
        <div style={s.box}>
          <button style={s.backBtn} onClick={goHome}>← Bumalik</button>
          <div style={s.roleHeader}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🔧</div>
            <div style={s.roleTitle}>Technician</div>
            <div style={s.roleSub2}>I-type ang iyong username</div>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Username</label>
            <input
              style={s.input}
              placeholder="e.g. arnel, karl, danny..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && findTech()}
              autoFocus
            />
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={{ ...s.btn, background: "#2dcc7a" }} onClick={findTech} disabled={loading}>
            {loading ? "Hinahanap..." : "Susunod →"}
          </button>
        </div>
      </div>
    );
  }

  // ── TECH: PIN PAD ──
  if (screen === "tech-pin" && foundTech) {
    return (
      <div style={s.bg}>
        <div style={s.grid} />
        <div style={s.box}>
          <button style={s.backBtn} onClick={() => { setScreen("tech"); setPin(""); setError(""); setFoundTech(null); }}>← Bumalik</button>

          <div style={s.techGreet}>
            <div style={{ ...s.techAv, background: foundTech.data.bg || "#0d1e42", color: foundTech.data.color || "#4d8ef5" }}>
              {foundTech.data.initials || foundTech.data.name[0]}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#dde3ff" }}>{foundTech.data.name}</div>
              <div style={{ fontSize: 11, color: "#7b87b8" }}>{foundTech.data.spec}</div>
              <div style={{ fontSize: 11, color: "#2dcc7a", marginTop: 2 }}>📍 {foundTech.data.area}</div>
            </div>
          </div>

          <div style={s.pinLabel}>I-enter ang iyong 4-digit PIN</div>
          <div style={s.pinDots}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ ...s.pinDot, background: i < pin.length ? "#2dcc7a" : "#222840", transform: i < pin.length ? "scale(1.2)" : "scale(1)" }} />
            ))}
          </div>
          {error && <div style={{ ...s.error, textAlign: "center", marginBottom: 12 }}>{error}</div>}
          <div style={s.pinGrid}>
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
              <button
                key={i}
                style={{ ...s.pinBtn, ...(d === "" ? { visibility: "hidden" } : {}), ...(d === "⌫" ? { fontSize: 18, color: "#f05555" } : {}) }}
                onClick={() => d === "⌫" ? deletePin() : d !== "" && handlePinInput(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: "#3d4668", marginTop: 12, fontFamily: "monospace" }}>
            Default PIN: 1234 · Para palitan, makipag-ugnayan sa admin
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── ROLE CARD COMPONENT ──
function RoleCard({ icon, title, desc, color, bg, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 14, background: hovered ? bg : "#111525", border: "1.5px solid", borderColor: hovered ? color : "#222840", borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all .2s" }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 26, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: hovered ? color : "#dde3ff" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#7b87b8", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ fontSize: 16, color: hovered ? color : "#3d4668" }}>→</div>
    </div>
  );
}

const s = {
  bg: { minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", fontFamily: "'Plus Jakarta Sans',sans-serif" },
  grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(#222840 1px,transparent 1px),linear-gradient(90deg,#222840 1px,transparent 1px)", backgroundSize: "48px 48px", opacity: .18, pointerEvents: "none" },
  box: { position: "relative", zIndex: 1, background: "#0c0f1a", border: "1px solid #2e3450", borderRadius: 18, padding: "32px 30px", width: 420, maxWidth: "95vw" },
  logo: { fontSize: 26, fontWeight: 800, letterSpacing: -1, marginBottom: 2, color: "#dde3ff" },
  sub: { color: "#7b87b8", fontSize: 11, fontFamily: "monospace", marginBottom: 24 },
  secLabel: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 10 },
  footer: { textAlign: "center", fontSize: 10, color: "#3d4668", fontFamily: "monospace", marginTop: 20 },
  backBtn: { background: "none", border: "none", color: "#7b87b8", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: "0 0 16px", display: "block" },
  roleHeader: { textAlign: "center", marginBottom: 22 },
  roleTitle: { fontSize: 20, fontWeight: 800, color: "#dde3ff", letterSpacing: -.5 },
  roleSub2: { fontSize: 12, color: "#7b87b8", marginTop: 4 },
  accountList: { marginBottom: 16 },
  accountListLabel: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 8 },
  accountChip: { display: "inline-flex", alignItems: "center", gap: 6, background: "#111525", border: "1px solid #222840", borderRadius: 20, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, color: "#dde3ff", cursor: "pointer", marginRight: 6, marginBottom: 6, transition: "all .15s" },
  accountChipActive: { borderColor: "#4d8ef5", background: "#0d1e42", color: "#4d8ef5" },
  accountDot: { width: 6, height: 6, borderRadius: "50%", background: "#2dcc7a" },
  fg: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  lbl: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" },
  input: { width: "100%", background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "10px 13px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none", display: "block" },
  eyeBtn: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2 },
  error: { background: "#2a0a0a", border: "1px solid #f05555", borderRadius: 8, padding: "8px 12px", color: "#f05555", fontSize: 12.5, marginBottom: 12 },
  btn: { width: "100%", background: "#4d8ef5", color: "#fff", border: "none", padding: 12, borderRadius: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  techGreet: { display: "flex", alignItems: "center", gap: 14, background: "#111525", border: "1px solid #222840", borderRadius: 12, padding: "14px 16px", marginBottom: 22 },
  techAv: { width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0 },
  pinLabel: { fontSize: 12, color: "#7b87b8", textAlign: "center", marginBottom: 16 },
  pinDots: { display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 },
  pinDot: { width: 16, height: 16, borderRadius: "50%", transition: "all .15s" },
  pinGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  pinBtn: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", height: 62, borderRadius: 12, fontSize: 22, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .1s" },
};