import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, update } from "firebase/database";
import Calendar from "./Calendar";

const TC = { install:"#4dff88",repair:"#ff8c3d",relocate:"#7db8ff",collection:"#ffc04d" };
const TB = { install:"#0d2a0d",repair:"#2a1005",relocate:"#0d1530",collection:"#2a1800" };

const JS = {
  pending:       { label:"Pending",     color:"#f0a030",bg:"#2a1805",pct:5,  order:6 },
  dispatched:    { label:"Dispatched",  color:"#4d8ef5",bg:"#0d1535",pct:20, order:1 },
  "on-way":      { label:"On the Way",  color:"#9b78f5",bg:"#1a1040",pct:40, order:2 },
  "on-site":     { label:"On-Site",     color:"#20c8b0",bg:"#052220",pct:60, order:3 },
  "for-approval":{ label:"For IT",      color:"#f0a030",bg:"#2a1a05",pct:70, order:4 },
  configuring:   { label:"Configuring", color:"#4d8ef5",bg:"#0d1535",pct:80, order:5 },
  activated:     { label:"Activated",   color:"#2dcc7a",bg:"#081e13",pct:90, order:7 },
  done:          { label:"Done",        color:"#2dcc7a",bg:"#081e13",pct:100,order:8 },
  cancelled:     { label:"Cancelled",   color:"#f05555",bg:"#2a0a0a",pct:100,order:9 },
};

const AS = {
  present:{ label:"Present", color:"#2dcc7a",bg:"#081e13",icon:"✅" },
  late:   { label:"Late",    color:"#f0a030",bg:"#2a1805",icon:"⏰" },
  absent: { label:"Absent",  color:"#f05555",bg:"#2a0a0a",icon:"❌" },
  halfday:{ label:"Half Day",color:"#9b78f5",bg:"#160f30",icon:"🌗" },
  leave:  { label:"On Leave",color:"#4d8ef5",bg:"#0d1535",icon:"🏖"  },
  dayoff: { label:"Day Off", color:"#7b87b8",bg:"#111525",icon:"🗓"  },
};

// Time between two ISO strings → "Xhr Ymin"
function timeDiff(from, to) {
  if (!from || !to) return null;
  const ms = new Date(to) - new Date(from);
  if (ms < 0) return null;
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Format ISO to local time
function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",hour12:true});
}

export default function JobTracking() {
  const [jobs,       setJobs]       = useState({});
  const [techs,      setTechs]      = useState({});
  const [attendance, setAttendance] = useState({});
  const [filterTech, setFilterTech] = useState("all");
  const [filterStatus,setFilterStatus]=useState("active");
  const [filterType, setFilterType] = useState("all");
  const [viewMode,   setViewMode]   = useState("board"); // board | list | calendar | timeline
  const [selectedJob,setSelectedJob]= useState(null);   // job id for time detail modal

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const u1=onValue(ref(db,"jobs"),        s=>setJobs(s.exists()?s.val():{}));
    const u2=onValue(ref(db,"technicians"), s=>setTechs(s.exists()?s.val():{}));
    const u3=onValue(ref(db,`attendance/${today}`),s=>setAttendance(s.exists()?s.val():{}));
    return ()=>{ u1();u2();u3(); };
  },[today]);

  const techList = Object.entries(techs);
  const jobList  = Object.entries(jobs);

  function getAttend(tid) { return attendance[tid]||null; }
  function canDeploy(tid) {
    const a=getAttend(tid);
    if(!a||!a.status) return true;
    return ["present","late","halfday"].includes(a.status);
  }

  const filtered = jobList.filter(([,j])=>{
    const tm = filterTech==="all" || j.techId===filterTech || (j.techIds||[]).includes(filterTech);
    const sm = filterStatus==="active" ? !["done","activated","cancelled"].includes(j.status)
             : filterStatus==="done"   ? ["done","activated"].includes(j.status) : true;
    const tp = filterType==="all" || j.type===filterType;
    return tm && sm && tp;
  });

  // KPI
  const active    = jobList.filter(([,j])=>!["done","activated","cancelled"].includes(j.status)).length;
  const doneToday = jobList.filter(([,j])=>["done","activated"].includes(j.status)&&j.updatedAt?.startsWith(today)).length;
  const onSite    = jobList.filter(([,j])=>j.status==="on-site").length;
  const onWay     = jobList.filter(([,j])=>j.status==="on-way").length;
  const available = techList.filter(([id])=>canDeploy(id)).length;

  // Grouped by tech for board
  const byTech = {};
  techList.forEach(([id])=>{ byTech[id]=[]; });
  byTech["unassigned"]=[];
  filtered.forEach(([jid,j])=>{
    const ids=j.techIds||[];
    if(ids.length===0){byTech["unassigned"].push([jid,j]);return;}
    ids.forEach(tid=>{ if(byTech[tid]) byTech[tid].push([jid,j]); });
  });

  const selJob = selectedJob ? jobs[selectedJob] : null;

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,letterSpacing:-.5,color:"#dde3ff",margin:0}}>Job Tracking</h1>
          <div style={{fontSize:12,color:"#7b87b8",marginTop:3}}>Real-time · {new Date().toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric"})}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["board","⊞ Board"],["list","≡ List"],["timeline","⟿ Timeline"],["calendar","📅 Calendar"]].map(([k,lbl])=>(
            <button key={k} style={{...s.btn,...(viewMode===k?{background:"#0d1e42",borderColor:"#4d8ef5",color:"#4d8ef5"}:{})}} onClick={()=>setViewMode(k)}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* KPI STRIP */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
        {[
          ["Active",       active,    "#f0a030","#2a1805"],
          ["On the Way",   onWay,     "#9b78f5","#1a1040"],
          ["On-Site",      onSite,    "#20c8b0","#052220"],
          ["Done Today",   doneToday, "#2dcc7a","#081e13"],
          ["Techs Avail",  available, "#4d8ef5","#0d1535"],
        ].map(([lbl,val,col,bg])=>(
          <div key={lbl} style={{background:bg,border:`1px solid ${col}44`,borderRadius:10,padding:"10px 12px",borderTop:`2px solid ${col}`}}>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:col,marginBottom:4,opacity:.8}}>{lbl}</div>
            <div style={{fontFamily:"monospace",fontSize:24,fontWeight:800,color:col}}>{val}</div>
          </div>
        ))}
      </div>

      {/* FILTERS (not on calendar view) */}
      {viewMode!=="calendar" && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
          <select style={s.sel} value={filterTech} onChange={e=>setFilterTech(e.target.value)}>
            <option value="all">All Technicians</option>
            {techList.map(([id,t])=>{
              const a=getAttend(id); const dep=canDeploy(id);
              return <option key={id} value={id}>{dep?"":"⛔ "}{t.name}{a?` (${AS[a.status]?.label||a.status})`:""}</option>;
            })}
          </select>
          <select style={s.sel} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {["install","repair","relocate","collection"].map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
          <div style={{display:"flex",gap:4}}>
            {[["active","Active"],["done","Done"],["all","All"]].map(([k,lbl])=>(
              <button key={k} style={{...s.btn,...(filterStatus===k?{background:"#0d1e42",borderColor:"#4d8ef5",color:"#4d8ef5"}:{})}} onClick={()=>setFilterStatus(k)}>{lbl}</button>
            ))}
          </div>
          <span style={{fontSize:12,color:"#7b87b8",marginLeft:"auto"}}>{filtered.length} jobs</span>
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {viewMode==="board" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:12}}>
          {techList.map(([tid,t])=>{
            const tJobs=(byTech[tid]||[]).sort((a,b)=>(JS[a[1].status]?.order||9)-(JS[b[1].status]?.order||9));
            const a=getAttend(tid); const ast=a?AS[a.status]:null; const dep=canDeploy(tid);
            return (
              <div key={tid} style={{background:"#0c0f1a",border:`1.5px solid ${dep?(tJobs.filter(([,j])=>!["done","activated","cancelled"].includes(j.status)).length>0?"#4d8ef5":"#222840"):"#f05555"}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"11px 14px",borderBottom:"1px solid #222840",background:dep?"transparent":"#140505"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0,border:`2px solid ${dep?(t.color||"#4d8ef5"):"#f05555"}`}}>{t.initials||t.name[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#dde3ff"}}>{t.name}</div>
                      <div style={{fontSize:10.5,color:"#7b87b8"}}>{t.area||"—"}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      {ast ? <div style={{background:ast.bg,border:`1px solid ${ast.color}44`,color:ast.color,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700}}>{ast.icon} {ast.label}</div>
                           : <div style={{fontSize:10,color:"#3d4668"}}>No record</div>}
                      {a?.timeIn && <div style={{fontSize:9,fontFamily:"monospace",color:"#7b87b8",marginTop:2}}>In: {a.timeIn}{a.timeOut?` · Out: ${a.timeOut}`:""}</div>}
                    </div>
                  </div>
                  {!dep && <div style={{marginTop:7,background:"#2a0a0a",border:"1px solid #f0555544",borderRadius:6,padding:"4px 9px",fontSize:10.5,color:"#f05555",fontWeight:600}}>⛔ Hindi pwedeng ma-deploy — {ast?.label}</div>}
                  <div style={{display:"flex",gap:6,marginTop:7}}>
                    <span style={{fontSize:10,color:"#4d8ef5",background:"#0d1535",border:"1px solid #4d8ef544",padding:"2px 7px",borderRadius:4,fontWeight:700}}>
                      {tJobs.filter(([,j])=>!["done","activated","cancelled"].includes(j.status)).length} active
                    </span>
                    <span style={{fontSize:10,color:"#2dcc7a",background:"#081e13",border:"1px solid #2dcc7a44",padding:"2px 7px",borderRadius:4}}>
                      {tJobs.filter(([,j])=>["done","activated"].includes(j.status)).length} done
                    </span>
                  </div>
                </div>
                <div style={{maxHeight:320,overflowY:"auto"}}>
                  {tJobs.length===0
                    ? <div style={{padding:"16px 14px",textAlign:"center",color:"#3d4668",fontSize:12}}>Walang jobs</div>
                    : tJobs.map(([jid,j])=>{
                        const st=JS[j.status]||JS.pending;
                        const elapsed = j.dispatchedAt ? timeDiff(j.dispatchedAt, j.status==="done"?j.updatedAt:new Date().toISOString()) : null;
                        return (
                          <div key={jid} style={{padding:"9px 13px",borderBottom:"1px solid #222840",opacity:["done","activated","cancelled"].includes(j.status)?.65:1,cursor:"pointer"}}
                            onClick={()=>setSelectedJob(jid)}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                              <span style={{background:TB[j.type],color:TC[j.type],borderRadius:3,padding:"1px 6px",fontSize:9.5,fontWeight:800,flexShrink:0}}>{(j.type||"").toUpperCase()}</span>
                              {j.priority==="urgent" && <span style={{fontSize:9.5,color:"#f05555",fontWeight:800}}>🔴</span>}
                              <span style={{background:st.bg,border:`1px solid ${st.color}44`,color:st.color,borderRadius:4,padding:"1px 7px",fontSize:9.5,fontWeight:700,marginLeft:"auto"}}>{st.label}</span>
                            </div>
                            <div style={{fontWeight:700,fontSize:12,color:"#dde3ff",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.client}</div>
                            <div style={{fontSize:10.5,color:"#7b87b8",marginBottom:4}}>📍 {j.site}</div>
                            {/* Progress bar */}
                            <div style={{height:3,background:"#222840",borderRadius:2,overflow:"hidden",marginBottom:4}}>
                              <div style={{height:"100%",background:st.color,borderRadius:2,width:st.pct+"%",transition:"width .4s"}}/>
                            </div>
                            {/* Time elapsed */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontFamily:"monospace",fontSize:9,color:"#3d4668"}}>{j.jo}</span>
                              {elapsed && <span style={{fontSize:9.5,color:"#f0a030",fontFamily:"monospace"}}>⏱ {elapsed}</span>}
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            );
          })}
          {byTech["unassigned"]?.length>0 && (
            <div style={{background:"#0c0f1a",border:"1.5px solid #f0a03044",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"11px 14px",borderBottom:"1px solid #222840",background:"#2a1805"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#f0a030"}}>⚠ Unassigned</div>
              </div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {byTech["unassigned"].map(([jid,j])=>{
                  const st=JS[j.status]||JS.pending;
                  return (
                    <div key={jid} style={{padding:"9px 13px",borderBottom:"1px solid #222840",cursor:"pointer"}} onClick={()=>setSelectedJob(jid)}>
                      <span style={{background:TB[j.type],color:TC[j.type],borderRadius:3,padding:"1px 6px",fontSize:9.5,fontWeight:800}}>{(j.type||"").toUpperCase()}</span>
                      <div style={{fontWeight:700,fontSize:12,color:"#dde3ff",marginTop:4}}>{j.client}</div>
                      <div style={{fontSize:10.5,color:"#7b87b8"}}>📍 {j.site}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode==="list" && (
        <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1000}}>
              <thead>
                <tr>{["JO #","Type","Client","Site","Status","Technician","Dispatched","On-Site","Done","Duration","Progress"].map(h=>(
                  <th key={h} style={{padding:"9px 11px",background:"#111525",color:"#7b87b8",fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",borderBottom:"1px solid #222840",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.sort((a,b)=>(JS[a[1].status]?.order||9)-(JS[b[1].status]?.order||9)).map(([jid,j])=>{
                  const st=JS[j.status]||JS.pending;
                  const tIds=j.techIds||[];
                  const dur = j.dispatchedAt&&j.updatedAt&&["done","activated"].includes(j.status)
                    ? timeDiff(j.dispatchedAt,j.updatedAt) : j.dispatchedAt ? timeDiff(j.dispatchedAt,new Date().toISOString()) : null;
                  return (
                    <tr key={jid} style={{borderBottom:"1px solid #222840",cursor:"pointer",opacity:["done","activated","cancelled"].includes(j.status)?.7:1}} onClick={()=>setSelectedJob(jid)}>
                      <td style={{padding:"9px 11px",fontFamily:"monospace",fontSize:10,color:"#7b87b8"}}>{j.jo}</td>
                      <td style={{padding:"9px 11px"}}><span style={{background:TB[j.type],color:TC[j.type],borderRadius:3,padding:"2px 7px",fontSize:9.5,fontWeight:800}}>{(j.type||"").toUpperCase()}</span></td>
                      <td style={{padding:"9px 11px"}}>
                        <div style={{fontWeight:600,color:"#dde3ff",whiteSpace:"nowrap",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis"}}>{j.client}</div>
                        <div style={{fontSize:10,color:"#7b87b8"}}>{j.address?.substring(0,30)}</div>
                      </td>
                      <td style={{padding:"9px 11px",color:"#9b78f5",fontWeight:600,fontSize:11}}>{j.site||"—"}</td>
                      <td style={{padding:"9px 11px"}}><span style={{background:st.bg,border:`1px solid ${st.color}44`,color:st.color,borderRadius:4,padding:"2px 8px",fontSize:9.5,fontWeight:700}}>{st.label}</span></td>
                      <td style={{padding:"9px 11px"}}>
                        {tIds.map(tid=>{
                          const t=techs[tid]; if(!t) return null;
                          const a=getAttend(tid); const ast=a?AS[a.status]:null;
                          return <div key={tid} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                            <div style={{width:16,height:16,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800}}>{t.initials||t.name[0]}</div>
                            <span style={{fontSize:11,color:"#dde3ff"}}>{t.name}</span>
                            {ast&&<span style={{fontSize:9,color:ast.color}}>{ast.icon}</span>}
                          </div>;
                        })}
                      </td>
                      <td style={{padding:"9px 11px",fontFamily:"monospace",fontSize:10,color:"#7b87b8"}}>{fmtTime(j.dispatchedAt)}</td>
                      <td style={{padding:"9px 11px",fontFamily:"monospace",fontSize:10,color:"#20c8b0"}}>{fmtTime(j.onSiteAt)}</td>
                      <td style={{padding:"9px 11px",fontFamily:"monospace",fontSize:10,color:"#2dcc7a"}}>{["done","activated"].includes(j.status)?fmtTime(j.updatedAt):"—"}</td>
                      <td style={{padding:"9px 11px"}}>
                        {dur?<span style={{fontFamily:"monospace",fontSize:10,color:"#f0a030",fontWeight:700}}>⏱ {dur}</span>:<span style={{color:"#3d4668"}}>—</span>}
                      </td>
                      <td style={{padding:"9px 11px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{width:50,height:4,background:"#222840",borderRadius:2,overflow:"hidden"}}>
                            <div style={{width:st.pct+"%",height:"100%",background:st.color,borderRadius:2}}/>
                          </div>
                          <span style={{fontSize:9.5,color:st.color,fontFamily:"monospace"}}>{st.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length===0 && <div style={{padding:30,textAlign:"center",color:"#3d4668",fontSize:13}}>Walang jobs.</div>}
        </div>
      )}

      {/* ── TIMELINE VIEW ── */}
      {viewMode==="timeline" && (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered
            .filter(([,j])=>j.dispatchedAt||j.createdAt)
            .sort((a,b)=>new Date(b[1].updatedAt||0)-new Date(a[1].updatedAt||0))
            .map(([jid,j])=>{
              const st=JS[j.status]||JS.pending;
              const steps=[
                {label:"Created",    time:j.createdAt,    color:"#7b87b8"},
                {label:"Dispatched", time:j.dispatchedAt, color:"#4d8ef5"},
                {label:"On the Way", time:j.onWayAt,      color:"#9b78f5"},
                {label:"On-Site",    time:j.onSiteAt,     color:"#20c8b0"},
                {label:"Done",       time:j.status==="done"||j.status==="activated"?j.updatedAt:null, color:"#2dcc7a"},
              ].filter(s=>s.time);
              return (
                <div key={jid} style={{background:"#0c0f1a",border:`1px solid ${st.color}44`,borderRadius:10,padding:"12px 14px",cursor:"pointer"}} onClick={()=>setSelectedJob(jid)}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{background:TB[j.type],color:TC[j.type],borderRadius:3,padding:"1px 7px",fontSize:9.5,fontWeight:800}}>{(j.type||"").toUpperCase()}</span>
                    <span style={{fontWeight:700,fontSize:13,color:"#dde3ff"}}>{j.client}</span>
                    <span style={{fontSize:11,color:"#7b87b8"}}>· {j.site}</span>
                    <span style={{marginLeft:"auto",background:st.bg,border:`1px solid ${st.color}44`,color:st.color,borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:700}}>{st.label}</span>
                    {j.dispatchedAt && <span style={{fontSize:11,color:"#f0a030",fontFamily:"monospace"}}>⏱ {timeDiff(j.dispatchedAt,j.status==="done"?j.updatedAt:new Date().toISOString())||"—"}</span>}
                  </div>
                  {/* Timeline dots */}
                  <div style={{display:"flex",alignItems:"center",gap:0}}>
                    {steps.map((step,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"auto"}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:step.color,border:`2px solid ${step.color}`}}/>
                          <div style={{fontSize:8.5,color:step.color,fontWeight:700,whiteSpace:"nowrap"}}>{step.label}</div>
                          <div style={{fontSize:8,fontFamily:"monospace",color:"#7b87b8"}}>{fmtTime(step.time)}</div>
                        </div>
                        {i<steps.length-1 && <div style={{flex:1,height:2,background:`linear-gradient(90deg,${step.color},${steps[i+1].color})`,margin:"0 4px",marginBottom:20}}/>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          {filtered.length===0 && <div style={{padding:30,textAlign:"center",color:"#3d4668",fontSize:13}}>Walang jobs.</div>}
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {viewMode==="calendar" && <Calendar />}

      {/* ── JOB TIME DETAIL MODAL ── */}
      {selectedJob && selJob && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,backdropFilter:"blur(5px)"}}>
          <div style={{background:"#0c0f1a",border:"1px solid #2e3450",borderRadius:16,width:540,maxWidth:"95vw",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #222840",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:10,color:"#7b87b8",marginBottom:3}}>{selJob.jo}</div>
                <div style={{fontSize:18,fontWeight:800,color:"#dde3ff"}}>{selJob.client}</div>
                <div style={{fontSize:12,color:"#7b87b8",marginTop:2}}>📍 {selJob.site} · {selJob.address}</div>
              </div>
              <button style={{background:"none",border:"none",color:"#7b87b8",fontSize:18,cursor:"pointer"}} onClick={()=>setSelectedJob(null)}>✕</button>
            </div>
            <div style={{padding:"16px 20px"}}>
              {/* Status + type */}
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <span style={{background:TB[selJob.type],color:TC[selJob.type],borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:800}}>{(selJob.type||"").toUpperCase()}</span>
                <span style={{background:(JS[selJob.status]||{}).bg,border:`1px solid ${(JS[selJob.status]||{}).color}44`,color:(JS[selJob.status]||{}).color,borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700}}>{(JS[selJob.status]||{}).label}</span>
                {selJob.priority==="urgent" && <span style={{background:"#2a0a0a",color:"#f05555",border:"1px solid #f0555544",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700}}>🔴 URGENT</span>}
              </div>

              {/* Time Tracking Section */}
              <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#4d8ef5",marginBottom:12}}>⏱ Time Tracking</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    ["Created",    selJob.createdAt,   "#7b87b8"],
                    ["Dispatched", selJob.dispatchedAt, "#4d8ef5"],
                    ["On the Way", selJob.onWayAt,      "#9b78f5"],
                    ["On-Site",    selJob.onSiteAt,     "#20c8b0"],
                    ["Completed",  ["done","activated"].includes(selJob.status)?selJob.updatedAt:null, "#2dcc7a"],
                    ["Cancelled",  selJob.status==="cancelled"?selJob.updatedAt:null, "#f05555"],
                  ].map(([label,time,color])=>(
                    <div key={label} style={{background:"#0c0f1a",border:`1px solid ${time?color+"44":"#222840"}`,borderRadius:8,padding:"9px 12px",opacity:time?1:.45}}>
                      <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:time?color:"#3d4668",marginBottom:4}}>{label}</div>
                      <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:time?color:"#3d4668"}}>{time?fmtTime(time):"—"}</div>
                      {time && <div style={{fontSize:9.5,color:"#7b87b8",marginTop:2,fontFamily:"monospace"}}>{new Date(time).toLocaleDateString("en-PH")}</div>}
                    </div>
                  ))}
                </div>

                {/* Duration summaries */}
                <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid #222840",display:"flex",gap:12,flexWrap:"wrap"}}>
                  {selJob.dispatchedAt && selJob.onSiteAt && (
                    <div style={{fontSize:11,color:"#9b78f5"}}>
                      🚗 Travel time: <strong style={{fontFamily:"monospace"}}>{timeDiff(selJob.dispatchedAt,selJob.onSiteAt)||"—"}</strong>
                    </div>
                  )}
                  {selJob.onSiteAt && (selJob.updatedAt&&["done","activated"].includes(selJob.status)) && (
                    <div style={{fontSize:11,color:"#20c8b0"}}>
                      🔧 On-site duration: <strong style={{fontFamily:"monospace"}}>{timeDiff(selJob.onSiteAt,selJob.updatedAt)||"—"}</strong>
                    </div>
                  )}
                  {selJob.dispatchedAt && (
                    <div style={{fontSize:11,color:"#f0a030"}}>
                      ⏱ Total elapsed: <strong style={{fontFamily:"monospace"}}>{timeDiff(selJob.dispatchedAt,["done","activated","cancelled"].includes(selJob.status)?selJob.updatedAt:new Date().toISOString())||"—"}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Tech + Attend */}
              {(selJob.techIds||[]).length>0 && (
                <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:10}}>Technician</div>
                  {(selJob.techIds||[]).map(tid=>{
                    const t=techs[tid]; if(!t) return null;
                    const a=getAttend(tid); const ast=a?AS[a.status]:null;
                    return (
                      <div key={tid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800}}>{t.initials||t.name[0]}</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,color:"#dde3ff",fontSize:13}}>{t.name}</div>
                          <div style={{fontSize:11,color:"#7b87b8"}}>{t.area}</div>
                        </div>
                        {ast && <div style={{background:ast.bg,border:`1px solid ${ast.color}44`,color:ast.color,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>{ast.icon} {ast.label}</div>}
                        {a?.timeIn && <div style={{fontSize:10,fontFamily:"monospace",color:"#7b87b8"}}>In: {a.timeIn}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* IT Credentials if install */}
              {selJob.itUsername && (
                <div style={{background:"#0d1535",border:"1px solid #4d8ef5",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#4d8ef5",marginBottom:8}}>Internet Credentials</div>
                  <div style={{fontFamily:"monospace",fontSize:13,color:"#4d8ef5",marginBottom:4}}>User: <strong>{selJob.itUsername}</strong></div>
                  <div style={{fontFamily:"monospace",fontSize:13,color:"#9b78f5"}}>Pass: <strong>{selJob.itPassword||selJob.macAddress}</strong></div>
                </div>
              )}

              {/* Materials */}
              {selJob.materialsUsed?.length>0 && (
                <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:8}}>Materials Used</div>
                  {selJob.materialsUsed.map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:i<selJob.materialsUsed.length-1?"1px solid #222840":"none",fontSize:12}}>
                      <span style={{color:"#dde3ff"}}>{m.name} x{m.qty}</span>
                      <span style={{fontFamily:"monospace",color:"#2dcc7a",fontWeight:700}}>₱{(m.price*m.qty).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,marginTop:6,borderTop:"1px solid #2dcc7a",fontWeight:700}}>
                    <span style={{color:"#2dcc7a"}}>TOTAL</span>
                    <span style={{fontFamily:"monospace",fontSize:14,color:"#2dcc7a"}}>₱{(selJob.materialsTotal||0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TECH AVAILABILITY STRIP */}
      <div style={{marginTop:16,background:"#0c0f1a",border:"1px solid #222840",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:10}}>Technician Availability Today</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {techList.map(([id,t])=>{
            const a=getAttend(id); const ast=a?AS[a.status]:null; const dep=canDeploy(id);
            return (
              <div key={id} style={{background:ast?ast.bg:"#111525",border:`1px solid ${ast?(ast.color+"44"):"#222840"}`,borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,border:`1.5px solid ${dep?(t.color||"#4d8ef5"):"#f05555"}`}}>{t.initials||t.name[0]}</div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:dep?"#dde3ff":"#f05555"}}>{t.name}</div>
                  <div style={{fontSize:9.5,color:ast?ast.color:"#3d4668"}}>{ast?ast.icon+" "+ast.label:"No record"}{a?.timeIn?" · "+a.timeIn:""}</div>
                </div>
                {!dep && <span style={{fontSize:10,color:"#f05555",fontWeight:700}}>⛔</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const s = {
  btn:{ background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"6px 12px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600 },
  sel:{ background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"7px 11px",borderRadius:8,fontFamily:"inherit",fontSize:12,outline:"none" },
};