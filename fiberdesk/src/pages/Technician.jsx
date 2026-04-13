import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, update } from "firebase/database";

const TASK_COLORS = { install:"#4dff88", repair:"#ff8c3d", relocate:"#7db8ff", collection:"#ffc04d" };
const TASK_BG = { install:"#0d2a0d", repair:"#2a1005", relocate:"#0d1530", collection:"#2a1800" };
const STATUS_COLOR = { pending:"#f0a030", dispatched:"#4d8ef5", "on-way":"#9b78f5", "on-site":"#20c8b0", "for-approval":"#f0a030", configuring:"#4d8ef5", activated:"#2dcc7a", done:"#2dcc7a", cancelled:"#f05555" };
const STATUS_BG = { pending:"#2a1805", dispatched:"#0d1535", "on-way":"#1a1040", "on-site":"#052220", "for-approval":"#2a1a05", configuring:"#0d1535", activated:"#081e13", done:"#081e13", cancelled:"#2a0a0a" };
const STATUS_LABEL = { pending:"PENDING", dispatched:"DISPATCHED", "on-way":"ON THE WAY", "on-site":"ON-SITE", "for-approval":"FOR IT", configuring:"CONFIGURING", activated:"ACTIVATED", done:"DONE", cancelled:"CANCELLED" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Technician({ user, onLogout }) {
  const [jobs, setJobs] = useState({});
  const [materials, setMaterials] = useState({});
  const [tab, setTab] = useState("dashboard");
  const [historyView, setHistoryView] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));
  const [confirming, setConfirming] = useState(null);
  const [declareJobId, setDeclareJobId] = useState(null);
  const [usedItems, setUsedItems] = useState([]);
  const [installJobId, setInstallJobId] = useState(null);
  const [installForm, setInstallForm] = useState({
    realName:"", realAddress:"", realContact:"", realPlan:"",
    realReferral:"", lcp:"", nap:"", port:"",
    macAddress:"", modemSerial:"", techNotes:""
  });
  const [cancelJobId, setCancelJobId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    const u1 = onValue(ref(db,"jobs"), s => setJobs(s.exists() ? s.val() : {}));
    const u2 = onValue(ref(db,"materials"), s => setMaterials(s.exists() ? s.val() : {}));
    return () => { u1(); u2(); };
  }, []);

  const allMyJobs = Object.entries(jobs).filter(([,j]) => j.techId === user.techId || (j.techIds||[]).includes(user.techId));
  const myJobs = allMyJobs
    .filter(([,j]) => !["done","cancelled"].includes(j.status))
    .sort((a,b) => {
      const o = { dispatched:0,"on-way":1,"on-site":2,"for-approval":3,configuring:4,activated:5,pending:6 };
      return (o[a[1].status]??9)-(o[b[1].status]??9);
    });

  const today = new Date().toISOString().split("T")[0];
  const thisMonth = new Date().toISOString().slice(0,7);
  const todayJobs = allMyJobs.filter(([,j]) => j.date===today || j.updatedAt?.startsWith(today));
  const monthJobs = allMyJobs.filter(([,j]) => j.date?.startsWith(thisMonth) || j.updatedAt?.startsWith(thisMonth));

  const totalDone = allMyJobs.filter(([,j]) => j.status==="done"||j.status==="activated").length;
  const totalCancelled = allMyJobs.filter(([,j]) => j.status==="cancelled").length;
  const totalMaterials = allMyJobs.reduce((a,[,j]) => a+(j.materialsTotal||0), 0);
  const monthDone = monthJobs.filter(([,j]) => j.status==="done"||j.status==="activated").length;

  const historyJobs = allMyJobs.filter(([,j]) => {
    if (historyView==="daily") return j.date===selectedDate || j.updatedAt?.startsWith(selectedDate);
    return j.date?.startsWith(selectedMonth) || j.updatedAt?.startsWith(selectedMonth);
  }).reverse();

  const monthlyData = Array.from({length:6}, (_,i) => {
    const d = new Date(); d.setMonth(d.getMonth()-5+i);
    const key = d.toISOString().slice(0,7);
    const count = allMyJobs.filter(([,j]) => (j.date?.startsWith(key)||j.updatedAt?.startsWith(key)) && (j.status==="done"||j.status==="activated")).length;
    return { label: MONTHS[d.getMonth()], count, key };
  });
  const maxCount = Math.max(...monthlyData.map(m=>m.count), 1);

  async function updateStatus(jobId, newStatus) {
    await update(ref(db,"jobs/"+jobId), { status:newStatus, updatedAt:new Date().toISOString(), updatedBy:user.name });
    setConfirming(null);
  }

  async function submitCancel() {
    if (!cancelReason.trim()) { alert("Ilagay ang dahilan"); return; }
    await update(ref(db,"jobs/"+cancelJobId), {
      status:"cancelled", cancelReason:cancelReason.trim(),
      cancelledBy:user.name, cancelledAt:new Date().toISOString(), updatedAt:new Date().toISOString()
    });
    setCancelJobId(null); setCancelReason("");
  }

  function openInstallForm(jobId) {
    const j = jobs[jobId];
    setInstallForm({ realName:j.client||"", realAddress:j.address||"", realContact:j.contact||"", realPlan:j.plan||"", realReferral:j.referral||"", lcp:j.lcp||"", nap:j.nap||"", port:j.port||"", macAddress:"", modemSerial:"", techNotes:"" });
    setUsedItems([]);
    setInstallJobId(jobId);
  }

  async function submitInstallDetails() {
    if (!installForm.macAddress.trim()) { alert("Kailangan ang MAC Address"); return; }
    if (!installForm.lcp || !installForm.nap || !installForm.port) { alert("Ilagay ang LCP, NAP, at PORT"); return; }
    const matTotal = usedItems.reduce((a,i) => a+(i.price*i.qty), 0);
    await update(ref(db,"jobs/"+installJobId), {
      ...installForm, status:"for-approval",
      macSubmittedAt:new Date().toISOString(), updatedBy:user.name,
      materialsUsed:usedItems, materialsTotal:matTotal
    });
    setInstallJobId(null); setUsedItems([]);
  }

  function openDeclare(jobId) {
    setUsedItems((jobs[jobId]?.materialsUsed||[]).map(i=>({...i})));
    setDeclareJobId(jobId);
  }

  function addItem(matId) {
    const mat = materials[matId]; if (!mat) return;
    const idx = usedItems.findIndex(i => i.matId===matId);
    if (idx>=0) { const u=[...usedItems]; u[idx].qty+=1; setUsedItems(u); }
    else setUsedItems([...usedItems, {matId, name:mat.name, unit:mat.unit, price:mat.price, qty:1}]);
  }

  function changeQty(i, val) {
    const u = [...usedItems];
    u[i].qty = Math.max(0, parseInt(val)||0);
    setUsedItems(u.filter(x => x.qty>0));
  }

  async function submitDeclaration() {
    const total = usedItems.reduce((a,i) => a+(i.price*i.qty), 0);
    await update(ref(db,"jobs/"+declareJobId), {
      materialsUsed:usedItems, materialsTotal:total,
      status:"done", updatedAt:new Date().toISOString(), updatedBy:user.name
    });
    setDeclareJobId(null); setUsedItems([]); setConfirming(null);
  }

  const totalCost = usedItems.reduce((a,i) => a+(i.price*i.qty), 0);

  return (
    <div style={s.app}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={s.logo}>KEY<span style={{color:"#2dcc7a"}}>CONNECT</span></div>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{display:"flex", alignItems:"center", gap:6, background:"#081e13", border:"1px solid #1a5a2a", borderRadius:20, padding:"4px 12px"}}>
            <span style={s.ldot} />
            <span style={{fontSize:12, fontWeight:600, color:"#2dcc7a"}}>{user.name.split(" ")[0]}</span>
          </div>
          {myJobs.length > 0 && (
            <div style={{background:"#f05555", color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700}}>
              {myJobs.length} active
            </div>
          )}
          <button style={s.logoutBtn} onClick={onLogout}>Labas</button>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={s.tabBar}>
        {[["dashboard","◈","Dashboard"],["tasks","📋","Mga Task"],["history","📊","Records"]].map(([key,ic,lbl]) => (
          <button key={key} style={{...s.tabBtn, ...(tab===key ? s.tabActive : {})}} onClick={() => setTab(key)}>
            <span style={{fontSize:16}}>{ic}</span>
            <span style={{fontSize:10, marginTop:2}}>{lbl}</span>
            {key==="tasks" && myJobs.length>0 && (
              <span style={s.tabBadge}>{myJobs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab==="dashboard" && (
        <div style={s.body}>
          <div style={s.greeting}>
            <div style={s.greetName}>Kumusta, {user.name.split(" ")[0]}! 👋</div>
            <div style={s.greetSub}>{new Date().toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric"})}</div>
          </div>

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16}}>
            {[
              ["Active Tasks", myJobs.length, "#4d8ef5", "Kailangan gawin"],
              ["Done Today", todayJobs.filter(([,j])=>j.status==="done"||j.status==="activated").length, "#2dcc7a", "Natapos ngayon"],
              ["This Month", monthDone, "#20c8b0", "Jobs completed"],
              ["All Time", totalDone, "#9b78f5", "Total completed"],
            ].map(([lbl,val,col,sub]) => (
              <div key={lbl} style={{...s.statCard, borderTopColor:col}}>
                <div style={s.statLbl}>{lbl}</div>
                <div style={{...s.statVal, color:col}}>{val}</div>
                <div style={s.statSub}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={s.sectionHd}>
            <span style={s.secTitle2}>NGAYON</span>
            <span style={{fontSize:11, color:"#7b87b8"}}>{todayJobs.length} jobs</span>
          </div>
          {todayJobs.length > 0 ? (
            <div style={s.card}>
              {todayJobs.map(([id,j]) => (
                <div key={id} style={{display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid #222840", cursor:"pointer"}} onClick={() => setTab("tasks")}>
                  <span style={{...s.typePill, background:TASK_BG[j.type], color:TASK_COLORS[j.type]}}>{(j.type||"").toUpperCase()}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontWeight:600, fontSize:13, color:"#dde3ff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{j.client}</div>
                    <div style={{fontSize:11, color:"#7b87b8"}}>{j.site||""} · {j.address?.substring(0,30)}</div>
                  </div>
                  <span style={{...s.statusPill, background:STATUS_BG[j.status], color:STATUS_COLOR[j.status]}}>{STATUS_LABEL[j.status]}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={s.emptyCard}>Walang scheduled jobs ngayon.</div>
          )}

          <div style={{...s.sectionHd, marginTop:16}}>
            <span style={s.secTitle2}>JOBS COMPLETED (6 MONTHS)</span>
          </div>
          <div style={s.card}>
            <div style={{padding:"16px 14px"}}>
              <div style={{display:"flex", alignItems:"flex-end", gap:8, height:120}}>
                {monthlyData.map((m,i) => (
                  <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5}}>
                    <div style={{fontSize:11, fontWeight:700, color:"#2dcc7a", minHeight:16}}>{m.count>0?m.count:""}</div>
                    <div style={{width:"100%", background:m.key===thisMonth?"#2dcc7a":"#4d8ef5", borderRadius:"4px 4px 0 0", height:m.count===0?4:Math.max(8,(m.count/maxCount)*90), opacity:m.key===thisMonth?1:0.55}}></div>
                    <div style={{fontSize:10, color:m.key===thisMonth?"#2dcc7a":"#7b87b8", fontWeight:m.key===thisMonth?700:400}}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{...s.card, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:0}}>
            <div>
              <div style={{fontSize:11, color:"#7b87b8", marginBottom:4}}>All-time materials cost</div>
              <div style={{fontSize:22, fontWeight:800, fontFamily:"monospace", color:"#9b78f5"}}>₱{totalMaterials.toLocaleString()}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11, color:"#7b87b8", marginBottom:4}}>Cancelled jobs</div>
              <div style={{fontSize:22, fontWeight:800, fontFamily:"monospace", color:"#f05555"}}>{totalCancelled}</div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TASKS ══ */}
      {tab==="tasks" && (
        <div style={s.body}>
          {myJobs.length===0 ? (
            <div style={s.noTasks}>
              <div style={{fontSize:48, marginBottom:14}}>✅</div>
              <div style={{fontSize:15, fontWeight:600, color:"#dde3ff", marginBottom:6}}>Walang active tasks.</div>
              <div style={{fontSize:13, color:"#7b87b8", textAlign:"center"}}>Kapag may ibinaba sa iyo ang dispatcher,<br/>lalabas dito agad!</div>
            </div>
          ) : (
            <>
              <div style={{...s.sectionHd, marginBottom:12}}>
                <span style={s.secTitle2}>ACTIVE TASKS ({myJobs.length})</span>
                <span style={s.ldot} />
              </div>
              {myJobs.map(([id,j]) => (
                <TaskCard key={id} id={id} j={j} materials={materials}
                  usedItems={usedItems} setUsedItems={setUsedItems} totalCost={totalCost}
                  confirming={confirming} setConfirming={setConfirming}
                  setCancelJobId={setCancelJobId} setCancelReason={setCancelReason}
                  openInstallForm={openInstallForm} openDeclare={openDeclare}
                  updateStatus={updateStatus} addItem={addItem} changeQty={changeQty}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ══ HISTORY / RECORDS ══ */}
      {tab==="history" && (
        <div style={s.body}>
          <div style={{display:"flex", gap:6, marginBottom:14}}>
            {[["daily","Daily"],["monthly","Monthly"]].map(([k,lbl]) => (
              <button key={k} style={{...s.toggleBtn, ...(historyView===k ? s.toggleActive : {})}} onClick={() => setHistoryView(k)}>{lbl}</button>
            ))}
            <div style={{marginLeft:"auto"}}>
              {historyView==="daily"
                ? <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={s.dateInput}/>
                : <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={s.dateInput}/>
              }
            </div>
          </div>

          <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14}}>
            {[
              ["Jobs", historyJobs.length, "#4d8ef5"],
              ["Done", historyJobs.filter(([,j])=>j.status==="done"||j.status==="activated").length, "#2dcc7a"],
              ["Materials", "₱"+historyJobs.reduce((a,[,j])=>a+(j.materialsTotal||0),0).toLocaleString(), "#9b78f5"],
            ].map(([lbl,val,col]) => (
              <div key={lbl} style={{...s.statCard, borderTopColor:col, padding:"10px 12px"}}>
                <div style={{fontSize:9, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:"#7b87b8", marginBottom:4}}>{lbl}</div>
                <div style={{fontSize:18, fontWeight:700, fontFamily:"monospace", color:col}}>{val}</div>
              </div>
            ))}
          </div>

          {historyJobs.length > 0 && (
            <>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:14}}>
                {["install","repair","relocate","collection"].map(t => {
                  const cnt = historyJobs.filter(([,j])=>j.type===t).length;
                  return (
                    <div key={t} style={{background:TASK_BG[t], border:"1px solid "+TASK_COLORS[t]+"44", borderRadius:8, padding:"8px 10px", textAlign:"center"}}>
                      <div style={{fontSize:18, fontWeight:800, color:TASK_COLORS[t]}}>{cnt}</div>
                      <div style={{fontSize:9.5, fontWeight:700, color:TASK_COLORS[t], textTransform:"uppercase", marginTop:2}}>{t}</div>
                    </div>
                  );
                })}
              </div>

              <div style={s.card}>
                {historyJobs.map(([id,j]) => (
                  <div key={id} style={{padding:"11px 14px", borderBottom:"1px solid #222840"}}>
                    <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5}}>
                      <div style={{display:"flex", alignItems:"center", gap:6}}>
                        <span style={{...s.typePill, background:TASK_BG[j.type], color:TASK_COLORS[j.type]}}>{(j.type||"").toUpperCase()}</span>
                        {j.site && <span style={{fontSize:10, color:"#9b78f5", fontWeight:600}}>{j.site}</span>}
                      </div>
                      <span style={{...s.statusPill, background:STATUS_BG[j.status], color:STATUS_COLOR[j.status]}}>{STATUS_LABEL[j.status]}</span>
                    </div>
                    <div style={{fontWeight:700, fontSize:13.5, color:"#dde3ff"}}>{j.client}</div>
                    <div style={{fontSize:11.5, color:"#7b87b8", marginTop:2}}>{j.address}</div>
                    {j.lcp && <div style={{fontFamily:"monospace", fontSize:11, color:"#20c8b0", marginTop:3}}>LCP: {j.lcp} | NAP: {j.nap} | PORT: {j.port}</div>}
                    {j.status==="cancelled" && j.cancelReason && (
                      <div style={{fontSize:11, color:"#f05555", marginTop:4, background:"#2a0a0a", padding:"4px 8px", borderRadius:5}}>Cancel: {j.cancelReason}</div>
                    )}
                    {j.materialsUsed && j.materialsUsed.length>0 && (
                      <div style={{marginTop:6, background:"#111525", borderRadius:6, padding:"6px 10px"}}>
                        <div style={{fontSize:10, color:"#7b87b8", marginBottom:3}}>Materials used:</div>
                        <div style={{fontSize:11.5, color:"#f0a030"}}>{j.materialsUsed.map(m=>m.name+" x"+m.qty).join(", ")}</div>
                        <div style={{fontFamily:"monospace", fontSize:13, fontWeight:700, color:"#2dcc7a", marginTop:3}}>₱{(j.materialsTotal||0).toLocaleString()}</div>
                      </div>
                    )}
                    <div style={{fontSize:10, color:"#3d4668", fontFamily:"monospace", marginTop:5}}>{j.jo} · {j.date}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {historyJobs.length===0 && <div style={s.emptyCard}>Walang jobs para sa period na ito.</div>}
        </div>
      )}

      {/* ── CANCEL MODAL ── */}
      {cancelJobId && (
        <div style={s.ov}>
          <div style={{...s.modal, width:440}}>
            <div style={{padding:"16px 18px", borderBottom:"1px solid #222840"}}>
              <div style={{fontSize:16, fontWeight:800, color:"#f05555"}}>✕ Cancel Task</div>
              <div style={{fontSize:11, color:"#7b87b8", marginTop:2}}>{jobs[cancelJobId]?.client} · {jobs[cancelJobId]?.jo}</div>
            </div>
            <div style={{padding:"16px 18px"}}>
              <div style={{fontSize:10, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:"#7b87b8", marginBottom:8}}>Bakit mo kina-cancel?</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginBottom:12}}>
                {["Hindi mahanap ang address","Walang tao sa bahay","Client nag-cancel","Di magawa — reschedule","Kulang ang materials","Iba pang dahilan"].map(r => (
                  <button key={r} style={{...s.reasonBtn, ...(cancelReason===r ? s.reasonActive : {})}} onClick={() => setCancelReason(r)}>{r}</button>
                ))}
              </div>
              <textarea style={{...s.fi, minHeight:60, resize:"vertical"}} placeholder="O mag-type ng dahilan..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
              <div style={{background:"#2a0a0a", border:"1px solid #f05555", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#f05555", marginTop:8}}>⚠ Malalaman ito ng Dispatcher.</div>
            </div>
            <div style={{padding:"12px 18px", borderTop:"1px solid #222840", display:"flex", justifyContent:"flex-end", gap:8}}>
              <button style={s.btnGhost} onClick={() => setCancelJobId(null)}>Bumalik</button>
              <button style={s.btnDanger} onClick={submitCancel}>Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── INSTALL MODAL ── */}
      {installJobId && (
        <div style={s.ov}>
          <div style={{...s.modal, width:560, maxHeight:"90vh", overflowY:"auto"}}>
            <div style={{padding:"16px 18px", borderBottom:"1px solid #222840"}}>
              <div style={{fontSize:16, fontWeight:800, color:"#dde3ff"}}>📡 Installation Details</div>
              <div style={{fontSize:11, color:"#7b87b8", marginTop:2}}>{jobs[installJobId]?.client} · {jobs[installJobId]?.jo}</div>
            </div>
            <div style={{padding:"16px 18px"}}>
              <Fsec>Client Details</Fsec>
              <div style={s.f2}>
                <FI label="Real Name *" v={installForm.realName} set={v => setInstallForm({...installForm,realName:v})} ph="Actual name" />
                <FI label="Contact" v={installForm.realContact} set={v => setInstallForm({...installForm,realContact:v})} ph="09XX-XXX-XXXX" mono />
              </div>
              <FI label="Real Address *" v={installForm.realAddress} set={v => setInstallForm({...installForm,realAddress:v})} ph="Blk/Lot, Street, Brgy" full />
              <div style={s.f2}>
                <FI label="Plan" v={installForm.realPlan} set={v => setInstallForm({...installForm,realPlan:v})} ph="25 Mbps..." />
                <FI label="Referral" v={installForm.realReferral} set={v => setInstallForm({...installForm,realReferral:v})} ph="Sino nag-refer" />
              </div>

              <Fsec>Network Info (ikaw ang maglalagay)</Fsec>
              <div style={s.f3}>
                <NumPrefixFI label="LCP *" prefix="L" v={installForm.lcp} set={v => setInstallForm({...installForm,lcp:v})} />
                <NumPrefixFI label="NAP *" prefix="N" v={installForm.nap} set={v => setInstallForm({...installForm,nap:v})} />
                <NumPrefixFI label="Port *" prefix="P" v={installForm.port} set={v => setInstallForm({...installForm,port:v})} />
              </div>

              <Fsec>Modem Info (para sa IT)</Fsec>
              <div style={s.f2}>
                <FI label="MAC Address *" v={installForm.macAddress} set={v => setInstallForm({...installForm,macAddress:v})} ph="XX:XX:XX:XX:XX:XX" mono big />
                <FI label="Modem Serial" v={installForm.modemSerial} set={v => setInstallForm({...installForm,modemSerial:v})} ph="Serial number" mono />
              </div>
              <FI label="Tech Notes" v={installForm.techNotes} set={v => setInstallForm({...installForm,techNotes:v})} ph="Dagdag na info para sa IT..." full ta />

              <Fsec>Materials Ginamit</Fsec>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10}}>
                {Object.entries(materials).map(([id,m]) => (
                  <button key={id} style={s.matBtn} onClick={() => addItem(id)}>
                    <span style={{color:"#2dcc7a", fontWeight:700}}>+</span>{m.name}
                    <span style={{fontSize:10, color:"#7b87b8", marginLeft:"auto"}}>₱{m.price}/{m.unit}</span>
                  </button>
                ))}
              </div>
              {usedItems.length > 0 && (
                <div style={{background:"#111525", border:"1px solid #222840", borderRadius:8, overflow:"hidden", marginBottom:8}}>
                  {usedItems.map((item,i) => (
                    <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderBottom:i<usedItems.length-1?"1px solid #222840":"none"}}>
                      <div style={{flex:1, fontSize:12}}>{item.name}</div>
                      <div style={{display:"flex", alignItems:"center", gap:4}}>
                        <button style={s.qtyBtn} onClick={() => changeQty(i,item.qty-1)}>−</button>
                        <input style={s.qtyInput} type="number" value={item.qty} onChange={e => changeQty(i,e.target.value)} min="1" />
                        <button style={s.qtyBtn} onClick={() => changeQty(i,item.qty+1)}>+</button>
                      </div>
                      <div style={{fontSize:12, fontWeight:700, color:"#2dcc7a", minWidth:50, textAlign:"right"}}>₱{(item.price*item.qty).toLocaleString()}</div>
                      <button style={{background:"none", border:"none", color:"#f05555", cursor:"pointer", fontSize:13}} onClick={() => setUsedItems(usedItems.filter((_,x)=>x!==i))}>✕</button>
                    </div>
                  ))}
                  <div style={{display:"flex", justifyContent:"space-between", padding:"8px 12px", borderTop:"1px solid #2dcc7a", background:"#081e13"}}>
                    <span style={{fontWeight:700, color:"#2dcc7a"}}>TOTAL</span>
                    <span style={{fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#2dcc7a"}}>₱{totalCost.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{padding:"12px 18px", borderTop:"1px solid #222840", display:"flex", justifyContent:"flex-end", gap:8}}>
              <button style={s.btnGhost} onClick={() => { setInstallJobId(null); setUsedItems([]); }}>Cancel</button>
              <button style={{...s.btnPrimary, background:"#9b78f5"}} onClick={submitInstallDetails}>
                📡 I-submit sa IT {usedItems.length>0 ? "(+"+usedItems.length+" materials)" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MATERIALS DECLARE MODAL ── */}
      {declareJobId && (
        <div style={s.ov}>
          <div style={{...s.modal, width:520, maxHeight:"90vh", overflowY:"auto"}}>
            <div style={{padding:"16px 18px", borderBottom:"1px solid #222840"}}>
              <div style={{fontSize:16, fontWeight:800, color:"#dde3ff"}}>Declare Materials Used</div>
              <div style={{fontSize:11, color:"#7b87b8", marginTop:2}}>{jobs[declareJobId]?.client} · {jobs[declareJobId]?.jo}</div>
            </div>
            <div style={{padding:"16px 18px"}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14}}>
                {Object.entries(materials).map(([id,m]) => (
                  <button key={id} style={s.matBtn} onClick={() => addItem(id)}>
                    <span style={{color:"#2dcc7a", fontWeight:700}}>+</span>{m.name}
                    <span style={{fontSize:10, color:"#7b87b8", marginLeft:"auto"}}>₱{m.price}/{m.unit}</span>
                  </button>
                ))}
              </div>
              {usedItems.length > 0 && (
                <div style={{background:"#111525", border:"1px solid #222840", borderRadius:8, overflow:"hidden", marginBottom:12}}>
                  {usedItems.map((item,i) => (
                    <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderBottom:i<usedItems.length-1?"1px solid #222840":"none"}}>
                      <div style={{flex:1, fontSize:12.5}}>{item.name}</div>
                      <div style={{fontSize:11, color:"#7b87b8"}}>₱{item.price}</div>
                      <div style={{display:"flex", alignItems:"center", gap:4}}>
                        <button style={s.qtyBtn} onClick={() => changeQty(i,item.qty-1)}>−</button>
                        <input style={s.qtyInput} type="number" value={item.qty} onChange={e => changeQty(i,e.target.value)} min="1" />
                        <button style={s.qtyBtn} onClick={() => changeQty(i,item.qty+1)}>+</button>
                      </div>
                      <div style={{fontSize:12, fontWeight:700, color:"#2dcc7a", minWidth:55, textAlign:"right"}}>₱{(item.price*item.qty).toLocaleString()}</div>
                      <button style={{background:"none", border:"none", color:"#f05555", cursor:"pointer", fontSize:14, padding:"0 4px"}} onClick={() => setUsedItems(usedItems.filter((_,x)=>x!==i))}>✕</button>
                    </div>
                  ))}
                  <div style={{display:"flex", justifyContent:"space-between", padding:"10px 12px", borderTop:"1px solid #2dcc7a", background:"#081e13"}}>
                    <span style={{fontWeight:700, color:"#2dcc7a"}}>TOTAL</span>
                    <span style={{fontFamily:"monospace", fontSize:16, fontWeight:700, color:"#2dcc7a"}}>₱{totalCost.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {usedItems.length===0 && (
                <div style={{background:"#111525", border:"1px solid #222840", borderRadius:8, padding:16, textAlign:"center", color:"#7b87b8", fontSize:12.5, marginBottom:12}}>
                  Walang materials? I-click ang Done sa ibaba.
                </div>
              )}
            </div>
            <div style={{padding:"12px 18px", borderTop:"1px solid #222840", display:"flex", justifyContent:"flex-end", gap:8}}>
              <button style={s.btnGhost} onClick={() => { setDeclareJobId(null); setUsedItems([]); }}>Bumalik</button>
              <button style={{...s.btnPrimary, background:usedItems.length===0?"#444":"#2dcc7a"}} onClick={submitDeclaration}>
                {usedItems.length===0 ? "Walang Materials — Done" : "Submit at Done ✓ (₱"+totalCost.toLocaleString()+")"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TASK CARD ──
function TaskCard({ id, j, materials, usedItems, setUsedItems, totalCost, confirming, setConfirming, setCancelJobId, setCancelReason, openInstallForm, openDeclare, updateStatus, addItem, changeQty }) {
  const isInstall = j.type==="install";
  const isUrgent = j.priority==="urgent";
  const borderColor = isUrgent ? "#f05555" : ({dispatched:"#4d8ef5","on-way":"#9b78f5","on-site":"#20c8b0","for-approval":"#f0a030",configuring:"#4d8ef5",activated:"#2dcc7a"}[j.status]||"#222840");

  let actions = null;
  if (j.status==="dispatched") {
    actions = (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button style={{...s.actBtn,background:"#7b3ff5"}} onClick={() => updateStatus(id,"on-way")}>🚗 &nbsp;Papunta Na Ako!</button>
        <button style={s.cancelBtn} onClick={() => { setCancelJobId(id); setCancelReason(""); }}>✕ Cancel Task</button>
      </div>
    );
  } else if (j.status==="on-way") {
    actions = (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button style={{...s.actBtn,background:"#20c8b0"}} onClick={() => updateStatus(id,"on-site")}>📍 &nbsp;Nandito Na Ako!</button>
        <button style={s.cancelBtn} onClick={() => { setCancelJobId(id); setCancelReason(""); }}>✕ Cancel Task</button>
      </div>
    );
  } else if (j.status==="on-site") {
    if (isInstall) {
      actions = (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button style={{...s.actBtn,background:"#9b78f5"}} onClick={() => openInstallForm(id)}>📡 &nbsp;Submit Installation Details + MAC</button>
          <button style={s.cancelBtn} onClick={() => { setCancelJobId(id); setCancelReason(""); }}>✕ Hindi Ma-install / Cancel</button>
        </div>
      );
    } else {
      actions = confirming===id ? (
        <div style={s.confirmBox}>
          <div style={{fontSize:13,fontWeight:700,color:"#dde3ff",marginBottom:8}}>I-declare muna ang ginamit na materials.</div>
          <div style={{display:"flex",gap:8}}>
            <button style={{...s.actBtn,background:"#2dcc7a",flex:1,padding:12,fontSize:13}} onClick={() => openDeclare(id)}>✅ I-declare Materials</button>
            <button style={s.cancelBtn2} onClick={() => setConfirming(null)}>Bumalik</button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button style={{...s.actBtn,background:"#2dcc7a"}} onClick={() => setConfirming(id)}>✅ &nbsp;TAPOS NA!</button>
          <button style={s.cancelBtn} onClick={() => { setCancelJobId(id); setCancelReason(""); }}>✕ Cancel Task</button>
        </div>
      );
    }
  } else if (j.status==="for-approval") {
    actions = (
      <div style={{background:"#052220",border:"1px solid #0f5548",borderRadius:8,padding:"12px 14px"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#20c8b0",marginBottom:4}}>⏳ Naghihintay ng IT Activation</div>
        <div style={{fontSize:12,color:"#7b87b8"}}>Na-submit mo na ang MAC Address. Hintayin ang IT.</div>
        {j.macAddress && <div style={{fontFamily:"monospace",fontSize:12,color:"#9b78f5",marginTop:6}}>MAC: {j.macAddress}</div>}
      </div>
    );
  } else if (j.status==="configuring") {
    actions = (
      <div style={{background:"#0d1535",border:"1px solid #4d8ef5",borderRadius:8,padding:"12px 14px"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#4d8ef5",marginBottom:4}}>⚙ Kina-configure ng IT...</div>
        <div style={{fontSize:12,color:"#7b87b8"}}>Sandali lang.</div>
      </div>
    );
  } else if (j.status==="activated") {
    actions = (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{background:"#081e13",border:"1.5px solid #1a5a2a",borderRadius:10,padding:"16px"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#2dcc7a",marginBottom:14}}>✅ INTERNET ACTIVATED!</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:6}}>USERNAME</div>
            <div style={{background:"#0a1628",border:"1px solid #4d8ef5",borderRadius:8,padding:"10px 14px"}}>
              <div style={{fontFamily:"monospace",fontSize:15,fontWeight:800,color:"#4d8ef5",letterSpacing:1,wordBreak:"break-all"}}>{j.itUsername||"—"}</div>
            </div>
          </div>
          <div>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:6}}>PASSWORD (MAC Address)</div>
            <div style={{background:"#160a28",border:"1px solid #9b78f5",borderRadius:8,padding:"10px 14px"}}>
              <div style={{fontFamily:"monospace",fontSize:15,fontWeight:800,color:"#9b78f5",letterSpacing:2,wordBreak:"break-all"}}>{j.itPassword||j.macAddress||"—"}</div>
            </div>
          </div>
          <div style={{background:"#0d1535",border:"1px solid #2a3a6a",borderRadius:8,padding:"10px 12px",marginTop:12,fontSize:12,color:"#7b87b8"}}>
            💡 Ibigay ang <strong style={{color:"#dde3ff"}}>username at password</strong> na ito sa client.
          </div>
        </div>
        {j.materialsUsed && j.materialsUsed.length>0
          ? <button style={{...s.actBtn,background:"#2dcc7a"}} onClick={() => updateStatus(id,"done")}>✅ &nbsp;Mark as Done</button>
          : <button style={{...s.actBtn,background:"#2dcc7a"}} onClick={() => openDeclare(id)}>✅ &nbsp;I-declare Materials at Tapusin</button>
        }
      </div>
    );
  } else if (j.status==="pending") {
    actions = <button style={{...s.actBtn,background:"#171c2e",color:"#7b87b8",cursor:"not-allowed"}} disabled>⏳ &nbsp;Naghihintay ng dispatch...</button>;
  }

  const guide = {
    dispatched:"I-tap kapag umalis ka na.",
    "on-way":"I-tap kapag nandoon ka na.",
    "on-site": isInstall ? "I-submit ang installation details at MAC Address." : "I-tap ang TAPOS NA kapag done ka.",
    "for-approval":"Naghihintay ng IT.",
    configuring:"Kina-configure ng IT ang modem.",
    activated:"Activated! Ibigay ang credentials sa client.",
    pending:"Naghihintay ng dispatcher."
  };

  return (
    <div style={{...s.card, border:"1.5px solid "+borderColor, marginBottom:14}}>
      <div style={s.cardHd}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{...s.typePill,background:TASK_BG[j.type],color:TASK_COLORS[j.type]}}>{(j.type||"").toUpperCase()}</span>
          {j.site && <span style={s.siteBadge}>{j.site}</span>}
          {isUrgent && <span style={s.urgBadge}>URGENT</span>}
        </div>
        <span style={s.joNum}>{j.jo}</span>
      </div>
      <div style={s.cardBody}>
        <div style={s.clientNm}>{j.client}</div>
        <div style={s.addr}>📍 {j.address||"—"}</div>
        <div style={s.contact}>📞 {j.contact||"—"}</div>
        {j.plan && <div style={{fontSize:12,color:"#20c8b0",marginBottom:4}}>📶 {j.plan}</div>}
        {j.lcp && !["for-approval","activated"].includes(j.status) && (
          <div style={s.lcpBox}>LCP: {j.lcp} &nbsp;|&nbsp; NAP: {j.nap} &nbsp;|&nbsp; PORT: {j.port}</div>
        )}
        {j.notes && <div style={s.notesBox}>⚠ {j.notes}</div>}
        <div style={{marginTop:8}}>{actions}</div>
      </div>
      <div style={s.guide}>{guide[j.status]||""}</div>
    </div>
  );
}

// ── HELPERS ──
function Fsec({ children }) {
  return <div style={{fontSize:9,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#4d8ef5",margin:"14px 0 9px",paddingBottom:5,borderBottom:"1px solid #222840"}}>{children}</div>;
}

function FI({ label, v, set, ph, mono, big, full, ta }) {
  const st = { width:"100%", background:"#111525", border:"1px solid #222840", color:"#dde3ff", padding:"8px 11px", borderRadius:8, fontFamily:mono?"monospace":"inherit", fontSize:big?16:13, outline:"none", fontWeight:big?700:400 };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12,gridColumn:full?"1/-1":"auto"}}>
      <label style={{fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"#7b87b8"}}>{label}</label>
      {ta
        ? <textarea style={{...st,minHeight:70,resize:"vertical"}} value={v} onChange={e=>set(e.target.value)} placeholder={ph}/>
        : <input style={st} value={v} onChange={e=>set(e.target.value)} placeholder={ph}/>
      }
    </div>
  );
}

function NumPrefixFI({ label, prefix, v, set }) {
  const numVal = v ? v.replace(new RegExp("^"+prefix,"i"), "") : "";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
      <label style={{fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"#7b87b8"}}>{label}</label>
      <div style={{display:"flex",alignItems:"center",background:"#111525",border:"1px solid #222840",borderRadius:8,overflow:"hidden"}}>
        <span style={{padding:"8px 10px",background:"#0d1535",color:"#4d8ef5",fontFamily:"monospace",fontSize:16,fontWeight:800,borderRight:"1px solid #222840",flexShrink:0}}>{prefix}</span>
        <input
          style={{flex:1,background:"#111525",border:"none",color:"#dde3ff",padding:"8px 11px",fontFamily:"monospace",fontSize:16,fontWeight:700,outline:"none"}}
          type="number" min="1"
          value={numVal}
          onChange={e => set(e.target.value ? prefix+e.target.value : "")}
          placeholder="1"
        />
      </div>
      {v && <div style={{fontSize:10,color:"#20c8b0",fontFamily:"monospace",marginTop:2}}>→ {v}</div>}
    </div>
  );
}

const s = {
  app:{minHeight:"100vh",background:"#07090f",display:"flex",flexDirection:"column",fontFamily:"'Plus Jakarta Sans',sans-serif",paddingBottom:60},
  header:{background:"#0c0f1a",borderBottom:"1px solid #222840",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10},
  logo:{fontSize:18,fontWeight:800,letterSpacing:-.5,color:"#dde3ff"},
  ldot:{width:6,height:6,borderRadius:"50%",background:"#2dcc7a",display:"inline-block",animation:"blink 1.4s infinite"},
  logoutBtn:{background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"4px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontFamily:"inherit"},
  tabBar:{position:"fixed",bottom:0,left:0,right:0,background:"#0c0f1a",borderTop:"1px solid #222840",display:"flex",zIndex:20},
  tabBtn:{flex:1,background:"none",border:"none",color:"#7b87b8",padding:"10px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,fontFamily:"inherit",position:"relative"},
  tabActive:{color:"#4d8ef5",borderTop:"2px solid #4d8ef5"},
  tabBadge:{position:"absolute",top:6,right:"50%",transform:"translateX(10px)",background:"#f05555",color:"#fff",fontSize:9,fontWeight:700,width:15,height:15,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"},
  body:{flex:1,padding:16,maxWidth:560,margin:"0 auto",width:"100%"},
  greeting:{marginBottom:16,padding:15,background:"#0c0f1a",border:"1px solid #222840",borderRadius:12},
  greetName:{fontSize:19,fontWeight:800,letterSpacing:-.3,marginBottom:3,color:"#dde3ff"},
  greetSub:{fontSize:12,color:"#7b87b8"},
  sectionHd:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8},
  secTitle2:{fontSize:10,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#7b87b8"},
  statCard:{background:"#0c0f1a",border:"1px solid #222840",borderTop:"2px solid",borderRadius:10,padding:"12px 14px"},
  statLbl:{fontSize:9.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:5},
  statVal:{fontSize:26,fontWeight:800,fontFamily:"monospace",lineHeight:1,marginBottom:3},
  statSub:{fontSize:11,color:"#7b87b8"},
  card:{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:14},
  cardHd:{padding:"10px 14px",borderBottom:"1px solid #222840",display:"flex",alignItems:"center",justifyContent:"space-between"},
  cardBody:{padding:"13px 14px"},
  emptyCard:{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:"20px",textAlign:"center",color:"#3d4668",fontSize:13,marginBottom:14},
  typePill:{display:"inline-block",padding:"2px 7px",borderRadius:3,fontSize:9.5,fontWeight:800},
  statusPill:{display:"inline-block",padding:"2px 7px",borderRadius:3,fontSize:9.5,fontWeight:700},
  siteBadge:{fontSize:9.5,fontWeight:700,background:"#1a1040",color:"#9b78f5",border:"1px solid #3a2080",padding:"2px 7px",borderRadius:3},
  urgBadge:{fontSize:9.5,fontWeight:800,color:"#f05555",background:"#2a0a0a",border:"1px solid #5a1a1a",padding:"1px 6px",borderRadius:3},
  joNum:{fontFamily:"monospace",fontSize:11,color:"#7b87b8"},
  clientNm:{fontSize:19,fontWeight:800,letterSpacing:-.3,marginBottom:5,color:"#dde3ff"},
  addr:{fontSize:13,color:"#7b87b8",marginBottom:3,lineHeight:1.5},
  contact:{fontSize:13,fontFamily:"monospace",color:"#20c8b0",marginBottom:7},
  lcpBox:{fontSize:12,fontFamily:"monospace",color:"#7b87b8",background:"#111525",padding:"5px 9px",borderRadius:6,display:"inline-block",marginBottom:7},
  notesBox:{fontSize:13,color:"#f0a030",background:"#2a1a05",padding:"7px 10px",borderRadius:6,marginBottom:10,borderLeft:"3px solid #f0a030"},
  actBtn:{width:"100%",padding:15,borderRadius:10,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer",border:"none",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"},
  cancelBtn:{width:"100%",padding:"9px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer",border:"1px solid #5a1a1a",color:"#f05555",background:"#1a0505",display:"flex",alignItems:"center",justifyContent:"center",gap:6},
  confirmBox:{background:"#111525",border:"1px solid #2dcc7a",borderRadius:10,padding:12},
  cancelBtn2:{background:"#171c2e",border:"1px solid #222840",color:"#7b87b8",padding:"12px 16px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600},
  guide:{padding:"8px 14px",background:"#111525",borderTop:"1px solid #222840",fontSize:12,color:"#7b87b8"},
  noTasks:{padding:"50px 20px",textAlign:"center",color:"#7b87b8"},
  toggleBtn:{background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"5px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600},
  toggleActive:{background:"#0d1e42",borderColor:"#4d8ef5",color:"#4d8ef5"},
  dateInput:{background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"5px 10px",borderRadius:8,fontFamily:"inherit",fontSize:12,outline:"none"},
  ov:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"},
  modal:{background:"#0c0f1a",border:"1px solid #2e3450",borderRadius:16,maxWidth:"96vw",width:"min(560px, 96vw)"},
  fi:{width:"100%",background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"8px 11px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none"},
  f2:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:11},
  f3:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10},
  matBtn:{background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,textAlign:"left"},
  qtyBtn:{background:"#222840",border:"none",color:"#dde3ff",width:26,height:26,borderRadius:6,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"},
  qtyInput:{width:40,background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"3px 6px",borderRadius:6,textAlign:"center",fontFamily:"monospace",fontSize:13,outline:"none"},
  reasonBtn:{background:"#111525",border:"1px solid #222840",color:"#7b87b8",padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:11.5,fontFamily:"inherit",textAlign:"left"},
  reasonActive:{borderColor:"#f05555",background:"#2a0a0a",color:"#f05555"},
  btnPrimary:{background:"#4d8ef5",color:"#fff",border:"none",padding:"8px 16px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer"},
  btnGhost:{background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"8px 16px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,cursor:"pointer"},
  btnDanger:{background:"#f05555",color:"#fff",border:"none",padding:"8px 16px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer"},
};