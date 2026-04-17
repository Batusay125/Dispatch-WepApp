import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue } from "firebase/database";

const ATTEND = {
  present:{ label:"Present",  color:"#2dcc7a", bg:"#081e13", icon:"✅" },
  late:   { label:"Late",     color:"#f0a030", bg:"#2a1805", icon:"⏰" },
  absent: { label:"Absent",   color:"#f05555", bg:"#2a0a0a", icon:"❌" },
  halfday:{ label:"Half Day", color:"#9b78f5", bg:"#160f30", icon:"🌗" },
  leave:  { label:"On Leave", color:"#4d8ef5", bg:"#0d1535", icon:"🏖"  },
  dayoff: { label:"Day Off",  color:"#7b87b8", bg:"#111525", icon:"🗓"  },
};

const TASK_COLORS = { install:"#4dff88", repair:"#ff8c3d", relocate:"#7db8ff", collection:"#ffc04d" };
const TASK_BG     = { install:"#0d2a0d", repair:"#2a1005", relocate:"#0d1530", collection:"#2a1800" };
const JOB_ST_COLOR= { pending:"#f0a030",dispatched:"#4d8ef5","on-way":"#9b78f5","on-site":"#20c8b0","for-approval":"#f0a030",configuring:"#4d8ef5",activated:"#2dcc7a",done:"#2dcc7a",cancelled:"#f05555" };

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Props: techId (optional — if given, single tech view; if null = all techs admin view)
export default function Calendar({ techId = null, techName = null }) {
  const [attendance, setAttendance] = useState({});
  const [jobs,       setJobs]       = useState({});
  const [techs,      setTechs]      = useState({});
  const [curYear,    setCurYear]    = useState(new Date().getFullYear());
  const [curMonth,   setCurMonth]   = useState(new Date().getMonth()); // 0-indexed
  const [selected,   setSelected]   = useState(null); // "YYYY-MM-DD"
  const [filterTech, setFilterTech] = useState(techId || "all");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const u1 = onValue(ref(db,"attendance"), s=>setAttendance(s.exists()?s.val():{}));
    const u2 = onValue(ref(db,"jobs"),       s=>setJobs(s.exists()?s.val():{}));
    const u3 = onValue(ref(db,"technicians"),s=>setTechs(s.exists()?s.val():{}));
    return ()=>{ u1(); u2(); u3(); };
  }, []);

  const techList = Object.entries(techs);
  const viewTechId = techId || (filterTech === "all" ? null : filterTech);

  // Get attend status for a date + tech
  function getAttend(dateStr, tId) {
    return attendance[dateStr]?.[tId] || null;
  }

  // Get jobs for a date + tech
  function getJobs(dateStr, tId) {
    return Object.entries(jobs).filter(([,j]) => {
      const techMatch = tId
        ? (j.techId===tId || (j.techIds||[]).includes(tId))
        : true;
      const dateMatch = j.date===dateStr || j.updatedAt?.startsWith(dateStr);
      return techMatch && dateMatch;
    });
  }

  // Calendar grid
  const firstDay = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth+1, 0).getDate();
  const prevDays = new Date(curYear, curMonth, 0).getDate();

  // Month stats
  function getMonthStats(tId) {
    const prefix = `${curYear}-${String(curMonth+1).padStart(2,"0")}`;
    let present=0, absent=0, late=0, total=0, jobsDone=0;
    for (let d=1; d<=daysInMonth; d++) {
      const ds = `${prefix}-${String(d).padStart(2,"0")}`;
      const a = getAttend(ds, tId);
      if (a?.status) {
        total++;
        if (a.status==="present") present++;
        if (a.status==="late")    late++;
        if (a.status==="absent")  absent++;
      }
      const dayJobs = getJobs(ds, tId);
      jobsDone += dayJobs.filter(([,j])=>["done","activated"].includes(j.status)).length;
    }
    return { present, absent, late, total, jobsDone };
  }

  function prevMonth() {
    if (curMonth===0) { setCurMonth(11); setCurYear(y=>y-1); }
    else setCurMonth(m=>m-1);
    setSelected(null);
  }
  function nextMonth() {
    if (curMonth===11) { setCurMonth(0); setCurYear(y=>y+1); }
    else setCurMonth(m=>m+1);
    setSelected(null);
  }

  const prefix = `${curYear}-${String(curMonth+1).padStart(2,"0")}`;
  const stats = viewTechId ? getMonthStats(viewTechId) : null;
  const selectedJobs = selected ? getJobs(selected, viewTechId) : [];
  const selectedAttend = selected && viewTechId ? getAttend(selected, viewTechId) : null;

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,letterSpacing:-.5,color:"#dde3ff",margin:0}}>
            📅 {techId ? `${techName||"Technician"}'s Calendar` : "Attendance Calendar"}
          </h2>
          <div style={{fontSize:12,color:"#7b87b8",marginTop:3}}>
            {techId ? "Your attendance and job history" : "Team attendance overview — click a day to see details"}
          </div>
        </div>
        {!techId && (
          <select style={s.sel} value={filterTech} onChange={e=>{setFilterTech(e.target.value);setSelected(null);}}>
            <option value="all">👥 All Technicians (Overview)</option>
            {techList.map(([id,t])=><option key={id} value={id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* MONTH NAV + STATS */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <button style={s.navBtn} onClick={prevMonth}>← Prev</button>
        <div style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:"#dde3ff",minWidth:180,textAlign:"center"}}>
          {MONTHS_LONG[curMonth]} {curYear}
        </div>
        <button style={s.navBtn} onClick={nextMonth}>Next →</button>
        <button style={{...s.navBtn,background:"#0d1e42",borderColor:"#4d8ef5",color:"#4d8ef5"}}
          onClick={()=>{setCurYear(new Date().getFullYear());setCurMonth(new Date().getMonth());setSelected(null);}}>
          Today
        </button>
        {stats && (
          <div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap"}}>
            {[
              [stats.present,"Present","#2dcc7a","#081e13"],
              [stats.late,   "Late",   "#f0a030","#2a1805"],
              [stats.absent, "Absent", "#f05555","#2a0a0a"],
              [stats.jobsDone,"Jobs Done","#9b78f5","#160f30"],
            ].map(([v,l,col,bg])=>(
              <div key={l} style={{background:bg,border:`1px solid ${col}44`,borderRadius:7,padding:"3px 10px",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontFamily:"monospace",fontWeight:800,fontSize:13,color:col}}>{v}</span>
                <span style={{fontSize:10,color:col}}>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CALENDAR GRID */}
      <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:14,overflow:"hidden",marginBottom:16}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #222840"}}>
          {DAYS.map(d=>(
            <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",borderRight:"1px solid #222840"}}>
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {/* Prev month ghost days */}
          {Array.from({length:firstDay},(_,i)=>(
            <div key={"prev"+i} style={{...s.cell,opacity:.2}}>
              <span style={{fontSize:11,color:"#3d4668"}}>{prevDays-firstDay+i+1}</span>
            </div>
          ))}

          {/* Current month days */}
          {Array.from({length:daysInMonth},(_,i)=>{
            const d = i+1;
            const ds = `${prefix}-${String(d).padStart(2,"0")}`;
            const isToday = ds===today;
            const isSel = ds===selected;
            const isFuture = ds > today;

            // Determine cell color
            let cellBg = "transparent";
            let cellBorder = "1px solid #222840";
            let dotColor = null;

            if (viewTechId) {
              const a = getAttend(ds, viewTechId);
              if (a?.status) {
                const ast = ATTEND[a.status];
                cellBg = ast?.bg || "transparent";
                dotColor = ast?.color;
              }
            } else {
              // In "all" mode — show dot count
            }

            if (isToday) cellBorder = "2px solid #4d8ef5";
            if (isSel)   cellBorder = "2px solid #fff";

            // All-mode: collect all techs' attend for this day
            const allAttend = viewTechId ? null : techList.map(([tid])=>getAttend(ds,tid)).filter(Boolean);
            const presentCnt = allAttend?.filter(a=>a.status==="present"||a.status==="late"||a.status==="halfday").length||0;
            const absentCnt  = allAttend?.filter(a=>a.status==="absent").length||0;

            // Jobs for the day
            const dayJobs = getJobs(ds, viewTechId);
            const doneJobs = dayJobs.filter(([,j])=>["done","activated"].includes(j.status)).length;

            return (
              <div key={ds}
                style={{...s.cell, background:isFuture?"transparent":cellBg, border:cellBorder, cursor:isFuture?"default":"pointer", position:"relative"}}
                onClick={()=>!isFuture && setSelected(isSel?null:ds)}>

                {/* Day number */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:isToday?800:500,color:isToday?"#4d8ef5":isFuture?"#3d4668":"#dde3ff"}}>{d}</span>
                  {isToday && <span style={{fontSize:8,fontWeight:700,color:"#4d8ef5",background:"#0d1e42",borderRadius:3,padding:"1px 4px"}}>TODAY</span>}
                </div>

                {/* Single tech mode */}
                {viewTechId && !isFuture && (()=>{
                  const a = getAttend(ds, viewTechId);
                  const ast = a?.status ? ATTEND[a.status] : null;
                  return (
                    <>
                      {ast && <div style={{fontSize:11,marginBottom:2}}>{ast.icon}</div>}
                      {a?.timeIn && <div style={{fontSize:8.5,fontFamily:"monospace",color:dotColor||"#7b87b8",opacity:.8}}>In: {a.timeIn}</div>}
                      {a?.timeOut && <div style={{fontSize:8.5,fontFamily:"monospace",color:"#4d8ef5",opacity:.8}}>Out: {a.timeOut}</div>}
                      {doneJobs>0 && <div style={{marginTop:3,background:"#9b78f544",border:"1px solid #9b78f544",borderRadius:3,padding:"1px 5px",fontSize:8.5,fontWeight:700,color:"#9b78f5"}}>✓ {doneJobs} jobs</div>}
                    </>
                  );
                })()}

                {/* All-tech overview mode */}
                {!viewTechId && !isFuture && (
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:2}}>
                    {presentCnt>0 && <span style={{fontSize:9,background:"#081e13",color:"#2dcc7a",border:"1px solid #2dcc7a44",borderRadius:3,padding:"1px 4px",fontWeight:700}}>{presentCnt}✅</span>}
                    {absentCnt>0  && <span style={{fontSize:9,background:"#2a0a0a",color:"#f05555",border:"1px solid #f0555544",borderRadius:3,padding:"1px 4px",fontWeight:700}}>{absentCnt}❌</span>}
                    {doneJobs>0   && <span style={{fontSize:9,background:"#160f30",color:"#9b78f5",border:"1px solid #9b78f544",borderRadius:3,padding:"1px 4px",fontWeight:700}}>✓{doneJobs}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Next month ghost days */}
          {Array.from({length:(7-(firstDay+daysInMonth)%7)%7},(_,i)=>(
            <div key={"next"+i} style={{...s.cell,opacity:.2}}>
              <span style={{fontSize:11,color:"#3d4668"}}>{i+1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LEGEND */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:selected?14:0}}>
        {Object.entries(ATTEND).map(([k,v])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:10.5,color:v.color}}>
            <span>{v.icon}</span><span>{v.label}</span>
          </div>
        ))}
      </div>

      {/* SELECTED DAY DETAIL PANEL */}
      {selected && (
        <div style={{background:"#0c0f1a",border:"1.5px solid #4d8ef5",borderRadius:12,padding:"16px",marginTop:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"#dde3ff",marginBottom:12}}>
            📅 {new Date(selected+"T00:00").toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
          </div>

          {/* Single tech detail */}
          {viewTechId && (()=>{
            const a = getAttend(selected, viewTechId);
            const ast = a?.status ? ATTEND[a.status] : null;
            const dayJobs = getJobs(selected, viewTechId);
            return (
              <>
                {ast ? (
                  <div style={{display:"flex",alignItems:"center",gap:10,background:ast.bg,border:`1px solid ${ast.color}44`,borderRadius:9,padding:"10px 14px",marginBottom:12}}>
                    <span style={{fontSize:22}}>{ast.icon}</span>
                    <div>
                      <div style={{fontWeight:700,color:ast.color,fontSize:14}}>{ast.label}</div>
                      <div style={{fontSize:11,color:"#7b87b8",marginTop:2}}>
                        {a.timeIn && `Time In: ${a.timeIn}`}
                        {a.timeOut && `  ·  Time Out: ${a.timeOut}`}
                        {a.note && `  ·  Note: ${a.note}`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{background:"#111525",border:"1px solid #222840",borderRadius:9,padding:"10px 14px",marginBottom:12,color:"#3d4668",fontSize:13}}>
                    Walang attendance record para sa araw na ito.
                  </div>
                )}
                {dayJobs.length>0 ? (
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:8}}>Jobs this day</div>
                    {dayJobs.map(([jid,j])=>(
                      <div key={jid} style={{display:"flex",alignItems:"center",gap:8,background:"#111525",border:"1px solid #222840",borderRadius:8,padding:"8px 12px",marginBottom:6}}>
                        <span style={{background:TASK_BG[j.type],color:TASK_COLORS[j.type],borderRadius:3,padding:"1px 7px",fontSize:9.5,fontWeight:800,flexShrink:0}}>{(j.type||"").toUpperCase()}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:13,color:"#dde3ff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.client}</div>
                          <div style={{fontSize:10.5,color:"#7b87b8"}}>{j.site} · {j.address?.substring(0,35)}</div>
                        </div>
                        <span style={{background:"#111525",border:`1px solid ${JOB_ST_COLOR[j.status]||"#222840"}44`,color:JOB_ST_COLOR[j.status]||"#7b87b8",borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700,flexShrink:0}}>{j.status?.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{fontSize:12,color:"#3d4668"}}>Walang jobs ngayong araw.</div>
                )}
              </>
            );
          })()}

          {/* All-tech detail */}
          {!viewTechId && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {techList.map(([tid,t])=>{
                const a = getAttend(selected, tid);
                const ast = a?.status ? ATTEND[a.status] : null;
                const tJobs = getJobs(selected, tid);
                return (
                  <div key={tid} style={{background:ast?ast.bg:"#111525",border:`1px solid ${ast?ast.color+"44":"#222840"}`,borderRadius:9,padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{t.initials||t.name[0]}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:12.5,color:"#dde3ff"}}>{t.name}</div>
                        {ast ? <div style={{fontSize:10,color:ast.color}}>{ast.icon} {ast.label}</div> : <div style={{fontSize:10,color:"#3d4668"}}>No record</div>}
                      </div>
                    </div>
                    {a?.timeIn && <div style={{fontSize:10,fontFamily:"monospace",color:"#7b87b8"}}>In: <span style={{color:"#2dcc7a"}}>{a.timeIn}</span>{a.timeOut&&` · Out: `}<span style={{color:"#4d8ef5"}}>{a.timeOut||""}</span></div>}
                    {tJobs.length>0 && (
                      <div style={{marginTop:6,fontSize:10,color:"#9b78f5"}}>{tJobs.length} job{tJobs.length>1?"s":""} · {tJobs.filter(([,j])=>["done","activated"].includes(j.status)).length} done</div>
                    )}
                    {a?.note && <div style={{marginTop:4,fontSize:10,color:"#f0a030",fontStyle:"italic"}}>📝 {a.note}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  navBtn:{ background:"#111525",border:"1px solid #222840",color:"#7b87b8",padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600 },
  sel:   { background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"7px 11px",borderRadius:8,fontFamily:"inherit",fontSize:12,outline:"none" },
  cell:  { minHeight:90,padding:"6px 6px 5px",borderRight:"1px solid #222840",borderBottom:"1px solid #222840",transition:"background .15s",display:"flex",flexDirection:"column",position:"relative" },
};