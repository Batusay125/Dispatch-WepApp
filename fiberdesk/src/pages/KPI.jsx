import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue } from "firebase/database";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, Header, Footer, TabStopType, TabStopPosition,
  LevelFormat
} from "docx";

const TASK_COLORS = { install:"#4dff88", repair:"#ff8c3d", relocate:"#7db8ff", collection:"#ffc04d" };
const TASK_BG = { install:"#0d2a0d", repair:"#2a1005", relocate:"#0d1530", collection:"#2a1800" };

export default function KPI() {
  const [jobs, setJobs] = useState({});
  const [techs, setTechs] = useState({});
  const [selectedTech, setSelectedTech] = useState("all");
  const [reportType, setReportType] = useState("monthly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));
  const [concern, setConcern] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const u1 = onValue(ref(db,"jobs"), s => setJobs(s.exists() ? s.val() : {}));
    const u2 = onValue(ref(db,"technicians"), s => setTechs(s.exists() ? s.val() : {}));
    return () => { u1(); u2(); };
  }, []);

  const jobList = Object.entries(jobs);

  function getFilteredJobs(techId) {
    return jobList.filter(([,j]) => {
      const techMatch = techId === "all" || j.techId === techId || (j.techIds||[]).includes(techId);
      const dateMatch = reportType === "daily"
        ? (j.date === selectedDate || j.updatedAt?.startsWith(selectedDate))
        : (j.date?.startsWith(selectedMonth) || j.updatedAt?.startsWith(selectedMonth));
      return techMatch && dateMatch;
    });
  }

  function computeKPI(techId) {
    const filtered = getFilteredJobs(techId);
    const done = filtered.filter(([,j]) => j.status==="done"||j.status==="activated");
    const cancelled = filtered.filter(([,j]) => j.status==="cancelled");
    const pending = filtered.filter(([,j]) => j.status==="pending");
    const active = filtered.filter(([,j]) => !["done","activated","cancelled"].includes(j.status));
    const completionRate = filtered.length > 0 ? Math.round((done.length / filtered.length) * 100) : 0;
    const totalMaterials = done.reduce((a,[,j]) => a+(j.materialsTotal||0), 0);
    const byType = { install:0, repair:0, relocate:0, collection:0 };
    filtered.forEach(([,j]) => { if (byType[j.type] !== undefined) byType[j.type]++; });
    const cancelReasons = {};
    cancelled.forEach(([,j]) => {
      const r = j.cancelReason || "Unknown";
      cancelReasons[r] = (cancelReasons[r]||0)+1;
    });
    return { filtered, done, cancelled, pending, active, completionRate, totalMaterials, byType, cancelReasons };
  }

  const kpi = selectedTech === "all"
    ? computeKPI("all")
    : computeKPI(selectedTech);

  const techName = selectedTech === "all" ? "All Technicians" : (techs[selectedTech]?.name || "—");
  const period = reportType === "daily" ? selectedDate : selectedMonth;

  // ── DOCX GENERATION ──
  async function generateDOCX() {
    setGenerating(true);
    try {
      const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
      const borders = { top: border, bottom: border, left: border, right: border };
      const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "1a5a2a" };
      const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

      function cell(text, opts = {}) {
        return new TableCell({
          borders: opts.header ? headerBorders : borders,
          width: { size: opts.width || 2340, type: WidthType.DXA },
          shading: opts.header
            ? { fill: "1a5a2a", type: ShadingType.CLEAR }
            : opts.shade
              ? { fill: opts.shade, type: ShadingType.CLEAR }
              : undefined,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({
              text: String(text),
              bold: opts.bold || opts.header,
              color: opts.header ? "FFFFFF" : (opts.color || "1a1a1a"),
              size: opts.size || 20,
              font: "Arial",
            })]
          })]
        });
      }

      function sectionTitle(text) {
        return new Paragraph({
          spacing: { before: 280, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1a5a2a", space: 1 } },
          children: [new TextRun({ text, bold: true, size: 26, color: "1a5a2a", font: "Arial" })]
        });
      }

      function label(txt) {
        return new TextRun({ text: txt, bold: true, size: 20, font: "Arial", color: "555555" });
      }
      function value(txt) {
        return new TextRun({ text: "  " + txt, size: 20, font: "Arial", color: "1a1a1a" });
      }
      function spacer() {
        return new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun("")] });
      }

      // ── COVER / HEADER INFO ──
      const coverSection = [
        new Paragraph({
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "KEYCONNECT ISP", bold: true, size: 40, color: "1a5a2a", font: "Arial" })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: "Technician KPI Report", bold: true, size: 34, color: "222222", font: "Arial" })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: `Period: ${period}  |  Report Type: ${reportType === "daily" ? "Daily" : "Monthly"}`, size: 20, color: "666666", font: "Arial" })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: `Technician: ${techName}`, size: 20, color: "666666", font: "Arial" })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleString("en-PH")}`, size: 18, color: "999999", font: "Arial" })]
        }),
      ];

      // ── KPI SUMMARY TABLE ──
      const summaryRows = [
        new TableRow({
          children: [
            cell("KPI Metric", { header: true, width: 4680 }),
            cell("Value", { header: true, width: 2340, center: true }),
            cell("Remarks", { header: true, width: 2340 }),
          ]
        }),
        new TableRow({
          children: [
            cell("Total Jobs Assigned", { width: 4680 }),
            cell(kpi.filtered.length, { width: 2340, center: true, bold: true }),
            cell("Total tasks for the period", { width: 2340, color: "666666" }),
          ]
        }),
        new TableRow({
          children: [
            cell("Jobs Completed (Done)", { width: 4680 }),
            cell(kpi.done.length, { width: 2340, center: true, bold: true, color: "1a5a2a" }),
            cell("Successfully finished tasks", { width: 2340, color: "666666" }),
          ]
        }),
        new TableRow({
          children: [
            cell("Jobs Cancelled", { width: 4680 }),
            cell(kpi.cancelled.length, { width: 2340, center: true, bold: true, color: kpi.cancelled.length > 0 ? "cc0000" : "1a1a1a" }),
            cell(kpi.cancelled.length > 0 ? "See cancel reason breakdown below" : "No cancellations", { width: 2340, color: "666666" }),
          ]
        }),
        new TableRow({
          children: [
            cell("Active/Ongoing Jobs", { width: 4680 }),
            cell(kpi.active.length, { width: 2340, center: true, bold: true }),
            cell("Currently in progress", { width: 2340, color: "666666" }),
          ]
        }),
        new TableRow({
          children: [
            cell("Completion Rate", { width: 4680, bold: true }),
            cell(kpi.completionRate + "%", { width: 2340, center: true, bold: true, color: kpi.completionRate >= 80 ? "1a5a2a" : kpi.completionRate >= 50 ? "cc7700" : "cc0000", shade: kpi.completionRate >= 80 ? "e8f9f0" : "fff8f0" }),
            cell(kpi.completionRate >= 80 ? "Excellent performance" : kpi.completionRate >= 50 ? "Needs improvement" : "Requires attention", { width: 2340, color: "666666" }),
          ]
        }),
        new TableRow({
          children: [
            cell("Total Materials Cost", { width: 4680 }),
            cell("₱" + kpi.totalMaterials.toLocaleString(), { width: 2340, center: true, bold: true, color: "1a4a8a" }),
            cell("Total equipment/materials used", { width: 2340, color: "666666" }),
          ]
        }),
      ];

      const summaryTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 2340, 2340],
        rows: summaryRows,
      });

      // ── TASK TYPE BREAKDOWN TABLE ──
      const typeRows = [
        new TableRow({
          children: [
            cell("Task Type", { header: true, width: 3120 }),
            cell("Count", { header: true, width: 2080, center: true }),
            cell("% of Total", { header: true, width: 2080, center: true }),
            cell("Completion", { header: true, width: 2080, center: true }),
          ]
        }),
        ...["install","repair","relocate","collection"].map(type => {
          const typeJobs = kpi.filtered.filter(([,j]) => j.type === type);
          const typeDone = typeJobs.filter(([,j]) => j.status==="done"||j.status==="activated").length;
          const pct = kpi.filtered.length > 0 ? Math.round((kpi.byType[type] / kpi.filtered.length) * 100) : 0;
          const compRate = typeJobs.length > 0 ? Math.round((typeDone/typeJobs.length)*100) + "%" : "—";
          return new TableRow({
            children: [
              cell(type.toUpperCase(), { width: 3120, bold: true }),
              cell(kpi.byType[type], { width: 2080, center: true }),
              cell(pct + "%", { width: 2080, center: true }),
              cell(compRate, { width: 2080, center: true }),
            ]
          });
        })
      ];

      const typeTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 2080, 2080, 2080],
        rows: typeRows,
      });

      // ── PER-TECH TABLE (if All) ──
      let perTechSection = [];
      if (selectedTech === "all" && Object.keys(techs).length > 0) {
        const perTechRows = [
          new TableRow({
            children: [
              cell("Technician", { header: true, width: 2880 }),
              cell("Total", { header: true, width: 1440, center: true }),
              cell("Done", { header: true, width: 1440, center: true }),
              cell("Cancelled", { header: true, width: 1440, center: true }),
              cell("Rate", { header: true, width: 1440, center: true }),
              cell("Materials", { header: true, width: 1720, center: true }),
            ]
          }),
          ...Object.entries(techs).map(([tid, t]) => {
            const tk = computeKPI(tid);
            return new TableRow({
              children: [
                cell(t.name, { width: 2880, bold: true }),
                cell(tk.filtered.length, { width: 1440, center: true }),
                cell(tk.done.length, { width: 1440, center: true, color: "1a5a2a", bold: true }),
                cell(tk.cancelled.length, { width: 1440, center: true, color: tk.cancelled.length > 0 ? "cc0000" : "1a1a1a" }),
                cell(tk.completionRate + "%", { width: 1440, center: true, bold: true, color: tk.completionRate >= 80 ? "1a5a2a" : "cc7700" }),
                cell("₱" + tk.totalMaterials.toLocaleString(), { width: 1720, center: true, color: "1a4a8a" }),
              ]
            });
          })
        ];
        const perTechTable = new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2880, 1440, 1440, 1440, 1440, 1720],
          rows: perTechRows,
        });
        perTechSection = [
          spacer(),
          sectionTitle("4. Technician Performance Breakdown"),
          spacer(),
          perTechTable,
        ];
      }

      // ── CANCEL REASONS TABLE ──
      let cancelSection = [];
      if (kpi.cancelled.length > 0) {
        const cancelRows = [
          new TableRow({
            children: [
              cell("Reason", { header: true, width: 6240 }),
              cell("Count", { header: true, width: 1560, center: true }),
              cell("% of Cancelled", { header: true, width: 1560, center: true }),
            ]
          }),
          ...Object.entries(kpi.cancelReasons).sort((a,b)=>b[1]-a[1]).map(([reason, count]) => {
            const pct = Math.round((count / kpi.cancelled.length) * 100);
            return new TableRow({
              children: [
                cell(reason, { width: 6240 }),
                cell(count, { width: 1560, center: true, bold: true, color: "cc0000" }),
                cell(pct + "%", { width: 1560, center: true }),
              ]
            });
          })
        ];
        const cancelTable = new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [6240, 1560, 1560],
          rows: cancelRows,
        });
        cancelSection = [
          spacer(),
          sectionTitle("5. Cancellation Analysis"),
          spacer(),
          cancelTable,
        ];
      }

      // ── CONCERNS & RECOMMENDATIONS ──
      const concernSection = [
        spacer(),
        sectionTitle("6. Concerns / Notes"),
        spacer(),
        ...(concern.trim() ? concern.split("\n").filter(l=>l.trim()).map(line =>
          new Paragraph({
            spacing: { before: 60, after: 60 },
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: line.trim(), size: 20, font: "Arial" })]
          })
        ) : [new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "No concerns noted for this period.", size: 20, font: "Arial", color: "999999", italics: true })]
        })]),
        spacer(),
        sectionTitle("7. Recommendations"),
        spacer(),
        ...(recommendation.trim() ? recommendation.split("\n").filter(l=>l.trim()).map(line =>
          new Paragraph({
            spacing: { before: 60, after: 60 },
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: line.trim(), size: 20, font: "Arial" })]
          })
        ) : [new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: "No recommendations at this time.", size: 20, font: "Arial", color: "999999", italics: true })]
        })]),
      ];

      // ── SIGNATURE BLOCK ──
      const sigSection = [
        spacer(), spacer(),
        new Paragraph({
          spacing: { before: 280, after: 60 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } },
          children: [new TextRun({ text: "", size: 20 })]
        }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4320, 720, 4320],
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.SINGLE,size:1,color:"CCCCCC"}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} },
                  width: { size: 4320, type: WidthType.DXA },
                  margins: { top: 300, bottom: 80, left: 0, right: 0 },
                  children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })]
                }),
                new TableCell({ width: { size: 720, type: WidthType.DXA }, borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children: [new Paragraph({ children: [new TextRun("")] })] }),
                new TableCell({
                  borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.SINGLE,size:1,color:"CCCCCC"}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} },
                  width: { size: 4320, type: WidthType.DXA },
                  margins: { top: 300, bottom: 80, left: 0, right: 0 },
                  children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })]
                }),
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
                  width: { size: 4320, type: WidthType.DXA },
                  margins: { top: 40, bottom: 80, left: 0, right: 0 },
                  children: [new Paragraph({ children: [new TextRun({ text: "Prepared by: Dispatcher / Supervisor", bold: true, size: 18, font: "Arial", color: "555555" })] })]
                }),
                new TableCell({ width: { size: 720, type: WidthType.DXA }, borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children: [new Paragraph({ children: [new TextRun("")] })] }),
                new TableCell({
                  borders: { top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE} },
                  width: { size: 4320, type: WidthType.DXA },
                  margins: { top: 40, bottom: 80, left: 0, right: 0 },
                  children: [new Paragraph({ children: [new TextRun({ text: "Noted by: Operations Manager", bold: true, size: 18, font: "Arial", color: "555555" })] })]
                }),
              ]
            })
          ]
        })
      ];

      // ── BUILD DOCUMENT ──
      const doc = new Document({
        numbering: {
          config: [{
            reference: "bullets",
            levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
          }]
        },
        styles: {
          default: { document: { run: { font: "Arial", size: 20 } } }
        },
        sections: [{
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
            }
          },
          headers: {
            default: new Header({
              children: [new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1a5a2a", space: 2 } },
                children: [
                  new TextRun({ text: "KEYCONNECT ISP  ·  Technician KPI Report  ·  " + period, bold: true, size: 18, font: "Arial", color: "1a5a2a" }),
                ]
              })]
            })
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 2 } },
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                children: [
                  new TextRun({ text: "Confidential — Internal Use Only", size: 16, font: "Arial", color: "999999" }),
                  new TextRun({ text: "\tPage ", size: 16, font: "Arial", color: "999999" }),
                  new PageNumber({ size: 16, font: "Arial", color: "999999" }),
                ]
              })]
            })
          },
          children: [
            ...coverSection,
            spacer(),

            // Section 1: KPI Summary
            sectionTitle("1. KPI Summary"),
            spacer(),
            summaryTable,
            spacer(),

            // Section 2: Task Type Breakdown
            sectionTitle("2. Task Type Breakdown"),
            spacer(),
            typeTable,

            // Section 3: Per-tech (if all)
            ...perTechSection,

            // Section 4/5: Cancel analysis
            ...cancelSection,

            // Section 5/6: Concerns
            ...concernSection,

            // Signature
            ...sigSection,
          ]
        }]
      });

      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KPI_Report_${techName.replace(/\s/g,"_")}_${period}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generating DOCX: " + err.message);
      console.error(err);
    }
    setGenerating(false);
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={s.ph}>
        <div>
          <h1 style={s.h1}>KPI Reports</h1>
          <div style={{ fontSize: 12, color: "#7b87b8", marginTop: 3 }}>Auto-generated Technician Performance Report — downloadable as Word (.docx)</div>
        </div>
        <button style={{ ...s.btnPrimary, background: generating ? "#444" : "#2dcc7a", fontSize: 13, padding: "9px 20px" }} onClick={generateDOCX} disabled={generating}>
          {generating ? "⏳ Generating..." : "⬇ Download KPI Report (.docx)"}
        </button>
      </div>

      {/* FILTERS */}
      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={s.fsec}>Report Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={s.fg}>
            <label style={s.lbl}>Technician</label>
            <select style={s.fi} value={selectedTech} onChange={e => setSelectedTech(e.target.value)}>
              <option value="all">All Technicians</option>
              {Object.entries(techs).map(([id,t]) => <option key={id} value={id}>{t.name}</option>)}
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Report Type</label>
            <select style={s.fi} value={reportType} onChange={e => setReportType(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>{reportType === "daily" ? "Date" : "Month"}</label>
            {reportType === "daily"
              ? <input type="date" style={s.fi} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              : <input type="month" style={s.fi} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            }
          </div>
        </div>
      </div>

      {/* KPI PREVIEW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          ["Total Jobs", kpi.filtered.length, "#4d8ef5"],
          ["Done", kpi.done.length, "#2dcc7a"],
          ["Cancelled", kpi.cancelled.length, "#f05555"],
          ["Active", kpi.active.length, "#f0a030"],
          ["Completion Rate", kpi.completionRate + "%", kpi.completionRate >= 80 ? "#2dcc7a" : kpi.completionRate >= 50 ? "#f0a030" : "#f05555"],
          ["Materials Cost", "₱" + kpi.totalMaterials.toLocaleString(), "#9b78f5"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} style={{ background: "#0c0f1a", border: "1px solid #222840", borderTop: "2px solid " + col, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 5 }}>{lbl}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: col }}>{val}</div>
          </div>
        ))}
      </div>

      {/* TASK TYPE BREAKDOWN */}
      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #222840", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" }}>Task Type Breakdown</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {["install","repair","relocate","collection"].map(t => {
            const typeJobs = kpi.filtered.filter(([,j]) => j.type===t);
            const done = typeJobs.filter(([,j]) => j.status==="done"||j.status==="activated").length;
            return (
              <div key={t} style={{ padding: "14px", borderRight: "1px solid #222840", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: TASK_COLORS[t], textTransform: "uppercase", background: TASK_BG[t], padding: "2px 8px", borderRadius: 3, display: "inline-block", marginBottom: 8 }}>{t}</div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", color: TASK_COLORS[t] }}>{kpi.byType[t]}</div>
                <div style={{ fontSize: 11, color: "#7b87b8", marginTop: 3 }}>{done} done</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONCERNS & RECOMMENDATIONS */}
      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={s.fsec}>Concerns / Notes</div>
        <textarea
          style={{ ...s.fi, minHeight: 100, resize: "vertical", marginBottom: 16 }}
          placeholder={"Halimbawa:\n• May tech na madalas mag-cancel\n• Kulang ang materials sa Lawa area\n• Delay sa activation dahil sa IT availability"}
          value={concern}
          onChange={e => setConcern(e.target.value)}
        />
        <div style={s.fsec}>Recommendations</div>
        <textarea
          style={{ ...s.fi, minHeight: 100, resize: "vertical" }}
          placeholder={"Halimbawa:\n• Dagdagan ang stock ng FOC at SC connectors\n• I-schedule ang IT availability para sa activation\n• I-review ang cancel rate ni Tech X"}
          value={recommendation}
          onChange={e => setRecommendation(e.target.value)}
        />
      </div>

      {/* CANCEL ANALYSIS */}
      {kpi.cancelled.length > 0 && (
        <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #222840", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" }}>Cancellation Breakdown</div>
          {Object.entries(kpi.cancelReasons).sort((a,b)=>b[1]-a[1]).map(([reason, count]) => (
            <div key={reason} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #222840" }}>
              <div style={{ flex: 1, fontSize: 13, color: "#dde3ff" }}>{reason}</div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#f05555", fontSize: 14 }}>{count}x</div>
              <div style={{ width: 100, height: 6, background: "#222840", borderRadius: 3 }}>
                <div style={{ width: Math.round((count/kpi.cancelled.length)*100)+"%", height: "100%", background: "#f05555", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#0d1535", border: "1px solid #4d8ef5", borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: "#7b87b8" }}>
        💡 I-click ang <strong style={{ color: "#2dcc7a" }}>Download KPI Report (.docx)</strong> para ma-generate ang professional Word document na may lahat ng data, breakdown, concerns, recommendations, at signature block.
      </div>
    </div>
  );
}

const s = {
  ph: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  h1: { fontSize: 20, fontWeight: 800, letterSpacing: -.5, color: "#dde3ff" },
  fsec: { fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#4d8ef5", marginBottom: 10, paddingBottom: 5, borderBottom: "1px solid #222840" },
  fg: { display: "flex", flexDirection: "column", gap: 4 },
  lbl: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" },
  fi: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "8px 11px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none", width: "100%" },
  btnPrimary: { background: "#4d8ef5", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
};
