import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue } from "firebase/database";
import * as XLSX from "xlsx";
import { SITES } from "../constants";

export default function Reports() {
  const [jobs, setJobs] = useState({});
  const [techs, setTechs] = useState({});
  const [type, setType] = useState("daily");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [site, setSite] = useState("All");
  const [tech, setTech] = useState("All");

  useEffect(() => {
    const u1 = onValue(ref(db,"jobs"), s => setJobs(s.exists()?s.val():{}));
    const u2 = onValue(ref(db,"technicians"), s => setTechs(s.exists()?s.val():{}));
    return () => { u1(); u2(); };
  }, []);

  function getFiltered() {
    return Object.entries(jobs).filter(([,j]) => {
      const dm = type==="daily"
        ? (j.date===date || j.updatedAt?.startsWith(date))
        : (j.date?.startsWith(month) || j.updatedAt?.startsWith(month));
      const sm = site==="All" || j.site===site;
      const tm = tech==="All" || j.techId===tech;
      return dm && sm && tm;
    });
  }

  const filtered = getFiltered();
  const done = filtered.filter(([,j])=>j.status==="done"||j.status==="activated");
  const cancelled = filtered.filter(([,j])=>j.status==="cancelled");
  const totalMat = done.reduce((a,[,j])=>a+(j.materialsTotal||0),0);

  const bySite = {};
  filtered.forEach(([,j])=>{ const k=j.site||"Unknown"; if(!bySite[k]) bySite[k]=[]; bySite[k].push(j); });
  const byTech = {};
  filtered.forEach(([,j])=>{ const k=j.techName||"Unassigned"; if(!byTech[k]) byTech[k]=[]; byTech[k].push(j); });

  const SC={pending:"#f0a030",dispatched:"#4d8ef5","on-way":"#9b78f5","on-site":"#20c8b0",done:"#2dcc7a",activated:"#2dcc7a",cancelled:"#f05555"};
  const TC={install:"#4dff88",repair:"#ff8c3d",relocate:"#7db8ff",collection:"#ffc04d"};

  // ── STYLED EXCEL EXPORT ──
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const label = type==="daily"?date:month;

    // Helper: set cell style
    function sc(ws, addr, val, style) {
      if(!ws[addr]) ws[addr] = {};
      ws[addr].v = val;
      ws[addr].t = typeof val==="number"?"n":"s";
      ws[addr].s = style;
    }

    // Color constants for xlsx
    const GREEN_DARK  = "1a5a2a";
    const GREEN_MID   = "2dcc7a";
    const GREEN_LIGHT = "e8f9f0";
    const BLUE_DARK   = "0d1e42";
    const BLUE_MID    = "4d8ef5";
    const AMBER       = "f0a030";
    const RED         = "f05555";
    const GRAY_HD     = "2d3450";
    const GRAY_ROW    = "f5f7ff";
    const WHITE       = "ffffff";
    const BLACK       = "1a1a2e";

    function hdrStyle(bgHex, fgHex="ffffff") {
      return { font:{bold:true,color:{rgb:fgHex},sz:10}, fill:{fgColor:{rgb:bgHex}}, alignment:{horizontal:"center",vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"888888"}},bottom:{style:"thin",color:{rgb:"888888"}},left:{style:"thin",color:{rgb:"888888"}},right:{style:"thin",color:{rgb:"888888"}}} };
    }
    function cellStyle(bgHex=WHITE, fgHex=BLACK, bold=false, center=false) {
      return { font:{color:{rgb:fgHex},sz:10,bold}, fill:{fgColor:{rgb:bgHex}}, alignment:{horizontal:center?"center":"left",vertical:"center",wrapText:true}, border:{top:{style:"thin",color:{rgb:"cccccc"}},bottom:{style:"thin",color:{rgb:"cccccc"}},left:{style:"thin",color:{rgb:"cccccc"}},right:{style:"thin",color:{rgb:"cccccc"}}} };
    }
    function titleStyle() {
      return { font:{bold:true,sz:14,color:{rgb:WHITE}}, fill:{fgColor:{rgb:GREEN_DARK}}, alignment:{horizontal:"left",vertical:"center"} };
    }

    // ── SHEET 1: JOB ORDERS ──
    const ws1 = {};
    // Title rows
    ws1["A1"] = {v:`FIBERDESK — ${type==="daily"?"DAILY":"MONTHLY"} REPORT`, t:"s", s:titleStyle()};
    ws1["A2"] = {v:`Period: ${label}  |  Site: ${site}  |  Generated: ${new Date().toLocaleString("en-PH")}`, t:"s", s:{font:{sz:9,color:{rgb:"aaaaaa"}},fill:{fgColor:{rgb:"111525"}}}};
    ws1["A3"] = {v:"", t:"s"};

    const j1hdrs = ["JO #","Date","Site","Task","Status","Client Name","Address","Contact","LCP","NAP","Port","Plan","Referral","Install Fee","Technician","Notes","Materials Used","Total Cost (₱)","Cancel Reason"];
    j1hdrs.forEach((h,i) => {
      const addr = XLSX.utils.encode_cell({r:3,c:i});
      ws1[addr] = {v:h, t:"s", s:hdrStyle(GREEN_DARK)};
    });

    filtered.forEach(([id,j],ri) => {
      const row = ri+4;
      const bg = ri%2===0?WHITE:GREEN_LIGHT;
      const rowData = [
        j.jo||id.slice(-6), j.date||"", j.site||"", (j.type||"").toUpperCase(),
        (j.status||"").toUpperCase(), j.client||"", j.address||"", j.contact||"",
        j.lcp||"", j.nap||"", j.port||"", j.plan||"", j.referral||"",
        j.installFee?Number(j.installFee):0, j.techName||"",
        j.notes||"", j.materialsUsed?.map(m=>`${m.name} x${m.qty}`).join(", ")||"",
        j.materialsTotal||0, j.cancelReason||""
      ];
      rowData.forEach((v,ci) => {
        const addr = XLSX.utils.encode_cell({r:row,c:ci});
        const isNum = typeof v==="number";
        let fgColor = BLACK;
        if(ci===3) fgColor = v==="INSTALL"?"0d5a1e":v==="REPAIR"?"8b3000":v==="RELOCATE"?"1a3a8a":"7a4a00";
        if(ci===4) fgColor = v==="DONE"||v==="ACTIVATED"?GREEN_DARK:v==="CANCELLED"?RED:v==="ON-SITE"?"0a4a40":BLUE_DARK;
        ws1[addr] = {v, t:isNum?"n":"s", s:cellStyle(bg,fgColor,ci===5,isNum)};
      });
    });

    ws1["!ref"] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:filtered.length+4,c:j1hdrs.length-1}});
    ws1["!merges"] = [{s:{r:0,c:0},e:{r:0,c:j1hdrs.length-1}},{s:{r:1,c:0},e:{r:1,c:j1hdrs.length-1}},{s:{r:2,c:0},e:{r:2,c:j1hdrs.length-1}}];
    ws1["!cols"] = [10,10,10,10,12,20,28,14,6,6,6,14,14,10,18,20,30,12,20].map(w=>({wch:w}));
    ws1["!rows"] = [{hpt:24},{hpt:16},{hpt:8},{hpt:22}];
    XLSX.utils.book_append_sheet(wb, ws1, "Job Orders");

    // ── SHEET 2: MATERIALS USED ──
    const ws2 = {};
    ws2["A1"] = {v:"MATERIALS / EQUIPMENT USED", t:"s", s:titleStyle()};
    ws2["A2"] = {v:`Period: ${label}`, t:"s", s:{font:{sz:9,color:{rgb:"aaaaaa"}},fill:{fgColor:{rgb:"111525"}}}};
    ws2["A3"] = {v:"", t:"s"};
    const m2hdrs = ["Date","JO #","Site","Client","Task","Technician","Material / Item","Unit","Qty","Unit Price (₱)","Total (₱)"];
    m2hdrs.forEach((h,i)=>{ws2[XLSX.utils.encode_cell({r:3,c:i})]={v:h,t:"s",s:hdrStyle(GRAY_HD)};});
    let matRow = 4;
    done.forEach(([,j]) => {
      (j.materialsUsed||[]).forEach(m => {
        const bg = matRow%2===0?WHITE:"f0f4ff";
        [[j.date||""],[j.jo||""],[j.site||""],[j.client||""],[j.type?.toUpperCase()||""],[j.techName||""],[m.name||""],[m.unit||""],[m.qty||0],[m.price||0],[(m.price||0)*(m.qty||0)]].forEach((v,ci)=>{
          const addr = XLSX.utils.encode_cell({r:matRow,c:ci});
          const val = v[0]; const isNum=typeof val==="number";
          ws2[addr]={v:val,t:isNum?"n":"s",s:cellStyle(bg,ci===10?GREEN_DARK:ci===8||ci===9?BLUE_DARK:BLACK,ci===10,isNum)};
        });
        matRow++;
      });
    });
    // Total row
    const totRow = matRow;
    ws2[XLSX.utils.encode_cell({r:totRow,c:9})]={v:"GRAND TOTAL:",t:"s",s:{font:{bold:true,sz:11,color:{rgb:GREEN_DARK}},fill:{fgColor:{rgb:GREEN_LIGHT}},alignment:{horizontal:"right"}}};
    ws2[XLSX.utils.encode_cell({r:totRow,c:10})]={v:totalMat,t:"n",s:{font:{bold:true,sz:12,color:{rgb:GREEN_DARK}},fill:{fgColor:{rgb:GREEN_LIGHT}},alignment:{horizontal:"center"}}};
    ws2["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:totRow,c:10}});
    ws2["!merges"]=[{s:{r:0,c:0},e:{r:0,c:10}},{s:{r:1,c:0},e:{r:1,c:10}},{s:{r:2,c:0},e:{r:2,c:10}}];
    ws2["!cols"]=[10,10,10,20,10,18,28,8,6,12,12].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb,ws2,"Materials Used");

    // ── SHEET 3: SITE SUMMARY ──
    const ws3 = {};
    ws3["A1"]={v:"SUMMARY BY SITE",t:"s",s:titleStyle()};
    ws3["A2"]={v:`Period: ${label}`,t:"s",s:{font:{sz:9,color:{rgb:"aaaaaa"}},fill:{fgColor:{rgb:"111525"}}}};
    ws3["A3"]={v:"",t:"s"};
    const s3hdrs=["Site","Total Jobs","Done","Pending","Cancelled","Install","Repair","Relocate","Collection","Materials Cost (₱)"];
    s3hdrs.forEach((h,i)=>{ws3[XLSX.utils.encode_cell({r:3,c:i})]={v:h,t:"s",s:hdrStyle(GREEN_DARK)};});
    Object.entries(bySite).forEach(([siteName,sj],ri)=>{
      const row=ri+4; const bg=ri%2===0?WHITE:GREEN_LIGHT;
      const mat=sj.reduce((a,j)=>a+(j.materialsTotal||0),0);
      [siteName,sj.length,sj.filter(j=>j.status==="done"||j.status==="activated").length,sj.filter(j=>j.status==="pending").length,sj.filter(j=>j.status==="cancelled").length,sj.filter(j=>j.type==="install").length,sj.filter(j=>j.type==="repair").length,sj.filter(j=>j.type==="relocate").length,sj.filter(j=>j.type==="collection").length,mat].forEach((v,ci)=>{
        const addr=XLSX.utils.encode_cell({r:row,c:ci});
        const isNum=typeof v==="number";
        ws3[addr]={v,t:isNum?"n":"s",s:cellStyle(bg,ci===0?"4a0080":ci===9?GREEN_DARK:BLACK,ci===0||ci===9,isNum)};
      });
    });
    ws3["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Object.keys(bySite).length+4,c:9}});
    ws3["!merges"]=[{s:{r:0,c:0},e:{r:0,c:9}},{s:{r:1,c:0},e:{r:1,c:9}},{s:{r:2,c:0},e:{r:2,c:9}}];
    ws3["!cols"]=[14,10,8,10,10,10,10,10,12,16].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb,ws3,"Summary by Site");

    // ── SHEET 4: TECHNICIAN SUMMARY ──
    const ws4={};
    ws4["A1"]={v:"SUMMARY BY TECHNICIAN",t:"s",s:titleStyle()};
    ws4["A2"]={v:`Period: ${label}`,t:"s",s:{font:{sz:9,color:{rgb:"aaaaaa"}},fill:{fgColor:{rgb:"111525"}}}};
    ws4["A3"]={v:"",t:"s"};
    const s4hdrs=["Technician","Area","Total Jobs","Done","Cancelled","Install","Repair","Relocate","Collection","Materials Used (₱)"];
    s4hdrs.forEach((h,i)=>{ws4[XLSX.utils.encode_cell({r:3,c:i})]={v:h,t:"s",s:hdrStyle(GRAY_HD)};});
    Object.entries(byTech).forEach(([tn,tj],ri)=>{
      const row=ri+4; const bg=ri%2===0?WHITE:GRAY_ROW;
      const techInfo=Object.values(techs).find(t=>t.name===tn);
      const mat=tj.reduce((a,j)=>a+(j.materialsTotal||0),0);
      [tn,techInfo?.area||"—",tj.length,tj.filter(j=>j.status==="done"||j.status==="activated").length,tj.filter(j=>j.status==="cancelled").length,tj.filter(j=>j.type==="install").length,tj.filter(j=>j.type==="repair").length,tj.filter(j=>j.type==="relocate").length,tj.filter(j=>j.type==="collection").length,mat].forEach((v,ci)=>{
        const addr=XLSX.utils.encode_cell({r:row,c:ci});
        const isNum=typeof v==="number";
        ws4[addr]={v,t:isNum?"n":"s",s:cellStyle(bg,ci===9?GREEN_DARK:ci===0?BLUE_DARK:BLACK,ci===0,isNum)};
      });
    });
    ws4["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Object.keys(byTech).length+4,c:9}});
    ws4["!merges"]=[{s:{r:0,c:0},e:{r:0,c:9}},{s:{r:1,c:0},e:{r:1,c:9}},{s:{r:2,c:0},e:{r:2,c:9}}];
    ws4["!cols"]=[22,20,10,8,10,10,10,10,12,16].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb,ws4,"Summary by Tech");

    // ── SHEET 5: CANCELLED JOBS ──
    if(cancelled.length>0){
      const ws5={};
      ws5["A1"]={v:"CANCELLED JOBS",t:"s",s:{...titleStyle(),fill:{fgColor:{rgb:"8b0000"}}}};
      ws5["A2"]={v:`Period: ${label}`,t:"s",s:{font:{sz:9,color:{rgb:"aaaaaa"}},fill:{fgColor:{rgb:"111525"}}}};
      ws5["A3"]={v:"",t:"s"};
      const c5hdrs=["JO #","Date","Site","Task","Client","Address","Technician","Cancelled By","Reason","Date Cancelled"];
      c5hdrs.forEach((h,i)=>{ws5[XLSX.utils.encode_cell({r:3,c:i})]={v:h,t:"s",s:hdrStyle("8b0000")};});
      cancelled.forEach(([,j],ri)=>{
        const row=ri+4; const bg=ri%2===0?"fff5f5":"ffe0e0";
        [j.jo||"",j.date||"",j.site||"",j.type?.toUpperCase()||"",j.client||"",j.address||"",j.techName||"",j.cancelledBy||"",j.cancelReason||"",j.cancelledAt?new Date(j.cancelledAt).toLocaleString("en-PH"):""].forEach((v,ci)=>{
          ws5[XLSX.utils.encode_cell({r:row,c:ci})]={v,t:"s",s:cellStyle(bg,ci===8?RED:BLACK,ci===8)};
        });
      });
      ws5["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:cancelled.length+4,c:9}});
      ws5["!merges"]=[{s:{r:0,c:0},e:{r:0,c:9}},{s:{r:1,c:0},e:{r:1,c:9}},{s:{r:2,c:0},e:{r:2,c:9}}];
      ws5["!cols"]=[10,10,10,10,20,28,18,16,30,18].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb,ws5,"Cancelled Jobs");
    }

    XLSX.writeFile(wb,`FiberDesk_${type==="daily"?"Daily":"Monthly"}_Report_${label}.xlsx`);
  }

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@media print{.no-print{display:none!important}body{background:white!important;color:black!important}.print-card{background:white!important;border:1px solid #ccc!important}table{font-size:10px}th{background:#1a5a2a!important;color:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:5px 8px}td{padding:4px 8px;border:1px solid #ddd;color:black!important}tr:nth-child(even)td{background:#f5fff5!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:12mm;size:A4 landscape}}`}</style>

      {/* FILTERS */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}} className="no-print">
        <div style={{display:"flex",gap:4}}>
          {["daily","monthly"].map(t=>(
            <button key={t} style={{background:type===t?"#4d8ef5":"none",border:"1px solid",borderColor:type===t?"#4d8ef5":"#222840",color:type===t?"#fff":"#7b87b8",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}} onClick={()=>setType(t)}>
              {t==="daily"?"Daily":"Monthly"}
            </button>
          ))}
        </div>
        {type==="daily"?<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={fs.filter}/>:<input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={fs.filter}/>}
        <select value={site} onChange={e=>setSite(e.target.value)} style={fs.filter}>
          <option value="All">All Sites</option>
          {SITES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={tech} onChange={e=>setTech(e.target.value)} style={fs.filter}>
          <option value="All">All Technicians</option>
          {Object.entries(techs).map(([id,t])=><option key={id} value={id}>{t.name}</option>)}
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button style={fs.btnExcel} onClick={exportExcel}>⬇ Export Excel (Styled)</button>
          <button style={fs.btnPrint} onClick={()=>window.print()}>��� Print</button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
        {[["Total Jobs",filtered.length,"#4d8ef5"],["Done",done.length,"#2dcc7a"],["Active",filtered.filter(([,j])=>!["done","cancelled","activated"].includes(j.status)).length,"#f0a030"],["Cancelled",cancelled.length,"#f05555"],["Materials","₱"+totalMat.toLocaleString(),"#9b78f5"]].map(([lbl,val,col])=>(
          <div key={lbl} style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,padding:"13px 15px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:col}}></div>
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#7b87b8",marginBottom:6}}>{lbl}</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"monospace",color:col}}>{val}</div>
          </div>
        ))}
      </div>

      {/* SUMMARY BY SITE */}
      <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:14}} className="print-card">
        <div style={{padding:"10px 14px",borderBottom:"1px solid #222840",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8"}}>Summary by Site</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>{["Site","Total","Done","Pending","Cancel","Install","Repair","Relocate","Collection","Materials (₱)"].map(h=><th key={h} style={fs.th}>{h}</th>)}</tr></thead>
            <tbody>
              {Object.entries(bySite).map(([siteName,sj])=>(
                <tr key={siteName} style={{borderBottom:"1px solid #222840"}}>
                  <td style={{padding:"8px 10px",fontWeight:700,color:"#9b78f5"}}>{siteName}</td>
                  <td style={fs.td}>{sj.length}</td>
                  <td style={{...fs.td,color:"#2dcc7a",fontWeight:700}}>{sj.filter(j=>j.status==="done"||j.status==="activated").length}</td>
                  <td style={{...fs.td,color:"#f0a030"}}>{sj.filter(j=>j.status==="pending").length}</td>
                  <td style={{...fs.td,color:"#f05555"}}>{sj.filter(j=>j.status==="cancelled").length}</td>
                  <td style={{...fs.td,color:"#4dff88"}}>{sj.filter(j=>j.type==="install").length}</td>
                  <td style={{...fs.td,color:"#ff8c3d"}}>{sj.filter(j=>j.type==="repair").length}</td>
                  <td style={{...fs.td,color:"#7db8ff"}}>{sj.filter(j=>j.type==="relocate").length}</td>
                  <td style={{...fs.td,color:"#ffc04d"}}>{sj.filter(j=>j.type==="collection").length}</td>
                  <td style={{...fs.td,color:"#9b78f5",fontFamily:"monospace",fontWeight:700}}>₱{sj.reduce((a,j)=>a+(j.materialsTotal||0),0).toLocaleString()}</td>
                </tr>
              ))}
              {Object.keys(bySite).length===0 && <tr><td colSpan={10} style={{textAlign:"center",padding:20,color:"#3d4668"}}>Walang data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED LIST */}
      <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:14}} className="print-card">
        <div style={{padding:"10px 14px",borderBottom:"1px solid #222840",fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8"}}>Detailed Job Orders ({filtered.length})</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5,minWidth:1000}}>
            <thead><tr>{["JO #","Date","Site","Task","Status","Client","LCP/NAP/Port","Technician","Notes","Cancel Reason","Materials","Cost"].map(h=><th key={h} style={fs.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(([id,j])=>(
                <tr key={id} style={{borderBottom:"1px solid #222840"}}>
                  <td style={{...fs.td,fontFamily:"monospace",fontSize:10}}>{j.jo||id.slice(-6)}</td>
                  <td style={{...fs.td,fontFamily:"monospace",fontSize:10}}>{j.date}</td>
                  <td style={{...fs.td,color:"#9b78f5"}}>{j.site||"—"}</td>
                  <td style={{padding:"6px 10px"}}><span style={{background:{install:"#0d2a0d",repair:"#2a1005",relocate:"#0d1530",collection:"#2a1800"}[j.type],color:TC[j.type],padding:"2px 7px",borderRadius:3,fontSize:9.5,fontWeight:800}}>{j.type?.toUpperCase()}</span></td>
                  <td style={{padding:"6px 10px"}}><span style={{background:{pending:"#2a1805",dispatched:"#0d1535","on-way":"#1a1040","on-site":"#052220",done:"#081e13",activated:"#081e13",cancelled:"#2a0a0a"}[j.status],color:SC[j.status],padding:"2px 7px",borderRadius:3,fontSize:9.5,fontWeight:700}}>{j.status?.toUpperCase()}</span></td>
                  <td style={{...fs.td,fontWeight:600}}>{j.client}</td>
                  <td style={{...fs.td,fontFamily:"monospace",fontSize:10,color:"#20c8b0"}}>{j.lcp} {j.nap} {j.port}</td>
                  <td style={fs.td}>{j.techName||"—"}</td>
                  <td style={{...fs.td,color:"#f0a030",fontSize:11,maxWidth:120,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.notes||"—"}</td>
                  <td style={{...fs.td,color:"#f05555",fontSize:11,maxWidth:120,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.cancelReason||"—"}</td>
                  <td style={{...fs.td,fontSize:10.5,maxWidth:140,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.materialsUsed?.map(m=>`${m.name}x${m.qty}`).join(", ")||"—"}</td>
                  <td style={{...fs.td,fontFamily:"monospace",color:"#2dcc7a",fontWeight:700}}>{j.materialsTotal?"₱"+j.materialsTotal.toLocaleString():"—"}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={12} style={{textAlign:"center",padding:24,color:"#3d4668"}}>Walang jobs para sa period na ito</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length>0 && (
          <div style={{display:"flex",justifyContent:"flex-end",padding:"10px 14px",borderTop:"1px solid #222840",gap:24}}>
            <span style={{fontSize:12,color:"#7b87b8"}}>Total: <strong style={{color:"#dde3ff"}}>{filtered.length}</strong></span>
            <span style={{fontSize:12,color:"#7b87b8"}}>Done: <strong style={{color:"#2dcc7a"}}>{done.length}</strong></span>
            <span style={{fontSize:12,color:"#7b87b8"}}>Cancelled: <strong style={{color:"#f05555"}}>{cancelled.length}</strong></span>
            <span style={{fontSize:12,color:"#7b87b8"}}>Materials: <strong style={{fontFamily:"monospace",color:"#9b78f5"}}>₱{totalMat.toLocaleString()}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

const fs = {
  filter:{background:"#111525",border:"1px solid #222840",color:"#dde3ff",padding:"6px 10px",borderRadius:8,fontFamily:"inherit",fontSize:12,outline:"none"},
  th:{padding:"7px 10px",background:"#111525",color:"#7b87b8",fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",borderBottom:"1px solid #222840",textAlign:"left",whiteSpace:"nowrap"},
  td:{padding:"7px 10px",color:"#dde3ff"},
  btnExcel:{background:"#081e13",border:"1px solid #2dcc7a",color:"#2dcc7a",padding:"7px 14px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer"},
  btnPrint:{background:"#0d1535",border:"1px solid #4d8ef5",color:"#4d8ef5",padding:"7px 14px",borderRadius:8,fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer"},
};
