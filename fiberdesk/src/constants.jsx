export const SITES = [
  "Server", "Lawa", "Bancal", "Socorro", "Lias", "Loma", "Bahay Pare", "Malolos"
];

export const DEFAULT_MATERIALS = [
  { name: "Modem Set (ONU)", unit: "pc", price: 800 },
  { name: "SC/APC Connector (Blue)", unit: "pc", price: 25 },
  { name: "SC/UPC Connector (Green)", unit: "pc", price: 20 },
  { name: "FOC (Fiber Optic Cable)", unit: "meter", price: 12 },
  { name: "Cable Clamp", unit: "pc", price: 3 },
  { name: "F Clamp", unit: "pc", price: 5 },
  { name: "Drop Wire", unit: "meter", price: 12 },
  { name: "Splitter 1x2", unit: "pc", price: 80 },
  { name: "Splitter 1x4", unit: "pc", price: 120 },
  { name: "Patch Cord SC/APC-SC/APC", unit: "pc", price: 60 },
  { name: "Alcohol + Cotton", unit: "set", price: 10 },
  { name: "Cable Tie", unit: "pc", price: 2 },
  { name: "Electrical Tape", unit: "roll", price: 20 },
  { name: "Heat Shrink", unit: "pc", price: 5 },
];

export const DEFAULT_TECHS = {
  T01: { name: "Arnel Bautista", initials: "AB", loginName: "arnel", area: "Socorro / San Isidro", contact: "0917-111-2222", spec: "FTTH Installation", color: "#4d8ef5", bg: "#0d1e42" },
  T02: { name: "Benny Cruz", initials: "BC", loginName: "benny", area: "Lawa / Bancal", contact: "0918-222-3333", spec: "All-around", color: "#2dcc7a", bg: "#081e13" },
  T03: { name: "Karl Mendoza", initials: "KM", loginName: "karl", area: "Socorro / Abangan", contact: "0919-333-4444", spec: "Troubleshooting", color: "#f0a030", bg: "#2a1a05" },
  T04: { name: "Danny Flores", initials: "DF", loginName: "danny", area: "Lias / Loma", contact: "0920-444-5555", spec: "Splicing / OPM", color: "#9b78f5", bg: "#160f30" },
  T05: { name: "Edgar Santos", initials: "ES", loginName: "edgar", area: "Bahay Pare / Malolos", contact: "0921-555-6666", spec: "FTTH Installation", color: "#20c8b0", bg: "#052220" },
};

export const TASK_COLORS = { install: "#4dff88", repair: "#ff8c3d", relocate: "#7db8ff", collection: "#ffc04d" };
export const TASK_BG = { install: "#0d2a0d", repair: "#2a1005", relocate: "#0d1530", collection: "#2a1800" };
export const STATUS_COLORS = { pending: "#f0a030", dispatched: "#4d8ef5", "on-way": "#9b78f5", "on-site": "#20c8b0", done: "#2dcc7a" };
export const STATUS_BG = { pending: "#2a1805", dispatched: "#0d1535", "on-way": "#1a1040", "on-site": "#052220", done: "#081e13" };

export const STYLE = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#07090f", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#dde3ff" },
  card: { background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, overflow: "hidden", marginBottom: 14 },
  cardHd: { padding: "10px 14px", borderBottom: "1px solid #222840", display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b87b8" },
  ph: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 },
  h1: { fontSize: 20, fontWeight: 800, letterSpacing: -.5, color: "#dde3ff" },
  srow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 },
  sc: { background: "#0c0f1a", border: "1px solid #222840", borderRadius: 12, padding: "13px 15px", position: "relative", overflow: "hidden" },
  scTop: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  scLbl: { fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#7b87b8", marginBottom: 6 },
  scVal: { fontSize: 26, fontWeight: 700, fontFamily: "monospace", lineHeight: 1 },
  badge: { display: "inline-block", padding: "2px 7px", borderRadius: 3, fontSize: 9.5, fontWeight: 800 },
  btnPrimary: { background: "#4d8ef5", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  btnGhost: { background: "none", border: "1px solid #222840", color: "#7b87b8", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, cursor: "pointer" },
  btnGreen: { background: "#2dcc7a", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  btnDanger: { background: "#f05555", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  fi: { background: "#111525", border: "1px solid #222840", color: "#dde3ff", padding: "8px 11px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none", width: "100%" },
  f2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 },
  f3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  fsec: { fontSize: 9, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#4d8ef5", margin: "14px 0 9px", paddingBottom: 5, borderBottom: "1px solid #222840" },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 },
  th: { padding: "7px 10px", background: "#111525", color: "#7b87b8", fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid #222840", textAlign: "left", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #222840", cursor: "pointer" },
  tdMono: { fontFamily: "monospace", fontSize: 10.5, color: "#7b87b8", padding: "8px 10px" },
  modalOv: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" },
  modal: { background: "#0c0f1a", border: "1px solid #2e3450", borderRadius: 16, width: 640, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.6)" },
  modalHd: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #222840" },
  mx: { background: "none", border: "none", color: "#7b87b8", fontSize: 16, cursor: "pointer", padding: "2px 6px", borderRadius: 4 },
  modalBody: { padding: "18px 20px" },
  modalFt: { padding: "12px 20px", borderTop: "1px solid #222840", display: "flex", justifyContent: "flex-end", gap: 8 },
};

export function FG({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
      <label style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#7b87b8" }}>{label}</label>
      {children}
    </div>
  );
}

export function StatCard({ label, value, color }) {
  return (
    <div style={STYLE.sc}>
      <div style={{ ...STYLE.scTop, background: color }}></div>
      <div style={STYLE.scLbl}>{label}</div>
      <div style={{ ...STYLE.scVal, color }}>{value}</div>
    </div>
  );
}