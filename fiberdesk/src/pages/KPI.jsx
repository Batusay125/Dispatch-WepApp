import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue } from "firebase/database";

const TASK_COLORS = { install:"#4dff88", repair:"#ff8c3d", relocate:"#7db8ff", collection:"#ffc04d" };
const TASK_BG    = { install:"#0d2a0d", repair:"#2a1005", relocate:"#0d1530", collection:"#2a1800" };

export default function KPI() {
  const [jobs,    setJobs]    = useState({});
  const [techs,   setTechs]   = useState({});
  const [selectedTech,  setSelectedTech]  = useState("all");
  const [reportType,    setReportType]    = useState("monthly");
  const [selectedDate,  setSelectedDate]  = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));
  const [concern,        setConcern]        = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genDaily,   setGenDaily]   = useState(false);

  useEffect(() => {
    const u1 = onValue(ref(db,"jobs"),        s => setJobs(s.exists()  ? s.val() : {}));
    const u2 = onValue(ref(db,"technicians"), s => setTechs(s.exists() ? s.val() : {}));
    return () => { u1(); u2(); };
  }, []);

  const jobList = Object.entries(jobs);

  function getFiltered(techId) {
    return jobList.filter(([,j]) => {
      const techMatch = techId === "all"
        || j.techId === techId
        || (j.techIds||[]).includes(techId);
      const dateMatch = reportType === "daily"
        ? (j.date === selectedDate || j.updatedAt?.startsWith(selectedDate))
        : (j.date?.startsWith(selectedMonth) || j.updatedAt?.startsWith(selectedMonth));
      return techMatch && dateMatch;
    });
  }

  function computeKPI(techId) {
    const filtered   = getFiltered(techId);
    const done       = filtered.filter(([,j]) => j.status==="done"||j.status==="activated");
    const cancelled  = filtered.filter(([,j]) => j.status==="cancelled");
    const active     = filtered.filter(([,j]) => !["done","activated","cancelled"].includes(j.status));
    const completionRate = filtered.length > 0 ? Math.round((done.length/filtered.length)*100) : 0;
    const totalMaterials = done.reduce((a,[,j]) => a+(j.materialsTotal||0), 0);
    const byType = { install:0, repair:0, relocate:0, collection:0 };
    filtered.forEach(([,j]) => { if (byType[j.type]!==undefined) byType[j.type]++; });
    const cancelReasons = {};
    cancelled.forEach(([,j]) => {
      const r = j.cancelReason || "Unknown";
      cancelReasons[r] = (cancelReasons[r]||0)+1;
    });
    return { filtered, done, cancelled, active, completionRate, totalMaterials, byType, cancelReasons };
  }

  const kpi      = computeKPI(selectedTech === "all" ? "all" : selectedTech);
  const techName = selectedTech === "all" ? "All Technicians" : (techs[selectedTech]?.name || "—");
  const period   = reportType === "daily" ? selectedDate : selectedMonth;

  // ── DOCX GENERATION (lazy import to avoid Vite SSR issues) ──
  async function generateDOCX() {
    setGenerating(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
        Header, Footer, LevelFormat, PageNumber
      } = await import("docx");

      const border  = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
      const borders = { top: border, bottom: border, left: border, right: border };
      const hBorder = { style: BorderStyle.SINGLE, size: 1, color: "1a5a2a" };
      const hBorders= { top: hBorder, bottom: hBorder, left: hBorder, right: hBorder };

      function mkCell(text, opts={}) {
        return new TableCell({
          borders: opts.header ? hBorders : borders,
          width: { size: opts.width || 2340, type: WidthType.DXA },
          shading: opts.header
            ? { fill: "1a5a2a", type: ShadingType.CLEAR }
            : opts.shade
              ? { fill: opts.shade,  type: ShadingType.CLEAR }
              : undefined,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top:80, bottom:80, left:120, right:120 },
          children: [new Paragraph({
            alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({
              text: String(text ?? "—"),
              bold: opts.bold || opts.header,
              color: opts.header ? "FFFFFF" : (opts.color || "1a1a1a"),
              size: opts.size || 20,
              font: "Arial",
            })]
          })]
        });
      }

      function secTitle(text) {
        return new Paragraph({
          spacing: { before:280, after:100 },
          border: { bottom:{ style:BorderStyle.SINGLE, size:4, color:"1a5a2a", space:1 } },
          children: [new TextRun({ text, bold:true, size:26, color:"1a5a2a", font:"Arial" })]
        });
      }

      function spacer() {
        return new Paragraph({ spacing:{ before:60, after:60 }, children:[new TextRun("")] });
      }

      // ── COVER ──
      const cover = [
        new Paragraph({ spacing:{before:0,after:120}, children:[new TextRun({ text:"KEYCONNECT ISP", bold:true, size:44, color:"1a5a2a", font:"Arial" })] }),
        new Paragraph({ spacing:{before:0,after:80},  children:[new TextRun({ text:"Technician KPI Report", bold:true, size:36, color:"222222", font:"Arial" })] }),
        new Paragraph({ spacing:{before:0,after:60},  children:[new TextRun({ text:`Period: ${period}  |  Type: ${reportType==="daily"?"Daily":"Monthly"}  |  Technician: ${techName}`, size:20, color:"666666", font:"Arial" })] }),
        new Paragraph({ spacing:{before:0,after:200}, children:[new TextRun({ text:`Generated: ${new Date().toLocaleString("en-PH")}`, size:18, color:"999999", font:"Arial" })] }),
      ];

      // ── KPI SUMMARY TABLE ──
      const crColor = kpi.completionRate>=80 ? "1a5a2a" : kpi.completionRate>=50 ? "cc7700" : "cc0000";
      const crShade = kpi.completionRate>=80 ? "e8f9f0" : "fff8f0";
      const summaryTable = new Table({
        width:{ size:9360, type:WidthType.DXA },
        columnWidths:[4680,2340,2340],
        rows:[
          new TableRow({ children:[mkCell("KPI Metric",{header:true,width:4680}), mkCell("Value",{header:true,width:2340,center:true}), mkCell("Remarks",{header:true,width:2340})] }),
          new TableRow({ children:[mkCell("Total Jobs Assigned",{width:4680}), mkCell(kpi.filtered.length,{width:2340,center:true,bold:true}), mkCell("Total tasks for the period",{width:2340,color:"666666"})] }),
          new TableRow({ children:[mkCell("Jobs Completed",{width:4680}), mkCell(kpi.done.length,{width:2340,center:true,bold:true,color:"1a5a2a"}), mkCell("Successfully finished",{width:2340,color:"666666"})] }),
          new TableRow({ children:[mkCell("Jobs Cancelled",{width:4680}), mkCell(kpi.cancelled.length,{width:2340,center:true,bold:true,color:kpi.cancelled.length>0?"cc0000":"1a1a1a"}), mkCell(kpi.cancelled.length>0?"See breakdown below":"No cancellations",{width:2340,color:"666666"})] }),
          new TableRow({ children:[mkCell("Active / Ongoing",{width:4680}), mkCell(kpi.active.length,{width:2340,center:true,bold:true}), mkCell("Currently in progress",{width:2340,color:"666666"})] }),
          new TableRow({ children:[mkCell("Completion Rate",{width:4680,bold:true}), mkCell(kpi.completionRate+"%",{width:2340,center:true,bold:true,color:crColor,shade:crShade}), mkCell(kpi.completionRate>=80?"Excellent":kpi.completionRate>=50?"Needs improvement":"Requires attention",{width:2340,color:"666666"})] }),
          new TableRow({ children:[mkCell("Total Materials Cost",{width:4680}), mkCell("₱"+kpi.totalMaterials.toLocaleString(),{width:2340,center:true,bold:true,color:"1a4a8a"}), mkCell("Equipment/materials used",{width:2340,color:"666666"})] }),
        ]
      });

      // ── TASK TYPE TABLE ──
      const typeRows = [
        new TableRow({ children:[mkCell("Task Type",{header:true,width:3120}),mkCell("Count",{header:true,width:2080,center:true}),mkCell("% of Total",{header:true,width:2080,center:true}),mkCell("Completion",{header:true,width:2080,center:true})] }),
        ...["install","repair","relocate","collection"].map(type => {
          const tj   = kpi.filtered.filter(([,j])=>j.type===type);
          const tdone= tj.filter(([,j])=>j.status==="done"||j.status==="activated").length;
          const pct  = kpi.filtered.length>0 ? Math.round((kpi.byType[type]/kpi.filtered.length)*100) : 0;
          const rate = tj.length>0 ? Math.round((tdone/tj.length)*100)+"%" : "—";
          return new TableRow({ children:[mkCell(type.toUpperCase(),{width:3120,bold:true}),mkCell(kpi.byType[type],{width:2080,center:true}),mkCell(pct+"%",{width:2080,center:true}),mkCell(rate,{width:2080,center:true})] });
        })
      ];
      const typeTable = new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3120,2080,2080,2080], rows:typeRows });

      // ── PER-TECH TABLE (all mode) ──
      let perTechSection = [];
      if (selectedTech==="all" && Object.keys(techs).length>0) {
        const ptRows = [
          new TableRow({ children:[mkCell("Technician",{header:true,width:2880}),mkCell("Total",{header:true,width:1440,center:true}),mkCell("Done",{header:true,width:1440,center:true}),mkCell("Cancelled",{header:true,width:1440,center:true}),mkCell("Rate",{header:true,width:1440,center:true}),mkCell("Materials",{header:true,width:1720,center:true})] }),
          ...Object.entries(techs).map(([tid,t]) => {
            const tk = computeKPI(tid);
            return new TableRow({ children:[mkCell(t.name,{width:2880,bold:true}),mkCell(tk.filtered.length,{width:1440,center:true}),mkCell(tk.done.length,{width:1440,center:true,color:"1a5a2a",bold:true}),mkCell(tk.cancelled.length,{width:1440,center:true,color:tk.cancelled.length>0?"cc0000":"1a1a1a"}),mkCell(tk.completionRate+"%",{width:1440,center:true,bold:true,color:tk.completionRate>=80?"1a5a2a":"cc7700"}),mkCell("₱"+tk.totalMaterials.toLocaleString(),{width:1720,center:true,color:"1a4a8a"})] });
          })
        ];
        perTechSection = [spacer(), secTitle("3. Per-Technician Breakdown"), spacer(), new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2880,1440,1440,1440,1440,1720],rows:ptRows})];
      }

      // ── CANCEL SECTION ──
      let cancelSection = [];
      if (kpi.cancelled.length>0) {
        const cRows = [
          new TableRow({ children:[mkCell("Reason",{header:true,width:6240}),mkCell("Count",{header:true,width:1560,center:true}),mkCell("%",{header:true,width:1560,center:true})] }),
          ...Object.entries(kpi.cancelReasons).sort((a,b)=>b[1]-a[1]).map(([r,cnt]) =>
            new TableRow({ children:[mkCell(r,{width:6240}),mkCell(cnt,{width:1560,center:true,bold:true,color:"cc0000"}),mkCell(Math.round((cnt/kpi.cancelled.length)*100)+"%",{width:1560,center:true})] })
          )
        ];
        cancelSection = [spacer(), secTitle((selectedTech==="all"?"4":"3")+". Cancellation Analysis"), spacer(), new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[6240,1560,1560],rows:cRows})];
      }

      // ── CONCERNS & RECOMMENDATIONS ──
      const bullets = concern.trim()
        ? concern.split("\n").filter(l=>l.trim()).map(line =>
            new Paragraph({ spacing:{before:60,after:60}, numbering:{reference:"bullets",level:0}, children:[new TextRun({text:line.trim(),size:20,font:"Arial"})] }))
        : [new Paragraph({ spacing:{before:60,after:60}, children:[new TextRun({text:"No concerns noted for this period.",size:20,font:"Arial",color:"999999",italics:true})] })];

      const recBullets = recommendation.trim()
        ? recommendation.split("\n").filter(l=>l.trim()).map(line =>
            new Paragraph({ spacing:{before:60,after:60}, numbering:{reference:"bullets",level:0}, children:[new TextRun({text:line.trim(),size:20,font:"Arial"})] }))
        : [new Paragraph({ spacing:{before:60,after:60}, children:[new TextRun({text:"No recommendations at this time.",size:20,font:"Arial",color:"999999",italics:true})] })];

      const secN = selectedTech==="all" ? (kpi.cancelled.length>0 ? 5 : 4) : (kpi.cancelled.length>0 ? 4 : 3);
      const concernSection = [
        spacer(),
        secTitle(secN+". Concerns / Notes"),
        spacer(),
        ...bullets,
        spacer(),
        secTitle((secN+1)+". Recommendations"),
        spacer(),
        ...recBullets,
      ];

      // ── SIGNATURE BLOCK ──
      const sigSection = [
        spacer(), spacer(),
        new Paragraph({ spacing:{before:200,after:60}, border:{top:{style:BorderStyle.SINGLE,size:2,color:"CCCCCC",space:1}}, children:[new TextRun("")] }),
        new Paragraph({ spacing:{before:0,after:40}, children:[new TextRun({text:"Prepared by: ________________________     Noted by: ________________________",size:20,font:"Arial",color:"555555"})] }),
        new Paragraph({ spacing:{before:0,after:0},  children:[new TextRun({text:"         Dispatcher / Supervisor                          Operations Manager",size:18,font:"Arial",color:"999999"})] }),
      ];

      // ── BUILD DOC ──
      const doc = new Document({
        numbering: { config:[{ reference:"bullets", levels:[{level:0, format:LevelFormat.BULLET, text:"•", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:720,hanging:360}}}}] }] },
        styles: { default:{ document:{ run:{ font:"Arial", size:20 } } } },
        sections: [{
          properties: { page:{ size:{width:12240,height:15840}, margin:{top:1080,right:1080,bottom:1080,left:1080} } },
          headers: { default: new Header({ children:[new Paragraph({ border:{bottom:{style:BorderStyle.SINGLE,size:4,color:"1a5a2a",space:2}}, children:[new TextRun({text:`KEYCONNECT ISP  ·  KPI Report  ·  ${period}  ·  ${techName}`,bold:true,size:18,font:"Arial",color:"1a5a2a"})] })] }) },
          footers: { default: new Footer({ children:[new Paragraph({ border:{top:{style:BorderStyle.SINGLE,size:2,color:"CCCCCC",space:2}}, children:[new TextRun({text:"Confidential — Internal Use Only",size:16,font:"Arial",color:"999999"})] })] }) },
          children: [
            ...cover, spacer(),
            secTitle("1. KPI Summary"), spacer(), summaryTable, spacer(),
            secTitle("2. Task Type Breakdown"), spacer(), typeTable,
            ...perTechSection,
            ...cancelSection,
            ...concernSection,
            ...sigSection,
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `KPI_${techName.replace(/\s+/g,"_")}_${period}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      alert("Error: " + err.message);
      console.error(err);
    }
    setGenerating(false);
  }

  // ── DAILY REPORT DOCX ──
  async function generateDailyReport() {
    setGenDaily(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, UnderlineType
      } = await import("docx");

      const BLUE="2E75B6", WHITE="FFFFFF", BLACK="000000";
      const noBorder={style:BorderStyle.NONE,size:0,color:"FFFFFF"};
      const noBorders={top:noBorder,bottom:noBorder,left:noBorder,right:noBorder};
      const thin={style:BorderStyle.SINGLE,size:4,color:"AAAAAA"};
      const allThin={top:thin,bottom:thin,left:thin,right:thin};

      function blueHdr(text) {
        return new Table({ width:{size:10800,type:WidthType.DXA}, columnWidths:[10800],
          rows:[new TableRow({ children:[new TableCell({
            width:{size:10800,type:WidthType.DXA}, shading:{fill:BLUE,type:ShadingType.CLEAR},
            borders:noBorders, margins:{top:80,bottom:80,left:160,right:160},
            children:[new Paragraph({children:[new TextRun({text,bold:true,size:22,font:"Arial",color:WHITE})]})]
          })]})]
        });
      }

      function sp(b=80,a=80){return new Paragraph({spacing:{before:b,after:a},children:[new TextRun("")]});}

      function uCell(w) {
        return new TableCell({width:{size:w,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:60,right:60},
          children:[new Paragraph({borders:{bottom:{style:BorderStyle.SINGLE,size:6,color:"000000",space:1}},children:[new TextRun({text:"",size:20})]})]});
      }

      function rCell(w,isHdr=false,txt="",chk=false){
        return new TableCell({width:{size:w,type:WidthType.DXA},
          shading:isHdr?{fill:BLUE,type:ShadingType.CLEAR}:undefined,
          borders:allThin, verticalAlign:VerticalAlign.CENTER,
          margins:{top:60,bottom:60,left:40,right:40},
          children:[new Paragraph({alignment:AlignmentType.CENTER,
            children:[new TextRun({text:isHdr?txt:(chk?"☐":""),bold:isHdr,size:isHdr?18:22,font:"Arial",color:isHdr?WHITE:BLACK})]})]});
      }

      const doc = new Document({
        styles:{default:{document:{run:{font:"Arial",size:20}}}},
        sections:[{
          properties:{page:{size:{width:12240,height:15840},margin:{top:720,right:720,bottom:720,left:720}}},
          children:[
            new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:120},
              children:[new TextRun({text:"KEYCONNECT ISP - DAILY REPORT",bold:true,size:32,font:"Arial",color:BLUE})]}),

            // Name/Date/Dept
            new Table({width:{size:10800,type:WidthType.DXA},columnWidths:[1100,3200,800,2500,700,2500],
              rows:[new TableRow({children:[
                new TableCell({width:{size:1100,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:0,right:40},children:[new Paragraph({children:[new TextRun({text:"Name:",bold:true,size:22,font:"Arial"})]})] }),
                uCell(3200),
                new TableCell({width:{size:800,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:80,right:40},children:[new Paragraph({children:[new TextRun({text:"Date:",bold:true,size:22,font:"Arial"})]})] }),
                uCell(2500),
                new TableCell({width:{size:700,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:80,right:40},children:[new Paragraph({children:[new TextRun({text:"Dept:",bold:true,size:22,font:"Arial"})]})] }),
                uCell(2500),
              ]})]
            }),

            sp(120,80), blueHdr("TASKS COMPLETED & KPIs"), sp(80,40),

            // Stats row
            new Table({width:{size:10800,type:WidthType.DXA},columnWidths:[1800,600,1200,600,1000,600,800,600,3600],
              rows:[new TableRow({children:[
                new TableCell({width:{size:1800,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:160,right:40},children:[new Paragraph({children:[new TextRun({text:"Tasks/Installs:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(600),
                new TableCell({width:{size:1200,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:80,right:40},children:[new Paragraph({children:[new TextRun({text:"Tickets:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(600),
                new TableCell({width:{size:1000,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:80,right:40},children:[new Paragraph({children:[new TextRun({text:"Calls:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(600),
                new TableCell({width:{size:800,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:80,right:40},children:[new Paragraph({children:[new TextRun({text:"Docs:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(600),
                new TableCell({width:{size:3600,type:WidthType.DXA},borders:noBorders,children:[new Paragraph({children:[new TextRun("")]})]}),
              ]})]
            }),

            sp(80,40),
            new Paragraph({spacing:{before:40,after:60},children:[new TextRun({text:"Accomplishments:",bold:true,size:20,font:"Arial"})]}),
            ...[1,2,3].map(n=>new Table({width:{size:10800,type:WidthType.DXA},columnWidths:[400,10400],
              rows:[new TableRow({children:[
                new TableCell({width:{size:400,type:WidthType.DXA},borders:noBorders,margins:{top:30,bottom:30,left:160,right:0},children:[new Paragraph({children:[new TextRun({text:`${n}.`,size:20,font:"Arial"})]})] }),
                new TableCell({width:{size:10400,type:WidthType.DXA},borders:noBorders,margins:{top:30,bottom:30,left:0,right:160},
                  children:[new Paragraph({borders:{bottom:{style:BorderStyle.SINGLE,size:4,color:"999999",space:1}},children:[new TextRun({text:"",size:20})]})]}),
              ]})]
            })),

            sp(120,80), blueHdr("ISSUES & CONCERNS"), sp(80,40),

            ...[0,1].map(()=>new Table({width:{size:10800,type:WidthType.DXA},columnWidths:[800,5000,900,4100],
              rows:[new TableRow({children:[
                new TableCell({width:{size:800,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:160,right:40},children:[new Paragraph({children:[new TextRun({text:"Issue:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(5000),
                new TableCell({width:{size:900,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:80,right:40},children:[new Paragraph({children:[new TextRun({text:"Status:",bold:true,size:20,font:"Arial"})]})] }),
                new TableCell({width:{size:4100,type:WidthType.DXA},borders:noBorders,margins:{top:20,bottom:20,left:80,right:80},
                  children:[new Paragraph({children:[new TextRun({text:"☐ Resolved   ☐ Pending   ☐ Escalated",size:20,font:"Arial"})]})] }),
              ]})]
            })),

            sp(120,80), blueHdr("LEADER EVALUATION"), sp(80,40),

            new Table({width:{size:8640,type:WidthType.DXA},columnWidths:[2880,480,480,480,480,480,3360],
              rows:[
                new TableRow({children:[rCell(2880,true,"CRITERIA"),rCell(480,true,"1"),rCell(480,true,"2"),rCell(480,true,"3"),rCell(480,true,"4"),rCell(480,true,"5"),rCell(3360,true,"COMMENTS")]}),
                ...["Attitude / Professional","Work Quality","Productivity","Communication / Docs","Teamwork / Cooperation","Attendance / Punctuality"].map(cr=>
                  new TableRow({children:[
                    new TableCell({width:{size:2880,type:WidthType.DXA},borders:allThin,margins:{top:60,bottom:60,left:120,right:60},children:[new Paragraph({children:[new TextRun({text:cr,size:20,font:"Arial"})]})] }),
                    rCell(480,false,"",true),rCell(480,false,"",true),rCell(480,false,"",true),rCell(480,false,"",true),rCell(480,false,"",true),
                    new TableCell({width:{size:3360,type:WidthType.DXA},borders:allThin,margins:{top:60,bottom:60,left:120,right:60},
                      children:[new Paragraph({borders:{bottom:{style:BorderStyle.SINGLE,size:4,color:"AAAAAA",space:1}},children:[new TextRun({text:"",size:20})]})]}),
                  ]})
                )
              ]
            }),

            sp(100,60),

            // Overall
            new Table({width:{size:10800,type:WidthType.DXA},columnWidths:[900,2800,1200,5900],
              rows:[new TableRow({children:[
                new TableCell({width:{size:900,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:0,right:40},children:[new Paragraph({children:[new TextRun({text:"Overall:",bold:true,size:22,font:"Arial"})]})] }),
                new TableCell({width:{size:2800,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:0,right:0},children:[new Paragraph({children:[new TextRun({text:"☐ 1   ☐ 2   ☐ 3   ☐ 4   ☐ 5",size:20,font:"Arial"})]})] }),
                new TableCell({width:{size:1200,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:40,right:40},children:[new Paragraph({children:[new TextRun({text:"Comments:",bold:true,size:22,font:"Arial"})]})] }),
                uCell(5900),
              ]})]
            }),

            sp(80,60),

            // Signatures
            new Table({width:{size:10800,type:WidthType.DXA},columnWidths:[1000,2000,400,1000,2000,400,1000,2000],
              rows:[new TableRow({children:[
                new TableCell({width:{size:1000,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:0,right:40},children:[new Paragraph({children:[new TextRun({text:"Employee:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(2000),
                new TableCell({width:{size:400,type:WidthType.DXA},borders:noBorders,children:[new Paragraph({children:[new TextRun("")]})] }),
                new TableCell({width:{size:1000,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:40,right:40},children:[new Paragraph({children:[new TextRun({text:"Leader:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(2000),
                new TableCell({width:{size:400,type:WidthType.DXA},borders:noBorders,children:[new Paragraph({children:[new TextRun("")]})] }),
                new TableCell({width:{size:1000,type:WidthType.DXA},borders:noBorders,margins:{top:40,bottom:40,left:40,right:40},children:[new Paragraph({children:[new TextRun({text:"Ops Mgr:",bold:true,size:20,font:"Arial"})]})] }),
                uCell(2000),
              ]})]
            }),

            sp(80,40),
            new Paragraph({spacing:{before:60,after:0},children:[new TextRun({text:"Daily report = Attendance. NO EVIDENCE = NO CREDIT. Workflow: Staff → Leader → Ops Manager",size:16,font:"Arial",italics:true,color:"666666"})]}),
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `KeyConnect_Daily_Report_${new Date().toISOString().split("T")[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) { alert("Error: "+err.message); console.error(err); }
    setGenDaily(false);
  }

  // ── UI ──
  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={s.ph}>
        <div>
          <h1 style={s.h1}>KPI Reports</h1>
          <div style={{fontSize:12,color:"#7b87b8",marginTop:3}}>Auto-generated · Downloadable as Word (.docx)</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={{...s.btn, background:generating?"#444":"#2dcc7a"}} onClick={generateDOCX} disabled={generating}>
            {generating ? "⏳ Generating..." : "⬇ Download KPI Report (.docx)"}
          </button>
          <button style={{...s.btn, background:genDaily?"#444":"#4d8ef5"}} onClick={generateDailyReport} disabled={genDaily}>
            {genDaily ? "⏳ Generating..." : "📋 Daily Report Form (.docx)"}
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
        <div style={s.fsec}>Report Settings</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          <div style={s.fg}>
            <label style={s.lbl}>Technician</label>
            <select style={s.fi} value={selectedTech} onChange={e=>setSelectedTech(e.target.value)}>
              <option value="all">All Technicians</option>
              {Object.entries(techs).map(([id,t]) => <option key={id} value={id}>{t.name}</option>)}
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>Report Type</label>
            <select style={s.fi} value={reportType} onChange={e=>setReportType(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.lbl}>{reportType==="daily"?"Date":"Month"}</label>
            {reportType==="daily"
              ? <input type="date"  style={s.fi} value={selectedDate}  onChange={e=>setSelectedDate(e.target.value)} />
              : <input type="month" style={s.fi} value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} />}
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[
          ["Total Jobs", kpi.filtered.length, "#4d8ef5"],
          ["Done",       kpi.done.length,      "#2dcc7a"],
          ["Cancelled",  kpi.cancelled.length,  "#f05555"],
          ["Active",     kpi.active.length,     "#f0a030"],
          ["Completion", kpi.completionRate+"%", kpi.completionRate>=80?"#2dcc7a":kpi.completionRate>=50?"#f0a030":"#f05555"],
          ["Materials",  "₱"+kpi.totalMaterials.toLocaleString(), "#9b78f5"],
        ].map(([lbl,val,col]) => (
          <div key={lbl} style={{background:"#0c0f1a",border:"1px solid #222840",borderTop:"2px solid "+col,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:5}}>{lbl}</div>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:col}}>{val}</div>
          </div>
        ))}
      </div>

      {/* TASK TYPE BREAKDOWN */}
      <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #222840",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8"}}>Task Type Breakdown</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>
          {["install","repair","relocate","collection"].map(t => {
            const tj   = kpi.filtered.filter(([,j])=>j.type===t);
            const done = tj.filter(([,j])=>j.status==="done"||j.status==="activated").length;
            return (
              <div key={t} style={{padding:14,borderRight:"1px solid #222840",textAlign:"center"}}>
                <div style={{fontSize:10,fontWeight:700,color:TASK_COLORS[t],textTransform:"uppercase",background:TASK_BG[t],padding:"2px 8px",borderRadius:3,display:"inline-block",marginBottom:8}}>{t}</div>
                <div style={{fontSize:24,fontWeight:800,fontFamily:"monospace",color:TASK_COLORS[t]}}>{kpi.byType[t]}</div>
                <div style={{fontSize:11,color:"#7b87b8",marginTop:3}}>{done} done</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONCERNS */}
      <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
        <div style={s.fsec}>Concerns / Notes</div>
        <textarea style={{...s.fi,minHeight:90,resize:"vertical",marginBottom:14}} placeholder={"Halimbawa:\n• May tech na madalas mag-cancel\n• Kulang ang materials sa Lawa area"} value={concern} onChange={e=>setConcern(e.target.value)} />
        <div style={s.fsec}>Recommendations</div>
        <textarea style={{...s.fi,minHeight:90,resize:"vertical"}} placeholder={"Halimbawa:\n• Dagdagan ang stock ng FOC\n• I-review ang cancel rate ni Tech X"} value={recommendation} onChange={e=>setRecommendation(e.target.value)} />
      </div>

      {/* CANCEL BREAKDOWN */}
      {kpi.cancelled.length>0 && (
        <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #222840",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8"}}>Cancellation Breakdown</div>
          {Object.entries(kpi.cancelReasons).sort((a,b)=>b[1]-a[1]).map(([reason,count]) => (
            <div key={reason} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderBottom:"1px solid #222840"}}>
              <div style={{flex:1,fontSize:13,color:"#dde3ff"}}>{reason}</div>
              <div style={{fontFamily:"monospace",fontWeight:700,color:"#f05555",fontSize:14}}>{count}x</div>
              <div style={{width:100,height:6,background:"#222840",borderRadius:3}}>
                <div style={{width:Math.round((count/kpi.cancelled.length)*100)+"%",height:"100%",background:"#f05555",borderRadius:3}} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{background:"#0d1535",border:"1px solid #4d8ef5",borderRadius:10,padding:"12px 16px",fontSize:12.5,color:"#7b87b8"}}>
        💡 Lagyan ng <strong style={{color:"#dde3ff"}}>Concerns at Recommendations</strong> bago mag-download para makasama sa Word document.
      </div>
    </div>
  );
}

const s = {
  ph:  { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 },
  h1:  { fontSize:20, fontWeight:800, letterSpacing:-.5, color:"#dde3ff" },
  fsec:{ fontSize:9, fontWeight:700, letterSpacing:".14em", textTransform:"uppercase", color:"#4d8ef5", marginBottom:10, paddingBottom:5, borderBottom:"1px solid #222840" },
  fg:  { display:"flex", flexDirection:"column", gap:4 },
  lbl: { fontSize:9.5, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"#7b87b8" },
  fi:  { background:"#111525", border:"1px solid #222840", color:"#dde3ff", padding:"8px 11px", borderRadius:8, fontFamily:"inherit", fontSize:13, outline:"none", width:"100%" },
  btn: { color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" },
};