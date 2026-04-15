import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, set, update } from "firebase/database";

const STATUS = {
  present:  { label:"Present",   color:"#2dcc7a", bg:"#081e13", icon:"✅" },
  absent:   { label:"Absent",    color:"#f05555", bg:"#2a0a0a", icon:"❌" },
  late:     { label:"Late",      color:"#f0a030", bg:"#2a1805", icon:"⏰" },
  halfday:  { label:"Half Day",  color:"#9b78f5", bg:"#160f30", icon:"🌗" },
  leave:    { label:"On Leave",  color:"#4d8ef5", bg:"#0d1535", icon:"🏖" },
  dayoff:   { label:"Day Off",   color:"#7b87b8", bg:"#111525", icon:"🗓" },
};

export default function Attendance() {
  const [techs,      setTechs]      = useState({});
  const [attendance, setAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode,   setViewMode]   = useState("daily");   // daily | summary
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0,7));
  const [noteModal,  setNoteModal]  = useState(null); // { techId, techName }
  const [noteText,   setNoteText]   = useState("");
  const [saving,     setSaving]     = useState("");

  useEffect(() => {
    const u1 = onValue(ref(db,"technicians"), s => setTechs(s.exists() ? s.val() : {}));
    const u2 = onValue(ref(db,"attendance"),  s => setAttendance(s.exists() ? s.val() : {}));
    return () => { u1(); u2(); };
  }, []);

  const techList = Object.entries(techs);
  const todayRecord = attendance[selectedDate] || {};

  // Count for summary badge
  const todayCounts = {
    present: techList.filter(([id]) => todayRecord[id]?.status === "present").length,
    absent:  techList.filter(([id]) => todayRecord[id]?.status === "absent").length,
    late:    techList.filter(([id]) => todayRecord[id]?.status === "late").length,
    noRecord:techList.filter(([id]) => !todayRecord[id]?.status).length,
  };

  async function markStatus(techId, status) {
    setSaving(techId + status);
    const existing = todayRecord[techId] || {};
    await set(ref(db, `attendance/${selectedDate}/${techId}`), {
      ...existing,
      status,
      techName: techs[techId]?.name || "",
      updatedAt: new Date().toISOString(),
      timeIn: existing.timeIn || (status !== "absent" && status !== "dayoff" ? new Date().toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}) : ""),
    });
    setSaving("");
  }

  async function saveNote() {
    if (!noteModal) return;
    const existing = todayRecord[noteModal.techId] || {};
    await update(ref(db, `attendance/${selectedDate}/${noteModal.techId}`), {
      ...existing,
      note: noteText.trim(),
      techName: techs[noteModal.techId]?.name || "",
      updatedAt: new Date().toISOString(),
    });
    setNoteModal(null); setNoteText("");
  }

  async function updateTimeIn(techId, time) {
    const existing = todayRecord[techId] || {};
    await update(ref(db, `attendance/${selectedDate}/${techId}`), {
      ...existing,
      timeIn: time,
      techName: techs[techId]?.name || "",
      updatedAt: new Date().toISOString(),
    });
  }

  // Summary data for a month
  function getSummary(techId) {
    const days = Object.entries(attendance).filter(([d]) => d.startsWith(summaryMonth));
    const counts = { present:0, absent:0, late:0, halfday:0, leave:0, dayoff:0, total:0 };
    days.forEach(([, rec]) => {
      const st = rec[techId]?.status;
      if (st) { counts[st] = (counts[st]||0)+1; counts.total++; }
    });
    return { counts, days: days.length };
  }

  // Mark all present / reset day
  async function markAllPresent() {
    const updates = {};
    const time = new Date().toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"});
    techList.forEach(([id, t]) => {
      updates[`attendance/${selectedDate}/${id}`] = {
        status: "present", techName: t.name, timeIn: time,
        updatedAt: new Date().toISOString(),
      };
    });
    await update(ref(db), updates);
  }

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* HEADER */}
      <div style={s.ph}>
        <div>
          <h1 style={s.h1}>Attendance</h1>
          <div style={{fontSize:12,color:"#7b87b8",marginTop:3}}>Manage daily technician attendance</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {viewMode==="daily" && (
            <button style={{...s.btnSm,background:"#081e13",border:"1px solid #2dcc7a",color:"#2dcc7a"}} onClick={markAllPresent}>
              ✅ Mark All Present
            </button>
          )}
          <div style={{display:"flex",gap:4}}>
            {[["daily","📅 Daily"],["summary","📊 Summary"]].map(([k,lbl])=>(
              <button key={k} style={{...s.btnSm,...(viewMode===k?{background:"#0d1e42",borderColor:"#4d8ef5",color:"#4d8ef5"}:{})}} onClick={()=>setViewMode(k)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── DAILY VIEW ── */}
      {viewMode==="daily" && (
        <>
          {/* Date picker + stat pills */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
              style={{background:"#111525",border:"1px solid #4d8ef5",color:"#dde3ff",padding:"7px 12px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none"}} />
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[
                [todayCounts.present,"Present","#2dcc7a","#081e13"],
                [todayCounts.late,   "Late",   "#f0a030","#2a1805"],
                [todayCounts.absent, "Absent", "#f05555","#2a0a0a"],
                [todayCounts.noRecord,"No Record","#7b87b8","#111525"],
              ].map(([cnt,lbl,col,bg])=>(
                <div key={lbl} style={{background:bg,border:`1px solid ${col}55`,borderRadius:8,padding:"4px 10px",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontFamily:"monospace",fontWeight:800,color:col,fontSize:15}}>{cnt}</span>
                  <span style={{fontSize:11,color:col}}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
            {techList.map(([id, t]) => {
              const rec    = todayRecord[id] || {};
              const st     = STATUS[rec.status] || null;
              const isSav  = saving.startsWith(id);
              return (
                <div key={id} style={{background:"#0c0f1a",border:"1.5px solid "+(st ? st.color+"55" : "#222840"),borderRadius:12,overflow:"hidden"}}>
                  {/* Tech info row */}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:"1px solid #222840"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>
                      {t.initials||t.name[0]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13.5,color:"#dde3ff"}}>{t.name}</div>
                      <div style={{fontSize:11,color:"#7b87b8"}}>{t.area||"—"} · {t.spec||""}</div>
                    </div>
                    {st && (
                      <div style={{background:st.bg,border:`1px solid ${st.color}44`,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,color:st.color,flexShrink:0}}>
                        {st.icon} {st.label}
                      </div>
                    )}
                  </div>

                  {/* Status buttons */}
                  <div style={{padding:"10px 14px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
                      {Object.entries(STATUS).map(([key,val])=>(
                        <button key={key}
                          style={{background:rec.status===key?val.bg:"#111525",border:`1px solid ${rec.status===key?val.color:"#222840"}`,color:rec.status===key?val.color:"#7b87b8",borderRadius:7,padding:"6px 4px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:isSav?0.6:1}}
                          onClick={()=>markStatus(id,key)} disabled={isSav}>
                          {val.icon} {val.label}
                        </button>
                      ))}
                    </div>

                    {/* Time In + Note row */}
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"#7b87b8",marginBottom:4}}>Time In</div>
                        <input type="time" value={rec.timeIn||""}
                          onChange={e=>updateTimeIn(id,e.target.value)}
                          style={{background:"#111525",border:"1px solid #222840",color:rec.timeIn?"#dde3ff":"#3d4668",padding:"5px 8px",borderRadius:6,fontFamily:"monospace",fontSize:12,outline:"none",width:"100%"}} />
                      </div>
                      <div style={{flex:2}}>
                        <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"#7b87b8",marginBottom:4}}>Note</div>
                        <div style={{display:"flex",gap:4}}>
                          <input value={rec.note||""} readOnly placeholder="Add note..."
                            style={{flex:1,background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"5px 8px",borderRadius:6,fontFamily:"inherit",fontSize:12,outline:"none",cursor:"pointer"}}
                            onClick={()=>{setNoteModal({techId:id,techName:t.name});setNoteText(rec.note||"");}} />
                          <button style={{background:"#111525",border:"1px solid #222840",color:"#4d8ef5",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13}}
                            onClick={()=>{setNoteModal({techId:id,techName:t.name});setNoteText(rec.note||"");}}>✏</button>
                        </div>
                      </div>
                    </div>
                    {rec.updatedAt && (
                      <div style={{fontSize:10,color:"#3d4668",fontFamily:"monospace",marginTop:6}}>
                        Updated: {new Date(rec.updatedAt).toLocaleString("en-PH")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {techList.length===0 && (
            <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:30,textAlign:"center",color:"#3d4668",fontSize:13}}>
              Walang technicians. Mag-add muna sa Technicians tab.
            </div>
          )}
        </>
      )}

      {/* ── SUMMARY VIEW ── */}
      {viewMode==="summary" && (
        <>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <input type="month" value={summaryMonth} onChange={e=>setSummaryMonth(e.target.value)}
              style={{background:"#111525",border:"1px solid #4d8ef5",color:"#dde3ff",padding:"7px 12px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none"}} />
            <span style={{fontSize:12,color:"#7b87b8"}}>{Object.keys(attendance).filter(d=>d.startsWith(summaryMonth)).length} days with records</span>
          </div>

          <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
                <thead>
                  <tr>
                    {["Technician","Area",
                      ...Object.entries(STATUS).map(([,v])=>v.icon+" "+v.label),
                      "Total Days","Rate"
                    ].map(h=>(
                      <th key={h} style={{padding:"9px 12px",background:"#111525",color:"#7b87b8",fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",borderBottom:"1px solid #222840",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {techList.map(([id,t])=>{
                    const {counts} = getSummary(id);
                    const rate = counts.total>0 ? Math.round((counts.present/counts.total)*100) : 0;
                    return (
                      <tr key={id} style={{borderBottom:"1px solid #222840"}}>
                        <td style={{padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:28,height:28,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{t.initials||t.name[0]}</div>
                            <span style={{fontWeight:600,color:"#dde3ff"}}>{t.name}</span>
                          </div>
                        </td>
                        <td style={{padding:"10px 12px",color:"#7b87b8",fontSize:11}}>{t.area||"—"}</td>
                        {Object.keys(STATUS).map(st=>(
                          <td key={st} style={{padding:"10px 12px",textAlign:"center",fontFamily:"monospace",fontWeight:700,color:STATUS[st].color,fontSize:13}}>
                            {counts[st]||0}
                          </td>
                        ))}
                        <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"monospace",fontWeight:700,color:"#dde3ff"}}>{counts.total}</td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}>
                          <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
                            <div style={{width:50,height:6,background:"#222840",borderRadius:3,overflow:"hidden"}}>
                              <div style={{width:rate+"%",height:"100%",background:rate>=80?"#2dcc7a":rate>=60?"#f0a030":"#f05555",borderRadius:3}}/>
                            </div>
                            <span style={{fontFamily:"monospace",fontWeight:700,color:rate>=80?"#2dcc7a":rate>=60?"#f0a030":"#f05555",fontSize:12}}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Calendar heatmap per tech */}
          <div style={{marginTop:20}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:12}}>Daily Breakdown — {summaryMonth}</div>
            {techList.map(([id,t])=>{
              const daysInMonth = new Date(summaryMonth.split("-")[0], summaryMonth.split("-")[1], 0).getDate();
              const days = Array.from({length:daysInMonth},(_,i)=>{
                const d = `${summaryMonth}-${String(i+1).padStart(2,"0")}`;
                const rec = attendance[d]?.[id];
                return { d, st: rec?.status||null, n:i+1 };
              });
              return (
                <div key={id} style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800}}>{t.initials||t.name[0]}</div>
                    <span style={{fontWeight:700,fontSize:13,color:"#dde3ff"}}>{t.name}</span>
                    <span style={{fontSize:11,color:"#7b87b8"}}>· {t.area}</span>
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {days.map(({d,st,n})=>{
                      const s = STATUS[st];
                      const isToday = d===new Date().toISOString().split("T")[0];
                      return (
                        <div key={d} title={`${d}: ${s?s.label:"No record"}`}
                          style={{width:28,height:28,borderRadius:5,background:s?s.bg:"#111525",border:`1.5px solid ${isToday?"#fff":(s?s.color+"66":"#222840")}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"default"}}>
                          <span style={{fontSize:9,fontWeight:700,color:s?s.color:"#3d4668"}}>{n}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                    {Object.entries(STATUS).map(([k,v])=>{
                      const cnt = days.filter(d=>d.st===k).length;
                      if (!cnt) return null;
                      return <span key={k} style={{fontSize:10,color:v.color}}>{v.icon} {v.label}: <strong>{cnt}</strong></span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── NOTE MODAL ── */}
      {noteModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"}}>
          <div style={{background:"#0c0f1a",border:"1px solid #2e3450",borderRadius:16,width:420,maxWidth:"95vw"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #222840"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#dde3ff"}}>Add Note</div>
              <div style={{fontSize:11,color:"#7b87b8",marginTop:2}}>{noteModal.techName} · {selectedDate}</div>
            </div>
            <div style={{padding:"16px 20px"}}>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)}
                placeholder="Halimbawa: Nag-leave ng maaga, may sakit, etc."
                style={{width:"100%",background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"10px 12px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none",minHeight:90,resize:"vertical"}} />
            </div>
            <div style={{padding:"12px 20px",borderTop:"1px solid #222840",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={s.btnGhost} onClick={()=>setNoteModal(null)}>Cancel</button>
              <button style={{...s.btnPrimary}} onClick={saveNote}>Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  ph:        { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 },
  h1:        { fontSize:20, fontWeight:800, letterSpacing:-.5, color:"#dde3ff" },
  btnSm:     { background:"none", border:"1px solid #222840", color:"#7b87b8", padding:"6px 12px", borderRadius:7, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:600 },
  btnPrimary:{ background:"#4d8ef5", color:"#fff", border:"none", padding:"8px 16px", borderRadius:8, fontFamily:"inherit", fontSize:12.5, fontWeight:600, cursor:"pointer" },
  btnGhost:  { background:"none", border:"1px solid #222840", color:"#7b87b8", padding:"8px 16px", borderRadius:8, fontFamily:"inherit", fontSize:12.5, cursor:"pointer" },
};
