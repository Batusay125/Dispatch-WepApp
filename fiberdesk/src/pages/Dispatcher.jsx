import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { SITES, TASK_COLORS, TASK_BG, STATUS_COLORS, STATUS_BG } from "../constants.jsx";
import Reports from "./Report";
import Materials from "./Material";
import MaterialsInventory from "./MaterialsInventory";
import KPI from "./KPI";
import Attendance from "./Attendance";
import JobTracking from "./JobTracking";
import Calendar from "./Calendar";



export default function Dispatcher({ user, onLogout }) {
  // FIX 6: Removed unused jobFilter state
  const [page, setPage]             = useState("dashboard");
  const [jobs, setJobs]             = useState({});
  const [deletedJobs, setDeletedJobs] = useState({});
  const [techs, setTechs]           = useState({});
  const [showModal, setShowModal]   = useState(false);
  const [editJobId, setEditJobId]   = useState(null);
  const [search, setSearch]         = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [form, setForm]             = useState(emptyForm());
  const [showAddTechModal, setShowAddTechModal] = useState(false);
  const [confirmDeleteTechId, setConfirmDeleteTechId] = useState(null);
  const [techForm, setTechForm]     = useState({ name: "", loginName: "", pin: "", area: "", contact: "", spec: "" });
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split("T")[0]);
  const [specificMonth, setSpecificMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isMobile, setIsMobile]     = useState(false);
  const [todayAttendance, setTodayAttendance] = useState({});
  const [pasteText,    setPasteText]    = useState("");
  const [parsedOk,     setParsedOk]     = useState(false);
  const [parseMode,    setParseMode]    = useState("labeled");
  const [parsedFields, setParsedFields] = useState({});

  // FIX 7: isCsr — Login sets role:'dispatcher' + isCsr:true, so check isCsr flag only
  const isCsr = !!user?.isCsr;

  // FIX 4: useRef so parsePaste always reads FRESH form (no stale closure bug)
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  function emptyForm() {
    return {
      acct: "", client: "", contact: "", address: "",
      site: "Socorro", type: "install", priority: "normal",
      lcp: "", nap: "", port: "", notes: "",
      date: new Date().toISOString().split("T")[0],
      techIds: [], plan: "", referral: "", installFee: "", amountToCollect: "",
    };
  }

  function extractLNP(text) {
    let lcp = "", nap = "", port = "";
    const parts = text.split(/[\s\/,]+/);
    for (const p of parts) {
      const cl = p.trim();
      if      (/^L\d+$/i.test(cl)) lcp  = cl.toUpperCase();
      else if (/^N\d+$/i.test(cl)) nap  = cl.toUpperCase();
      else if (/^P\d+$/i.test(cl)) port = cl.toUpperCase();
    }
    if (!lcp || !nap || !port) {
      const nums = parts.filter(p => /^\d+$/.test(p.trim()));
      if (!lcp  && nums[0]) lcp  = "L" + nums[0];
      if (!nap  && nums[1]) nap  = "N" + nums[1];
      if (!port && nums[2]) port = "P" + nums[2];
    }
    return { lcp, nap, port };
  }

  function parseLabeledText(lines, currentForm) {
    // FIX 2: Use RegExp constructor with proper escape — no template literal \s bug
    const get = (...keys) => {
      for (const key of keys) {
        const escaped = key.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
        const rx = new RegExp("^" + escaped + "[:\\s]+(.+)$", "i");
        for (const line of lines) {
          const m = line.match(rx);
          if (m) return m[1].trim();
        }
      }
      return "";
    };
    const taskRaw = get("TASK", "TYPE", "TASK TYPE").toLowerCase();
    const typeMap = {
      install:"install", repair:"repair", relocate:"relocate",
      collection:"collection", collect:"collection",
      mainline:"mainline", "mainline issue":"mainline",
      pullout:"pullout", "pull-out":"pullout", "pull out":"pullout",
    };
    const type = Object.entries(typeMap).find(([k]) => taskRaw.includes(k))?.[1] || currentForm.type;
    const lcpLine = get("LCP NAP PORT", "LCP/NAP/PORT", "LCP-NAP-PORT");
    let { lcp, nap, port } = lcpLine ? extractLNP(lcpLine) : { lcp:"", nap:"", port:"" };
    if (!lcp)  { const v=get("LCP");  if(v) lcp  = (/^\d+$/.test(v)?"L":"")+v.toUpperCase(); }
    if (!nap)  { const v=get("NAP");  if(v) nap  = (/^\d+$/.test(v)?"N":"")+v.toUpperCase(); }
    if (!port) { const v=get("PORT"); if(v) port = (/^\d+$/.test(v)?"P":"")+v.toUpperCase(); }
    const notes = get("ISSUE","ISSUE/AMOUNT COLLECTION","ISSUE/AMMOUNT COLLECTION","AMOUNT COLLECTION","AMMOUNT COLLECTION","NOTES","CONCERN","PROBLEM","REPORT");
    const amtRaw = get("AMOUNT TO COLLECT","AMOUNT COLLECTION","AMMOUNT COLLECTION","COLLECTION AMOUNT","AMOUNT");
    const amountToCollect = amtRaw.replace(/[₱,\s]/g, "") || "";
    const filled = {};
    const newForm = { ...currentForm, type };
    const cl=get("NAME","CLIENT","CLIENT NAME","SUBSCRIBER"); if(cl) { newForm.client=cl; filled.client=true; }
    const ct=get("CONTACT","CONTACT NUMBER","CONTACT NO","PHONE","MOBILE","NUMBER"); if(ct) { newForm.contact=ct; filled.contact=true; }
    const ad=get("ADDRESS","ADD","ADDR","LOCATION"); if(ad) { newForm.address=ad; filled.address=true; }
    if(lcp)             { newForm.lcp=lcp;   filled.lcp=true; }
    if(nap)             { newForm.nap=nap;   filled.nap=true; }
    if(port)            { newForm.port=port; filled.port=true; }
    if(notes)           { newForm.notes=notes; filled.notes=true; }
    if(amountToCollect) { newForm.amountToCollect=amountToCollect; filled.amountToCollect=true; }
    return { newForm, filled };
  }

  function parseFreeText(lines, currentForm) {
    let client="", contact="", address="", lcp="", nap="", port="", notes="", amountToCollect="";
    const filled={};
    const remaining=[];
    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      if (/^(09|\+63|63)\d{9,10}$/.test(l.replace(/[-\s]/g,"")) || /^09\d{2}[\s-]?\d{3}[\s-]?\d{4}$/.test(l)) {
        contact=l; filled.contact=true; continue;
      }
      const isLNPLabeled = /^[LNP]\d+([\s\/,][LNP]\d+){1,2}$/i.test(l) || /^L\d+/i.test(l);
      const isLNPNumeric = /^\d+[\s\/,]\d+[\s\/,]\d+$/.test(l);
      if (isLNPLabeled || isLNPNumeric) {
        const r=extractLNP(l);
        if (r.lcp||r.nap||r.port) { lcp=r.lcp;nap=r.nap;port=r.port;filled.lcp=!!r.lcp;filled.nap=!!r.nap;filled.port=!!r.port;continue; }
      }
      if (/^[₱]?\d[\d,.]*$/.test(l)) { amountToCollect=l.replace(/[₱,\s]/g,""); filled.amountToCollect=true; continue; }
      remaining.push(l);
    }
    const addressKw = /blk|lot|phase|brgy|barangay|st\.|street|ave|road|purok|sitio|village|subd|subdivision|marilao|bulacan/i;
    for (const l of remaining) {
      if (!client && l.split(" ").length<=5 && !/\d/.test(l) && !addressKw.test(l)) { client=l; filled.client=true; }
      else if (!address && (addressKw.test(l)||(client&&!address&&!notes)))          { address=l; filled.address=true; }
      else if (!notes)                                                                 { notes=l;  filled.notes=true; }
    }
    const newForm={...currentForm};
    if(client)          { newForm.client=client; }
    if(contact)         { newForm.contact=contact; }
    if(address)         { newForm.address=address; }
    if(lcp)             { newForm.lcp=lcp; }
    if(nap)             { newForm.nap=nap; }
    if(port)            { newForm.port=port; }
    if(notes)           { newForm.notes=notes; }
    if(amountToCollect) { newForm.amountToCollect=amountToCollect; }
    return { newForm, filled };
  }

  // FIX 4: reads formRef.current — always fresh, no stale closure
  function parsePaste(raw, mode) {
    const m = mode ?? parseMode;
    setPasteText(raw);
    setParsedOk(false);
    setParsedFields({});
    if (!raw.trim()) return;
    const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
    const { newForm, filled } = m==="free"
      ? parseFreeText(lines, formRef.current)
      : parseLabeledText(lines, formRef.current);
    setForm(newForm);
    setParsedFields(filled);
    setParsedOk(Object.keys(filled).length > 0);
  }

  function resetPaste() { setPasteText(""); setParsedOk(false); setParsedFields({}); setParseMode("labeled"); }
  function openNewJobModal() { setEditJobId(null); setForm(emptyForm()); resetPaste(); setShowModal(true); }

  function getCurrentTechNames(techIds) {
    return (techIds||[]).map(id=>techs[id]?.name||"").filter(n=>n).join(", ") || "—";
  }

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const u1=onValue(ref(db,"jobs"),              s=>setJobs(s.exists()?s.val():{}));
    const u2=onValue(ref(db,"technicians"),       s=>setTechs(s.exists()?s.val():{}));
    const u3=onValue(ref(db,"deletedJobs"),       s=>setDeletedJobs(s.exists()?s.val():{}));
    const u4=onValue(ref(db,`attendance/${today}`),s=>setTodayAttendance(s.exists()?s.val():{}));
    return () => { u1();u2();u3();u4(); };
  }, []);

  const CAN_DEPLOY = ["present","late","halfday"];
  function techCanDeploy(techId) {
    const a=todayAttendance[techId];
    if (!a||!a.status) return true;
    return CAN_DEPLOY.includes(a.status);
  }
  const ATTEND_STATUS_COLOR={present:"#2dcc7a",late:"#f0a030",absent:"#f05555",halfday:"#9b78f5",leave:"#4d8ef5",dayoff:"#7b87b8"};
  const ATTEND_STATUS_LABEL={present:"Present",late:"Late",absent:"Absent",halfday:"Half Day",leave:"On Leave",dayoff:"Day Off"};
  const ATTEND_STATUS_ICON ={present:"✅",late:"⏰",absent:"❌",halfday:"🌗",leave:"🏖",dayoff:"🗓"};

  useEffect(() => {
    const check=()=>setIsMobile(window.innerWidth<768);
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  }, []);

  const jobList=Object.entries(jobs);
  const filtered=jobList.filter(([,j])=>{
    const ms=!search||j.client?.toLowerCase().includes(search.toLowerCase())||(j.jo||"").toLowerCase().includes(search.toLowerCase())||(j.site||"").toLowerCase().includes(search.toLowerCase());
    const today=new Date().toISOString().split("T")[0];
    const wk=new Date();wk.setDate(wk.getDate()-7);
    const mo=new Date();mo.setMonth(mo.getMonth()-1);
    const df=dateFilter==="all"||(dateFilter==="today"&&j.date===today)||(dateFilter==="this-week"&&j.date>=wk.toISOString().split("T")[0])||(dateFilter==="this-month"&&j.date>=mo.toISOString().split("T")[0])||(dateFilter==="specific"&&j.date===specificDate)||(dateFilter==="month"&&j.date?.startsWith(specificMonth));
    return ms&&df&&(statusFilter==="all"||j.status===statusFilter)&&(typeFilter==="all"||j.type===typeFilter)&&(siteFilter==="all"||j.site===siteFilter);
  }).reverse();

  const counts={
    pending:    jobList.filter(([,j])=>j.status==="pending").length,
    dispatched: jobList.filter(([,j])=>j.status==="dispatched"||j.status==="on-way").length,
    onsite:     jobList.filter(([,j])=>j.status==="on-site").length,
    done:       jobList.filter(([,j])=>j.status==="done").length,
  };
  const deletedList=Object.entries(deletedJobs).reverse();

  async function submitJob() {
    if (!form.client.trim()) { alert("Client name required"); return; }
    const techNames=form.techIds.map(id=>techs[id]?.name||"").filter(n=>n).join(", ");
    if (editJobId) {
      await update(ref(db,"jobs/"+editJobId),{...form,techNames,updatedAt:new Date().toISOString(),updatedBy:user.name,status:jobs[editJobId]?.status});
    } else {
      const jo="JO-"+Date.now().toString().slice(-6);
      const now=new Date().toISOString();
      await push(ref(db,"jobs"),{...form,jo,techNames,status:form.techIds.length>0?"dispatched":"pending",createdAt:now,createdBy:user.name,...(form.techIds.length>0?{dispatchedAt:now}:{})});
    }
    setShowModal(false);setEditJobId(null);setForm(emptyForm());resetPaste();
  }

  function openEdit(jobId) {
    const j=jobs[jobId];
    setForm({acct:j.acct||"",client:j.client||"",contact:j.contact||"",address:j.address||"",site:j.site||"Socorro",type:j.type||"install",priority:j.priority||"normal",lcp:j.lcp||"",nap:j.nap||"",port:j.port||"",notes:j.notes||"",date:j.date||"",techIds:j.techIds||[],plan:j.plan||"",referral:j.referral||"",installFee:j.installFee||"",amountToCollect:j.amountToCollect||""});
    setEditJobId(jobId);setShowModal(true);
  }

  function isDone(jobId) { const st=jobs[jobId]?.status; return st==="done"||st==="activated"||st==="cancelled"; }

  async function updateStatus(jobId,status) {
    const tsMap={dispatched:"dispatchedAt","on-way":"onWayAt","on-site":"onSiteAt"};
    const extra=tsMap[status]?{[tsMap[status]]:new Date().toISOString()}:{};
    await update(ref(db,"jobs/"+jobId),{status,updatedAt:new Date().toISOString(),...extra});
  }

  async function archiveJob(jobId) {
    if (!jobId) return;
    const job=jobs[jobId];
    if (!job||!confirm("Move this job to Trash?")) return;
    await set(ref(db,`deletedJobs/${jobId}`),{...job,deletedAt:new Date().toISOString(),deletedBy:user?.name||"Dispatcher"});
    await remove(ref(db,`jobs/${jobId}`));
  }

  async function restoreJob(jobId) {
    if (!jobId) return;
    const job=deletedJobs[jobId]; if (!job) return;
    const {deletedAt,deletedBy,...restored}=job;
    await set(ref(db,`jobs/${jobId}`),{...restored,restoredAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    await remove(ref(db,`deletedJobs/${jobId}`));
  }

  async function submitNewTech() {
    if (!techForm.name.trim()||!techForm.loginName.trim()||!techForm.pin.trim()){alert("Name, login name, and PIN required");return;}
    const id="T"+String(Object.keys(techs).length+1).padStart(2,"0");
    const initials=techForm.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
    await set(ref(db,"technicians/"+id),{...techForm,name:techForm.name.trim(),loginName:techForm.loginName.trim(),pin:techForm.pin.trim(),initials,bg:"#0d1e42",color:"#4d8ef5"});
    setShowAddTechModal(false);setTechForm({name:"",loginName:"",pin:"",area:"",contact:"",spec:""});
  }

  async function deleteTechnician(techId) {
    if (!techId) return;
    const updates={};
    Object.entries(jobs).forEach(([jobId,job])=>{
      const cur=job.techIds||[]; if (!cur.includes(techId)) return;
      const next=cur.filter(id=>id!==techId);
      updates[`jobs/${jobId}/techIds`]=next;
      updates[`jobs/${jobId}/techNames`]=next.map(id=>techs[id]?.name||"").filter(n=>n).join(", ");
      if (next.length===0&&!["done","cancelled"].includes(job.status)) updates[`jobs/${jobId}/status`]="pending";
      updates[`jobs/${jobId}/updatedAt`]=new Date().toISOString();
    });
    if (Object.keys(updates).length>0) await update(ref(db),updates);
    await remove(ref(db,"technicians/"+techId));
    setConfirmDeleteTechId(null);
  }

  // Nav items — CSR sees only Dashboard + Job Orders
  const navMain = [
    ["dashboard","◈","Dashboard",null],
    ["jobs","📋","Job Orders",counts.pending>0?counts.pending:null],
    ...(!isCsr?[
      ["pipeline","⟶","Pipeline",null],
      ["dispatch","📡","Dispatch",counts.pending>0?counts.pending:null],
      ["technicians","🔧","Technicians",null],
    ]:[]),
  ];
  const navAdmin = !isCsr ? [
    ["reports","◫","Reports",null],
    ["kpi","📈","KPI Reports",null],
    ["jobtracking","🗺","Job Tracking",null],
    ["calendar","📅","Calendar",null],
    ["attendance","🗂","Attendance",null],
    ["materials","🗃","Materials",null],
    ["inventory","📦","Inventory",null],
    ["trash","🗑️","Trash",deletedList.length>0?deletedList.length:null],
  ] : [];

  const pageLabels={dashboard:"Dashboard",jobs:"Job Orders",pipeline:"Pipeline",dispatch:"Dispatch Board",technicians:"Technicians",reports:"Reports",kpi:"KPI Reports",jobtracking:"Job Tracking",calendar:"Calendar",attendance:"Attendance",materials:"Materials",inventory:"Inventory",trash:"Trash"};

  // ── CSR/ADMIN VIEW: Only admin section pages ──
  if (isCsr) {
    // CSR sees only the admin pages — no main dispatcher pages
    const csrNav = [
      ["reports",     "◫",  "Reports",      null],
      ["kpi",         "📈", "KPI Reports",  null],
      ["jobtracking", "🗺", "Job Tracking", null],
      ["calendar",    "📅", "Calendar",     null],
      ["attendance",  "🗂", "Attendance",   null],
      ["materials",   "🗃", "Materials",    null],
      ["trash",       "🗑️","Trash",        deletedList.length>0?deletedList.length:null],
    ];

    // Default page for CSR
    const csrPage = csrNav.find(([key])=>key===page) ? page : "reports";

    return (
      <div style={s.app}>
        {/* CSR TOPBAR */}
        <div style={s.tb}>
          <button style={s.menuBtn} onClick={()=>setSidebarOpen(!sidebarOpen)}>☰</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <img src="/logo.svg" alt="KeyConnect" style={{height:32,width:32}}/>
            <div style={s.logo}>KEY<span style={{color:"#4d8ef5"}}>CONNECT</span></div>
          </div>
          <div style={s.tbDiv}/>
          <div style={{fontSize:11.5,color:"#7b87b8"}}>{pageLabels[csrPage]}</div>
          <div style={s.tbRight}>
            <div style={s.livePill}><span style={s.ldot}/>LIVE</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={s.userAv}>{(user?.name?.[0]||"U").toUpperCase()}</div>
              <div style={{display:"flex",flexDirection:"column"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#dde3ff"}}>{user?.name||"Unknown"}</span>
                <span style={{fontSize:10,color:"#f472b6"}}>CSR / Admin</span>
              </div>
              <button style={s.btnGhost} onClick={onLogout}>Labas</button>
            </div>
          </div>
        </div>

        <div style={{...s.body,flexDirection:isMobile?"column":"row"}}>
          {/* CSR SIDEBAR — admin pages only */}
          {sidebarOpen&&(
            <nav style={{...s.sidebar,width:isMobile?"100%":190,position:isMobile?"absolute":"static",zIndex:isMobile?100:"auto",height:isMobile?"calc(100vh - 52px)":"auto"}}>
              <div style={s.navSection}>Admin</div>
              {csrNav.map(([key,ic,lbl,badge])=>(
                <div key={key} style={{...s.navItem,...(csrPage===key?s.navActive:{})}} onClick={()=>{setPage(key);if(isMobile)setSidebarOpen(false);}}>
                  <span style={{fontSize:13,width:16,textAlign:"center"}}>{ic}</span>{lbl}
                  {badge!=null&&<span style={s.navBadge}>{badge}</span>}
                </div>
              ))}
            </nav>
          )}

          <main style={{...s.content,padding:isMobile?10:20}}>
            {csrPage==="reports"&&<div><div style={s.ph}><h1 style={s.h1}>Reports</h1></div><Reports/></div>}
            {csrPage==="kpi"&&<KPI/>}
            {csrPage==="jobtracking"&&<JobTracking/>}
            {csrPage==="calendar"&&<Calendar/>}
            {csrPage==="attendance"&&<Attendance/>}
            {csrPage==="materials"&&<Materials/>}
            {csrPage==="trash"&&(
              <div>
                <div style={s.ph}><h1 style={s.h1}>Trash</h1><span style={{fontSize:12,color:"#7b87b8"}}>Restore deleted job orders anytime</span></div>
                <div style={s.card}>
                  {deletedList.length>0?deletedList.map(([id,job])=>(
                    <div key={id} style={{padding:"14px 16px",borderBottom:"1px solid #222840"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                        <div><div style={{fontWeight:700,fontSize:14,color:"#dde3ff"}}>{job.client}</div><div style={{fontSize:11,color:"#7b87b8"}}>{job.site} · {job.jo||id}</div></div>
                        <button style={{...s.btnPrimary,background:"#2dcc7a"}} onClick={()=>restoreJob(id)}>Restore</button>
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:10}}>
                        <span style={{...s.badge,background:TASK_BG[job.type],color:TASK_COLORS[job.type]}}>{(job.type||"").toUpperCase()}</span>
                        <span style={{...s.badge,background:STATUS_BG[job.status],color:STATUS_COLORS[job.status]}}>{(job.status||"").toUpperCase()}</span>
                      </div>
                      <div style={{fontSize:11,color:"#7b87b8",marginTop:8}}>{job.notes||"No notes"}</div>
                      <div style={{fontSize:10,color:"#3d4668",marginTop:8,fontFamily:"monospace"}}>Deleted at: {new Date(job.deletedAt).toLocaleString("en-PH")}</div>
                    </div>
                  )):<div style={s.empty}>Trash is empty.</div>}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ── DISPATCHER FULL VIEW ──
  return (
    <div style={s.app}>
      {/* TOPBAR */}
      <div style={s.tb}>
        <button style={s.menuBtn} onClick={()=>setSidebarOpen(!sidebarOpen)}>☰</button>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <img src="/logo.svg" alt="KeyConnect" style={{height:32,width:32}}/>
          <div style={s.logo}>KEY<span style={{color:"#4d8ef5"}}>CONNECT</span></div>
        </div>
        <div style={s.tbDiv}/>
        <div style={{fontSize:11.5,color:"#7b87b8"}}>{pageLabels[page]}</div>
        <div style={s.tbRight}>
          <div style={s.livePill}><span style={s.ldot}/>LIVE</div>
          <button style={s.btnPrimary} onClick={openNewJobModal}>+ New Job</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={s.userAv}>{(user?.name?.[0]||"U").toUpperCase()}</div>
            <div style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontSize:12,fontWeight:600,color:"#dde3ff"}}>{user?.name||"Unknown"}</span>
              <span style={{fontSize:10,color:"#7b87b8"}}>Dispatcher</span>
            </div>
            <button style={s.btnGhost} onClick={onLogout}>Labas</button>
          </div>
        </div>
      </div>

      <div style={{...s.body,flexDirection:isMobile?"column":"row"}}>
        {/* SIDEBAR */}
        {sidebarOpen&&(
          <nav style={{...s.sidebar,width:isMobile?"100%":190,position:isMobile?"absolute":"static",zIndex:isMobile?100:"auto",height:isMobile?"calc(100vh - 52px)":"auto"}}>
            <div style={s.navSection}>Main</div>
            {navMain.map(([key,ic,lbl,badge])=>(
              <div key={key} style={{...s.navItem,...(page===key?s.navActive:{})}} onClick={()=>{setPage(key);if(isMobile)setSidebarOpen(false);}}>
                <span style={{fontSize:13,width:16,textAlign:"center"}}>{ic}</span>{lbl}
                {badge!=null&&<span style={s.navBadge}>{badge}</span>}
              </div>
            ))}
            {navAdmin.length>0&&<>
              <div style={{...s.navSection,paddingTop:12}}>Admin</div>
              {navAdmin.map(([key,ic,lbl,badge])=>(
                <div key={key} style={{...s.navItem,...(page===key?s.navActive:{})}} onClick={()=>{setPage(key);if(isMobile)setSidebarOpen(false);}}>
                  <span style={{fontSize:13,width:16,textAlign:"center"}}>{ic}</span>{lbl}
                  {badge!=null&&<span style={s.navBadge}>{badge}</span>}
                </div>
              ))}
            </>}
          </nav>
        )}

        <main style={{...s.content,padding:isMobile?10:20}}>

          {/* DASHBOARD */}
          {page==="dashboard"&&(
            <div>
              <div style={s.ph}><h1 style={s.h1}>Dashboard</h1><div style={{fontSize:11.5,color:"#7b87b8",fontFamily:"monospace"}}>{new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div></div>
              <div style={s.srow}>
                {[["Pending",counts.pending,"#f05555"],["Dispatched",counts.dispatched,"#4d8ef5"],["On-Site",counts.onsite,"#20c8b0"],["Done",counts.done,"#2dcc7a"]].map(([lbl,val,col])=>(
                  <div key={lbl} style={s.sc}><div style={{...s.scTop,background:col}}/><div style={s.scLbl}>{lbl}</div><div style={{...s.scVal,color:col}}>{val}</div></div>
                ))}
              </div>
              <div style={s.dashGrid}>
                <div>
                  <div style={s.card}>
                    <div style={s.cardHd}><span style={s.cardTitle}>Recent Jobs</span><button style={s.cardBtn} onClick={()=>setPage("jobs")}>View All →</button></div>
                    {jobList.slice(-8).reverse().map(([id,j])=>(
                      <div key={id} style={s.jobRow} onClick={()=>openEdit(id)}>
                        <span style={{fontFamily:"monospace",fontSize:10,color:"#7b87b8"}}>{j.jo}</span>
                        <span style={{...s.badge,background:TASK_BG[j.type],color:TASK_COLORS[j.type]}}>{j.type?.toUpperCase()}</span>
                        <span style={{fontSize:10,color:"#9b78f5",fontWeight:600,minWidth:60}}>{j.site||"—"}</span>
                        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12.5}}>{j.client}</div><div style={{fontSize:10,color:"#7b87b8"}}>{j.address?.substring(0,30)}</div></div>
                        <span style={{...s.badge,background:STATUS_BG[j.status],color:STATUS_COLORS[j.status]}}>{j.status?.toUpperCase()}</span>
                        <span style={{fontSize:11,color:j.techIds?.length>0?"#dde3ff":"#3d4668"}}>{getCurrentTechNames(j.techIds)}</span>
                      </div>
                    ))}
                    {jobList.length===0&&<div style={s.empty}>Walang jobs pa. I-click ang "+ New Job"</div>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={s.card}>
                    <div style={s.cardHd}><span style={s.cardTitle}>Technicians</span></div>
                    {Object.entries(techs).map(([id,t])=>{
                      const mj=jobList.filter(([,j])=>(j.techIds||[]).includes(id)&&!["done","cancelled"].includes(j.status)).length;
                      return(<div key={id} style={s.techRow}><div style={{...s.techAv,background:t.bg,color:t.color}}>{t.initials}</div><div style={{flex:1}}><div style={{fontWeight:600,fontSize:12.5}}>{t.name}</div><div style={{fontSize:10,color:"#7b87b8"}}>{t.spec}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10.5,color:mj>0?"#f0a030":"#2dcc7a"}}>{mj>0?mj+" active":"Free"}</div><div style={{fontSize:9,color:"#3d4668",fontFamily:"monospace"}}>{t.loginName}</div></div></div>);
                    })}
                  </div>
                  <div style={s.card}>
                    <div style={s.cardHd}><span style={s.cardTitle}>Jobs by Site</span></div>
                    {SITES.map(site=>{
                      const ct=jobList.filter(([,j])=>j.site===site).length;
                      const done=jobList.filter(([,j])=>j.site===site&&j.status==="done").length;
                      return ct>0?(<div key={site} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",borderBottom:"1px solid #222840"}}><span style={{fontSize:11,fontWeight:600,color:"#9b78f5",flex:1}}>{site}</span><span style={{fontFamily:"monospace",fontSize:11,color:"#7b87b8"}}>{done}/{ct}</span><div style={{width:60,height:4,background:"#222840",borderRadius:2,overflow:"hidden"}}><div style={{width:ct>0?(done/ct*100)+"%":"0%",height:"100%",background:"#2dcc7a",borderRadius:2}}/></div></div>):null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* JOB ORDERS */}
          {page==="jobs"&&(
            <div>
              <div style={s.ph}><h1 style={s.h1}>Job Orders</h1><button style={s.btnPrimary} onClick={openNewJobModal}>+ New Job Order</button></div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#7b87b8",minWidth:40}}>Status:</span>
                      {[["all","All"],["pending","Pending"],["dispatched","Dispatched"],["on-way","On the Way"],["on-site","On-Site"],["done","Done"],["cancelled","Cancelled"]].map(([k,lbl])=>(
                        <button key={k} style={{...s.ftab,...(statusFilter===k?s.ftabActive:{})}} onClick={()=>setStatusFilter(k)}>{lbl}</button>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#7b87b8",minWidth:40}}>Task:</span>
                      {[["all","All"],["install","Install"],["repair","Repair"],["relocate","Relocate"],["collection","Collection"],["mainline","Mainline"],["pullout","Pull-Out"]].map(([k,lbl])=>(
                        <button key={k} style={{...s.ftab,...(typeFilter===k?s.ftabActive:{})}} onClick={()=>setTypeFilter(k)}>{lbl}</button>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#7b87b8",minWidth:40}}>Site:</span>
                      <button style={{...s.ftab,...(siteFilter==="all"?s.ftabActive:{})}} onClick={()=>setSiteFilter("all")}>All</button>
                      {SITES.map(site=>(<button key={site} style={{...s.ftab,...(siteFilter===site?s.ftabActive:{})}} onClick={()=>setSiteFilter(site)}>{site}</button>))}
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#7b87b8",minWidth:40}}>Date:</span>
                      {[["all","All Dates"],["today","Today"],["this-week","This Week"],["this-month","This Month"],["specific","Specific Day"],["month","Pick Month"]].map(([k,lbl])=>(
                        <button key={k} style={{...s.ftab,...(dateFilter===k?s.ftabActive:{})}} onClick={()=>setDateFilter(k)}>{lbl}</button>
                      ))}
                      {dateFilter==="specific"&&<input type="date" value={specificDate} onChange={e=>setSpecificDate(e.target.value)} style={{background:"#111525",border:"1px solid #4d8ef5",color:"#dde3ff",padding:"4px 10px",borderRadius:5,fontFamily:"inherit",fontSize:11,outline:"none"}}/>}
                      {dateFilter==="month"&&<input type="month" value={specificMonth} onChange={e=>setSpecificMonth(e.target.value)} style={{background:"#111525",border:"1px solid #9b78f5",color:"#dde3ff",padding:"4px 10px",borderRadius:5,fontFamily:"inherit",fontSize:11,outline:"none"}}/>}
                    </div>
                  </div>
                  <input style={s.searchInput} placeholder="Client / JO / Site..." value={search} onChange={e=>setSearch(e.target.value)}/>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={s.tbl}>
                    <thead><tr>{["JO #","Task","Site","Date","Status","Client","Address","Contact","LCP/NAP/Port","Tech","Notes","Materials","Actions"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filtered.map(([id,j])=>(
                        <tr key={id} style={s.tr} onClick={()=>openEdit(id)}>
                          <td style={s.tdMono}>{j.jo}</td>
                          <td><span style={{...s.badge,background:TASK_BG[j.type],color:TASK_COLORS[j.type]}}>{j.type?.toUpperCase()}</span></td>
                          <td style={{padding:"8px 10px",color:"#9b78f5",fontWeight:600,fontSize:12}}>{j.site||"—"}</td>
                          <td style={s.tdMono}>{j.date||"—"}</td>
                          <td><span style={{...s.badge,background:STATUS_BG[j.status],color:STATUS_COLORS[j.status]}}>{j.status?.toUpperCase()}</span></td>
                          <td style={{padding:"8px 10px"}}><div style={{fontWeight:600,fontSize:13}}>{j.client}</div><div style={{fontSize:10,color:"#7b87b8"}}>{j.acct}</div></td>
                          <td style={{padding:"8px 10px",fontSize:11,color:"#7b87b8",maxWidth:140,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.address}</td>
                          <td style={s.tdMono}>{j.contact}</td>
                          <td style={{...s.tdMono,color:"#20c8b0"}}>{j.lcp} {j.nap} {j.port}</td>
                          <td style={{padding:"8px 10px",fontSize:12,fontWeight:j.techIds?.length>0?600:400,color:j.techIds?.length>0?"#dde3ff":"#3d4668"}}>{getCurrentTechNames(j.techIds)}</td>
                          <td style={{padding:"8px 10px",fontSize:11,color:"#f0a030",maxWidth:100,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.notes||"—"}</td>
                          <td style={{padding:"8px 10px",fontSize:11}}>{j.materialsUsed?.length>0?<span style={{color:"#2dcc7a",fontFamily:"monospace"}}>₱{(j.materialsTotal||0).toLocaleString()}</span>:<span style={{color:"#3d4668"}}>—</span>}</td>
                          <td style={{padding:"8px 10px"}} onClick={e=>e.stopPropagation()}>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                              {j.status!=="done"&&<button style={s.tdBtn} onClick={()=>openEdit(id)}>Edit</button>}
                              {j.status==="pending"&&<button style={{...s.tdBtn,color:"#2dcc7a"}} onClick={()=>updateStatus(id,"dispatched")}>Dispatch</button>}
                              {j.status!=="done"&&<button style={{...s.tdBtn,color:"#2dcc7a"}} onClick={()=>updateStatus(id,"done")}>Done ✓</button>}
                              <button style={{...s.tdBtn,color:"#ff7b7b"}} onClick={()=>archiveJob(id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length===0&&<tr><td colSpan={13} style={{textAlign:"center",padding:24,color:"#3d4668"}}>Walang results</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {page==="pipeline"&&(
            <div>
              <div style={s.ph}><h1 style={s.h1}>Pipeline</h1><span style={{fontSize:12,color:"#7b87b8"}}>Real-time · Auto-updates</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                {[["pending","Pending","#f05555"],["dispatched","Dispatched","#4d8ef5"],["on-way","On the Way","#9b78f5"],["on-site","On-Site","#20c8b0"],["done","Done ✓","#2dcc7a"]].map(([status,lbl,col])=>{
                  const pj=jobList.filter(([,j])=>j.status===status);
                  return(<div key={status} style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",minHeight:180}}>
                    <div style={{padding:"8px 12px",borderBottom:"2px solid "+col+"44",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:9.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:col}}>{lbl}</span>
                      <span style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:col}}>{pj.length}</span>
                    </div>
                    <div style={{padding:7,display:"flex",flexDirection:"column",gap:5}}>
                      {pj.map(([id,j])=>(<div key={id} style={{background:"#111525",border:"1px solid #222840",borderLeft:"3px solid "+col,borderRadius:8,padding:"8px 10px",cursor:"pointer"}} onClick={()=>openEdit(id)}><div style={{fontFamily:"monospace",fontSize:9.5,color:"#7b87b8",marginBottom:2}}>{j.jo}</div><div style={{fontWeight:600,fontSize:12}}>{j.client}</div>{j.site&&<div style={{fontSize:10,color:"#9b78f5",marginTop:1}}>{j.site}</div>}<div style={{fontSize:10.5,color:"#7b87b8"}}>{j.address?.substring(0,25)}...</div>{j.lcp&&<div style={{fontSize:9.5,fontFamily:"monospace",color:"#20c8b0",marginTop:2}}>{j.lcp} {j.nap} {j.port}</div>}<div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}><span style={{...s.badge,background:TASK_BG[j.type],color:TASK_COLORS[j.type]}}>{j.type?.toUpperCase()}</span>{j.techIds?.length>0&&<span style={{fontSize:10,color:"#7b87b8"}}>→ {getCurrentTechNames(j.techIds).split(", ")[0]}</span>}</div></div>))}
                      {pj.length===0&&<div style={{fontSize:11,color:"#3d4668",padding:10,textAlign:"center"}}>Wala</div>}
                    </div>
                  </div>);
                })}
              </div>
            </div>
          )}

          {page==="dispatch"&&(
            <div>
              <div style={s.ph}><h1 style={s.h1}>Dispatch Board</h1></div>
              <div style={s.srow}>
                {[["Kailangan ng Dispatch",counts.pending,"#f05555"],["Available Techs",Object.values(techs).length,"#2dcc7a"],["Active",jobList.filter(([,j])=>!["done","cancelled"].includes(j.status)).length,"#4d8ef5"],["Done",counts.done,"#20c8b0"]].map(([lbl,val,col])=>(
                  <div key={lbl} style={s.sc}><div style={{...s.scTop,background:col}}/><div style={s.scLbl}>{lbl}</div><div style={{...s.scVal,color:col}}>{val}</div></div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:14}}>
                <div style={s.card}>
                  <div style={s.cardHd}><span style={s.cardTitle}>Needs Dispatch</span></div>
                  {jobList.filter(([,j])=>j.status==="pending").map(([id,j])=>(
                    <div key={id} style={{padding:"11px 14px",borderBottom:"1px solid #222840",display:"flex",alignItems:"center",gap:11}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:5,marginBottom:3}}><span style={{...s.badge,background:TASK_BG[j.type],color:TASK_COLORS[j.type]}}>{j.type?.toUpperCase()}</span><span style={{fontSize:10,color:"#9b78f5",fontWeight:600}}>{j.site}</span>{j.priority==="urgent"&&<span style={{fontSize:9,fontWeight:800,color:"#f05555"}}>URGENT</span>}</div>
                        <div style={{fontWeight:700,fontSize:13}}>{j.client}</div>
                        <div style={{fontSize:11,color:"#7b87b8"}}>{j.address}</div>
                        {j.notes&&<div style={{fontSize:11,color:"#f0a030"}}>{j.notes}</div>}
                        {j.lcp&&<div style={{fontSize:10.5,fontFamily:"monospace",color:"#20c8b0"}}>{j.lcp} / {j.nap} / {j.port}</div>}
                      </div>
                      <button style={s.btnPrimary} onClick={()=>openEdit(id)}>Assign →</button>
                    </div>
                  ))}
                  {counts.pending===0&&<div style={s.empty}>Lahat ay dispatched na ✓</div>}
                </div>
                <div style={s.card}>
                  <div style={s.cardHd}><span style={s.cardTitle}>Mga Technician</span></div>
                  {Object.entries(techs).map(([id,t])=>{
                    const mj=jobList.filter(([,j])=>(j.techIds||[]).includes(id)&&!["done","cancelled"].includes(j.status)).length;
                    return(<div key={id} style={s.techRow}><div style={{...s.techAv,background:t.profilePic?`url(${t.profilePic}) center/cover no-repeat`:t.bg,color:t.profilePic?"#fff":t.color,cursor:"pointer"}} onClick={()=>setConfirmDeleteTechId(id)}>{!t.profilePic&&t.initials}</div><div style={{flex:1}}><div style={{fontWeight:600,fontSize:12.5}}>{t.name}</div><div style={{fontSize:10,color:"#7b87b8"}}>{t.area}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10.5,color:mj>0?"#f0a030":"#2dcc7a"}}>{mj>0?mj+" active":"Free"}</div><div style={{fontSize:9,color:"#3d4668",fontFamily:"monospace"}}>login: {t.loginName}</div></div></div>);
                  })}
                </div>
              </div>
            </div>
          )}

          {page==="technicians"&&(
            <div>
              <div style={s.ph}><h1 style={s.h1}>Technicians</h1><button style={s.btnPrimary} onClick={()=>setShowAddTechModal(true)}>+ Add Technician</button></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
                {Object.entries(techs).map(([id,t])=>{
                  const myJobs=jobList.filter(([,j])=>(j.techIds||[]).includes(id)&&!["done","cancelled"].includes(j.status));
                  const done=jobList.filter(([,j])=>(j.techIds||[]).includes(id)&&j.status==="done").length;
                  return(<div key={id} style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{...s.techAv,width:40,height:40,fontSize:13,background:t.profilePic?`url(${t.profilePic}) center/cover no-repeat`:t.bg,color:t.profilePic?"#fff":t.color,cursor:"pointer"}} onClick={()=>setConfirmDeleteTechId(id)}>{!t.profilePic&&t.initials}</div>
                      <div><div style={{fontWeight:700,fontSize:14,color:"#dde3ff"}}>{t.name}</div><div style={{fontSize:10.5,color:"#7b87b8"}}>{t.spec}</div><div style={{fontSize:10.5,color:myJobs.length>0?"#f0a030":"#2dcc7a",marginTop:2}}>● {myJobs.length>0?"On Job":"Available"}</div></div>
                    </div>
                    <div style={{fontSize:11.5,color:"#7b87b8",lineHeight:1.7}}>📍 {t.area}<br/>📞 {t.contact}<br/>🔑 <span style={{fontFamily:"monospace",color:"#4d8ef5"}}>{t.loginName}</span></div>
                    <div style={{display:"flex",gap:12,marginTop:10,paddingTop:8,borderTop:"1px solid #222840"}}>
                      <div><div style={{fontFamily:"monospace",fontSize:15,fontWeight:700,color:"#f0a030"}}>{myJobs.length}</div><div style={{fontSize:10,color:"#7b87b8"}}>Active</div></div>
                      <div><div style={{fontFamily:"monospace",fontSize:15,fontWeight:700,color:"#2dcc7a"}}>{done}</div><div style={{fontSize:10,color:"#7b87b8"}}>Done</div></div>
                    </div>
                  </div>);
                })}
              </div>
            </div>
          )}

          {page==="reports"&&<div><div style={s.ph}><h1 style={s.h1}>Reports</h1></div><Reports/></div>}
          {page==="kpi"&&<KPI/>}
          {page==="jobtracking"&&<JobTracking/>}
          {page==="calendar"&&<Calendar/>}
          {page==="attendance"&&<Attendance/>}
          {page==="materials"&&<Materials/>}
          {page==="inventory"&&<div><MaterialsInventory/></div>}

          {page==="trash"&&(
            <div>
              <div style={s.ph}><h1 style={s.h1}>Trash</h1><span style={{fontSize:12,color:"#7b87b8"}}>Restore deleted job orders anytime</span></div>
              <div style={s.card}>
                {deletedList.length>0?deletedList.map(([id,job])=>(
                  <div key={id} style={{padding:"14px 16px",borderBottom:"1px solid #222840"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                      <div><div style={{fontWeight:700,fontSize:14,color:"#dde3ff"}}>{job.client}</div><div style={{fontSize:11,color:"#7b87b8"}}>{job.site} · {job.jo||id}</div></div>
                      <button style={{...s.btnPrimary,background:"#2dcc7a"}} onClick={()=>restoreJob(id)}>Restore</button>
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:10}}>
                      <span style={{...s.badge,background:TASK_BG[job.type],color:TASK_COLORS[job.type]}}>{(job.type||"").toUpperCase()}</span>
                      <span style={{...s.badge,background:STATUS_BG[job.status],color:STATUS_COLORS[job.status]}}>{(job.status||"").toUpperCase()}</span>
                    </div>
                    <div style={{fontSize:11,color:"#7b87b8",marginTop:8}}>{job.notes||"No notes"}</div>
                    <div style={{fontSize:10,color:"#3d4668",marginTop:8,fontFamily:"monospace"}}>Deleted at: {new Date(job.deletedAt).toLocaleString("en-PH")}</div>
                  </div>
                )):<div style={s.empty}>Trash is empty.</div>}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL */}
      {showModal&&<JobModal {...{jobs,editJobId,isDone,form,setForm,techs,todayAttendance,techCanDeploy,ATTEND_STATUS_COLOR,ATTEND_STATUS_LABEL,ATTEND_STATUS_ICON,pasteText,setPasteText,parsedOk,setParsedOk,parsedFields,setParsedFields,parseMode,setParseMode,parsePaste,resetPaste,submitJob,updateStatus,setShowModal,setEditJobId,emptyForm,s}}/>}

      {/* ADD TECHNICIAN */}
      {showAddTechModal&&(
        <div style={s.modalOv} onClick={e=>e.target===e.currentTarget&&setShowAddTechModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHd}><h3 style={{fontSize:15,fontWeight:700,color:"#dde3ff"}}>Add New Technician</h3><button style={s.mx} onClick={()=>setShowAddTechModal(false)}>✕</button></div>
            <div style={s.modalBody}>
              <div style={s.f2}><FG label="Full Name *"><input style={s.fi} value={techForm.name} onChange={e=>setTechForm({...techForm,name:e.target.value})} placeholder="Juan dela Cruz"/></FG><FG label="Login Name *"><input style={s.fi} value={techForm.loginName} onChange={e=>setTechForm({...techForm,loginName:e.target.value})} placeholder="juan"/></FG></div>
              <div style={s.f2}><FG label="PIN *"><input style={s.fi} value={techForm.pin} onChange={e=>setTechForm({...techForm,pin:e.target.value})} placeholder="1234"/></FG><FG label="Area"><input style={s.fi} value={techForm.area} onChange={e=>setTechForm({...techForm,area:e.target.value})} placeholder="Socorro / Bancal"/></FG></div>
              <div style={s.f2}><FG label="Contact"><input style={s.fi} value={techForm.contact} onChange={e=>setTechForm({...techForm,contact:e.target.value})} placeholder="0917-XXX-XXXX"/></FG><FG label="Specialization"><input style={s.fi} value={techForm.spec} onChange={e=>setTechForm({...techForm,spec:e.target.value})} placeholder="FTTH Installation"/></FG></div>
            </div>
            <div style={s.modalFt}><button style={s.btnGhost} onClick={()=>setShowAddTechModal(false)}>Cancel</button><button style={s.btnPrimary} onClick={submitNewTech}>Add Technician</button></div>
          </div>
        </div>
      )}

      {/* DELETE TECH */}
      {confirmDeleteTechId&&(
        <div style={s.modalOv} onClick={e=>e.target===e.currentTarget&&setConfirmDeleteTechId(null)}>
          <div style={{...s.modal,width:420}}>
            <div style={s.modalHd}><h3 style={{fontSize:15,fontWeight:700,color:"#dde3ff"}}>Delete Technician</h3><button style={s.mx} onClick={()=>setConfirmDeleteTechId(null)}>✕</button></div>
            <div style={s.modalBody}>
              <div style={{fontSize:13,color:"#dde3ff",marginBottom:12}}>Are you sure you want to remove this technician?</div>
              <div style={{fontSize:11,color:"#7b87b8",marginBottom:16}}>This will delete the technician and remove them from any assigned jobs.</div>
              <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:12}}>
                <div style={{fontSize:12,color:"#7b87b8"}}>Technician</div>
                <div style={{fontWeight:700,color:"#dde3ff",marginTop:4}}>{techs[confirmDeleteTechId]?.name||"Unknown"}</div>
                <div style={{fontSize:11,color:"#4d8ef5",marginTop:2}}>{techs[confirmDeleteTechId]?.loginName||""}</div>
              </div>
            </div>
            <div style={s.modalFt}><button style={s.btnGhost} onClick={()=>setConfirmDeleteTechId(null)}>Cancel</button><button style={{...s.btnDanger,minWidth:120}} onClick={()=>deleteTechnician(confirmDeleteTechId)}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Job Modal (shared by Dispatcher + CSR) ──
function JobModal({jobs,editJobId,isDone,form,setForm,techs,todayAttendance,techCanDeploy,ATTEND_STATUS_COLOR,ATTEND_STATUS_LABEL,ATTEND_STATUS_ICON,pasteText,setPasteText,parsedOk,setParsedOk,parsedFields,setParsedFields,parseMode,setParseMode,parsePaste,resetPaste,submitJob,updateStatus,setShowModal,setEditJobId,emptyForm,s}){
  function closeModal(){ setShowModal(false); setEditJobId(null); setForm(emptyForm()); resetPaste(); }
  const CAN_DEPLOY=["present","late","halfday"];
  return(
    <div style={s.modalOv} onClick={e=>e.target===e.currentTarget&&closeModal()}>
      <div style={s.modal}>
        <div style={s.modalHd}>
          {editJobId?(
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <h3 style={{fontSize:15,fontWeight:700,color:isDone(editJobId)?"#2dcc7a":"#dde3ff",margin:0}}>{isDone(editJobId)?"✅ Job Completed":"Job Order Details"}</h3>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontFamily:"monospace",fontSize:11,color:"#4d8ef5"}}>{jobs[editJobId]?.jo}</span>
                <span style={{...s.badge,background:STATUS_BG[jobs[editJobId]?.status],color:STATUS_COLORS[jobs[editJobId]?.status]}}>{jobs[editJobId]?.status?.toUpperCase()}</span>
                <span style={{...s.badge,background:TASK_BG[jobs[editJobId]?.type],color:TASK_COLORS[jobs[editJobId]?.type]}}>{jobs[editJobId]?.type?.toUpperCase()}</span>
              </div>
            </div>
          ):<h3 style={{fontSize:15,fontWeight:700,color:"#dde3ff"}}>New Job Order</h3>}
          <button style={s.mx} onClick={closeModal}>✕</button>
        </div>

        {editJobId?(
          isDone(editJobId)?(
            <div style={s.modalBody}>
              <div style={{background:jobs[editJobId]?.status==="cancelled"?"#2a0a0a":"#081e13",border:"1px solid",borderColor:jobs[editJobId]?.status==="cancelled"?"#5a1a1a":"#1a5a2a",borderRadius:10,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:28}}>{jobs[editJobId]?.status==="cancelled"?"✕":"✅"}</div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:jobs[editJobId]?.status==="cancelled"?"#f05555":"#2dcc7a"}}>{jobs[editJobId]?.status==="cancelled"?"Job Cancelled":"Job Completed!"}</div>
                  <div style={{fontSize:11,color:"#7b87b8",marginTop:3}}>{jobs[editJobId]?.status==="cancelled"?`Cancelled by ${jobs[editJobId]?.cancelledBy||"—"}`:`Completed by ${jobs[editJobId]?.updatedBy||"—"}`}</div>
                </div>
              </div>
              {jobs[editJobId]?.cancelReason&&<div style={{background:"#2a0a0a",border:"1px solid #5a1a1a",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#f05555"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",display:"block",marginBottom:4}}>Cancel Reason</span>{jobs[editJobId]?.cancelReason}</div>}
              <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:12}}>Client Info</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                  <InfoBlock label="Client" value={form.client} bold/><InfoBlock label="Account #" value={form.acct} mono color="#4d8ef5"/>
                  <InfoBlock label="Contact" value={form.contact} mono/><InfoBlock label="Site" value={form.site} color="#9b78f5"/>
                  <InfoBlock label="Address" value={form.address} full/>
                  {(form.lcp||form.nap||form.port)&&<InfoBlock label="LCP / NAP / PORT" value={`${form.lcp} / ${form.nap} / ${form.port}`} mono color="#20c8b0" full/>}
                  {form.plan&&<InfoBlock label="Plan" value={form.plan} color="#20c8b0"/>}
                  {form.installFee&&<InfoBlock label="Install Fee" value={"₱"+parseFloat(form.installFee).toLocaleString()} color="#2dcc7a" bold/>}
                  {form.referral&&<InfoBlock label="Referral" value={form.referral}/>}
                  {form.notes&&<InfoBlock label="Notes" value={form.notes} color="#f0a030" full/>}
                  <InfoBlock label="Date" value={form.date} mono/>
                </div>
              </div>
              {jobs[editJobId]?.materialsUsed?.length>0&&(
                <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:10}}>Materials Used</div>
                  {jobs[editJobId].materialsUsed.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<jobs[editJobId].materialsUsed.length-1?"1px solid #222840":"none"}}><span style={{fontSize:13,color:"#dde3ff"}}>{m.name} <span style={{color:"#7b87b8"}}>x{m.qty}</span></span><span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#2dcc7a"}}>₱{(m.price*m.qty).toLocaleString()}</span></div>))}
                  <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:6,borderTop:"1px solid #2dcc7a"}}><span style={{fontWeight:700,color:"#2dcc7a"}}>TOTAL</span><span style={{fontFamily:"monospace",fontSize:15,fontWeight:800,color:"#2dcc7a"}}>₱{(jobs[editJobId]?.materialsTotal||0).toLocaleString()}</span></div>
                </div>
              )}
              {jobs[editJobId]?.itUsername&&(
                <div style={{background:"#0d1535",border:"1px solid #4d8ef5",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#4d8ef5",marginBottom:12}}>Internet Credentials</div>
                  <div style={{marginBottom:10}}><div style={{fontSize:9.5,color:"#7b87b8",marginBottom:4,fontWeight:700}}>Username</div><div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:"#4d8ef5",wordBreak:"break-all"}}>{jobs[editJobId]?.itUsername}</div></div>
                  <div><div style={{fontSize:9.5,color:"#7b87b8",marginBottom:4,fontWeight:700}}>Password</div><div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:"#9b78f5",wordBreak:"break-all"}}>{jobs[editJobId]?.itPassword||jobs[editJobId]?.macAddress}</div></div>
                </div>
              )}
            </div>
          ):(
            <div style={s.modalBody}>
              <div style={{background:"#111525",border:"1px solid #222840",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 16px"}}>
                <div><span style={s.infoLbl}>Client</span><div style={{fontSize:13,fontWeight:700,color:"#dde3ff",marginTop:2}}>{form.client||"—"}</div></div>
                <div><span style={s.infoLbl}>Account #</span><div style={{fontSize:13,fontFamily:"monospace",color:"#4d8ef5",marginTop:2}}>{form.acct||"—"}</div></div>
                <div><span style={s.infoLbl}>Contact</span><div style={{fontSize:12,color:"#dde3ff",marginTop:2}}>{form.contact||"—"}</div></div>
                <div><span style={s.infoLbl}>Site</span><div style={{fontSize:12,fontWeight:600,color:"#9b78f5",marginTop:2}}>{form.site||"—"}</div></div>
                <div style={{gridColumn:"1/-1"}}><span style={s.infoLbl}>Address</span><div style={{fontSize:12,color:"#dde3ff",marginTop:2}}>{form.address||"—"}</div></div>
                {(form.lcp||form.nap||form.port)&&<div style={{gridColumn:"1/-1"}}><span style={s.infoLbl}>LCP / NAP / PORT</span><div style={{fontSize:12,fontFamily:"monospace",color:"#20c8b0",marginTop:2}}>{form.lcp} {form.nap} {form.port}</div></div>}
                {form.notes&&<div style={{gridColumn:"1/-1"}}><span style={s.infoLbl}>Notes</span><div style={{fontSize:12,color:"#f0a030",marginTop:2}}>{form.notes}</div></div>}
                {form.installFee&&<div><span style={s.infoLbl}>Installation Fee</span><div style={{fontSize:13,fontWeight:700,color:"#2dcc7a",marginTop:2}}>₱{parseFloat(form.installFee).toLocaleString()}</div></div>}
                <div><span style={s.infoLbl}>Scheduled</span><div style={{fontSize:12,fontFamily:"monospace",color:"#dde3ff",marginTop:2}}>{form.date||"—"}</div></div>
              </div>
              <div style={s.fsec}>Update Job</div>
              <div style={s.f2}>
                <FG label="Priority"><select style={s.fi} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="normal">Normal</option><option value="urgent">🔴 Urgent</option></select></FG>
                <FG label="Scheduled Date"><input style={s.fi} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></FG>
              </div>
              <div style={s.f3}>
                <FG label="LCP"><input style={s.fi} type="number" value={form.lcp.replace(/^L/i,"")} onChange={e=>setForm({...form,lcp:e.target.value?"L"+e.target.value:""})} placeholder="1"/></FG>
                <FG label="NAP"><input style={s.fi} type="number" value={form.nap.replace(/^N/i,"")} onChange={e=>setForm({...form,nap:e.target.value?"N"+e.target.value:""})} placeholder="1"/></FG>
                <FG label="PORT"><input style={s.fi} type="number" value={form.port.replace(/^P/i,"")} onChange={e=>setForm({...form,port:e.target.value?"P"+e.target.value:""})} placeholder="1"/></FG>
              </div>
              {form.type==="install"&&<FG label="Installation Fee (₱)"><input style={s.fi} type="number" value={form.installFee} onChange={e=>setForm({...form,installFee:e.target.value})} placeholder="0.00" min="0" step="0.01"/></FG>}
              <FG label="Notes / Issue"><input style={s.fi} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="LOS / NO NET / FOR RELOCATION..."/></FG>
              <FG label="Assign Technicians">
                <div style={{background:"#111525",border:"1px solid #222840",borderRadius:8,padding:"8px 11px",maxHeight:150,overflowY:"auto"}}>
                  {Object.entries(techs).map(([id,t])=>{
                    const canDeploy=techCanDeploy(id);
                    const attend=todayAttendance[id];
                    const aStatus=attend?.status;
                    return(<label key={id} style={{display:"flex",alignItems:"center",gap:7,cursor:canDeploy?"pointer":"not-allowed",fontSize:12,color:canDeploy?"#dde3ff":"#f05555",marginBottom:6,opacity:canDeploy?1:0.65}}>
                      <input type="checkbox" checked={form.techIds.includes(id)} style={{margin:0}} disabled={!canDeploy}
                        onChange={e=>{if(!canDeploy){alert(`⛔ Hindi pwedeng i-assign si ${t.name} — ${ATTEND_STATUS_LABEL[aStatus]||"Absent/Unavailable"} ngayon.`);return;}const ids=e.target.checked?[...form.techIds,id]:form.techIds.filter(x=>x!==id);setForm({...form,techIds:ids});}}/>
                      <div style={{width:22,height:22,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>{t.initials||t.name[0]}</div>
                      <span style={{flex:1}}>{t.name}</span>
                      {aStatus?<span style={{fontSize:10,color:ATTEND_STATUS_COLOR[aStatus]||"#7b87b8",fontWeight:700}}>{ATTEND_STATUS_ICON[aStatus]} {ATTEND_STATUS_LABEL[aStatus]}{attend?.timeIn?` · ${attend.timeIn}`:""}</span>:<span style={{fontSize:10,color:"#3d4668"}}>No record</span>}
                    </label>);
                  })}
                </div>
                <div style={{fontSize:10.5,color:"#7b87b8",marginTop:5}}>⛔ = Hindi pwedeng i-assign (Absent/Leave/Day Off)</div>
              </FG>
              <div style={s.fsec}>Update Status</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["pending","Pending","#f05555"],["dispatched","Dispatched","#4d8ef5"],["on-way","On the Way","#9b78f5"],["on-site","On-Site","#20c8b0"],["done","Done ✓","#2dcc7a"]].map(([st,lbl,col])=>(
                  <button key={st} style={{...s.ftab,...(jobs[editJobId]?.status===st?{background:col+"22",borderColor:col,color:col,fontWeight:700}:{})}} onClick={()=>updateStatus(editJobId,st)}>{lbl}</button>
                ))}
              </div>
            </div>
          )
        ):(
          <div style={s.modalBody}>
            {/* PASTE PARSER */}
            <div style={{background:"#0d1535",border:"1.5px solid #4d8ef5",borderRadius:12,padding:14,marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:"#4d8ef5",letterSpacing:".05em",textTransform:"uppercase"}}>⚡ Quick Paste Parser</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {parsedOk&&<div style={{background:"#081e13",border:"1px solid #2dcc7a",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#2dcc7a"}}>✓ {Object.keys(parsedFields).length} fields filled!</div>}
                  {pasteText&&!parsedOk&&<div style={{background:"#2a1805",border:"1px solid #f0a030",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#f0a030"}}>⏳ Parsing...</div>}
                </div>
              </div>
              <div style={{display:"flex",background:"#111525",borderRadius:8,padding:3,marginBottom:12,gap:3}}>
                {[["labeled","🏷 With Labels"],["free","🔓 No Labels (Smart)"]].map(([m,lbl])=>(
                  <button key={m} style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s",background:parseMode===m?"#4d8ef5":"transparent",color:parseMode===m?"#fff":"#7b87b8"}}
                    onClick={()=>{setParseMode(m);if(pasteText)parsePaste(pasteText,m);}}>
                    {lbl}
                  </button>
                ))}
              </div>
              <textarea
                style={{width:"100%",background:"#111525",border:`1px solid ${parsedOk?"#2dcc7a":"#4d8ef5"}`,color:"#dde3ff",padding:"10px 12px",borderRadius:8,fontFamily:"monospace",fontSize:12,outline:"none",minHeight:parseMode==="free"?85:120,resize:"vertical",lineHeight:1.7,transition:"border-color .2s"}}
                placeholder={parseMode==="labeled"?"TASK: repair\nName: Juan dela Cruz\nContact Number: 09171234567\nAddress: Blk 15 Lot 20 Socorro\nLCP NAP PORT: L1 N2 P14\nISSUE: LOS signal":"Juan dela Cruz\n09171234567\nBlk 15 Lot 20 Purok 3 Socorro\nL1 N2 P14\nLOS signal"}
                value={pasteText}
                onChange={e=>parsePaste(e.target.value,parseMode)}
                onPaste={e=>{e.preventDefault();const txt=e.clipboardData.getData("text");setPasteText(txt);setTimeout(()=>parsePaste(txt,parseMode),0);}}
              />
              <div style={{marginTop:8,fontSize:10.5,color:"#7b87b8",lineHeight:1.5}}>
                {parseMode==="labeled"?<><strong style={{color:"#dde3ff"}}>🏷 Labels:</strong> TASK:, Name:, Contact Number:, Address:, LCP NAP PORT:, ISSUE:</>:<><strong style={{color:"#dde3ff"}}>🔓 Smart:</strong> Auto-detect phone, LCP/NAP/PORT, name, address, issue.</>}
              </div>
              {parsedOk&&(
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
                  {[["client","👤 Name"],["contact","📞 Contact"],["address","📍 Address"],["lcp","L"],["nap","N"],["port","P"],["notes","📝 Issue"],["amountToCollect","₱ Amount"]].map(([key,label])=>
                    parsedFields[key]?(<span key={key} style={{background:"#081e13",border:"1px solid #2dcc7a44",color:"#2dcc7a",borderRadius:5,padding:"1px 8px",fontSize:10.5,fontWeight:600}}>✓ {label}</span>):null
                  )}
                </div>
              )}
              {pasteText&&<button style={{marginTop:8,background:"none",border:"1px solid #f0555544",color:"#f05555",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{resetPaste();setForm(emptyForm());}}>✕ Clear & Reset</button>}
            </div>

            <div style={s.fsec}>Client Info</div>
            <div style={s.f2}><FG label="Account #"><input style={s.fi} value={form.acct} onChange={e=>setForm({...form,acct:e.target.value})} placeholder="ACC-0001"/></FG><FG label="Client Name *"><input style={s.fi} value={form.client} onChange={e=>setForm({...form,client:e.target.value})} placeholder="Juan dela Cruz"/></FG></div>
            <div style={s.f2}><FG label="Contact"><input style={s.fi} value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="09XXXXXXXXX"/></FG><FG label="Address"><input style={s.fi} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Blk 15 Lot 20 Cherry St."/></FG></div>
            <div style={s.fsec}>Job Details</div>
            <div style={s.f3}>
              <FG label="Task Type"><select style={s.fi} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="install">INSTALL</option><option value="repair">REPAIR</option><option value="relocate">RELOCATE</option><option value="collection">COLLECTION</option><option value="mainline">MAINLINE ISSUE</option><option value="pullout">PULL-OUT</option></select></FG>
              <FG label="Site"><select style={s.fi} value={form.site} onChange={e=>setForm({...form,site:e.target.value})}>{SITES.map(site=><option key={site}>{site}</option>)}</select></FG>
              <FG label="Priority"><select style={s.fi} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="normal">Normal</option><option value="urgent">🔴 Urgent</option></select></FG>
            </div>
            <div style={s.f3}>
              <FG label="LCP"><input style={s.fi} type="number" value={form.lcp.replace(/^L/i,"")} onChange={e=>setForm({...form,lcp:e.target.value?"L"+e.target.value:""})} placeholder="1"/></FG>
              <FG label="NAP"><input style={s.fi} type="number" value={form.nap.replace(/^N/i,"")} onChange={e=>setForm({...form,nap:e.target.value?"N"+e.target.value:""})} placeholder="1"/></FG>
              <FG label="PORT"><input style={s.fi} type="number" value={form.port.replace(/^P/i,"")} onChange={e=>setForm({...form,port:e.target.value?"P"+e.target.value:""})} placeholder="1"/></FG>
            </div>
            {form.type==="install"&&<FG label="Installation Fee (₱)"><input style={s.fi} type="number" value={form.installFee} onChange={e=>setForm({...form,installFee:e.target.value})} placeholder="0.00" min="0" step="0.01"/></FG>}
            {form.type==="collection"&&<FG label="Amount to Collect (₱)"><input style={s.fi} type="number" value={form.amountToCollect||""} onChange={e=>setForm({...form,amountToCollect:e.target.value})} placeholder="0.00" min="0" step="0.01"/></FG>}
            <FG label="Notes / Issue"><input style={s.fi} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="LOS / NO NET / FOR RELOCATION / MAINLINE ISSUE..."/></FG>
            <div style={s.f2}>
              <FG label="Scheduled Date"><input style={s.fi} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></FG>
              <FG label="Assign Technicians (1-3)">
                <div style={{background:"#111525",border:"1px solid #222840",borderRadius:8,padding:"8px 11px",maxHeight:150,overflowY:"auto"}}>
                  {Object.entries(techs).map(([id,t])=>{
                    const canDeploy=techCanDeploy(id);
                    const attend=todayAttendance[id];
                    const aStatus=attend?.status;
                    return(<label key={id} style={{display:"flex",alignItems:"center",gap:7,cursor:canDeploy?"pointer":"not-allowed",fontSize:12,color:canDeploy?"#dde3ff":"#f05555",marginBottom:6,opacity:canDeploy?1:0.65}}>
                      <input type="checkbox" checked={form.techIds.includes(id)} style={{margin:0}} disabled={!canDeploy}
                        onChange={e=>{if(!canDeploy){alert(`⛔ Hindi pwedeng i-assign si ${t.name} — ${ATTEND_STATUS_LABEL[aStatus]||"Absent/Unavailable"} ngayon.`);return;}const ids=e.target.checked?[...form.techIds,id]:form.techIds.filter(x=>x!==id);setForm({...form,techIds:ids});}}/>
                      <div style={{width:22,height:22,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,flexShrink:0}}>{t.initials||t.name[0]}</div>
                      <span style={{flex:1}}>{t.name}</span>
                      {aStatus?<span style={{fontSize:10,color:ATTEND_STATUS_COLOR[aStatus]||"#7b87b8",fontWeight:700}}>{ATTEND_STATUS_ICON[aStatus]} {ATTEND_STATUS_LABEL[aStatus]}{attend?.timeIn?` · ${attend.timeIn}`:""}</span>:<span style={{fontSize:10,color:"#3d4668"}}>No record</span>}
                    </label>);
                  })}
                </div>
                <div style={{fontSize:10.5,color:"#7b87b8",marginTop:5}}>⛔ = Hindi pwedeng i-assign (Absent/Leave/Day Off)</div>
              </FG>
            </div>
          </div>
        )}

        <div style={s.modalFt}>
          <button style={s.btnGhost} onClick={closeModal}>{editJobId?"Close":"Cancel"}</button>
          {(!editJobId||!isDone(editJobId))&&<button style={s.btnPrimary} onClick={submitJob}>{editJobId?"Update Job":"Create Job Order"}</button>}
        </div>
      </div>
    </div>
  );
}

function FG({label,children}){return(<div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}><label style={{fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"#7b87b8"}}>{label}</label>{children}</div>);}
function InfoBlock({label,value,mono,bold,color,full}){return(<div style={{gridColumn:full?"1/-1":"auto"}}><div style={{fontSize:9.5,color:"#7b87b8",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{label}</div><div style={{fontSize:13,fontFamily:mono?"monospace":"inherit",color:color||"#dde3ff",fontWeight:bold?700:400}}>{value||"—"}</div></div>);}

const s={
  app:{display:"flex",flexDirection:"column",height:"100vh",background:"#07090f",fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#dde3ff"},
  tb:{height:52,background:"#0c0f1a",borderBottom:"1px solid #222840",display:"flex",alignItems:"center",padding:"0 16px",gap:10,flexShrink:0},
  menuBtn:{background:"none",border:"none",color:"#7b87b8",cursor:"pointer",fontSize:17,padding:3,lineHeight:1},
  logo:{fontSize:16,fontWeight:800,letterSpacing:-.5,color:"#dde3ff",whiteSpace:"nowrap"},
  tbDiv:{width:1,height:16,background:"#222840"},
  tbRight:{marginLeft:"auto",display:"flex",alignItems:"center",gap:8},
  livePill:{display:"flex",alignItems:"center",gap:5,fontSize:9.5,fontWeight:700,fontFamily:"monospace",color:"#2dcc7a",border:"1px solid #081e13",borderRadius:4,padding:"3px 8px"},
  ldot:{width:6,height:6,borderRadius:"50%",background:"#2dcc7a",display:"inline-block",animation:"blink 1.4s infinite"},
  userAv:{width:28,height:28,borderRadius:"50%",background:"#0d1e42",color:"#4d8ef5",border:"1.5px solid #4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700},
  body:{display:"flex",flex:1,overflow:"hidden"},
  sidebar:{width:190,flexShrink:0,background:"#0c0f1a",borderRight:"1px solid #222840",display:"flex",flexDirection:"column",padding:"10px 0",overflowY:"auto"},
  navSection:{padding:"8px 14px 4px",fontSize:9,fontWeight:700,letterSpacing:".14em",color:"#3d4668",textTransform:"uppercase"},
  navItem:{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",cursor:"pointer",color:"#7b87b8",fontSize:12.5,fontWeight:500,borderLeft:"2px solid transparent"},
  navActive:{color:"#4d8ef5",background:"#0d1e42",borderLeftColor:"#4d8ef5"},
  navBadge:{marginLeft:"auto",fontFamily:"monospace",fontSize:9,background:"#2a0a0a",color:"#f05555",padding:"1px 5px",borderRadius:7},
  content:{flex:1,overflowY:"auto",padding:20},
  srow:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16},
  sc:{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:"13px 15px",position:"relative",overflow:"hidden"},
  scTop:{position:"absolute",top:0,left:0,right:0,height:2},
  scLbl:{fontSize:9.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:6},
  scVal:{fontSize:26,fontWeight:700,fontFamily:"monospace",lineHeight:1},
  dashGrid:{display:"grid",gridTemplateColumns:"1fr 280px",gap:14},
  card:{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:14},
  cardHd:{padding:"10px 14px",borderBottom:"1px solid #222840",display:"flex",alignItems:"center",justifyContent:"space-between"},
  cardTitle:{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8"},
  cardBtn:{background:"none",border:"none",color:"#4d8ef5",cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  jobRow:{display:"grid",gridTemplateColumns:"70px 80px 70px 1fr 90px 80px",alignItems:"center",gap:8,padding:"8px 13px",borderBottom:"1px solid #222840",cursor:"pointer"},
  badge:{display:"inline-block",padding:"2px 7px",borderRadius:3,fontSize:9.5,fontWeight:800},
  techRow:{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",borderBottom:"1px solid #222840"},
  techAv:{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0},
  ph:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8},
  h1:{fontSize:20,fontWeight:800,letterSpacing:-.5,color:"#dde3ff"},
  toolbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #222840",flexWrap:"wrap",gap:7},
  ftab:{background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:11,fontFamily:"inherit"},
  ftabActive:{background:"#0d1e42",borderColor:"#4d8ef5",color:"#4d8ef5"},
  searchInput:{background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"5px 10px",borderRadius:8,fontFamily:"inherit",fontSize:11.5,outline:"none",width:170},
  tbl:{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1000},
  th:{padding:"7px 10px",background:"#111525",color:"#7b87b8",fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",borderBottom:"1px solid #222840",textAlign:"left",whiteSpace:"nowrap"},
  tr:{borderBottom:"1px solid #222840",cursor:"pointer"},
  tdMono:{fontFamily:"monospace",fontSize:10.5,color:"#7b87b8",padding:"8px 10px"},
  tdBtn:{background:"#171c2e",border:"1px solid #222840",color:"#7b87b8",padding:"3px 8px",borderRadius:4,fontSize:10.5,cursor:"pointer",fontFamily:"inherit"},
  empty:{padding:"20px",textAlign:"center",color:"#3d4668",fontSize:13},
  btnPrimary:{background:"#4d8ef5",color:"#fff",border:"none",padding:"7px 14px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"},
  btnGhost:{background:"none",border:"1px solid #222840",color:"#7b87b8",padding:"7px 14px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,cursor:"pointer"},
  btnDanger:{background:"#f05555",color:"#fff",border:"none",padding:"7px 14px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"},
  modalOv:{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"},
  modal:{background:"#0c0f1a",border:"1px solid #2e3450",borderRadius:16,width:660,maxWidth:"96vw",maxHeight:"90vh",overflowY:"auto"},
  modalHd:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid #222840"},
  mx:{background:"none",border:"none",color:"#7b87b8",fontSize:16,cursor:"pointer"},
  modalBody:{padding:"18px 20px"},
  modalFt:{padding:"12px 20px",borderTop:"1px solid #222840",display:"flex",justifyContent:"flex-end",gap:8},
  fsec:{fontSize:9,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"#4d8ef5",margin:"14px 0 9px",paddingBottom:5,borderBottom:"1px solid #222840"},
  infoLbl:{fontSize:9.5,color:"#7b87b8",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"},
  f2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11},
  f3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10},
  fi:{background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"8px 11px",borderRadius:8,fontFamily:"inherit",fontSize:13,outline:"none",width:"100%"},
};