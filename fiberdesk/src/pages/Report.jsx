import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue } from "firebase/database";
import * as XLSX from "xlsx-js-style";

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "1A5A2A" } }, // green header
  alignment: { horizontal: "center" }
};

const moneyStyle = {
  numFmt: '"₱"#,##0.00',
  font: { bold: true, color: { rgb: "2DCC7A" } }
};

const totalStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "4D8EF5" } } // blue total row
};

export default function Reports() {
  const [jobs, setJobs] = useState({});
  const [techs, setTechs] = useState({});
  const [reportType, setReportType] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedSite, setSelectedSite] = useState("All");
  const [selectedTech, setSelectedTech] = useState("All");

  useEffect(() => {
    const u1 = onValue(ref(db, "jobs"), s => setJobs(s.exists() ? s.val() : {}));
    const u2 = onValue(ref(db, "technicians"), s => setTechs(s.exists() ? s.val() : {}));
    return () => { u1(); u2(); };
  }, []);

  const SITES = ["All", "Server", "Lawa", "Bancal", "Socorro", "Lias", "Loma", "Bahay Pare", "Malolos"];

  function getFilteredJobs() {
    return Object.entries(jobs).filter(([, j]) => {
      const dateMatch = reportType === "daily"
        ? j.date === selectedDate || j.updatedAt?.startsWith(selectedDate)
        : (j.date?.startsWith(selectedMonth) || j.updatedAt?.startsWith(selectedMonth));
      const siteMatch = selectedSite === "All" || j.site === selectedSite;
      const techMatch = selectedTech === "All" || j.techId === selectedTech;
      return dateMatch && siteMatch && techMatch;
    });
  }

  const filtered = getFilteredJobs();
  const doneJobs = filtered.filter(([, j]) => j.status === "done");
  const totalMaterials = doneJobs.reduce((a, [, j]) => a + (j.materialsTotal || 0), 0);
  const totalJobs = filtered.length;

  // Group by site
  const bySite = {};
  filtered.forEach(([, j]) => {
    const site = j.site || "Unknown";
    if (!bySite[site]) bySite[site] = [];
    bySite[site].push(j);
  });

  // Group by tech
  const byTech = {};
  filtered.forEach(([, j]) => {
    const tn = j.techNames || "Unassigned";
    if (!byTech[tn]) byTech[tn] = [];
    byTech[tn].push(j);
  });

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Job Orders


    const jobRows = filtered.map(([id, j]) => ({
      "JO #": j.jo || id.slice(-6),
      "Date": j.date || "",
      "Site": j.site || "",
      "Task Type": (j.type || "").toUpperCase(),
      "Status": (j.status || "").toUpperCase(),
      "Client": j.client || "",
      "Address": j.address || "",
      "Contact": j.contact || "",
      "LCP": j.lcp || "",
      "NAP": j.nap || "",
      "Port": j.port || "",
      "Technician": j.techNames || "",
      "Notes": j.notes || "",
      "Materials Total (₱)": j.materialsTotal || 0,
    }));
    const ws1 = XLSX.utils.json_to_sheet(jobRows);

    const totalRow = jobRows.length + 1;

    // TOTAL LABEL
    ws1[`N${totalRow + 1}`] = { v: "TOTAL:", s: totalStyle };

    // TOTAL FORMULA
    ws1[`O${totalRow + 1}`] = {
    f: `SUM(O2:O${totalRow})`,
    s: totalStyle
   };

    // PESO FORMAT
    for (let i = 2; i <= totalRow; i++) {
     if (ws1[`O${i}`]) {
      ws1[`O${i}`].z = '"₱"#,##0.00';
    }
  }
    const range = XLSX.utils.decode_range(ws1['!ref']);

    // Apply header style
    for (let C = range.s.c; C <= range.e.c; ++C) {
     const cell = ws1[XLSX.utils.encode_cell({ r: 0, c: C })];
     if (cell) cell.s = headerStyle;
    }
    ws1["!cols"] = [10,10,12,12,12,20,30,15,8,8,8,20,20,15].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, "Job Orders");

    // Sheet 2: Materials Used
    const matRows = [];
    doneJobs.forEach(([, j]) => {
      if (j.materialsUsed?.length) {
        j.materialsUsed.forEach(m => {
          matRows.push({
            "Date": j.date || "",
            "JO #": j.jo || "",
            "Site": j.site || "",
            "Client": j.client || "",
            "Technician": j.techNames || "",
            "Material": m.name || "",
            "Unit": m.unit || "",
            "Qty": m.qty || 0,
            "Unit Price (₱)": m.price || 0,
            "Total (₱)": (m.price || 0) * (m.qty || 0),
          });
        });
      }
    });
    if (matRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(matRows);
      ws2["!cols"] = [10,10,12,20,18,25,8,8,12,12].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws2, "Materials Used");
      
      const range2 = XLSX.utils.decode_range(ws2['!ref']);

      for (let C = range2.s.c; C <= range2.e.c; ++C) {
        const cell = ws2[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (cell) cell.s = headerStyle;
      }
      const matTotal = matRows.length + 1;

       ws2[`I${matTotal + 1}`] = { v: "TOTAL:", s: totalStyle };
       ws2[`J${matTotal + 1}`] = {
       f: `SUM(J2:J${matTotal})`,
        s: totalStyle
      };

      for (let i = 2; i <= matTotal; i++) {
       if (ws2[`I${i}`]) ws2[`I${i}`].z = '"₱"#,##0.00';
       if (ws2[`J${i}`]) ws2[`J${i}`].z = '"₱"#,##0.00';
      }
    }

    // Sheet 3: Summary by Site
    const siteRows = Object.entries(bySite).map(([site, sjobs]) => ({
      "Site": site,
      "Total Jobs": sjobs.length,
      "Done": sjobs.filter(j => j.status === "done").length,
      "Pending": sjobs.filter(j => j.status === "pending").length,
      "Install": sjobs.filter(j => j.type === "install").length,
      "Repair": sjobs.filter(j => j.type === "repair").length,
      "Relocate": sjobs.filter(j => j.type === "relocate").length,
      "Collection": sjobs.filter(j => j.type === "collection").length,
      "Materials Cost (₱)": sjobs.reduce((a, j) => a + (j.materialsTotal || 0), 0),
    }));
    const ws3 = XLSX.utils.json_to_sheet(siteRows);
    ws3["!cols"] = [14,10,8,10,10,10,10,12,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, "Summary by Site");

    // Sheet 4: Summary by Technician
    const techRows = Object.entries(byTech).map(([tn, tjobs]) => ({
      "Technician": tn,
      "Total Jobs": tjobs.length,
      "Done": tjobs.filter(j => j.status === "done").length,
      "Install": tjobs.filter(j => j.type === "install").length,
      "Repair": tjobs.filter(j => j.type === "repair").length,
      "Relocate": tjobs.filter(j => j.type === "relocate").length,
      "Collection": tjobs.filter(j => j.type === "collection").length,
      "Materials Cost (₱)": tjobs.reduce((a, j) => a + (j.materialsTotal || 0), 0),
    }));
    const ws4 = XLSX.utils.json_to_sheet(techRows);
    ws4["!cols"] = [20,10,8,10,10,10,12,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws4, "Summary by Tech");

    const label = reportType === "daily" ? selectedDate : selectedMonth;
    XLSX.writeFile(wb, `FiberDesk_Report_${label}.xlsx`);
  }

  function printReport() { window.print(); }

  const statusColors = { pending: "#f0a030", dispatched: "#4d8ef5", "on-way": "#9b78f5", "on-site": "#20c8b0", done: "#2dcc7a" };
  const taskColors = { install: "#4dff88", repair: "#ff8c3d", relocate: "#7db8ff", collection: "#ffc04d" };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* PRINT STYLES */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { background: white !important; border: 1px solid #ccc !important; border-radius: 8px; page-break-inside: avoid; }
          .print-header { background: #1a5a2a !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; }
          th { background: #1a5a2a !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 5px 8px; }
          td { padding: 4px 8px; border: 1px solid #ddd; color: black !important; }
          tr:nth-child(even) td { background: #f5fff5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm; size: A4 landscape; }
        }
      `}</style>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }} className="no-print">
        <div style={{ display: "flex", gap: 4 }}>
          {["daily","monthly"].map(t => (
            <button key={t} style={{ background: reportType === t ? "#4d8ef5" : "none", border: "1px solid", borderColor: reportType === t ? "#4d8ef5" : "#222840", color: reportType === t ? "#fff" : "#7b87b8", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }} onClick={() => setReportType(t)}>
              {t === "daily" ? "Daily" : "Monthly"}
            </button>
          ))}
        </div>
        {reportType === "daily"
          ? <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={fs.filter} />
          : <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={fs.filter} />}
        <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)} style={fs.filter}>
          {SITES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)} style={fs.filter}>
          <option value="All">All Technicians</option>
          {Object.entries(techs).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ ...fs.btnExcel }} onClick={exportExcel}>⬇ Export Excel</button>
          <button style={{ ...fs.btnPrint }} onClick={printReport}>🖨 Print</button>
        </div>
      </div>

      {/* PRINT HEADER */}
      <div style={{ marginBottom: 16, display: "none" }} className="print-header-wrap">
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1a5a2a" }}>FIBERDESK — {reportType === "daily" ? "Daily" : "Monthly"} Report</div>
        <div style={{ fontSize: 12, color: "#555" }}>{reportType === "daily" ? selectedDate : selectedMonth} · Site: {selectedSite} · Generated: {new Date().toLocaleString()}</div>
      </div>

      {/* STAT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          ["Total Jobs", totalJobs, "#4d8ef5"],
          ["Done", doneJobs.length, "#2dcc7a"],
          ["Pending/Active", filtered.filter(([,j]) => j.status !== "done").length, "#f0a030"],
          ["Materials Cost", "₱" + totalMaterials.toLocaleString(), "#9b78f5"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, padding: "13px 15px", position: "relative", overflow: "hidden" }} className="print-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: col }}></div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 6 }}>{lbl}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: col }}>{val}</div>
          </div>
        ))}
      </div>

      {/* SUMMARY BY SITE */}
      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 14 }} className="print-card">
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #222840", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" }} className="print-header">Summary by Site</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>{["Site","Total","Done","Install","Repair","Relocate","Collection","Materials (₱)"].map(h => <th key={h} style={fs.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(bySite).map(([site, sjobs]) => (
                <tr key={site} style={{ borderBottom: "1px solid #222840" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#9b78f5" }}>{site}</td>
                  <td style={fs.td}>{sjobs.length}</td>
                  <td style={{ ...fs.td, color: "#2dcc7a", fontWeight: 700 }}>{sjobs.filter(j => j.status === "done").length}</td>
                  <td style={{ ...fs.td, color: "#4dff88" }}>{sjobs.filter(j => j.type === "install").length}</td>
                  <td style={{ ...fs.td, color: "#ff8c3d" }}>{sjobs.filter(j => j.type === "repair").length}</td>
                  <td style={{ ...fs.td, color: "#7db8ff" }}>{sjobs.filter(j => j.type === "relocate").length}</td>
                  <td style={{ ...fs.td, color: "#ffc04d" }}>{sjobs.filter(j => j.type === "collection").length}</td>
                  <td style={{ ...fs.td, color: "#9b78f5", fontFamily: "monospace", fontWeight: 700 }}>₱{sjobs.reduce((a, j) => a + (j.materialsTotal || 0), 0).toLocaleString()}</td>
                </tr>
              ))}
              {Object.keys(bySite).length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: "#3d4668" }}>Walang data para sa period na ito</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY BY TECHNICIAN */}
      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 14 }} className="print-card">
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #222840", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" }} className="print-header">Summary by Technician</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>{["Technician","Total","Done","Install","Repair","Relocate","Collection","Materials (₱)"].map(h => <th key={h} style={fs.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(byTech).map(([tn, tjobs]) => (
                <tr key={tn} style={{ borderBottom: "1px solid #222840" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: "#dde3ff" }}>{tn}</td>
                  <td style={fs.td}>{tjobs.length}</td>
                  <td style={{ ...fs.td, color: "#2dcc7a", fontWeight: 700 }}>{tjobs.filter(j => j.status === "done").length}</td>
                  <td style={{ ...fs.td, color: "#4dff88" }}>{tjobs.filter(j => j.type === "install").length}</td>
                  <td style={{ ...fs.td, color: "#ff8c3d" }}>{tjobs.filter(j => j.type === "repair").length}</td>
                  <td style={{ ...fs.td, color: "#7db8ff" }}>{tjobs.filter(j => j.type === "relocate").length}</td>
                  <td style={{ ...fs.td, color: "#ffc04d" }}>{tjobs.filter(j => j.type === "collection").length}</td>
                  <td style={{ ...fs.td, color: "#9b78f5", fontFamily: "monospace", fontWeight: 700 }}>₱{tjobs.reduce((a, j) => a + (j.materialsTotal || 0), 0).toLocaleString()}</td>
                </tr>
              ))}
              {Object.keys(byTech).length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: "#3d4668" }}>Walang data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED JOB LIST */}
      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 14 }} className="print-card">
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #222840", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" }} className="print-header">Detailed Job Orders</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 900 }}>
            <thead>
              <tr>{["JO #","Date","Site","Task","Status","Client","LCP/NAP/Port","Technician","Notes","Materials","Cost"].map(h => <th key={h} style={fs.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(([id, j]) => (
                <tr key={id} style={{ borderBottom: "1px solid #222840" }}>
                  <td style={{ ...fs.td, fontFamily: "monospace", fontSize: 10 }}>{j.jo || id.slice(-6)}</td>
                  <td style={{ ...fs.td, fontFamily: "monospace", fontSize: 10 }}>{j.date}</td>
                  <td style={{ ...fs.td, color: "#9b78f5" }}>{j.site || "—"}</td>
                  <td style={{ padding: "6px 10px" }}><span style={{ background: { install:"#0d2a0d",repair:"#2a1005",relocate:"#0d1530",collection:"#2a1800" }[j.type], color: taskColors[j.type], padding: "2px 7px", borderRadius: 3, fontSize: 9.5, fontWeight: 800 }}>{j.type?.toUpperCase()}</span></td>
                  <td style={{ padding: "6px 10px" }}><span style={{ background: { pending:"#2a1805",dispatched:"#0d1535","on-way":"#1a1040","on-site":"#052220",done:"#081e13" }[j.status], color: statusColors[j.status], padding: "2px 7px", borderRadius: 3, fontSize: 9.5, fontWeight: 700 }}>{j.status?.toUpperCase()}</span></td>
                  <td style={{ ...fs.td, fontWeight: 600 }}>{j.client}</td>
                  <td style={{ ...fs.td, fontFamily: "monospace", fontSize: 10, color: "#20c8b0" }}>{j.lcp} {j.nap} {j.port}</td>
                  <td style={fs.td}>{j.techName || "—"}</td>
                  <td style={{ ...fs.td, color: "#f0a030", fontSize: 11, maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.notes || "—"}</td>
                  <td style={{ ...fs.td, fontSize: 10.5 }}>{j.materialsUsed?.map(m => `${m.name} x${m.qty}`).join(", ") || "—"}</td>
                  <td style={{ ...fs.td, fontFamily: "monospace", color: "#2dcc7a", fontWeight: 700 }}>{j.materialsTotal ? "₱" + j.materialsTotal.toLocaleString() : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: 24, color: "#3d4668" }}>Walang jobs para sa period na ito</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px", borderTop: "1px solid #222840", gap: 24 }}>
            <span style={{ fontSize: 12, color: "#7b87b8" }}>Total Jobs: <strong style={{ color: "#dde3ff" }}>{filtered.length}</strong></span>
            <span style={{ fontSize: 12, color: "#7b87b8" }}>Done: <strong style={{ color: "#2dcc7a" }}>{doneJobs.length}</strong></span>
            <span style={{ fontSize: 12, color: "#7b87b8" }}>Materials Total: <strong style={{ fontFamily: "monospace", color: "#9b78f5" }}>₱{totalMaterials.toLocaleString()}</strong></span>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: "center", padding: "12px", color: "#3d4668", fontSize: 10.5, fontFamily: "monospace" }}>
        FiberDesk ISP · Generated {new Date().toLocaleString()} · {reportType === "daily" ? selectedDate : selectedMonth}
      </div>
    </div>
  );
}

const fs = {
  filter: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "6px 10px", borderRadius: 8, fontFamily: "inherit", fontSize: 12, outline: "none" },
  th: { padding: "7px 10px", background: "#111525", color: "#7b87b8", fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid #222840", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "7px 10px", color: "#dde3ff" },
  btnExcel: { background: "#0d2a0d", border: "1px solid #2dcc7a", color: "#2dcc7a", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  btnPrint: { background: "#0d1535", border: "1px solid #4d8ef5", color: "#4d8ef5", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
};