export const SITES = [
  "Server","Lawa","Bancal","Socorro","Lias","Loma","Bahay Pare","Malolos"
];

export const TASK_TYPES = [
  { value:"install",       label:"INSTALL",        color:"#4dff88", bg:"#0d2a0d" },
  { value:"repair",        label:"REPAIR",         color:"#ff8c3d", bg:"#2a1005" },
  { value:"relocate",      label:"RELOCATE",       color:"#7db8ff", bg:"#0d1530" },
  { value:"collection",    label:"COLLECTION",     color:"#ffc04d", bg:"#2a1800" },
  { value:"mainline",      label:"MAINLINE",       color:"#ff5fa0", bg:"#2a0a18" },
  { value:"pullout",       label:"PULL-OUT",       color:"#c084fc", bg:"#1e0a30" },
];

export const TASK_COLORS = {
  install:"#4dff88", repair:"#ff8c3d", relocate:"#7db8ff",
  collection:"#ffc04d", mainline:"#ff5fa0", pullout:"#c084fc"
};
export const TASK_BG = {
  install:"#0d2a0d", repair:"#2a1005", relocate:"#0d1530",
  collection:"#2a1800", mainline:"#2a0a18", pullout:"#1e0a30"
};

export const STATUS_COLORS = {
  pending:"#f0a030", dispatched:"#4d8ef5", "on-way":"#9b78f5",
  "on-site":"#20c8b0", "for-approval":"#f0a030", configuring:"#4d8ef5",
  activated:"#2dcc7a", done:"#2dcc7a", cancelled:"#f05555"
};
export const STATUS_BG = {
  pending:"#2a1805", dispatched:"#0d1535", "on-way":"#1a1040",
  "on-site":"#052220", "for-approval":"#2a1a05", configuring:"#0d1535",
  activated:"#081e13", done:"#081e13", cancelled:"#2a0a0a"
};
