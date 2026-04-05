import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, push, set, remove, update } from "firebase/database";

export default function Materials() {
  const [materials, setMaterials] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", unit: "pc", price: "" });

  useEffect(() => {
    return onValue(ref(db, "materials"), s => setMaterials(s.exists() ? s.val() : {}));
  }, []);

  async function submit() {
    if (!form.name.trim()) { alert("Ilagay ang pangalan ng material"); return; }
    const data = { name: form.name.trim(), unit: form.unit, price: parseFloat(form.price) || 0 };
    if (editId) await update(ref(db, "materials/" + editId), data);
    else await push(ref(db, "materials"), data);
    setShowModal(false); setEditId(null); setForm({ name: "", unit: "pc", price: "" });
  }

  function openEdit(id) {
    const m = materials[id];
    setForm({ name: m.name, unit: m.unit, price: m.price });
    setEditId(id); setShowModal(true);
  }

  async function deleteMat(id) {
    if (!confirm("I-delete ang material na ito?")) return;
    await remove(ref(db, "materials/" + id));
  }

  const units = ["pc", "meter", "roll", "set", "box", "pair"];
  const total = Object.values(materials).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#dde3ff" }}>Materials / Equipment List</h1>
          <div style={{ fontSize: 12, color: "#7b87b8", marginTop: 2 }}>{total} items · Ginagamit ng technicians para mag-declare ng materials used</div>
        </div>
        <button style={s.btnPrimary} onClick={() => { setEditId(null); setForm({ name: "", unit: "pc", price: "" }); setShowModal(true); }}>+ Add Material</button>
      </div>

      <div style={{ background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["#","Material Name","Unit","Price (₱)","Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 14px", background: "#111525", color: "#7b87b8", fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid #222840", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(materials).map(([id, m], i) => (
                <tr key={id} style={{ borderBottom: "1px solid #222840" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#7b87b8" }}>{i + 1}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#dde3ff" }}>{m.name}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: "#1a1040", color: "#9b78f5", border: "1px solid #3a2080", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{m.unit}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: "#2dcc7a" }}>₱{(m.price || 0).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={s.editBtn} onClick={() => openEdit(id)}>Edit</button>
                      <button style={s.deleteBtn} onClick={() => deleteMat(id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {total === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "#3d4668" }}>Walang materials pa. I-click ang "+ Add Material"</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={s.modalOv} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHd}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#dde3ff" }}>{editId ? "Edit Material" : "Add Material"}</h3>
              <button style={s.mx} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: "18px 20px" }}>
              <div style={s.fg}>
                <label style={s.lbl}>Material Name *</label>
                <input style={s.fi} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. SC/APC Connector (Blue)" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <div style={s.fg}>
                  <label style={s.lbl}>Unit</label>
                  <select style={s.fi} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                    {units.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div style={s.fg}>
                  <label style={s.lbl}>Unit Price (₱)</label>
                  <input style={s.fi} type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #222840", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={s.btnGhost} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={s.btnPrimary} onClick={submit}>{editId ? "Update" : "Add Material"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  btnPrimary: { background: "#4d8ef5", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "none", border: "1px solid #222840", color: "#7b87b8", padding: "8px 16px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, cursor: "pointer" },
  editBtn: { background: "#0d1535", border: "1px solid #4d8ef5", color: "#4d8ef5", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
  deleteBtn: { background: "#2a0a0a", border: "1px solid #f05555", color: "#f05555", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
  modalOv: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" },
  modal: { background: "#0c0f1a", border: "1px solid #2e3450", borderRadius: 16, width: 500, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto" },
  modalHd: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #222840" },
  mx: { background: "none", border: "none", color: "#7b87b8", fontSize: 16, cursor: "pointer" },
  fg: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 },
  lbl: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" },
  fi: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "8px 11px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none", width: "100%" },
};