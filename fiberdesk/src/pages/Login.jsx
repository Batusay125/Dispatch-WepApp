import { useState, useEffect } from "react";
import { auth, db } from "../firebase/config";
import { signInWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { DEFAULT_TECHS, DEFAULT_MATERIALS } from "../constants";

const DISPATCHER_EMAILS = [
  { name:"Aeriel", email:"aeriel@keyconnect.com", color:"#4d8ef5", bg:"#0d1e42", initials:"AE" },
  { name:"Riki",   email:"riki@keyconnect.com",   color:"#9b78f5", bg:"#160f30", initials:"RI" },
  { name:"Jeff",   email:"jeff@keyconnect.com",   color:"#20c8b0", bg:"#052220", initials:"JF" },
];
const IT_EMAILS = [
  { name:"Aeriel", email:"aeriel@keyconnect.com",  color:"#4d8ef5", bg:"#0d1e42", initials:"AE" },
  { name:"Riki",   email:"riki@keyconnect.com",    color:"#9b78f5", bg:"#160f30", initials:"RI" },
  { name:"Jeff",   email:"jeff@keyconnect.com",    color:"#20c8b0", bg:"#052220", initials:"JF" },
  { name:"Gedion", email:"gedion@keyconnect.com",  color:"#f0a030", bg:"#2a1a05", initials:"GD" },
];

export default function Login({ onLogin }) {
  const [screen,    setScreen]    = useState("home");
  const [selUser,   setSelUser]   = useState(null);
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [pin,       setPin]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [foundTech, setFoundTech] = useState(null);
  const [techList,  setTechList]  = useState([]);
  const [username,  setUsername]  = useState("");

  // Load technicians for clickable profiles
  useEffect(() => {
    if (screen === "tech") {
      loadTechs();
    }
  }, [screen]);

  async function loadTechs() {
    try {
      await signInAnonymously(auth);
      const snap = await get(ref(db, "technicians"));
      if (snap.exists()) {
        const list = Object.entries(snap.val()).map(([id, t]) => ({ id, ...t }));
        setTechList(list);
      }
    } catch(e) { /* silent */ }
  }

  async function seedData() {
    const ts = await get(ref(db,"technicians"));
    if (!ts.exists()) await set(ref(db,"technicians"), DEFAULT_TECHS);
    const ms = await get(ref(db,"materials"));
    if (!ms.exists()) {
      const mats = {};
      DEFAULT_MATERIALS.forEach((m,i) => { mats["M"+String(i+1).padStart(2,"0")] = m; });
      await set(ref(db,"materials"), mats);
    }
  }

  function goHome() {
    setScreen("home"); setSelUser(null); setPassword(""); setPin("");
    setError(""); setFoundTech(null); setShowPass(false); setUsername("");
  }

  function selectUser(user) {
    setSelUser(user); setError(""); setPassword(""); setShowPass(false);
  }

  function selectTech(tech) {
    setFoundTech({ id: tech.id, data: tech });
    setScreen("tech-pin"); setPin(""); setError("");
  }

  // ── DISPATCHER LOGIN ──
  async function handleDispatcherLogin() {
    if (!selUser) { setError("Piliin ang iyong account"); return; }
    if (!password) { setError("Ilagay ang password"); return; }
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, selUser.email, password);
      await seedData();
      onLogin({ role:"dispatcher", name: selUser.name });
    } catch(err) { setError(getAuthError(err.code)); }
    setLoading(false);
  }

  // ── IT LOGIN ──
  async function handleITLogin() {
    if (!selUser) { setError("Piliin ang iyong account"); return; }
    if (!password) { setError("Ilagay ang password"); return; }
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, selUser.email, password);
      await seedData();
      onLogin({ role:"it", name: selUser.name });
    } catch(err) { setError(getAuthError(err.code)); }
    setLoading(false);
  }

  // ── TECH: search by typing ──
  async function findTechByUsername() {
    if (!username.trim()) { setError("Ilagay ang username"); return; }
    setLoading(true); setError("");
    try {
      await signInAnonymously(auth);
      await seedData();
      const snap = await get(ref(db,"technicians"));
      if (snap.exists()) {
        const techs = snap.val();
        const found = Object.entries(techs).find(([,t]) =>
          t.loginName?.toLowerCase() === username.trim().toLowerCase() ||
          t.name?.toLowerCase().includes(username.trim().toLowerCase())
        );
        if (found) {
          setFoundTech({ id:found[0], data:found[1] });
          setScreen("tech-pin"); setError(""); setPin("");
        } else {
          setError("Hindi nahanap. I-click ang profile o subukan ulit.");
        }
      }
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  // ── PIN ──
  function handlePinInput(digit) {
    if (pin.length < 4) {
      const np = pin + digit;
      setPin(np);
      if (np.length === 4) verifyPin(np);
    }
  }
  function deletePin() { setPin(p => p.slice(0,-1)); setError(""); }
  async function verifyPin(inputPin) {
    const techPin = foundTech.data.pin || "1234";
    if (inputPin === techPin) {
      onLogin({ role:"technician", name:foundTech.data.name, techId:foundTech.id, techData:foundTech.data });
    } else {
      setError("Mali ang PIN. Subukan ulit.");
      setTimeout(() => setPin(""), 700);
    }
  }

  function getAuthError(code) {
    if (["auth/invalid-credential","auth/wrong-password","auth/user-not-found"].includes(code))
      return "Mali ang password.";
    if (code === "auth/too-many-requests")
      return "Masyadong maraming attempts. Subukan mamaya.";
    return "Login error. Subukan ulit.";
  }

  // ══════════════════════════════════════
  // RENDERS
  // ══════════════════════════════════════

  // HOME
  if (screen === "home") return (
    <Bg>
      <div style={s.logo}>KEY<span style={{color:"#4d8ef5"}}>CONNECT</span></div>
      <div style={s.sub}>KeyConnect · Real-time Dispatch</div>
      <div style={s.secLabel}>Pumili ng iyong role</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        <RoleCard icon="🎧" title="Dispatcher / CSR"  desc="Mag-create at mag-assign ng job orders"   color="#4d8ef5" bg="#0d1e42" onClick={()=>{setScreen("dispatcher");setSelUser(null);setError("");}} />
        <RoleCard icon="💻" title="IT / Network"       desc="Mag-activate ng internet ng mga clients"   color="#20c8b0" bg="#052220" onClick={()=>{setScreen("it");setSelUser(null);setError("");}} />
        <RoleCard icon="🔧" title="Technician"         desc="Tingnan ang tasks at i-update ang status"  color="#2dcc7a" bg="#081e13" onClick={()=>{setScreen("tech");setError("");setUsername("");}} />
      </div>
      <div style={s.footer}>KeyConnect ISP · Marilao, Bulacan</div>
    </Bg>
  );

  // DISPATCHER
  if (screen === "dispatcher") return (
    <Bg>
      <button style={s.backBtn} onClick={goHome}>← Bumalik</button>
      <div style={s.rh}>
        <div style={{fontSize:26,marginBottom:5}}>🎧</div>
        <div style={s.rt}>Dispatcher / CSR</div>
        <div style={s.rs}>Piliin ang iyong account</div>
      </div>

      {/* CLICKABLE PROFILE CARDS */}
      <div style={s.profileGrid}>
        {DISPATCHER_EMAILS.map((u,i) => (
          <ProfileCard key={i} user={u} selected={selUser?.email===u.email} onClick={()=>selectUser(u)} />
        ))}
      </div>

      {selUser && (
        <div style={s.pwSection}>
          <div style={s.selBanner}>
            <div style={{...s.selAv, background:selUser.bg, color:selUser.color}}>{selUser.initials}</div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#dde3ff"}}>{selUser.name}</div>
              <div style={{fontSize:11,color:"#7b87b8"}}>{selUser.email}</div>
            </div>
          </div>
          <label style={s.lbl}>Password</label>
          <div style={{position:"relative",marginBottom:12}}>
            <input style={{...s.input,paddingRight:40}} type={showPass?"text":"password"} placeholder="Password"
              value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleDispatcherLogin()} autoFocus />
            <button style={s.eyeBtn} onClick={()=>setShowPass(p=>!p)}>{showPass?"🙈":"👁"}</button>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={s.btn} onClick={handleDispatcherLogin} disabled={loading}>
            {loading?"Checking...":"Pumasok →"}
          </button>
        </div>
      )}
      {!selUser && error && <div style={{...s.error,marginTop:8}}>{error}</div>}
    </Bg>
  );

  // IT
  if (screen === "it") return (
    <Bg>
      <button style={s.backBtn} onClick={goHome}>← Bumalik</button>
      <div style={s.rh}>
        <div style={{fontSize:26,marginBottom:5}}>💻</div>
        <div style={s.rt}>IT / Network</div>
        <div style={s.rs}>Piliin ang iyong account</div>
      </div>

      <div style={s.profileGrid}>
        {IT_EMAILS.map((u,i) => (
          <ProfileCard key={i} user={u} selected={selUser?.email===u.email} onClick={()=>selectUser(u)} />
        ))}
      </div>

      {selUser && (
        <div style={s.pwSection}>
          <div style={s.selBanner}>
            <div style={{...s.selAv, background:selUser.bg, color:selUser.color}}>{selUser.initials}</div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#dde3ff"}}>{selUser.name}</div>
              <div style={{fontSize:11,color:"#7b87b8"}}>{selUser.email}</div>
            </div>
          </div>
          <label style={s.lbl}>Password</label>
          <div style={{position:"relative",marginBottom:12}}>
            <input style={{...s.input,paddingRight:40}} type={showPass?"text":"password"} placeholder="Password"
              value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleITLogin()} autoFocus />
            <button style={s.eyeBtn} onClick={()=>setShowPass(p=>!p)}>{showPass?"🙈":"👁"}</button>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={{...s.btn,background:"#20c8b0"}} onClick={handleITLogin} disabled={loading}>
            {loading?"Checking...":"Pumasok →"}
          </button>
        </div>
      )}
      {!selUser && error && <div style={{...s.error,marginTop:8}}>{error}</div>}
    </Bg>
  );

  // TECH
  if (screen === "tech") return (
    <Bg>
      <button style={s.backBtn} onClick={goHome}>← Bumalik</button>
      <div style={s.rh}>
        <div style={{fontSize:26,marginBottom:5}}>🔧</div>
        <div style={s.rt}>Technician</div>
        <div style={s.rs}>Piliin o hanapin ang iyong profile</div>
      </div>

      {/* CLICKABLE TECH PROFILES */}
      {techList.length > 0 ? (
        <div style={s.profileGrid}>
          {techList.map((t,i) => (
            <ProfileCard key={i}
              user={{ name:t.name, initials:t.initials||t.name[0], color:t.color||"#2dcc7a", bg:t.bg||"#081e13" }}
              selected={false}
              onClick={() => selectTech(t)}
            />
          ))}
        </div>
      ) : (
        <div style={{textAlign:"center",padding:"20px 0",color:"#7b87b8",fontSize:12}}>
          {loading ? "Loading profiles..." : "Loading..."}
        </div>
      )}

      {/* OR search by username */}
      <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0"}}>
        <div style={{flex:1,height:1,background:"#222840"}}/>
        <span style={{fontSize:11,color:"#7b87b8"}}>o i-type ang username</span>
        <div style={{flex:1,height:1,background:"#222840"}}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input style={{...s.input,flex:1,marginBottom:0}}
          placeholder="arnel, karl, danny..."
          value={username} onChange={e=>setUsername(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&findTechByUsername()} />
        <button style={{...s.btn,width:"auto",padding:"10px 16px",flexShrink:0}} onClick={findTechByUsername} disabled={loading}>
          {loading?"...":"→"}
        </button>
      </div>
      {error && <div style={{...s.error,marginTop:8}}>{error}</div>}
    </Bg>
  );

  // TECH PIN
  if (screen === "tech-pin" && foundTech) return (
    <Bg>
      <button style={s.backBtn} onClick={()=>{setScreen("tech");setPin("");setError("");setFoundTech(null);}}>← Bumalik</button>
      <div style={s.techGreet}>
        <div style={{width:56,height:56,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,background:foundTech.data.bg||"#081e13",color:foundTech.data.color||"#2dcc7a",border:"2px solid "+(foundTech.data.color||"#2dcc7a"),flexShrink:0}}>
          {foundTech.data.initials||foundTech.data.name[0]}
        </div>
        <div>
          <div style={{fontWeight:800,fontSize:17,color:"#dde3ff"}}>{foundTech.data.name}</div>
          <div style={{fontSize:11,color:"#7b87b8",marginTop:2}}>{foundTech.data.spec}</div>
          <div style={{fontSize:11,color:"#2dcc7a",marginTop:2}}>📍 {foundTech.data.area}</div>
        </div>
      </div>
      <div style={s.pinLabel}>I-enter ang iyong 4-digit PIN</div>
      <div style={s.pinDots}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{width:16,height:16,borderRadius:"50%",transition:"all .15s",background:i<pin.length?(foundTech.data.color||"#2dcc7a"):"#222840",transform:i<pin.length?"scale(1.2)":"scale(1)"}}/>
        ))}
      </div>
      {error && <div style={{...s.error,textAlign:"center",marginBottom:12}}>{error}</div>}
      <div style={s.pinGrid}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d,i)=>(
          <button key={i}
            style={{...s.pinBtn,...(d===""?{visibility:"hidden"}:{}),...(d==="⌫"?{color:"#f05555",fontSize:18}:{})}}
            onClick={()=>d==="⌫"?deletePin():d!==""&&handlePinInput(d)}>
            {d}
          </button>
        ))}
      </div>
      <div style={{textAlign:"center",fontSize:10,color:"#3d4668",marginTop:14,fontFamily:"monospace"}}>
        Para palitan ang PIN, makipag-ugnayan sa admin
      </div>
    </Bg>
  );

  return null;
}

function Bg({ children }) {
  return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(#222840 1px,transparent 1px),linear-gradient(90deg,#222840 1px,transparent 1px)",backgroundSize:"48px 48px",opacity:.18,pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,background:"#0c0f1a",border:"1px solid #2e3450",borderRadius:18,padding:"32px 30px",width:460,maxWidth:"95vw"}}>
        {children}
      </div>
    </div>
  );
}

function ProfileCard({ user, selected, onClick }) {
  const [hov, setHov] = useState(false);
  const active = selected || hov;
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,background:active?user.bg:"#111525",border:"1.5px solid",borderColor:active?user.color:"#222840",borderRadius:12,padding:"14px 10px",cursor:"pointer",transition:"all .2s",position:"relative"}}>
      {selected && <div style={{position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",background:"#2dcc7a"}}/>}
      <div style={{width:44,height:44,borderRadius:"50%",background:user.bg,color:user.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,border:"2px solid "+(active?user.color:"#333")}}>
        {user.initials}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:active?user.color:"#dde3ff",textAlign:"center"}}>{user.name}</div>
    </div>
  );
}

function RoleCard({ icon, title, desc, color, bg, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,background:hov?bg:"#111525",border:"1.5px solid",borderColor:hov?color:"#222840",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all .2s"}}
      onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{fontSize:26,flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:hov?color:"#dde3ff"}}>{title}</div>
        <div style={{fontSize:11.5,color:"#7b87b8",marginTop:2}}>{desc}</div>
      </div>
      <div style={{fontSize:16,color:hov?color:"#3d4668"}}>→</div>
    </div>
  );
}

const s = {
  logo:    {fontSize:26,fontWeight:800,letterSpacing:-1,marginBottom:2,color:"#dde3ff"},
  sub:     {color:"#7b87b8",fontSize:11,fontFamily:"monospace",marginBottom:20},
  secLabel:{fontSize:9.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:10},
  footer:  {textAlign:"center",fontSize:10,color:"#3d4668",fontFamily:"monospace",marginTop:20},
  backBtn: {background:"none",border:"none",color:"#7b87b8",cursor:"pointer",fontSize:13,fontFamily:"inherit",padding:"0 0 14px",display:"block"},
  rh:      {textAlign:"center",marginBottom:18},
  rt:      {fontSize:20,fontWeight:800,color:"#dde3ff",letterSpacing:-.5},
  rs:      {fontSize:12,color:"#7b87b8",marginTop:4},
  profileGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:10,marginBottom:16},
  pwSection:{background:"#111525",border:"1px solid #222840",borderRadius:12,padding:"14px 16px",marginTop:4},
  selBanner:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:12,borderBottom:"1px solid #222840"},
  selAv:   {width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0},
  lbl:     {fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"#7b87b8",display:"block",marginBottom:6},
  input:   {width:"100%",background:"#0c0f1a",border:"1px solid #222840",color:"#dde3ff",padding:"10px 13px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none",display:"block"},
  eyeBtn:  {position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,padding:2},
  error:   {background:"#2a0a0a",border:"1px solid #f05555",borderRadius:8,padding:"8px 12px",color:"#f05555",fontSize:12.5,marginBottom:10},
  btn:     {width:"100%",background:"#4d8ef5",color:"#fff",border:"none",padding:11,borderRadius:8,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer"},
  techGreet:{display:"flex",alignItems:"center",gap:14,background:"#111525",border:"1px solid #222840",borderRadius:12,padding:"14px 16px",marginBottom:20},
  pinLabel:{fontSize:12,color:"#7b87b8",textAlign:"center",marginBottom:16},
  pinDots: {display:"flex",justifyContent:"center",gap:16,marginBottom:20},
  pinGrid: {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10},
  pinBtn:  {background:"#111525",border:"1px solid #222840",color:"#dde3ff",height:62,borderRadius:12,fontSize:22,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
};