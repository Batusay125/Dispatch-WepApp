import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, update } from "firebase/database";

const STATUS_MAP = {
  pending:       { label: "Pending",         color: "#f0a030", bg: "#2a1805" },
  dispatched:    { label: "Dispatched",       color: "#4d8ef5", bg: "#0d1535" },
  "on-way":      { label: "On the Way",       color: "#9b78f5", bg: "#1a1040" },
  "on-site":     { label: "On-Site",          color: "#20c8b0", bg: "#052220" },
  "for-approval":{ label: "For IT Approval",  color: "#f0a030", bg: "#2a1a05" },
  "configuring": { label: "Configuring...",   color: "#4d8ef5", bg: "#0d1535" },
  "activated":   { label: "Activated ✓",      color: "#2dcc7a", bg: "#081e13" },
  done:          { label: "Done",             color: "#2dcc7a", bg: "#081e13" },
};

export default function ITPortal({ user, onLogout }) {
  const [jobs, setJobs] = useState({});
  const [view, setView] = useState("pending"); // pending | all | history
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [codeNote, setCodeNote] = useState("");
  const [codePass, setCodePass] = useState("");  
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [slowNetIssues, setSlowNetIssues] = useState({});
  const [showPage, setShowPage] = useState("jobs"); // jobs | slownet
  const [selectedSlowNet, setSelectedSlowNet] = useState(null);
  const [slowNetUpdate, setSlowNetUpdate] = useState("");
  const [slowNetSolution, setSlowNetSolution] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const u1 = onValue(ref(db, "jobs"), snap => {
      setJobs(snap.exists() ? snap.val() : {});
    });
    return () => { u1(); };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Only installation jobs
  const installJobs = Object.entries(jobs).filter(([, j]) => j.type === "install");

  const forApproval = installJobs.filter(([, j]) => j.status === "for-approval");
  const activated   = installJobs.filter(([, j]) => j.status === "activated" || j.status === "done");
  const allInstall  = installJobs;

  const filtered = (view === "pending" ? forApproval : view === "history" ? activated : allInstall)
    .filter(([, j]) => !search || j.client?.toLowerCase().includes(search.toLowerCase()) || (j.jo || "").toLowerCase().includes(search.toLowerCase()))
    .reverse();

  async function submitActivation() {
    if (!code.trim()) { alert("Ilagay ang activation code"); return; }
    if (!selected) return;
    setSubmitting(true);
    await update(ref(db, "jobs/" + selected), {
      status: "activated",
      itCode: code.trim(),
      itNote: codeNote.trim(),
      itBy: user.name,
      activatedAt: new Date().toISOString(),
    });
    setSelected(null); setCode(""); setCodeNote(""); setSubmitting(false);
    
    if (!pass.trim()) { alert("Ilagay ang activation code"); return; }
    if (!selected) return;
    setSubmitting(true);
    await update(ref(db, "jobs/" + selected), {
      status: "activated",
      itPass: pass.trim(),
      itNote: codeNote.trim(),
      itBy: user.name,
      activatedAt: new Date().toISOString(),
    });
    setSelected(null); setPass(""); setCodePass(""); setSubmitting(false);    
  }

  async function markConfiguring(jobId) {
    await update(ref(db, "jobs/" + jobId), { status: "configuring", itBy: user.name });
  }

  const selectedJob = selected ? jobs[selected] : null;

  return (
    <div style={s.app}>
      {/* HEADER */}
      <div style={s.header}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <img src="/logo.svg" alt="KeyConnect" style={{height:32,width:32}} />
            <div style={s.logo}>KEY<span style={{ color: "#4d8ef5" }}>CONNECT</span> <span style={{ fontSize: 13, fontWeight: 600, color: "#7b87b8" }}>IT Portal</span></div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.livePill}><span style={s.ldot} />LIVE</div>
          {forApproval.length > 0 && (
            <div style={{ background: "#f05555", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, animation: "blink 1.5s infinite" }}>
              🔔 {forApproval.length} for activation!
            </div>
          )}
          <span style={{ fontSize: 12, color: "#7b87b8" }}>{user.name}</span>
          <button style={s.logoutBtn} onClick={onLogout}>Labas</button>
        </div>
      </div>

      <div style={{ ...s.body, flexDirection: isMobile ? "column" : "row" }}>
        {/* PAGE SWITCHER */}
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid #222840", background: "#0c0f1a" }}>
          <button style={{ ...s.tab, borderBottomColor: "#4d8ef5", color: "#4d8ef5" }}>📋 Job Orders</button>
        </div>

        {/* LEFT PANEL — JOB LIST */}
        {showPage === "jobs" && (
        <div style={{ ...s.leftPanel, width: isMobile ? "100%" : 340, height: isMobile && selected ? "50%" : "auto" }}>
          {/* TABS */}
          <div style={s.tabs}>
            {[["pending", `For Activation (${forApproval.length})`, "#f0a030"],
              ["all", `All Installs (${allInstall.length})`, "#4d8ef5"],
              ["history", `Activated (${activated.length})`, "#2dcc7a"]].map(([key, lbl, col]) => (
              <button key={key} style={{ ...s.tab, ...(view === key ? { borderBottomColor: col, color: col } : {}) }} onClick={() => setView(key)}>{lbl}</button>
            ))}
          </div>

          {/* SEARCH */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #222840" }}>
            <input style={s.searchInput} placeholder="Search client / JO..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* LIST */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 && (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "#3d4668", fontSize: 13 }}>
                {view === "pending" ? "Walang pending activation. ✓" : "Walang results."}
              </div>
            )}
            {filtered.map(([id, j]) => {
              const st = STATUS_MAP[j.status] || STATUS_MAP["pending"];
              const isSelected = selected === id;
              const hasSubmission = !!j.macAddress;
              return (
                <div key={id} style={{ ...s.jobItem, ...(isSelected ? s.jobItemActive : {}), ...(j.status === "for-approval" ? { borderLeft: "3px solid #f0a030" } : {}) }} onClick={() => setSelected(id)}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#7b87b8" }}>{j.jo}</span>
                    <span style={{ ...s.pill, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#dde3ff", marginBottom: 2 }}>{j.client}</div>
                  <div style={{ fontSize: 11, color: "#7b87b8", marginBottom: 3 }}>{j.address}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, color: "#20c8b0" }}>{j.plan || "—"}</span>
                    {hasSubmission && <span style={{ fontSize: 10, background: "#052220", color: "#20c8b0", border: "1px solid #0f5548", padding: "1px 6px", borderRadius: 3 }}>✓ MAC submitted</span>}
                    {j.itCode && <span style={{ fontSize: 10, background: "#081e13", color: "#2dcc7a", border: "1px solid #1a5a2a", padding: "1px 6px", borderRadius: 3 }}>✓ Activated</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#7b87b8", marginTop: 3 }}>Tech: {j.techNames || "Unassigned"} · {j.site || "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* RIGHT PANEL — DETAIL */}
        {showPage === "jobs" && (selected || !isMobile) && (
        <div style={{ ...s.rightPanel, width: isMobile ? "100%" : "auto", height: isMobile ? "50%" : "auto" }}>
          {showPage === "jobs" && !selectedJob ? (
            <div style={s.emptyDetail}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>💻</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#dde3ff", marginBottom: 6 }}>IT Portal</div>
              <div style={{ fontSize: 13, color: "#7b87b8", textAlign: "center", lineHeight: 1.6 }}>
                Piliin ang isang installation job<br />para makita ang details at mag-activate.
              </div>
              {forApproval.length > 0 && (
                <div style={{ marginTop: 20, background: "#2a1805", border: "1px solid #f0a030", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0a030" }}>🔔 {forApproval.length} jobs na naghihintay ng activation!</div>
                  <div style={{ fontSize: 11.5, color: "#7b87b8", marginTop: 4 }}>I-click ang job sa kaliwang panel</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
              {/* JOB HEADER */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#7b87b8", marginBottom: 4 }}>{selectedJob.jo}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#dde3ff", letterSpacing: -.5 }}>{selectedJob.client}</div>
                  <div style={{ fontSize: 12, color: "#7b87b8", marginTop: 3 }}>Site: {selectedJob.site || "—"} · Tech: {selectedJob.techNames || "—"}</div>
                </div>
                <span style={{ ...s.pill, ...(STATUS_MAP[selectedJob.status] || {}), padding: "5px 12px", fontSize: 11 }}>
                  {(STATUS_MAP[selectedJob.status] || {}).label}
                </span>
              </div>

              {/* SECTION: CLIENT INFO FROM ADMIN/MARKETING */}
              <div style={s.section}>
                <div style={s.sectionTitle}>📋 Client Info (from Admin/Marketing)</div>
                <div style={s.infoGrid}>
                  <InfoRow label="Name" value={selectedJob.client} />
                  <InfoRow label="Contact" value={selectedJob.contact} mono />
                  <InfoRow label="Address" value={selectedJob.address} />
                  <InfoRow label="Plan" value={selectedJob.plan} color="#20c8b0" />
                  <InfoRow label="Referral" value={selectedJob.referral || "—"} />
                  <InfoRow label="Install Fee" value={selectedJob.installFee ? "₱" + Number(selectedJob.installFee).toLocaleString() : "—"} color="#2dcc7a" />
                  <InfoRow label="LCP/NAP/Port" value={[selectedJob.lcp, selectedJob.nap, selectedJob.port].filter(Boolean).join(" / ") || "Pending (Tech pa mag-fill)"} color="#7b87b8" />
                  {selectedJob.notes && <InfoRow label="Notes" value={selectedJob.notes} color="#f0a030" />}
                </div>
              </div>

              {/* SECTION: TECH SUBMISSION */}
              {selectedJob.macAddress ? (
                <div style={s.section}>
                  <div style={{ ...s.sectionTitle, color: "#20c8b0" }}>🔧 Tech Submission (On-site Details)</div>
                  <div style={s.infoGrid}>
                    <InfoRow label="Real Name" value={selectedJob.realName || selectedJob.client} />
                    <InfoRow label="Real Address" value={selectedJob.realAddress || selectedJob.address} />
                    <InfoRow label="Contact" value={selectedJob.realContact || selectedJob.contact} mono />
                    <InfoRow label="Plan" value={selectedJob.realPlan || selectedJob.plan} color="#20c8b0" />
                    <InfoRow label="Referral" value={selectedJob.realReferral || "—"} />
                    <InfoRow label="LCP" value={selectedJob.lcp || "—"} color="#20c8b0" mono />
                    <InfoRow label="NAP" value={selectedJob.nap || "—"} color="#20c8b0" mono />
                    <InfoRow label="Port" value={selectedJob.port || "—"} color="#20c8b0" mono />
                    <InfoRow label="MAC Address" value={selectedJob.macAddress} color="#9b78f5" mono big />
                    {selectedJob.modemSerial && <InfoRow label="Modem Serial" value={selectedJob.modemSerial} mono />}
                    {selectedJob.techNotes && <InfoRow label="Tech Notes" value={selectedJob.techNotes} color="#f0a030" />}
                  </div>
                  <div style={{ fontSize: 11, color: "#7b87b8", marginTop: 8, fontFamily: "monospace" }}>
                    Submitted by {selectedJob.techNames} · {selectedJob.macSubmittedAt ? new Date(selectedJob.macSubmittedAt).toLocaleString("en-PH") : ""}
                  </div>
                </div>
              ) : (
                <div style={{ ...s.section, background: "#1a1005", border: "1px solid #5a3808", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0a030", marginBottom: 4 }}>⏳ Waiting for Tech Submission</div>
                  <div style={{ fontSize: 12, color: "#7b87b8" }}>
                    Hindi pa nag-submit ang technician ng MAC Address at installation details.<br />
                    Kapag on-site na ang {selectedJob.techNames || "Tech"} at nakakabit na ang modem, lalabas dito ang details.
                  </div>
                </div>
              )}

              {/* SECTION: IT ACTIVATION */}
              {selectedJob.itCode ? (
                <div style={{ ...s.section, background: "#081e13", border: "1px solid #1a5a2a", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ ...s.sectionTitle, color: "#2dcc7a" }}>✅ Activated</div>
                  <div style={s.infoGrid}>
                    <InfoRow label="Activation Code" value={selectedJob.itCode} color="#2dcc7a" mono big />
                    {selectedJob.itNote && <InfoRow label="IT Notes" value={selectedJob.itNote} />}
                    <InfoRow label="Activated by" value={selectedJob.itBy} />
                    <InfoRow label="Date" value={selectedJob.activatedAt ? new Date(selectedJob.activatedAt).toLocaleString("en-PH") : "—"} mono />
                  </div>
                </div>
              ) : selectedJob.macAddress && (selectedJob.status === "for-approval" || selectedJob.status === "configuring") ? (
                <div style={s.section}>
                  <div style={{ ...s.sectionTitle, color: "#4d8ef5" }}>💻 IT Action Required</div>

                  {selectedJob.status === "for-approval" && (
                    <button style={{ ...s.actionBtn, background: "#0d1535", border: "1px solid #4d8ef5", color: "#4d8ef5", marginBottom: 12, fontSize: 13 }} onClick={() => markConfiguring(selected)}>
                      ▶ Start Configuring Modem
                    </button>
                  )}

                  {selectedJob.status === "configuring" && (
                    <div style={{ background: "#0d1535", border: "1px solid #4d8ef5", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#4d8ef5" }}>
                      ⚙ Configuring... I-input ang activation code kapag done na.
                    </div>
                  )}

                  {/* MAC ADDRESS DISPLAY BIG */}
                  <div style={{ background: "#111525", border: "1px solid #9b78f5", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 6 }}>MAC Address to Configure</div>
                    <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "#9b78f5", letterSpacing: 2 }}>{selectedJob.macAddress}</div>
                    {selectedJob.modemSerial && <div style={{ fontFamily: "monospace", fontSize: 12, color: "#7b87b8", marginTop: 4 }}>Serial: {selectedJob.modemSerial}</div>}
                    <div style={{ fontSize: 11, color: "#7b87b8", marginTop: 6 }}>Plan: <span style={{ color: "#20c8b0", fontWeight: 700 }}>{selectedJob.realPlan || selectedJob.plan}</span></div>
                  </div>

                  {/* ACTIVATION CODE INPUT */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={s.lbl}>Activation Code / USERNAME</label>
                    <input
                      style={{ ...s.fi, fontSize: 15, fontFamily: "monospace", letterSpacing: 1, fontWeight: 700 }}
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="e.g. L1N1P1@1000123 USERNAME"
                    />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={s.lbl}>Activation Code / PASSWORD</label>
                    <input
                      style={{ ...s.fi, fontSize: 15, fontFamily: "monospace", letterSpacing: 1, fontWeight: 700 }}
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      placeholder="e.g. 1A2B3C4D5E6F MAC"
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={s.lbl}>IT Notes (optional)</label>
                    <textarea
                      style={{ ...s.fi, minHeight: 70, resize: "vertical" }}
                      value={codeNote}
                      onChange={e => setCodeNote(e.target.value)}
                      placeholder="Additional config notes para sa tech..."
                    />
                  </div>
                  <button style={{ ...s.actionBtn, background: "#2dcc7a" }} onClick={submitActivation} disabled={submitting}>
                    {submitting ? "Submitting..." : "✅ Submit Activation Code"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, color, big }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" }}>{label}</div>
      <div style={{ fontSize: big ? 16 : 13, fontFamily: mono ? "monospace" : "inherit", color: color || "#dde3ff", fontWeight: big ? 700 : 500, letterSpacing: mono && big ? 1 : 0 }}>{value || "—"}</div>
    </div>
  );
}

const s = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#07090f", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#dde3ff" },
  header: { height: 52, background: "#0c0f1a", borderBottom: "1px solid #222840", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 },
  logo: { fontSize: 17, fontWeight: 800, letterSpacing: -.5, color: "#dde3ff" },
  livePill: { display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: "#20c8b0", border: "1px solid #052220", borderRadius: 4, padding: "3px 8px" },
  ldot: { width: 6, height: 6, borderRadius: "50%", background: "#20c8b0", display: "inline-block", animation: "blink 1.4s infinite" },
  logoutBtn: { background: "none", border: "1px solid #222840", color: "#7b87b8", padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  leftPanel: { width: 340, flexShrink: 0, background: "#0c0f1a", borderRight: "1px solid #222840", display: "flex", flexDirection: "column", overflow: "hidden" },
  rightPanel: { flex: 1, overflowY: "auto", background: "#07090f" },
  tabs: { display: "flex", borderBottom: "1px solid #222840" },
  tab: { flex: 1, padding: "10px 8px", background: "none", border: "none", borderBottom: "2px solid transparent", color: "#7b87b8", cursor: "pointer", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", transition: "all .15s" },
  searchInput: { width: "100%", background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "7px 11px", borderRadius: 8, fontFamily: "inherit", fontSize: 12, outline: "none" },
  jobItem: { padding: "12px 14px", borderBottom: "1px solid #222840", cursor: "pointer", transition: "background .1s", borderLeft: "3px solid transparent" },
  jobItemActive: { background: "#111525", borderLeftColor: "#20c8b0" },
  pill: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 },
  emptyDetail: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 32, color: "#7b87b8" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4d8ef5", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #222840" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" },
  actionBtn: { width: "100%", padding: "14px", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  lbl: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8", display: "block", marginBottom: 5 },
  fi: { width: "100%", background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "9px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none" },
  filab: { width: "100%", background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "9px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none" },
  btn: { padding: "10px 16px", borderRadius: 8, border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#fff" },
  listItem: { padding: "12px 14px", borderBottom: "1px solid #222840", cursor: "pointer" },
};