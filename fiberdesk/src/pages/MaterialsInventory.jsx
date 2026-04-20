import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, update, remove, push, set } from "firebase/database";

export default function MaterialsInventory() {
  const [materials,  setMaterials]  = useState({});
  const [techs,      setTechs]      = useState({});
  const [inventory,  setInventory]  = useState({});   // inventory/{techId}/{matId}
  const [requests,   setRequests]   = useState({});   // inventoryRequests/
  const [logs,       setLogs]       = useState({});   // inventoryLogs/
  const [tab,        setTab]        = useState("stock");    // stock | requests | logs
  const [selectedTech, setSelectedTech] = useState("all");
  const [addModal,   setAddModal]   = useState(null); // { techId, techName }
  const [addForm,    setAddForm]    = useState({ matId:"", qty:"", note:"" });
  const [bulkModal,  setBulkModal]  = useState(false);
  const [bulkTechId, setBulkTechId] = useState("");
  const [bulkItems,  setBulkItems]  = useState([]);   // [{matId, qty}]
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    const u1=onValue(ref(db,"materials"),        s=>setMaterials(s.exists()?s.val():{}));
    const u2=onValue(ref(db,"technicians"),      s=>setTechs(s.exists()?s.val():{}));
    const u3=onValue(ref(db,"inventory"),        s=>setInventory(s.exists()?s.val():{}));
    const u4=onValue(ref(db,"inventoryRequests"),s=>setRequests(s.exists()?s.val():{}));
    const u5=onValue(ref(db,"inventoryLogs"),    s=>setLogs(s.exists()?s.val():{}));
    return ()=>{u1();u2();u3();u4();u5();};
  },[]);

  const techList  = Object.entries(techs);
  const matList   = Object.entries(materials);
  const reqList   = Object.entries(requests).sort((a,b)=>new Date(b[1].createdAt)-new Date(a[1].createdAt));
  const logList   = Object.entries(logs).sort((a,b)=>new Date(b[1].timestamp)-new Date(a[1].timestamp));
  const pendingReqs = reqList.filter(([,r])=>r.status==="pending").length;

  // Get inventory for a tech
  function getTechInv(techId) { return inventory[techId]||{}; }

  // Total qty of a material across all techs
  function totalStock(matId) {
    return Object.values(inventory).reduce((a,ti)=>{
      const item=ti[matId]; return a+(item?.qty||0);
    },0);
  }

  // Add stock to a tech
  async function addStock() {
    if (!addForm.matId||!addForm.qty) { alert("Piliin ang material at quantity"); return; }
    setSaving(true);
    const { techId } = addModal;
    const mat = materials[addForm.matId];
    const current = inventory[techId]?.[addForm.matId]?.qty || 0;
    const newQty = current + (parseInt(addForm.qty)||0);

    await set(ref(db,`inventory/${techId}/${addForm.matId}`), {
      qty: newQty,
      matName: mat.name,
      unit: mat.unit,
      price: mat.price,
      techName: techs[techId]?.name||"",
      lastUpdated: new Date().toISOString(),
    });

    // Log it
    await push(ref(db,"inventoryLogs"), {
      type: "admin-add",
      matId: addForm.matId,
      matName: mat.name,
      techId,
      techName: techs[techId]?.name||"",
      qty: parseInt(addForm.qty)||0,
      prevQty: current,
      newQty,
      note: addForm.note,
      timestamp: new Date().toISOString(),
      by: "Admin",
    });

    setAddModal(null); setAddForm({matId:"",qty:"",note:""}); setSaving(false);
  }

  // Bulk add to one tech
  async function submitBulk() {
    if (!bulkTechId||bulkItems.filter(i=>i.matId&&i.qty).length===0) { alert("Piliin ang tech at materials"); return; }
    setSaving(true);
    const updates={};
    for (const item of bulkItems) {
      if (!item.matId||!item.qty) continue;
      const mat = materials[item.matId];
      const current = inventory[bulkTechId]?.[item.matId]?.qty||0;
      const newQty = current+(parseInt(item.qty)||0);
      updates[`inventory/${bulkTechId}/${item.matId}`]={
        qty:newQty, matName:mat.name, unit:mat.unit, price:mat.price,
        techName:techs[bulkTechId]?.name||"", lastUpdated:new Date().toISOString(),
      };
      await push(ref(db,"inventoryLogs"),{
        type:"admin-add", matId:item.matId, matName:mat.name,
        techId:bulkTechId, techName:techs[bulkTechId]?.name||"",
        qty:parseInt(item.qty)||0, prevQty:current, newQty,
        note:"Bulk add", timestamp:new Date().toISOString(), by:"Admin",
      });
    }
    await update(ref(db),updates);
    setBulkModal(false); setBulkTechId(""); setBulkItems([]); setSaving(false);
  }

  // Adjust qty manually
  async function adjustQty(techId, matId, newQty) {
    const mat = materials[matId];
    const current = inventory[techId]?.[matId]?.qty||0;
    if (newQty<0) return;
    await update(ref(db,`inventory/${techId}/${matId}`),{
      qty: newQty, matName:mat?.name, lastUpdated:new Date().toISOString()
    });
    await push(ref(db,"inventoryLogs"),{
      type:"admin-adjust", matId, matName:mat?.name||"",
      techId, techName:techs[techId]?.name||"",
      qty: newQty-current, prevQty:current, newQty,
      note:"Manual adjustment", timestamp:new Date().toISOString(), by:"Admin",
    });
  }

  // Approve request
  async function approveRequest(reqId) {
    setSaving(true);
    const req = requests[reqId];
    const mat = materials[req.matId];
    const current = inventory[req.techId]?.[req.matId]?.qty||0;
    const newQty  = current+(req.qtyRequested||0);

    await set(ref(db,`inventory/${req.techId}/${req.matId}`),{
      qty:newQty, matName:req.matName, unit:req.unit,
      price:mat?.price||0, techName:req.techName,
      lastUpdated:new Date().toISOString(),
    });
    await update(ref(db,`inventoryRequests/${reqId}`),{
      status:"approved", approvedAt:new Date().toISOString(), approvedBy:"Admin"
    });
    await push(ref(db,"inventoryLogs"),{
      type:"request-approved", matId:req.matId, matName:req.matName,
      techId:req.techId, techName:req.techName,
      qty:req.qtyRequested, prevQty:current, newQty,
      note:`Approved request: ${req.note||""}`, timestamp:new Date().toISOString(), by:"Admin",
    });
    setSaving(false);
  }

  // Decline request
  async function declineRequest(reqId) {
    await update(ref(db,`inventoryRequests/${reqId}`),{
      status:"declined", declinedAt:new Date().toISOString()
    });
  }

  // ── UI ──
  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>

      {/* PAGE HEADER */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,letterSpacing:-.5,color:"#dde3ff",margin:0}}>Materials Inventory</h1>
          <div style={{fontSize:12,color:"#7b87b8",marginTop:3}}>Admin manages stock per technician · Auto-deducted when tech declares materials</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{...s.btnSm,background:"#0d1e42",border:"1px solid #4d8ef5",color:"#4d8ef5"}}
            onClick={()=>{setBulkModal(true);setBulkTechId("");setBulkItems([{matId:"",qty:""}]);}}>
            📦 Bulk Add Stock
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#111525",borderRadius:10,padding:4}}>
        {[
          ["stock",    "📊 Stock per Tech"],
          ["requests", `📥 Requests${pendingReqs>0?` (${pendingReqs})`:""}`, pendingReqs>0],
          ["logs",     "📋 History"],
        ].map(([k,lbl,hasAlert])=>(
          <button key={k} style={{flex:1,padding:"8px 0",borderRadius:7,border:"none",fontFamily:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer",
            background:tab===k?"#4d8ef5":"transparent",
            color:tab===k?"#fff":hasAlert?"#f0a030":"#7b87b8"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── STOCK VIEW ── */}
      {tab==="stock" && (
        <>
          {/* Tech filter */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <select style={s.sel} value={selectedTech} onChange={e=>setSelectedTech(e.target.value)}>
              <option value="all">All Technicians</option>
              {techList.map(([id,t])=><option key={id} value={id}>{t.name}</option>)}
            </select>
            <span style={{fontSize:12,color:"#7b87b8",marginLeft:"auto"}}>
              Click ✏ to adjust qty · Click + to add stock
            </span>
          </div>

          {/* One card per tech */}
          {techList
            .filter(([id])=>selectedTech==="all"||id===selectedTech)
            .map(([tid,t])=>{
              const inv = getTechInv(tid);
              const totalItems = Object.values(inv).reduce((a,i)=>a+(i.qty||0),0);
              const totalVal = Object.values(inv).reduce((a,i)=>a+(i.qty||0)*(materials[Object.keys(materials).find(k=>materials[k]?.name===i.matName)]?.price||i.price||0),0);

              return (
                <div key={tid} style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden",marginBottom:14}}>
                  {/* Tech header */}
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #222840",background:"#0c0f1a"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:t.bg||"#0d1e42",color:t.color||"#4d8ef5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>{t.initials||t.name[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#dde3ff"}}>{t.name}</div>
                      <div style={{fontSize:11,color:"#7b87b8"}}>{t.area||"—"} · {t.spec||""}</div>
                    </div>
                    <div style={{textAlign:"right",marginRight:8}}>
                      <div style={{fontSize:11,color:"#7b87b8"}}>Total Items</div>
                      <div style={{fontFamily:"monospace",fontSize:18,fontWeight:800,color:"#4d8ef5"}}>{totalItems}</div>
                    </div>
                    <button style={{...s.btnSm,background:"#0d1e42",border:"1px solid #4d8ef5",color:"#4d8ef5",flexShrink:0}}
                      onClick={()=>{setAddModal({techId:tid,techName:t.name});setAddForm({matId:"",qty:"",note:""});}}>
                      + Add Stock
                    </button>
                  </div>

                  {/* Materials list */}
                  {Object.keys(inv).length===0 ? (
                    <div style={{padding:"18px 16px",textAlign:"center",color:"#3d4668",fontSize:12}}>
                      Walang inventory pa si {t.name}. I-click ang "+ Add Stock".
                    </div>
                  ) : (
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr>
                            {["Material","Unit","In Stock","Value","Last Updated","Adjust"].map(h=>(
                              <th key={h} style={{padding:"7px 12px",background:"#111525",color:"#7b87b8",fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",borderBottom:"1px solid #222840",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(inv).map(([mid,item],i)=>{
                            const matPrice = materials[mid]?.price || item.price || 0;
                            const val = (item.qty||0)*matPrice;
                            const isLow = (item.qty||0)<=2;
                            const isOut = (item.qty||0)===0;
                            return (
                              <tr key={mid} style={{borderBottom:"1px solid #222840",background:isOut?"#1a0505":isLow?"#1a0e00":"transparent"}}>
                                <td style={{padding:"9px 12px",fontWeight:600,color:isOut?"#f05555":isLow?"#f0a030":"#dde3ff"}}>
                                  {item.matName||materials[mid]?.name||"—"}
                                  {isOut&&<span style={{marginLeft:8,fontSize:9.5,background:"#f05555",color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:700}}>OUT</span>}
                                  {isLow&&!isOut&&<span style={{marginLeft:8,fontSize:9.5,background:"#f0a030",color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:700}}>LOW</span>}
                                </td>
                                <td style={{padding:"9px 12px",color:"#9b78f5",fontSize:11}}>{item.unit||"pc"}</td>
                                <td style={{padding:"9px 12px",fontFamily:"monospace",fontWeight:800,fontSize:15,color:isOut?"#f05555":isLow?"#f0a030":"#2dcc7a"}}>
                                  {item.qty||0}
                                </td>
                                <td style={{padding:"9px 12px",fontFamily:"monospace",fontSize:12,color:"#7b87b8"}}>₱{val.toLocaleString()}</td>
                                <td style={{padding:"9px 12px",fontSize:10,color:"#3d4668",fontFamily:"monospace"}}>
                                  {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString("en-PH") : "—"}
                                </td>
                                <td style={{padding:"9px 12px"}}>
                                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                                    <button style={s.adjBtn} onClick={()=>adjustQty(tid,mid,Math.max(0,(item.qty||0)-1))}>−</button>
                                    <span style={{fontFamily:"monospace",minWidth:28,textAlign:"center",fontWeight:700,color:"#dde3ff"}}>{item.qty||0}</span>
                                    <button style={{...s.adjBtn,borderColor:"#2dcc7a",color:"#2dcc7a"}} onClick={()=>adjustQty(tid,mid,(item.qty||0)+1)}>+</button>
                                    <button style={{...s.adjBtn,marginLeft:4}} onClick={async()=>{
                                      const v=prompt(`Set exact quantity for ${item.matName} (${t.name}):`,item.qty||0);
                                      if(v!==null&&v!=="") adjustQty(tid,mid,Math.max(0,parseInt(v)||0));
                                    }}>✏</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
        </>
      )}

      {/* ── REQUESTS VIEW ── */}
      {tab==="requests" && (
        <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden"}}>
          {reqList.length===0 ? (
            <div style={{padding:30,textAlign:"center",color:"#3d4668",fontSize:13}}>Walang requests pa.</div>
          ) : (
            reqList.map(([rid,r])=>{
              const isPending  = r.status==="pending";
              const isApproved = r.status==="approved";
              const isDeclined = r.status==="declined";
              return (
                <div key={rid} style={{padding:"14px 16px",borderBottom:"1px solid #222840",
                  background:isPending?"#0d1535":isApproved?"#081e13":isDeclined?"#140505":"transparent",
                  borderLeft:`3px solid ${isPending?"#f0a030":isApproved?"#2dcc7a":isDeclined?"#f05555":"#222840"}`}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <span style={{fontWeight:700,fontSize:13.5,color:"#dde3ff"}}>{r.matName}</span>
                        <span style={{background:"#0d1535",border:"1px solid #4d8ef544",color:"#4d8ef5",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                          ×{r.qtyRequested} {r.unit}
                        </span>
                        <span style={{background:isPending?"#2a1805":isApproved?"#081e13":"#2a0a0a",
                          border:`1px solid ${isPending?"#f0a030":isApproved?"#2dcc7a":"#f05555"}44`,
                          color:isPending?"#f0a030":isApproved?"#2dcc7a":"#f05555",
                          borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                          {isPending?"⏳ Pending":isApproved?"✅ Approved":"❌ Declined"}
                        </span>
                      </div>
                      <div style={{fontSize:12,color:"#7b87b8",marginBottom:3}}>
                        🔧 {r.techName}  ·  {new Date(r.createdAt).toLocaleString("en-PH")}
                      </div>
                      {r.note&&<div style={{fontSize:12,color:"#f0a030",fontStyle:"italic"}}>📝 "{r.note}"</div>}
                      {isApproved&&<div style={{fontSize:11,color:"#2dcc7a",marginTop:3}}>Approved by {r.approvedBy} · {new Date(r.approvedAt).toLocaleDateString("en-PH")}</div>}
                    </div>
                    {isPending && (
                      <div style={{display:"flex",gap:8,flexShrink:0}}>
                        <button style={{...s.btnSm,background:"#081e13",border:"1px solid #2dcc7a",color:"#2dcc7a",fontWeight:700}}
                          onClick={()=>approveRequest(rid)} disabled={saving}>
                          ✅ Approve (+{r.qtyRequested} {r.unit})
                        </button>
                        <button style={{...s.btnSm,background:"#2a0a0a",border:"1px solid #f05555",color:"#f05555"}}
                          onClick={()=>declineRequest(rid)}>
                          ❌ Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── LOGS ── */}
      {tab==="logs" && (
        <div style={{background:"#0c0f1a",border:"1px solid #222840",borderRadius:12,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
              <thead>
                <tr>{["Time","Type","Tech","Material","Qty Change","Prev→New","Job / Note"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",background:"#111525",color:"#7b87b8",fontSize:9.5,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",borderBottom:"1px solid #222840",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {logList.slice(0,100).map(([lid,l])=>{
                  const typeMap={
                    "admin-add":     {label:"Admin Add",   color:"#4d8ef5"},
                    "admin-adjust":  {label:"Adjusted",    color:"#9b78f5"},
                    "auto-deduct":   {label:"Used (Job)",  color:"#f0a030"},
                    "request-approved":{label:"Req Approved",color:"#2dcc7a"},
                  };
                  const t=typeMap[l.type]||{label:l.type,color:"#7b87b8"};
                  const qtyDiff = l.qty>0?`+${l.qty}`:String(l.qty);
                  return (
                    <tr key={lid} style={{borderBottom:"1px solid #222840"}}>
                      <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:10,color:"#7b87b8",whiteSpace:"nowrap"}}>{new Date(l.timestamp).toLocaleString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                      <td style={{padding:"8px 12px"}}><span style={{background:t.color+"22",border:`1px solid ${t.color}44`,color:t.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700}}>{t.label}</span></td>
                      <td style={{padding:"8px 12px",color:"#dde3ff",fontWeight:600}}>{l.techName}</td>
                      <td style={{padding:"8px 12px",color:"#dde3ff"}}>{l.matName}</td>
                      <td style={{padding:"8px 12px",fontFamily:"monospace",fontWeight:700,color:l.qty>0?"#2dcc7a":"#f0a030"}}>{l.qty>0?"+":""}{l.qty}</td>
                      <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:"#7b87b8"}}>{l.prevQty??"-"}→<span style={{color:"#dde3ff",fontWeight:700}}>{l.newQty??"-"}</span></td>
                      <td style={{padding:"8px 12px",fontSize:11,color:"#7b87b8",maxWidth:160,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.jo||l.note||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {logList.length===0&&<div style={{padding:30,textAlign:"center",color:"#3d4668",fontSize:13}}>Walang logs pa.</div>}
        </div>
      )}

      {/* ── ADD STOCK MODAL ── */}
      {addModal && (
        <div style={s.ov}>
          <div style={s.modal}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #222840"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#dde3ff"}}>+ Add Stock</div>
              <div style={{fontSize:11,color:"#7b87b8",marginTop:2}}>Para kay {addModal.techName}</div>
            </div>
            <div style={{padding:"16px 20px"}}>
              <div style={s.fg}>
                <label style={s.lbl}>Material</label>
                <select style={s.fi} value={addForm.matId} onChange={e=>setAddForm({...addForm,matId:e.target.value})}>
                  <option value="">Piliin ang material...</option>
                  {matList.map(([id,m])=>{
                    const current=inventory[addModal.techId]?.[id]?.qty||0;
                    return <option key={id} value={id}>{m.name} (kasalukuyang stock: {current} {m.unit})</option>;
                  })}
                </select>
              </div>
              <div style={s.fg}>
                <label style={s.lbl}>Quantity to Add</label>
                <input style={s.fi} type="number" min="1" value={addForm.qty} onChange={e=>setAddForm({...addForm,qty:e.target.value})} placeholder="e.g. 10" />
              </div>
              <div style={s.fg}>
                <label style={s.lbl}>Note (optional)</label>
                <input style={s.fi} value={addForm.note} onChange={e=>setAddForm({...addForm,note:e.target.value})} placeholder="e.g. Monthly supply, from PO #123..." />
              </div>
              {addForm.matId&&addForm.qty&&(
                <div style={{background:"#0d1535",border:"1px solid #4d8ef5",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#7b87b8"}}>
                  Current: <strong style={{color:"#dde3ff"}}>{inventory[addModal.techId]?.[addForm.matId]?.qty||0}</strong>
                  {" "}→ New: <strong style={{color:"#2dcc7a"}}>{(inventory[addModal.techId]?.[addForm.matId]?.qty||0)+(parseInt(addForm.qty)||0)}</strong>
                  {" "}{materials[addForm.matId]?.unit}
                </div>
              )}
            </div>
            <div style={{padding:"12px 20px",borderTop:"1px solid #222840",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={s.btnGhost} onClick={()=>setAddModal(null)}>Cancel</button>
              <button style={s.btnPrimary} onClick={addStock} disabled={saving}>{saving?"Saving...":"Add Stock"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK ADD MODAL ── */}
      {bulkModal && (
        <div style={s.ov}>
          <div style={{...s.modal,width:580,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #222840"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#dde3ff"}}>📦 Bulk Add Stock</div>
              <div style={{fontSize:11,color:"#7b87b8",marginTop:2}}>Mag-add ng maraming materials sa isang tech</div>
            </div>
            <div style={{padding:"16px 20px"}}>
              <div style={s.fg}>
                <label style={s.lbl}>Technician</label>
                <select style={s.fi} value={bulkTechId} onChange={e=>setBulkTechId(e.target.value)}>
                  <option value="">Piliin ang technician...</option>
                  {techList.map(([id,t])=><option key={id} value={id}>{t.name} — {t.area}</option>)}
                </select>
              </div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7b87b8",marginBottom:10}}>Materials</div>
              {bulkItems.map((item,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                  <select style={{...s.fi,flex:2}} value={item.matId} onChange={e=>{const b=[...bulkItems];b[i].matId=e.target.value;setBulkItems(b);}}>
                    <option value="">Piliin...</option>
                    {matList.map(([id,m])=><option key={id} value={id}>{m.name}</option>)}
                  </select>
                  <input style={{...s.fi,width:80,flex:"0 0 80px"}} type="number" min="1" placeholder="Qty" value={item.qty}
                    onChange={e=>{const b=[...bulkItems];b[i].qty=e.target.value;setBulkItems(b);}} />
                  <button style={{background:"#2a0a0a",border:"1px solid #f0555544",color:"#f05555",borderRadius:6,padding:"5px 8px",cursor:"pointer",flexShrink:0}}
                    onClick={()=>setBulkItems(bulkItems.filter((_,x)=>x!==i))}>✕</button>
                </div>
              ))}
              <button style={{...s.btnSm,marginTop:4}} onClick={()=>setBulkItems([...bulkItems,{matId:"",qty:""}])}>+ Add Row</button>
            </div>
            <div style={{padding:"12px 20px",borderTop:"1px solid #222840",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={s.btnGhost} onClick={()=>setBulkModal(false)}>Cancel</button>
              <button style={s.btnPrimary} onClick={submitBulk} disabled={saving}>{saving?"Saving...":"Submit Bulk Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  btnSm:    { background:"none", border:"1px solid #222840", color:"#7b87b8", padding:"6px 12px", borderRadius:7, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:600 },
  btnPrimary:{ background:"#4d8ef5", color:"#fff", border:"none", padding:"8px 16px", borderRadius:8, fontFamily:"inherit", fontSize:12.5, fontWeight:600, cursor:"pointer" },
  btnGhost: { background:"none", border:"1px solid #222840", color:"#7b87b8", padding:"8px 16px", borderRadius:8, fontFamily:"inherit", fontSize:12.5, cursor:"pointer" },
  adjBtn:   { background:"#111525", border:"1px solid #222840", color:"#7b87b8", width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" },
  sel:      { background:"#111525", border:"1px solid #222840", color:"#dde3ff", padding:"7px 11px", borderRadius:8, fontFamily:"inherit", fontSize:12, outline:"none" },
  ov:       { position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" },
  modal:    { background:"#0c0f1a", border:"1px solid #2e3450", borderRadius:16, width:460, maxWidth:"95vw" },
  fg:       { display:"flex", flexDirection:"column", gap:4, marginBottom:12 },
  lbl:      { fontSize:9.5, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"#7b87b8" },
  fi:       { background:"#111525", border:"1px solid #222840", color:"#dde3ff", padding:"8px 11px", borderRadius:8, fontFamily:"inherit", fontSize:13, outline:"none", width:"100%" },
};