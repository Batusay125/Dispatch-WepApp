import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { SITES, TASK_COLORS, TASK_BG, STATUS_COLORS, STATUS_BG } from "../constants.jsx";
import Reports from "./Report";
import Materials from "./Material";

export default function Dispatcher({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [jobs, setJobs] = useState({});
  const [deletedJobs, setDeletedJobs] = useState({});
  const [techs, setTechs] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editJobId, setEditJobId] = useState(null);
  const [jobFilter, setJobFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [showAddTechModal, setShowAddTechModal] = useState(false);
  const [confirmDeleteTechId, setConfirmDeleteTechId] = useState(null);
  const [techForm, setTechForm] = useState({ name: "", loginName: "", pin: "", area: "", contact: "", spec: "" });
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(false);

  function emptyForm() {
    return { acct: "", client: "", contact: "", address: "", site: "Socorro", type: "install", priority: "normal", lcp: "", nap: "", port: "", notes: "", date: new Date().toISOString().split("T")[0], techIds: [], plan: "", referral: "", installFee: "" };
  }

  // Get current technician names from techs object
  function getCurrentTechNames(techIds) {
    return (techIds || []).map(id => techs[id]?.name || "").filter(n => n).join(", ") || "—";
  }

  useEffect(() => {
    const u1 = onValue(ref(db, "jobs"), s => setJobs(s.exists() ? s.val() : {}));
    const u2 = onValue(ref(db, "technicians"), s => setTechs(s.exists() ? s.val() : {}));
    const u3 = onValue(ref(db, "deletedJobs"), s => setDeletedJobs(s.exists() ? s.val() : {}));
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const jobList = Object.entries(jobs);
  const filtered = jobList.filter(([, j]) => {
    const ms = !search || j.client?.toLowerCase().includes(search.toLowerCase()) || (j.jo || "").toLowerCase().includes(search.toLowerCase()) || (j.site || "").toLowerCase().includes(search.toLowerCase());
    const today = new Date().toISOString().split("T")[0];
    const thisWeek = new Date(); thisWeek.setDate(thisWeek.getDate() - 7); const weekStart = thisWeek.toISOString().split("T")[0];
    const thisMonth = new Date(); thisMonth.setMonth(thisMonth.getMonth() - 1); const monthStart = thisMonth.toISOString().split("T")[0];
    const df = dateFilter === "all" ||
      (dateFilter === "today" && j.date === today) ||
      (dateFilter === "this-week" && j.date >= weekStart) ||
      (dateFilter === "this-month" && j.date >= monthStart);
    const sf = statusFilter === "all" || j.status === statusFilter;
    const tf = typeFilter === "all" || j.type === typeFilter;
    const sif = siteFilter === "all" || j.site === siteFilter;
    return ms && df && sf && tf && sif;
  }).reverse();

  const counts = {
    pending: jobList.filter(([, j]) => j.status === "pending").length,
    dispatched: jobList.filter(([, j]) => j.status === "dispatched" || j.status === "on-way").length,
    onsite: jobList.filter(([, j]) => j.status === "on-site").length,
    done: jobList.filter(([, j]) => j.status === "done").length,
  };

  const deletedList = Object.entries(deletedJobs).reverse();

  async function submitJob() {
    if (!form.client.trim()) { alert("Client name required"); return; }
    const techNames = form.techIds.map(id => techs[id]?.name || "").filter(n => n).join(", ");
    if (editJobId) {
      // Editing existing job — preserve current status, only update info fields
      const existing = jobs[editJobId];
      const updates = {
        ...form,
        techNames,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name,
        // Preserve existing status — do NOT reset it
        status: existing?.status,
      };
      await update(ref(db, "jobs/" + editJobId), updates);
    } else {
      // New job — set status based on tech assignment
      const jo = "JO-" + Date.now().toString().slice(-6);
      const data = { ...form, jo, techNames, status: form.techIds.length > 0 ? "dispatched" : "pending", createdAt: new Date().toISOString(), createdBy: user.name };
      await push(ref(db, "jobs"), data);
    }
    setShowModal(false); setEditJobId(null); setForm(emptyForm());
  }

  function openEdit(jobId) {
    const j = jobs[jobId];
    setForm({ acct: j.acct || "", client: j.client || "", contact: j.contact || "", address: j.address || "", site: j.site || "Socorro", type: j.type || "install", priority: j.priority || "normal", lcp: j.lcp || "", nap: j.nap || "", port: j.port || "", notes: j.notes || "", date: j.date || "", techIds: j.techIds || [] });
    setEditJobId(jobId); setShowModal(true);
  }

  async function updateStatus(jobId, status) {
    await update(ref(db, "jobs/" + jobId), { status, updatedAt: new Date().toISOString() });
  }

  async function archiveJob(jobId) {
    if (!jobId) return;
    const job = jobs[jobId];
    if (!job) return;
    if (!confirm("Move this job to Trash?")) return;
    await set(ref(db, `deletedJobs/${jobId}`), { ...job, deletedAt: new Date().toISOString(), deletedBy: user?.name || "Dispatcher" });
    await remove(ref(db, `jobs/${jobId}`));
  }

  async function restoreJob(jobId) {
    if (!jobId) return;
    const job = deletedJobs[jobId];
    if (!job) return;
    const { deletedAt, deletedBy, ...restored } = job;
    await set(ref(db, `jobs/${jobId}`), { ...restored, restoredAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await remove(ref(db, `deletedJobs/${jobId}`));
  }

  async function submitNewTech() {
    if (!techForm.name.trim() || !techForm.loginName.trim() || !techForm.pin.trim()) { alert("Name, login name, and PIN required"); return; }
    const id = "T" + String(Object.keys(techs).length + 1).padStart(2, "0");
    const initials = techForm.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const data = { ...techForm, name: techForm.name.trim(), loginName: techForm.loginName.trim(), pin: techForm.pin.trim(), initials, bg: "#0d1e42", color: "#4d8ef5" };
    await set(ref(db, "technicians/" + id), data);
    setShowAddTechModal(false); setTechForm({ name: "", loginName: "", pin: "", area: "", contact: "", spec: "" });
  }

  async function deleteTechnician(techId) {
    if (!techId) return;
    const updates = {};
    Object.entries(jobs).forEach(([jobId, job]) => {
      const currentIds = job.techIds || [];
      if (currentIds.includes(techId)) {
        const newTechIds = currentIds.filter(id => id !== techId);
        updates[`jobs/${jobId}/techIds`] = newTechIds;
        updates[`jobs/${jobId}/techNames`] = newTechIds.map(id => techs[id]?.name || "").filter(n => n).join(", ");
        if (newTechIds.length === 0 && !["done", "cancelled"].includes(job.status)) {
          updates[`jobs/${jobId}/status`] = "pending";
        }
        updates[`jobs/${jobId}/updatedAt`] = new Date().toISOString();
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
    await remove(ref(db, "technicians/" + techId));
    setConfirmDeleteTechId(null);
  }

  const navPages = [
    ["dashboard", "◈", "Dashboard", null],
    ["jobs", "📋", "Job Orders", counts.pending > 0 ? counts.pending : null],
    ["pipeline", "⟶", "Pipeline", null],
    ["dispatch", "📡", "Dispatch", counts.pending > 0 ? counts.pending : null],
    ["technicians", "🔧", "Technicians", null],
    ["reports", "◫", "Reports", null],
    ["materials", "🗃", "Materials", null],
    ["trash", "🗑️", "Trash", deletedList.length > 0 ? deletedList.length : null],
  ];

  const pageLabels = { dashboard: "Dashboard", jobs: "Job Orders", pipeline: "Pipeline", dispatch: "Dispatch Board", technicians: "Technicians", reports: "Reports", materials: "Materials", trash: "Trash" };

  return (
    <div style={s.app}>
      {/* TOPBAR */}
      <div style={s.tb}>
        <button style={s.menuBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <img src="/logo.svg" alt="KeyConnect" style={{height:32,width:32}} />
          <div style={s.logo}>KEY<span style={{ color: "#4d8ef5" }}>CONNECT</span></div>
        </div>
        <div style={s.tbDiv}></div>
        <div style={{ fontSize: 11.5, color: "#7b87b8" }}>{pageLabels[page]}</div>
        <div style={s.tbRight}>
          <div style={s.livePill}><span style={s.ldot}></span>LIVE</div>
          <button style={s.btnPrimary} onClick={() => { setEditJobId(null); setForm(emptyForm()); setShowModal(true); }}>+ New Job</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={s.userAv}>{(user?.name?.[0] || "U").toUpperCase()}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#dde3ff" }}>{user?.name || "Unknown"}</span>
              <span style={{ fontSize: 10, color: "#7b87b8" }}>Dispatcher</span>
            </div>
            <button style={s.btnGhost} onClick={onLogout}>Labas</button>
          </div>
        </div>
      </div>

      <div style={{ ...s.body, flexDirection: isMobile ? "column" : "row" }}>
        {/* SIDEBAR */}
        {sidebarOpen && (
          <nav style={{ ...s.sidebar, width: isMobile ? "100%" : 190, position: isMobile ? "absolute" : "static", zIndex: isMobile ? 100 : "auto", height: isMobile ? "calc(100vh - 52px)" : "auto" }}>
            <div style={{ padding: "8px 0 4px", fontSize: 9, fontWeight: 700, letterSpacing: ".14em", color: "#3d4668", paddingLeft: 14, textTransform: "uppercase" }}>Main</div>
            {navPages.slice(0, 5).map(([key, ic, lbl, badge]) => (
              <div key={key} style={{ ...s.navItem, ...(page === key ? s.navActive : {}) }} onClick={() => { setPage(key); if (isMobile) setSidebarOpen(false); }}>
                <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{ic}</span>{lbl}
                {badge && <span style={s.navBadge}>{badge}</span>}
              </div>
            ))}
            <div style={{ padding: "12px 14px 4px", fontSize: 9, fontWeight: 700, letterSpacing: ".14em", color: "#3d4668", textTransform: "uppercase" }}>Admin</div>
            {navPages.slice(5).map(([key, ic, lbl]) => (
              <div key={key} style={{ ...s.navItem, ...(page === key ? s.navActive : {}) }} onClick={() => { setPage(key); if (isMobile) setSidebarOpen(false); }}>
                <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{ic}</span>{lbl}
              </div>
            ))}
          </nav>
        )}

        {/* CONTENT */}
        <main style={{ ...s.content, padding: isMobile ? 10 : 20 }}>

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Dashboard</h1><div style={{ fontSize: 11.5, color: "#7b87b8", fontFamily: "monospace" }}>{new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div>
              <div style={s.srow}>
                {[["Pending", counts.pending, "#f05555"], ["Dispatched", counts.dispatched, "#4d8ef5"], ["On-Site", counts.onsite, "#20c8b0"], ["Done", counts.done, "#2dcc7a"]].map(([lbl, val, col]) => (
                  <div key={lbl} style={s.sc}><div style={{ ...s.scTop, background: col }}></div><div style={s.scLbl}>{lbl}</div><div style={{ ...s.scVal, color: col }}>{val}</div></div>
                ))}
              </div>
              <div style={s.dashGrid}>
                <div>
                  <div style={s.card}>
                    <div style={s.cardHd}><span style={s.cardTitle}>Recent Jobs</span><button style={s.cardBtn} onClick={() => setPage("jobs")}>View All →</button></div>
                    {jobList.slice(-8).reverse().map(([id, j]) => (
                      <div key={id} style={s.jobRow} onClick={() => openEdit(id)}>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#7b87b8" }}>{j.jo}</span>
                        <span style={{ ...s.badge, background: TASK_BG[j.type], color: TASK_COLORS[j.type] }}>{j.type?.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: "#9b78f5", fontWeight: 600, minWidth: 60 }}>{j.site || "—"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{j.client}</div><div style={{ fontSize: 10, color: "#7b87b8" }}>{j.address?.substring(0, 30)}</div></div>
                        <span style={{ ...s.badge, background: STATUS_BG[j.status], color: STATUS_COLORS[j.status] }}>{j.status?.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: j.techIds && j.techIds.length > 0 ? "#dde3ff" : "#3d4668" }}>{getCurrentTechNames(j.techIds)}</span>
                      </div>
                    ))}
                    {jobList.length === 0 && <div style={s.empty}>Walang jobs pa. I-click ang "+ New Job"</div>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={s.card}>
                    <div style={s.cardHd}><span style={s.cardTitle}>Technicians</span></div>
                    {Object.entries(techs).map(([id, t]) => {
                      const mj = jobList.filter(([, j]) => (j.techIds || []).includes(id) && !["done", "cancelled"].includes(j.status)).length;
                      return (
                        <div key={id} style={s.techRow}>
                          <div style={{ ...s.techAv, background: t.bg, color: t.color }}>{t.initials}</div>
                          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{t.name}</div><div style={{ fontSize: 10, color: "#7b87b8" }}>{t.spec}</div></div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 10.5, color: mj > 0 ? "#f0a030" : "#2dcc7a" }}>{mj > 0 ? mj + " active" : "Free"}</div>
                            <div style={{ fontSize: 9, color: "#3d4668", fontFamily: "monospace" }}>{t.loginName}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={s.card}>
                    <div style={s.cardHd}><span style={s.cardTitle}>Jobs by Site</span></div>
                    {SITES.map(site => {
                      const ct = jobList.filter(([, j]) => j.site === site).length;
                      const done = jobList.filter(([, j]) => j.site === site && j.status === "done").length;
                      return ct > 0 ? (
                        <div key={site} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid #222840" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#9b78f5", flex: 1 }}>{site}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#7b87b8" }}>{done}/{ct}</span>
                          <div style={{ width: 60, height: 4, background: "#222840", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: ct > 0 ? (done / ct * 100) + "%" : "0%", height: "100%", background: "#2dcc7a", borderRadius: 2 }}></div>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* JOB ORDERS */}
          {page === "jobs" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Job Orders</h1><button style={s.btnPrimary} onClick={() => { setEditJobId(null); setForm(emptyForm()); setShowModal(true); }}>+ New Job Order</button></div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#7b87b8", minWidth: 40 }}>Status:</span>
                      {[["all","All"],["pending","Pending"],["dispatched","Dispatched"],["on-way","On the Way"],["on-site","On-Site"],["done","Done"]].map(([k, lbl]) => (
                        <button key={k} style={{ ...s.ftab, ...(statusFilter === k ? s.ftabActive : {}) }} onClick={() => setStatusFilter(k)}>{lbl}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#7b87b8", minWidth: 40 }}>Task:</span>
                      {[["all","All"],["install","Install"],["repair","Repair"],["relocate","Relocate"],["collection","Collection"]].map(([k, lbl]) => (
                        <button key={k} style={{ ...s.ftab, ...(typeFilter === k ? s.ftabActive : {}) }} onClick={() => setTypeFilter(k)}>{lbl}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#7b87b8", minWidth: 40 }}>Site:</span>
                      <button style={{ ...s.ftab, ...(siteFilter === "all" ? s.ftabActive : {}) }} onClick={() => setSiteFilter("all")}>All</button>
                      {SITES.map(site => (
                        <button key={site} style={{ ...s.ftab, ...(siteFilter === site ? s.ftabActive : {}) }} onClick={() => setSiteFilter(site)}>{site}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#7b87b8", minWidth: 40 }}>Date:</span>
                      {[["all","All Dates"],["today","Today"],["this-week","This Week"],["this-month","This Month"]].map(([k, lbl]) => (
                        <button key={k} style={{ ...s.ftab, ...(dateFilter === k ? s.ftabActive : {}) }} onClick={() => setDateFilter(k)}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  <input style={s.searchInput} placeholder="Client / JO / Site..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ ...s.tbl }}>
                    <thead>
                      <tr>{["JO #","Task","Site","Date","Status","Client","Address","Contact","LCP/NAP/Port","Tech","Notes","Materials","Actions"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filtered.map(([id, j]) => (
                        <tr key={id} style={s.tr} onClick={() => openEdit(id)}>
                          <td style={s.tdMono}>{j.jo}</td>
                          <td><span style={{ ...s.badge, background: TASK_BG[j.type], color: TASK_COLORS[j.type] }}>{j.type?.toUpperCase()}</span></td>
                          <td style={{ padding: "8px 10px", color: "#9b78f5", fontWeight: 600, fontSize: 12 }}>{j.site || "—"}</td>
                          <td style={s.tdMono}>{j.date || "—"}</td>
                          <td><span style={{ ...s.badge, background: STATUS_BG[j.status], color: STATUS_COLORS[j.status] }}>{j.status?.toUpperCase()}</span></td>
                          <td style={{ padding: "8px 10px" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{j.client}</div><div style={{ fontSize: 10, color: "#7b87b8" }}>{j.acct}</div></td>
                          <td style={{ padding: "8px 10px", fontSize: 11, color: "#7b87b8", maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.address}</td>
                          <td style={s.tdMono}>{j.contact}</td>
                          <td style={{ ...s.tdMono, color: "#20c8b0" }}>{j.lcp} {j.nap} {j.port}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: j.techIds && j.techIds.length > 0 ? 600 : 400, color: j.techIds && j.techIds.length > 0 ? "#dde3ff" : "#3d4668" }}>{getCurrentTechNames(j.techIds)}</td>
                          <td style={{ padding: "8px 10px", fontSize: 11, color: "#f0a030", maxWidth: 100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.notes || "—"}</td>
                          <td style={{ padding: "8px 10px", fontSize: 11 }}>
                            {j.materialsUsed?.length > 0
                              ? <span style={{ color: "#2dcc7a", fontFamily: "monospace" }}>₱{(j.materialsTotal || 0).toLocaleString()}</span>
                              : <span style={{ color: "#3d4668" }}>—</span>}
                          </td>
                          <td style={{ padding: "8px 10px" }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {j.status !== "done" && (<button style={s.tdBtn} onClick={() => openEdit(id)}>Edit</button>)}
                              {j.status === "pending" && <button style={{ ...s.tdBtn, color: "#2dcc7a" }} onClick={() => updateStatus(id, "dispatched")}>Dispatch</button>}
                              {j.status !== "done" && <button style={{ ...s.tdBtn, color: "#2dcc7a" }} onClick={() => updateStatus(id, "done")}>Done ✓</button>}
                              <button style={{ ...s.tdBtn, color: "#ff7b7b" }} onClick={() => archiveJob(id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center", padding: 24, color: "#3d4668" }}>Walang results</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {page === "pipeline" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Pipeline</h1><span style={{ fontSize: 12, color: "#7b87b8" }}>Real-time · Auto-updates</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                {[["pending","Pending","#f05555"],["dispatched","Dispatched","#4d8ef5"],["on-way","On the Way","#9b78f5"],["on-site","On-Site","#20c8b0"],["done","Done ✓","#2dcc7a"]].map(([status, lbl, col]) => {
                  const pj = jobList.filter(([, j]) => j.status === status);
                  return (
                    <div key={status} style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", minHeight: 180 }}>
                      <div style={{ padding: "8px 12px", borderBottom: "2px solid " + col + "44", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: col }}>{lbl}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: col }}>{pj.length}</span>
                      </div>
                      <div style={{ padding: 7, display: "flex", flexDirection: "column", gap: 5 }}>
                        {pj.map(([id, j]) => (
                          <div key={id} style={{ background: "#111525", border: "1px solid #222840", borderLeft: "3px solid " + col, borderRadius: 8, padding: "8px 10px", cursor: "pointer" }} onClick={() => openEdit(id)}>
                            <div style={{ fontFamily: "monospace", fontSize: 9.5, color: "#7b87b8", marginBottom: 2 }}>{j.jo}</div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{j.client}</div>
                            {j.site && <div style={{ fontSize: 10, color: "#9b78f5", marginTop: 1 }}>{j.site}</div>}
                            <div style={{ fontSize: 10.5, color: "#7b87b8" }}>{j.address?.substring(0, 25)}...</div>
                            {j.lcp && <div style={{ fontSize: 9.5, fontFamily: "monospace", color: "#20c8b0", marginTop: 2 }}>{j.lcp} {j.nap} {j.port}</div>}
                            <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                              <span style={{ ...s.badge, background: TASK_BG[j.type], color: TASK_COLORS[j.type] }}>{j.type?.toUpperCase()}</span>
                              {j.techIds && j.techIds.length > 0 && <span style={{ fontSize: 10, color: "#7b87b8" }}>→ {getCurrentTechNames(j.techIds).split(", ")[0]}</span>}
                            </div>
                          </div>
                        ))}
                        {pj.length === 0 && <div style={{ fontSize: 11, color: "#3d4668", padding: 10, textAlign: "center" }}>Wala</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DISPATCH BOARD */}
          {page === "dispatch" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Dispatch Board</h1></div>
              <div style={s.srow}>
                {[["Kailangan ng Dispatch", counts.pending, "#f05555"], ["Available Techs", Object.values(techs).length, "#2dcc7a"], ["Active", jobList.filter(([, j]) => !["done", "cancelled"].includes(j.status)).length, "#4d8ef5"], ["Done", counts.done, "#20c8b0"]].map(([lbl, val, col]) => (
                  <div key={lbl} style={s.sc}><div style={{ ...s.scTop, background: col }}></div><div style={s.scLbl}>{lbl}</div><div style={{ ...s.scVal, color: col }}>{val}</div></div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
                <div style={s.card}>
                  <div style={s.cardHd}><span style={s.cardTitle}>Needs Dispatch</span></div>
                  {jobList.filter(([, j]) => j.status === "pending").map(([id, j]) => (
                    <div key={id} style={{ padding: "11px 14px", borderBottom: "1px solid #222840", display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 5, marginBottom: 3 }}>
                          <span style={{ ...s.badge, background: TASK_BG[j.type], color: TASK_COLORS[j.type] }}>{j.type?.toUpperCase()}</span>
                          <span style={{ fontSize: 10, color: "#9b78f5", fontWeight: 600 }}>{j.site}</span>
                          {j.priority === "urgent" && <span style={{ fontSize: 9, fontWeight: 800, color: "#f05555" }}>URGENT</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{j.client}</div>
                        <div style={{ fontSize: 11, color: "#7b87b8" }}>{j.address}</div>
                        {j.notes && <div style={{ fontSize: 11, color: "#f0a030" }}>{j.notes}</div>}
                        {j.lcp && <div style={{ fontSize: 10.5, fontFamily: "monospace", color: "#20c8b0" }}>{j.lcp} / {j.nap} / {j.port}</div>}
                      </div>
                      <button style={s.btnPrimary} onClick={() => openEdit(id)}>Assign →</button>
                    </div>
                  ))}
                  {counts.pending === 0 && <div style={s.empty}>Lahat ay dispatched na ✓</div>}
                </div>
                <div style={s.card}>
                  <div style={s.cardHd}><span style={s.cardTitle}>Mga Technician</span></div>
                  {Object.entries(techs).map(([id, t]) => {
                    const mj = jobList.filter(([, j]) => (j.techIds || []).includes(id) && !["done", "cancelled"].includes(j.status)).length;
                    const avatarStyle = {
                      ...s.techAv,
                      background: t.profilePic ? `url(${t.profilePic}) center/cover no-repeat` : t.bg,
                      color: t.profilePic ? "#fff" : t.color,
                      cursor: "pointer",
                      border: t.profilePic ? "2px solid #4d8ef5" : undefined,
                    };
                    return (
                      <div key={id} style={s.techRow}>
                        <div style={avatarStyle} onClick={() => setConfirmDeleteTechId(id)} title="Click to delete this technician">{!t.profilePic && t.initials}</div>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{t.name}</div><div style={{ fontSize: 10, color: "#7b87b8" }}>{t.area}</div></div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 10.5, color: mj > 0 ? "#f0a030" : "#2dcc7a" }}>{mj > 0 ? mj + " active" : "Free"}</div>
                          <div style={{ fontSize: 9, color: "#3d4668", fontFamily: "monospace" }}>login: {t.loginName}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TECHNICIANS */}
          {page === "technicians" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Technicians</h1><button style={s.btnPrimary} onClick={() => setShowAddTechModal(true)}>+ Add Technician</button></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                {Object.entries(techs).map(([id, t]) => {
                  const myJobs = jobList.filter(([, j]) => (j.techIds || []).includes(id) && !["done", "cancelled"].includes(j.status));
                  const done = jobList.filter(([, j]) => (j.techIds || []).includes(id) && j.status === "done").length;
                  const avatarStyle = {
                    ...s.techAv,
                    width: 40,
                    height: 40,
                    fontSize: 13,
                    background: t.profilePic ? `url(${t.profilePic}) center/cover no-repeat` : t.bg,
                    color: t.profilePic ? "#fff" : t.color,
                    cursor: "pointer",
                    border: t.profilePic ? "2px solid #4d8ef5" : undefined,
                  };
                  return (
                    <div key={id} style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={avatarStyle} onClick={() => setConfirmDeleteTechId(id)} title="Click to delete this technician">{!t.profilePic && t.initials}</div>
                        <div><div style={{ fontWeight: 700, fontSize: 14, color: "#dde3ff" }}>{t.name}</div><div style={{ fontSize: 10.5, color: "#7b87b8" }}>{t.spec}</div><div style={{ fontSize: 10.5, color: myJobs.length > 0 ? "#f0a030" : "#2dcc7a", marginTop: 2 }}>● {myJobs.length > 0 ? "On Job" : "Available"}</div></div>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#7b87b8", lineHeight: 1.7 }}>📍 {t.area}<br />📞 {t.contact}<br />🔑 <span style={{ fontFamily: "monospace", color: "#4d8ef5" }}>{t.loginName}</span></div>
                      <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 8, borderTop: "1px solid #222840" }}>
                        <div><div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#f0a030" }}>{myJobs.length}</div><div style={{ fontSize: 10, color: "#7b87b8" }}>Active</div></div>
                        <div><div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#2dcc7a" }}>{done}</div><div style={{ fontSize: 10, color: "#7b87b8" }}>Done</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* REPORTS */}
          {page === "reports" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Reports</h1></div>
              <Reports />
            </div>
          )}

          {/* MATERIALS */}
          {page === "materials" && <Materials />}

          {/* TRASH */}
          {page === "trash" && (
            <div>
              <div style={s.ph}><h1 style={s.h1}>Trash</h1><span style={{ fontSize: 12, color: "#7b87b8" }}>Restore deleted job orders anytime</span></div>
              <div style={s.card}>
                {deletedList.length > 0 ? deletedList.map(([id, job]) => (
                  <div key={id} style={{ padding: "14px 16px", borderBottom: "1px solid #222840" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#dde3ff" }}>{job.client}</div>
                        <div style={{ fontSize: 11, color: "#7b87b8" }}>{job.site} · {job.jo || id}</div>
                      </div>
                      <button style={{ ...s.btnPrimary, background: "#2dcc7a", borderRadius: 8, padding: "6px 12px" }} onClick={() => restoreJob(id)}>Restore</button>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <span style={{ ...s.badge, background: TASK_BG[job.type], color: TASK_COLORS[job.type] }}>{(job.type || "").toUpperCase()}</span>
                      <span style={{ ...s.badge, background: STATUS_BG[job.status], color: STATUS_COLORS[job.status] }}>{(job.status || "").toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#7b87b8", marginTop: 8 }}>{job.notes || "No notes"}</div>
                    <div style={{ fontSize: 10, color: "#3d4668", marginTop: 8, fontFamily: "monospace" }}>Deleted at: {new Date(job.deletedAt).toLocaleString("en-PH")}</div>
                  </div>
                )) : <div style={s.empty}>Trash is empty.</div>}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={s.modalOv} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHd}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#dde3ff" }}>{editJobId ? "Edit Job Order" : "New Job Order"}</h3>
              <button style={s.mx} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.fsec}>Client Info</div>
              <div style={s.f2}><FG label="Account #"><input style={s.fi} value={form.acct} onChange={e => setForm({...form, acct: e.target.value})} placeholder="ACC-0001" /></FG><FG label="Client Name *"><input style={s.fi} value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Juan dela Cruz" /></FG></div>
              <div style={s.f2}><FG label="Contact"><input style={s.fi} value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} placeholder="639XXXXXXXXX" /></FG><FG label="Address"><input style={s.fi} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Blk 15 Lot 20 Cherry St." /></FG></div>
              <div style={s.fsec}>Job Details</div>
              <div style={s.f3}>
                <FG label="Task Type"><select style={s.fi} value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option value="install">INSTALL</option><option value="repair">REPAIR</option><option value="relocate">RELOCATE</option><option value="collection">COLLECTION</option></select></FG>
                <FG label="Site"><select style={s.fi} value={form.site} onChange={e => setForm({...form, site: e.target.value})}>{SITES.map(s => <option key={s}>{s}</option>)}</select></FG>
                <FG label="Priority"><select style={s.fi} value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}><option value="normal">Normal</option><option value="urgent">🔴 Urgent</option></select></FG>
              </div>
              <div style={s.f3}><FG label="LCP"><input style={s.fi} value={form.lcp} onChange={e => setForm({...form, lcp: e.target.value})} placeholder="L1" /></FG><FG label="NAP"><input style={s.fi} value={form.nap} onChange={e => setForm({...form, nap: e.target.value})} placeholder="N2" /></FG><FG label="PORT"><input style={s.fi} value={form.port} onChange={e => setForm({...form, port: e.target.value})} placeholder="P14" /></FG></div>
              <FG label="Notes / Issue"><input style={s.fi} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="LOS / NO NET / FOR RELOCATION..." /></FG>
              <div style={s.f2}><FG label="Scheduled Date"><input style={s.fi} type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></FG><FG label="Assign Technicians (1-3)"><div style={{background:"#111525",border:"1px solid #222840",borderRadius:8,padding:"8px 11px",maxHeight:120,overflowY:"auto"}}>{Object.entries(techs).map(([id,t])=><label key={id} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#dde3ff",marginBottom:4}}><input type="checkbox" checked={form.techIds.includes(id)} onChange={e=>{const ids=e.target.checked?[...form.techIds,id]:form.techIds.filter(x=>x!==id);setForm({...form,techIds:ids})}} style={{margin:0}} />{t.name}</label>)}</div></FG></div>
            </div>
            <div style={s.modalFt}><button style={s.btnGhost} onClick={() => setShowModal(false)}>Cancel</button><button style={s.btnPrimary} onClick={submitJob}>Save Job Order</button></div>
          </div>
        </div>
      )}

      {/* ADD TECHNICIAN MODAL */}
      {showAddTechModal && (
        <div style={s.modalOv} onClick={e => e.target === e.currentTarget && setShowAddTechModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHd}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#dde3ff" }}>Add New Technician</h3>
              <button style={s.mx} onClick={() => setShowAddTechModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.f2}><FG label="Full Name *"><input style={s.fi} value={techForm.name} onChange={e => setTechForm({...techForm, name: e.target.value})} placeholder="Juan dela Cruz" /></FG><FG label="Login Name *"><input style={s.fi} value={techForm.loginName} onChange={e => setTechForm({...techForm, loginName: e.target.value})} placeholder="juan" /></FG></div>
              <div style={s.f2}><FG label="PIN *"><input style={s.fi} value={techForm.pin} onChange={e => setTechForm({...techForm, pin: e.target.value})} placeholder="1234" /></FG><FG label="Area"><input style={s.fi} value={techForm.area} onChange={e => setTechForm({...techForm, area: e.target.value})} placeholder="Socorro / Bancal" /></FG></div>
              <div style={s.f2}><FG label="Contact"><input style={s.fi} value={techForm.contact} onChange={e => setTechForm({...techForm, contact: e.target.value})} placeholder="0917-XXX-XXXX" /></FG><FG label="Specialization"><input style={s.fi} value={techForm.spec} onChange={e => setTechForm({...techForm, spec: e.target.value})} placeholder="FTTH Installation" /></FG></div>
            </div>
            <div style={s.modalFt}><button style={s.btnGhost} onClick={() => setShowAddTechModal(false)}>Cancel</button><button style={s.btnPrimary} onClick={submitNewTech}>Add Technician</button></div>
          </div>
        </div>
      )}

      {confirmDeleteTechId && (
        <div style={s.modalOv} onClick={e => e.target === e.currentTarget && setConfirmDeleteTechId(null)}>
          <div style={{ ...s.modal, width: 420 }}>
            <div style={s.modalHd}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#dde3ff" }}>Delete Technician</h3>
              <button style={s.mx} onClick={() => setConfirmDeleteTechId(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={{ fontSize: 13, color: "#dde3ff", marginBottom: 12 }}>Are you sure you want to remove this technician?</div>
              <div style={{ fontSize: 11, color: "#7b87b8", marginBottom: 16 }}>This will delete the technician from Firebase and remove them from any assigned jobs. Jobs with no remaining techs will be returned to pending.</div>
              <div style={{ background: "#111525", border: "1px solid #222840", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: "#7b87b8" }}>Technician</div>
                <div style={{ fontWeight: 700, color: "#dde3ff", marginTop: 4 }}>{techs[confirmDeleteTechId]?.name || "Unknown"}</div>
                <div style={{ fontSize: 11, color: "#4d8ef5", marginTop: 2 }}>{techs[confirmDeleteTechId]?.loginName || ""}</div>
              </div>
            </div>
            <div style={s.modalFt}>
              <button style={s.btnGhost} onClick={() => setConfirmDeleteTechId(null)}>Cancel</button>
              <button style={{ ...s.btnDanger, minWidth: 120 }} onClick={() => deleteTechnician(confirmDeleteTechId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FG({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}><label style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" }}>{label}</label>{children}</div>;
}

const s = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#07090f", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#dde3ff" },
  tb: { height: 52, background: "#0c0f1a", borderBottom: "1px solid #222840", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 },
  menuBtn: { background: "none", border: "none", color: "#7b87b8", cursor: "pointer", fontSize: 17, padding: 3, lineHeight: 1 },
  logo: { fontSize: 16, fontWeight: 800, letterSpacing: -.5, color: "#dde3ff", whiteSpace: "nowrap" },
  tbDiv: { width: 1, height: 16, background: "#222840" },
  tbRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 },
  livePill: { display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 700, fontFamily: "monospace", color: "#2dcc7a", border: "1px solid #081e13", borderRadius: 4, padding: "3px 8px" },
  ldot: { width: 6, height: 6, borderRadius: "50%", background: "#2dcc7a", display: "inline-block", animation: "blink 1.4s infinite" },
  userAv: { width: 28, height: 28, borderRadius: "50%", background: "#0d1e42", color: "#4d8ef5", border: "1.5px solid #4d8ef5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: 190, flexShrink: 0, background: "#0c0f1a", borderRight: "1px solid #222840", display: "flex", flexDirection: "column", padding: "10px 0", overflowY: "auto" },
  navItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer", color: "#7b87b8", fontSize: 12.5, fontWeight: 500, borderLeft: "2px solid transparent" },
  navActive: { color: "#4d8ef5", background: "#0d1e42", borderLeftColor: "#4d8ef5" },
  navBadge: { marginLeft: "auto", fontFamily: "monospace", fontSize: 9, background: "#2a0a0a", color: "#f05555", padding: "1px 5px", borderRadius: 7 },
  content: { flex: 1, overflowY: "auto", padding: 20 },
  srow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 },
  sc: { background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, padding: "13px 15px", position: "relative", overflow: "hidden" },
  scTop: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  scLbl: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 6 },
  scVal: { fontSize: 26, fontWeight: 700, fontFamily: "monospace", lineHeight: 1 },
  dashGrid: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 },
  card: { background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 14 },
  cardHd: { padding: "10px 14px", borderBottom: "1px solid #222840", display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" },
  cardBtn: { background: "none", border: "none", color: "#4d8ef5", cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  jobRow: { display: "grid", gridTemplateColumns: "70px 80px 70px 1fr 90px 80px", alignItems: "center", gap: 8, padding: "8px 13px", borderBottom: "1px solid #222840", cursor: "pointer" },
  badge: { display: "inline-block", padding: "2px 7px", borderRadius: 3, fontSize: 9.5, fontWeight: 800 },
  techRow: { display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderBottom: "1px solid #222840" },
  techAv: { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 },
  ph: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 },
  h1: { fontSize: 20, fontWeight: 800, letterSpacing: -.5, color: "#dde3ff" },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #222840", flexWrap: "wrap", gap: 7 },
  ftab: { background: "none", border: "1px solid #222840", color: "#7b87b8", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
  ftabActive: { background: "#0d1e42", borderColor: "#4d8ef5", color: "#4d8ef5" },
  searchInput: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "5px 10px", borderRadius: 8, fontFamily: "inherit", fontSize: 11.5, outline: "none", width: 170 },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1000 },
  th: { padding: "7px 10px", background: "#111525", color: "#7b87b8", fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid #222840", textAlign: "left", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #222840", cursor: "pointer" },
  tdMono: { fontFamily: "monospace", fontSize: 10.5, color: "#7b87b8", padding: "8px 10px" },
  tdBtn: { background: "#171c2e", border: "1px solid #222840", color: "#7b87b8", padding: "3px 8px", borderRadius: 4, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" },
  empty: { padding: "20px", textAlign: "center", color: "#3d4668", fontSize: 13 },
  btnPrimary: { background: "#4d8ef5", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  btnGhost: { background: "none", border: "1px solid #222840", color: "#7b87b8", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, cursor: "pointer" },
  modalOv: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" },
  modal: { background: "#0c0f1a", border: "1px solid #2e3450", borderRadius: 16, width: 660, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto" },
  modalHd: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #222840" },
  mx: { background: "none", border: "none", color: "#7b87b8", fontSize: 16, cursor: "pointer" },
  modalBody: { padding: "18px 20px" },
  modalFt: { padding: "12px 20px", borderTop: "1px solid #222840", display: "flex", justifyContent: "flex-end", gap: 8 },
  fsec: { fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#4d8ef5", margin: "14px 0 9px", paddingBottom: 5, borderBottom: "1px solid #222840" },
  f2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 },
  f3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  fi: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "8px 11px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none", width: "100%" },
};