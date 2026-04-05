import { useState } from "react";
import { db } from "../firebase/config";
import { ref, get, set } from "firebase/database";
import { DEFAULT_TECHS, DEFAULT_MATERIALS } from "../constants";

export default function Login({ onLogin }) {
  const [role, setRole] = useState("dispatcher");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundTech, setFoundTech] = useState(null);
  const [step, setStep] = useState("role"); // role | pin

  async function seedData() {
    const techSnap = await get(ref(db, "technicians"));
    if (!techSnap.exists()) await set(ref(db, "technicians"), DEFAULT_TECHS);
    const matSnap = await get(ref(db, "materials"));
    if (!matSnap.exists()) {
      const mats = {};
      DEFAULT_MATERIALS.forEach((m, i) => { mats["M" + String(i+1).padStart(2,"0")] = m; });
      await set(ref(db, "materials"), mats);
    }
  }

  async function handleDispatcherLogin() {
    if (!name.trim()) { setError("Ilagay ang pangalan"); return; }
    setLoading(true); setError("");
    try {
      await seedData();
      onLogin({ role: "dispatcher", name: name.trim() });
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  async function handleITLogin() {
    if (!name.trim()) { setError("Ilagay ang pangalan"); return; }
    setLoading(true); setError("");
    try {
      await seedData();
      onLogin({ role: "it", name: name.trim() });
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  async function findTech() {
    if (!name.trim()) { setError("Ilagay ang username"); return; }
    setLoading(true); setError("");
    try {
      await seedData();
      const snap = await get(ref(db, "technicians"));
      if (snap.exists()) {
        const techs = snap.val();
        const found = Object.entries(techs).find(([,t]) =>
          t.loginName?.toLowerCase() === name.trim().toLowerCase() ||
          t.name?.toLowerCase().includes(name.trim().toLowerCase())
        );
        if (found) {
          setFoundTech({ id: found[0], data: found[1] });
          setStep("pin");
          setError("");
        } else {
          setError("Hindi nahanap ang technician.");
        }
      }
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  function handlePinInput(digit) {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) verifyPin(newPin);
    }
  }

  function deletePin() { setPin(p => p.slice(0,-1)); setError(""); }

  async function verifyPin(inputPin) {
    const techPin = foundTech.data.pin || "1234";
    if (inputPin === techPin) {
      onLogin({ role: "technician", name: foundTech.data.name, techId: foundTech.id, techData: foundTech.data });
    } else {
      setError("Mali ang PIN. Subukan ulit.");
      setTimeout(() => setPin(""), 600);
    }
  }

  const roles = [
    ["dispatcher","👨‍💼","Dispatcher","Mag-assign ng tasks"],
    ["technician","👨‍🔧","Technician","Tingnan ang tasks ko"],
    ["it","👨‍💻","IT / Network","Mag-activate ng internet"],
  ];

  return (
    <div style={s.bg}>
      <div style={s.grid}/>
      <div style={s.box}>
        <div style={s.logo}>KEY<span style={{color:"#4d8ef5"}}>CONNECT</span></div>
        <div style={s.sub}>KeyConnect· Real-time Dispatch</div>

        {/* ROLE SELECTOR */}
        <div style={s.roles}>
          {roles.map(([r,ic,nm,sub]) => (
            <div key={r} style={{...s.role,...(role===r?s.roleActive:{})}} onClick={()=>{setRole(r);setStep("role");setPin("");setName("");setError("");setFoundTech(null);}}>
              <div style={{fontSize:20,marginBottom:4}}>{ic}</div>
              <div style={s.roleNm}>{nm}</div>
              <div style={s.roleSub}>{sub}</div>
            </div>
          ))}
        </div>

        {/* DISPATCHER / IT LOGIN */}
        {(role === "dispatcher" || role === "it") && (
          <>
            <input style={s.input} placeholder="Pangalan" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(role==="it"?handleITLogin():handleDispatcherLogin())}/>
            <input style={s.input} placeholder="Password (kahit ano)" type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(role==="it"?handleITLogin():handleDispatcherLogin())}/>
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} onClick={role==="it"?handleITLogin:handleDispatcherLogin} disabled={loading}>{loading?"Loading...":"Pumasok →"}</button>
          </>
        )}

        {/* TECHNICIAN LOGIN */}
        {role === "technician" && step === "role" && (
          <>
            <div style={s.techHint}>I-type ang iyong username o pangalan</div>
            <input style={s.input} placeholder="Username (e.g. arnel, karl...)" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&findTech()}/>
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} onClick={findTech} disabled={loading}>{loading?"Hinahanap...":"Susunod →"}</button>
          </>
        )}

        {/* PIN PAD */}
        {role === "technician" && step === "pin" && foundTech && (
          <div>
            <div style={s.techGreet}>
              <div style={{...s.techAv, background:foundTech.data.bg||"#0d1e42", color:foundTech.data.color||"#4d8ef5"}}>{foundTech.data.initials||foundTech.data.name[0]}</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#dde3ff"}}>{foundTech.data.name}</div>
                <div style={{fontSize:11,color:"#7b87b8"}}>{foundTech.data.spec}</div>
              </div>
            </div>
            <div style={s.pinLabel}>I-enter ang iyong 4-digit PIN</div>
            <div style={s.pinDots}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{...s.pinDot, background: i<pin.length?"#4d8ef5":"#222840", transform: i<pin.length?"scale(1.2)":"scale(1)"}}/>
              ))}
            </div>
            {error && <div style={{...s.error, textAlign:"center",marginBottom:12}}>{error}</div>}
            <div style={s.pinGrid}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d,i) => (
                <button key={i} style={{...s.pinBtn, ...(d===""?{visibility:"hidden"}:{})}}
                  onClick={()=>d==="⌫"?deletePin():d!==""&&handlePinInput(d)}>
                  {d}
                </button>
              ))}
            </div>
            <button style={{...s.btnGhost,width:"100%",marginTop:8}} onClick={()=>{setStep("role");setPin("");setError("");setFoundTech(null);}}>← Bumalik</button>
            <div style={{textAlign:"center",fontSize:10,color:"#3d4668",marginTop:10,fontFamily:"monospace"}}>Default PIN: 1234 · Palitan sa Settings</div>
          </div>
        )}

        {(role==="dispatcher"||role==="it") && <div style={s.hint}>Kahit anong pangalan para sa {role==="it"?"IT":"dispatcher"}</div>}
      </div>
    </div>
  );
}

const s = {
  bg:{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",fontFamily:"'Plus Jakarta Sans',sans-serif"},
  grid:{position:"fixed",inset:0,backgroundImage:"linear-gradient(#222840 1px,transparent 1px),linear-gradient(90deg,#222840 1px,transparent 1px)",backgroundSize:"48px 48px",opacity:.18,pointerEvents:"none"},
  box:{position:"relative",zIndex:1,background:"#0c0f1a",border:"1px solid #2e3450",borderRadius:18,padding:"36px 32px",width:440,maxWidth:"95vw"},
  logo:{fontSize:26,fontWeight:800,letterSpacing:-1,marginBottom:3,color:"#dde3ff"},
  sub:{color:"#7b87b8",fontSize:11,fontFamily:"monospace",marginBottom:24},
  roles:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20},
  role:{border:"1.5px solid #222840",borderRadius:12,padding:"12px 8px",cursor:"pointer",textAlign:"center",background:"none",transition:"all .2s"},
  roleActive:{borderColor:"#4d8ef5",background:"#0d1e42"},
  roleNm:{fontSize:11.5,fontWeight:700,color:"#dde3ff"},
  roleSub:{fontSize:9.5,color:"#7b87b8",marginTop:2},
  input:{width:"100%",background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"10px 13px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none",marginBottom:10,display:"block"},
  error:{background:"#2a0a0a",border:"1px solid #f05555",borderRadius:8,padding:"8px 12px",color:"#f05555",fontSize:12.5,marginBottom:10},
  btn:{width:"100%",background:"#4d8ef5",color:"#fff",border:"none",padding:12,borderRadius:8,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4},
  btnGhost:{background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"9px 16px",borderRadius:8,fontFamily:"inherit",fontSize:13,cursor:"pointer"},
  hint:{textAlign:"center",fontSize:10.5,color:"#3d4668",fontFamily:"monospace",marginTop:12},
  techHint:{fontSize:12.5,color:"#7b87b8",marginBottom:10,textAlign:"center"},
  techGreet:{display:"flex",alignItems:"center",gap:12,background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"12px 14px",marginBottom:18},
  techAv:{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0},
  pinLabel:{fontSize:12,color:"#7b87b8",textAlign:"center",marginBottom:14},
  pinDots:{display:"flex",justifyContent:"center",gap:14,marginBottom:18},
  pinDot:{width:16,height:16,borderRadius:"50%",transition:"all .15s"},
  pinGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10},
  pinBtn:{background:"#111525",border:"1px solid #222840",color:"#dde3ff",height:60,borderRadius:12,fontSize:22,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .1s"},
};
