import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, update, get, runTransaction, push } from "firebase/database";
import { buildPortKey, activatePort, reservePort } from "./portDb";

const STATUS_MAP = {
  pending:        { label: "Pending",          color: "#f0a030", bg: "#2a1805" },
  dispatched:     { label: "Dispatched",        color: "#4d8ef5", bg: "#0d1535" },
  "on-way":       { label: "On the Way",        color: "#9b78f5", bg: "#1a1040" },
  "on-site":      { label: "On-Site",           color: "#20c8b0", bg: "#052220" },
  "for-approval": { label: "For IT Approval",   color: "#f0a030", bg: "#2a1a05" },
  configuring:    { label: "Configuring...",    color: "#4d8ef5", bg: "#0d1535" },
  activated:      { label: "Activated ✓",       color: "#2dcc7a", bg: "#081e13" },
  done:           { label: "Done",              color: "#2dcc7a", bg: "#081e13" },
};

// Auto-generate username from job data
// Format: LCP + NAP + PORT + @1000 + last 6 of job key
function generateUsername(j, jobId) {
  const lcp = (j.lcp || "").replace(/\s/g, "").toUpperCase();
  const nap = (j.nap || "").replace(/\s/g, "").toUpperCase();
  const port = (j.port || "").replace(/\s/g, "").toUpperCase();
  const seq = jobId ? jobId.slice(-6).toUpperCase() : "000001";
  return `${lcp}${nap}${port}@1000${seq}`;
}

export default function ITPortal({ user, onLogout }) {
  const [jobs, setJobs] = useState({});
  const [view, setView] = useState("pending"); // pending | all | history
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [copied,   setCopied]   = useState("");
  const [editUser, setEditUser] = useState("");
  const [editPass, setEditPass] = useState("");

  useEffect(() => {
    return onValue(ref(db, "jobs"), snap => {
      setJobs(snap.exists() ? snap.val() : {});
    });
  }, []);

  const installJobs = Object.entries(jobs).filter(([, j]) => j.type === "install");
  const forApproval = installJobs.filter(([, j]) => j.status === "for-approval");
  const activated   = installJobs.filter(([, j]) => j.status === "activated" || j.status === "done");
  const allInstall  = installJobs;

  const listSource = view === "pending" ? forApproval : view === "history" ? activated : allInstall;
  const filteredList = listSource
    .filter(([, j]) => !search || j.client?.toLowerCase().includes(search.toLowerCase()) || (j.jo || "").toLowerCase().includes(search.toLowerCase()))
    .reverse();

  const selectedJob = selected ? jobs[selected] : null;

  // Auto-generated credentials from job data
  const generatedUsername = selectedJob ? generateUsername(selectedJob, selected) : "";
  const generatedPassword = selectedJob?.macAddress || ""; // MAC address = password

  async function startConfiguring(jobId) {
    await update(ref(db, "jobs/" + jobId), {
      status: "configuring",
      itBy: user.name,
      itUsername: editUser || generateUsername(jobs[jobId], jobId),
      itPassword: editPass || jobs[jobId]?.macAddress || "",
      updatedAt: new Date().toISOString(),
    });
  }

  async function submitActivation() {
    if (!selected) return;
    if (!editUser.trim()) { alert("Ilagay ang Username"); return; }
    if (!editPass.trim()) { alert("Ilagay ang Password"); return; }

    // Port conflict check — block if already USED by another client
    if (selectedJob?.lcp && selectedJob?.nap && selectedJob?.port) {
      const portKey = buildPortKey(selectedJob.lcp, selectedJob.nap, selectedJob.port);
      const snap = await get(ref(db,`portIndex/${portKey}`));
      if (snap.exists()) {
        const p = snap.val();
        if (p.status === "used" && p.jobId !== selected) {
          alert(`⛔ Port ${portKey} is already USED by ${p.clientName||"another client"}!\nHindi pwedeng mag-activate. I-check ang port assignment.`);
          return;
        }
      }
    }

    setSubmitting(true);
    const itData = {
      lcp: selectedJob.lcp, nap: selectedJob.nap, port: selectedJob.port,
      itUsername: editUser.trim(), itPassword: editPass.trim(), itBy: user.name,
    };
    const portKey = selectedJob.lcp && selectedJob.nap && selectedJob.port
      ? buildPortKey(selectedJob.lcp, selectedJob.nap, selectedJob.port) : null;

    // Update job + create installation record + mark port as used
    if (portKey) {
      await activatePort(portKey, selectedJob, selected, itData);
    }
    await update(ref(db, "jobs/" + selected), {
      status: "activated",
      itUsername: editUser.trim(),
      itPassword: editPass.trim(),
      itBy: user.name,
      activatedAt: new Date().toISOString(),
    });
    setPortStatus({ status:"used", clientName: selectedJob.client });
    setSubmitting(false);
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  return (
    <div style={s.app}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.logo}>KEY<span style={{ color: "#20c8b0" }}>CONNECT</span></div>
          <span style={{ fontSize: 12, color: "#7b87b8", fontWeight: 600 }}>IT Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.livePill}><span style={s.ldot} />LIVE</div>
          {forApproval.length > 0 && (
            <div style={{ background: "#f05555", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11.5, fontWeight: 700 }}>
              🔔 {forApproval.length} for activation!
            </div>
          )}
          <span style={{ fontSize: 12, color: "#7b87b8" }}>{user.name}</span>
          <button style={s.logoutBtn} onClick={onLogout}>Labas</button>
        </div>
      </div>

      <div style={s.body}>
        {/* LEFT PANEL */}
        <div style={s.leftPanel}>
          <div style={s.tabs}>
            {[
              ["pending",  `For Activation (${forApproval.length})`, "#f0a030"],
              ["all",      `All Installs (${allInstall.length})`,    "#4d8ef5"],
              ["history",  `Activated (${activated.length})`,        "#2dcc7a"],
            ].map(([key, lbl, col]) => (
              <button key={key} style={{ ...s.tab, ...(view === key ? { borderBottomColor: col, color: col } : {}) }} onClick={() => setView(key)}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #222840" }}>
            <input style={s.searchInput} placeholder="Search client / JO..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filteredList.length === 0 && (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "#3d4668", fontSize: 13 }}>
                {view === "pending" ? "Walang pending activation ✓" : "Walang results."}
              </div>
            )}
            {filteredList.map(([id, j]) => {
              const st = STATUS_MAP[j.status] || STATUS_MAP["pending"];
              const isSelected = selected === id;
              return (
                <div key={id}
                  style={{ ...s.jobItem, ...(isSelected ? s.jobItemActive : {}), ...(j.status === "for-approval" ? { borderLeft: "3px solid #f0a030" } : {}) }}
                  onClick={async() => {
                    setSelected(id);
                    setEditUser(generateUsername(j,id));
                    setEditPass(j.macAddress||"");
                    setCopied("");
                    setPortStatus(null);
                    if (j.lcp && j.nap && j.port) {
                      setPortChecking(true);
                      const key = buildPortKey(j.lcp, j.nap, j.port);
                      const snap = await get(ref(db,`portIndex/${key}`));
                      setPortStatus(snap.exists() ? snap.val() : { status:"unregistered" });
                      setPortChecking(false);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#7b87b8" }}>{j.jo}</span>
                    <span style={{ ...s.pill, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#dde3ff", marginBottom: 2 }}>{j.client}</div>
                  <div style={{ fontSize: 11, color: "#7b87b8", marginBottom: 3 }}>{j.address}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, color: "#20c8b0" }}>{j.plan || "—"}</span>
                    {j.macAddress && <span style={{ fontSize: 10, background: "#052220", color: "#20c8b0", border: "1px solid #0f5548", padding: "1px 6px", borderRadius: 3 }}>✓ MAC ready</span>}
                    {j.status === "activated" || j.status === "done" ? <span style={{ fontSize: 10, background: "#081e13", color: "#2dcc7a", border: "1px solid #1a5a2a", padding: "1px 6px", borderRadius: 3 }}>✓ Activated</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={s.rightPanel}>
          {!selectedJob ? (
            <div style={s.emptyDetail}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>💻</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#dde3ff", marginBottom: 6 }}>IT Portal</div>
              <div style={{ fontSize: 13, color: "#7b87b8", textAlign: "center", lineHeight: 1.6 }}>
                Piliin ang isang installation job<br />para makita ang details at mag-activate.
              </div>
              {forApproval.length > 0 && (
                <div style={{ marginTop: 20, background: "#2a1805", border: "1px solid #f0a030", borderRadius: 10, padding: "14px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0a030" }}>🔔 {forApproval.length} jobs naghihintay ng activation!</div>
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
                  <div style={{ fontSize: 12, color: "#7b87b8", marginTop: 3 }}>
                    Site: {selectedJob.site || "—"} · Tech: {selectedJob.techNames || selectedJob.techName || "—"}
                  </div>
                </div>
                <span style={{ ...s.pill, ...(STATUS_MAP[selectedJob.status] || {}), padding: "5px 12px", fontSize: 11 }}>
                  {(STATUS_MAP[selectedJob.status] || {}).label}
                </span>
              </div>

              {/* CLIENT INFO FROM ADMIN */}
              <Section title="📋 Client Info (from Admin/Marketing)">
                <InfoGrid>
                  <InfoRow label="Name" value={selectedJob.client} />
                  <InfoRow label="Contact" value={selectedJob.contact} mono />
                  <InfoRow label="Address" value={selectedJob.address} full />
                  <InfoRow label="Plan" value={selectedJob.plan} color="#20c8b0" />
                  <InfoRow label="Referral" value={selectedJob.referral || "—"} />
                  <InfoRow label="Install Fee" value={selectedJob.installFee ? "₱" + Number(selectedJob.installFee).toLocaleString() : "—"} color="#2dcc7a" />
                </InfoGrid>
              </Section>

              {/* TECH SUBMISSION */}
              {selectedJob.macAddress ? (
                <Section title="🔧 Tech Submission (On-site Details)">
                  <InfoGrid>
                    <InfoRow label="Real Name" value={selectedJob.realName || selectedJob.client} />
                    <InfoRow label="Contact" value={selectedJob.realContact || selectedJob.contact} mono />
                    <InfoRow label="Real Address" value={selectedJob.realAddress || selectedJob.address} full />
                    <InfoRow label="Plan" value={selectedJob.realPlan || selectedJob.plan} color="#20c8b0" />
                    <InfoRow label="Referral" value={selectedJob.realReferral || "—"} />
                    <InfoRow label="LCP" value={selectedJob.lcp || "—"} color="#20c8b0" mono />
                    <InfoRow label="NAP" value={selectedJob.nap || "—"} color="#20c8b0" mono />
                    <InfoRow label="Port" value={selectedJob.port || "—"} color="#20c8b0" mono />
                    {selectedJob.modemSerial && <InfoRow label="Modem Serial" value={selectedJob.modemSerial} mono />}
                    {selectedJob.techNotes && <InfoRow label="Tech Notes" value={selectedJob.techNotes} color="#f0a030" full />}
                  </InfoGrid>
                  <div style={{ fontSize: 11, color: "#7b87b8", marginTop: 6, fontFamily: "monospace" }}>
                    Submitted by {selectedJob.techNames || selectedJob.techName} ·{" "}
                    {selectedJob.macSubmittedAt ? new Date(selectedJob.macSubmittedAt).toLocaleString("en-PH") : ""}
                  </div>
                </Section>
              ) : (
                <div style={{ background: "#1a1005", border: "1px solid #5a3808", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0a030", marginBottom: 4 }}>⏳ Waiting for Tech Submission</div>
                  <div style={{ fontSize: 12, color: "#7b87b8" }}>
                    Hindi pa nag-submit ng MAC Address ang technician. Kapag on-site na sila at nakakabit ang modem, lalabas dito ang details.
                  </div>
                </div>
              )}

              {/* CREDENTIALS SECTION */}
              {selectedJob.macAddress && (selectedJob.status === "for-approval" || selectedJob.status === "configuring" || selectedJob.status === "activated") && (
                <Section title="🔐 Internet Credentials (Ibibigay sa Tech)">

                  {/* Port Status Banner */}
                  {(()=>{
                    const portKey = selectedJob.lcp&&selectedJob.nap&&selectedJob.port
                      ? buildPortKey(selectedJob.lcp,selectedJob.nap,selectedJob.port) : null;
                    if (!portKey) return null;
                    if (portChecking) return (
                      <div style={{background:"#111525",border:"1px solid #222840",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#7b87b8"}}>
                        ⏳ Checking port {portKey}...
                      </div>
                    );
                    if (!portStatus) return (
                      <div style={{background:"#2a1805",border:"1px solid #f0a03044",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#f0a030"}}>
                        ⚠ Port {portKey} — hindi naka-register sa Port Index. Hindi ma-track.
                      </div>
                    );
                    const pStyle = {
                      available:{bg:"#081e13",border:"#2dcc7a",color:"#2dcc7a",icon:"○",msg:"Available — pwedeng i-activate"},
                      reserved: {bg:"#2a1805",border:"#f0a030",color:"#f0a030",icon:"◌",msg:"Reserved para sa job na ito"},
                      used:     {bg:"#0d1535",border:"#4d8ef5",color:"#4d8ef5",icon:"●",msg:portStatus.clientName?`Used — ${portStatus.clientName}`:"Used"},
                      unregistered:{bg:"#111525",border:"#7b87b8",color:"#7b87b8",icon:"?",msg:"Hindi registered sa Port Index"},
                    }[portStatus.status]||{bg:"#111525",border:"#222840",color:"#7b87b8",icon:"?",msg:portStatus.status};
                    return (
                      <div style={{background:pStyle.bg,border:`1px solid ${pStyle.border}44`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16,color:pStyle.color}}>{pStyle.icon}</span>
                        <div style={{flex:1}}>
                          <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:pStyle.color}}>{portKey}</span>
                          <span style={{fontSize:11,color:"#7b87b8",marginLeft:8}}>{pStyle.msg}</span>
                        </div>
                        {portStatus.status==="used"&&portStatus.jobId!==selected&&(
                          <span style={{background:"#f05555",color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>⛔ CONFLICT</span>
                        )}
                        {portStatus.status==="available"||portStatus.status==="reserved"||portStatus.status==="unregistered" ? null : null}
                      </div>
                    );
                  })()}

                  {/* EDITABLE USERNAME */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 6 }}>
                      USERNAME <span style={{ color: "#4d8ef5", fontWeight: 600 }}>· pwede i-edit kapag nagkamali</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ flex: 1, background: "#111525", border: "1.5px solid #4d8ef5", borderRadius: 10, padding: "12px 16px", fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#4d8ef5", outline: "none", letterSpacing: 1 }}
                        value={editUser}
                        onChange={e => setEditUser(e.target.value)}
                        placeholder="Username..."
                      />
                      <button style={s.copyBtn} onClick={() => copyToClipboard(editUser, "username")}>
                        {copied === "username" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#7b87b8", marginTop: 5 }}>
                      Auto-generated: {selectedJob.lcp}{selectedJob.nap}{selectedJob.port}@1000{selected?.slice(-6).toUpperCase()} · I-edit kung kailangan
                    </div>
                  </div>

                  {/* EDITABLE PASSWORD */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 6 }}>
                      PASSWORD <span style={{ color: "#9b78f5", fontWeight: 600 }}>· MAC Address · pwede i-edit kapag may typo</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ flex: 1, background: "#111525", border: "1.5px solid #9b78f5", borderRadius: 10, padding: "12px 16px", fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#9b78f5", outline: "none", letterSpacing: 2 }}
                        value={editPass}
                        onChange={e => setEditPass(e.target.value)}
                        placeholder="XX:XX:XX:XX:XX:XX"
                      />
                      <button style={{ ...s.copyBtn, borderColor: "#9b78f5", color: "#9b78f5" }} onClick={() => copyToClipboard(editPass, "password")}>
                        {copied === "password" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#7b87b8", marginTop: 5 }}>
                      Mula sa MAC Address ng modem na ibinigay ng tech · I-edit kung may typo
                    </div>
                  </div>

                  {/* SUMMARY BOX */}
                  <div style={{ background: "#0d1535", border: "1px solid #4d8ef5", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4d8ef5", marginBottom: 10 }}>
                      📤 Credentials na Ibibigay sa Tech
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 12px", alignItems: "start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#7b87b8" }}>Username:</span>
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#4d8ef5", wordBreak: "break-all" }}>{editUser || "—"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#7b87b8" }}>Password:</span>
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#9b78f5", wordBreak: "break-all" }}>{editPass || "—"}</span>
                    </div>
                    <button style={{ ...s.copyBtn, marginTop: 12, width: "100%", justifyContent: "center", background: "#1a2a50" }}
                      onClick={() => copyToClipboard(`Username: ${editUser}\nPassword: ${editPass}`, "both")}>
                      {copied === "both" ? "✓ Copied Both!" : "📋 Copy Username + Password"}
                    </button>
                  </div>

                  {/* ACTION BUTTONS */}
                  {selectedJob.status === "for-approval" && (
                    <button style={{ ...s.actionBtn, background: "#0d1535", border: "1px solid #4d8ef5", color: "#4d8ef5", marginBottom: 10, fontSize: 13 }}
                      onClick={() => startConfiguring(selected)}>
                      ▶ Start Configuring Modem
                    </button>
                  )}
                  {selectedJob.status === "configuring" && (
                    <div style={{ background: "#0d1535", border: "1px solid #4d8ef5", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#4d8ef5" }}>
                      ⚙ Configuring... I-configure ang modem gamit ang credentials sa itaas.
                    </div>
                  )}
                  {(selectedJob.status === "for-approval" || selectedJob.status === "configuring") && (
                    <button style={{ ...s.actionBtn, background: "#2dcc7a" }} onClick={submitActivation} disabled={submitting}>
                      {submitting ? "Submitting..." : "✅ Mark as Activated — Credentials Sent"}
                    </button>
                  )}
                </Section>
              )}

              {/* ALREADY ACTIVATED */}
              {selectedJob.status === "activated" || selectedJob.status === "done" ? (
                <div style={{ background: "#081e13", border: "1px solid #1a5a2a", borderRadius: 10, padding: "16px 18px", marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2dcc7a", marginBottom: 12 }}>✅ Activated</div>
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7b87b8" }}>Username:</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#4d8ef5", wordBreak: "break-all" }}>{selectedJob.itUsername || generatedUsername}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7b87b8" }}>Password:</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#9b78f5", wordBreak: "break-all" }}>{selectedJob.itPassword || selectedJob.macAddress}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7b87b8" }}>IT Staff:</span>
                    <span style={{ fontSize: 13, color: "#dde3ff" }}>{selectedJob.itBy}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7b87b8" }}>Date:</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#7b87b8" }}>{selectedJob.activatedAt ? new Date(selectedJob.activatedAt).toLocaleString("en-PH") : "—"}</span>
                  </div>
                </div>
              ) : null}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4d8ef5", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #222840" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>{children}</div>;
}

function InfoRow({ label, value, mono, color, full }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10, gridColumn: full ? "1/-1" : "auto" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: mono ? "monospace" : "inherit", color: color || "#dde3ff", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

const s = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#07090f", fontFamily: "'Plus Jakarta Sans',sans-serif", color: "#dde3ff" },
  header: { height: 52, background: "#0c0f1a", borderBottom: "1px solid #222840", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 },
  logo: { fontSize: 17, fontWeight: 800, letterSpacing: -.5, color: "#dde3ff" },
  livePill: { display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: "#20c8b0", border: "1px solid #052220", borderRadius: 4, padding: "3px 8px" },
  ldot: { width: 6, height: 6, borderRadius: "50%", background: "#20c8b0", display: "inline-block", animation: "blink 1.4s infinite" },
  logoutBtn: { background: "none", border: "1px solid #222840", color: "#7b87b8", padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  leftPanel: { width: 320, flexShrink: 0, background: "#0c0f1a", borderRight: "1px solid #222840", display: "flex", flexDirection: "column", overflow: "hidden" },
  rightPanel: { flex: 1, overflowY: "auto", background: "#07090f" },
  tabs: { display: "flex", borderBottom: "1px solid #222840" },
  tab: { flex: 1, padding: "10px 8px", background: "none", border: "none", borderBottom: "2px solid transparent", color: "#7b87b8", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" },
  searchInput: { width: "100%", background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "7px 11px", borderRadius: 8, fontFamily: "inherit", fontSize: 12, outline: "none" },
  jobItem: { padding: "12px 14px", borderBottom: "1px solid #222840", cursor: "pointer", borderLeft: "3px solid transparent" },
  jobItemActive: { background: "#111525", borderLeftColor: "#20c8b0" },
  pill: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 },
  emptyDetail: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 32, color: "#7b87b8" },
  copyBtn: { background: "#0d1e42", border: "1px solid #4d8ef5", color: "#4d8ef5", padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 },
  actionBtn: { width: "100%", padding: "14px", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
};