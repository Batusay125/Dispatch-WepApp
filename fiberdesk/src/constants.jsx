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

export const DEFAULT_MATERIALS = [
  {name:"Modem Set (ONU)",unit:"pc",price:800},
  {name:"SC/APC Connector (Blue)",unit:"pc",price:25},
  {name:"SC/UPC Connector (Green)",unit:"pc",price:20},
  {name:"FOC (Fiber Optic Cable)",unit:"meter",price:12},
  {name:"Cable Clamp",unit:"pc",price:3},
  {name:"F Clamp",unit:"pc",price:5},
  {name:"Drop Wire",unit:"meter",price:12},
  {name:"Splitter 1x2",unit:"pc",price:80},
  {name:"Splitter 1x4",unit:"pc",price:120},
  {name:"Patch Cord SC/APC",unit:"pc",price:60},
  {name:"Alcohol + Cotton",unit:"set",price:10},
  {name:"Cable Tie",unit:"pc",price:2},
  {name:"Electrical Tape",unit:"roll",price:20},
  {name:"Heat Shrink",unit:"pc",price:5},
];

export const DEFAULT_TECHS = {
  T01:{name:"Arnel Bautista",initials:"AB",loginName:"arnel",pin:"1111",area:"Socorro / San Isidro",contact:"0917-111-2222",spec:"FTTH Installation",color:"#4d8ef5",bg:"#0d1e42"},
  T02:{name:"Benny Cruz",initials:"BC",loginName:"benny",pin:"2222",area:"Lawa / Bancal",contact:"0918-222-3333",spec:"All-around",color:"#2dcc7a",bg:"#081e13"},
  T03:{name:"Karl Mendoza",initials:"KM",loginName:"karl",pin:"3333",area:"Socorro / Abangan",contact:"0919-333-4444",spec:"Troubleshooting",color:"#f0a030",bg:"#2a1a05"},
  T04:{name:"Danny Flores",initials:"DF",loginName:"danny",pin:"4444",area:"Lias / Loma",contact:"0920-444-5555",spec:"Splicing / OPM",color:"#9b78f5",bg:"#160f30"},
  T05:{name:"Edgar Santos",initials:"ES",loginName:"edgar",pin:"5555",area:"Bahay Pare / Malolos",contact:"0921-555-6666",spec:"FTTH Installation",color:"#20c8b0",bg:"#052220"},
  T06:{name:"Felix Ramos",initials:"FR",loginName:"felix",pin:"6666",area:"Lawa / Bancal",contact:"0922-666-7777",spec:"All-around",color:"#f07030",bg:"#2a1005"},
  T07:{name:"Gani Torres",initials:"GT",loginName:"gani",pin:"7777",area:"Socorro / Lias",contact:"0923-777-8888",spec:"Troubleshooting",color:"#e85c9a",bg:"#2a0e1c"},
};