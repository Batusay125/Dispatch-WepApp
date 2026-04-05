# FiberDesk — ISP Dispatch Management System

> Real-time fiber optic ISP dispatch system.  
> Built with **React + Vite + Firebase Realtime Database**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles & Access](#roles--access)
- [Workflow](#workflow)
- [Features](#features)
- [Firebase Setup](#firebase-setup)
- [Getting Started](#getting-started)
- [Default Accounts](#default-accounts)
- [Sites](#sites)
- [Materials / Equipment](#materials--equipment)
- [Reports & Export](#reports--export)

---

## Overview

FiberDesk ay isang real-time dispatch management system para sa isang small fiber optic ISP. Ang sistema ay naka-designed para sa tatlong roles:

```
Marketing/Admin  →  Dispatcher  →  Technician  →  IT/Network
  (create job)     (assign tech)   (do the job)   (activate internet)
```

Lahat ng updates ay **real-time** — kapag nag-assign ang Dispatcher ng task, lalabas agad ito sa Technician na may sariling login. Kapag natapos ng Tech ang job, makikita agad ng Dispatcher at IT.

---

## Tech Stack

| Technology | Gamit |
|---|---|
| React 18 | Frontend UI |
| Vite | Build tool / Dev server |
| Firebase Realtime Database | Real-time sync at data storage |
| SheetJS (xlsx) | Styled Excel export |
| CSS-in-JS (inline styles) | Styling — walang external CSS library |

---

## Project Structure

```
fiberdesk/
├── public/
├── src/
│   ├── firebase/
│   │   └── config.js          # Firebase configuration
│   ├── pages/
│   │   ├── Login.jsx          # Login screen (3 roles, PIN para sa Tech)
│   │   ├── Dispatcher.jsx     # Main dispatcher dashboard
│   │   ├── Technician.jsx     # Tech view — dashboard, tasks, records
│   │   ├── ITPortal.jsx       # IT activation portal
│   │   ├── Reports.jsx        # Daily/monthly reports + Excel export
│   │   └── Materials.jsx      # Materials/equipment management
│   ├── App.jsx                # Root component — routes per role
│   ├── constants.js           # Sites, default techs, materials, colors
│   ├── main.jsx               # Entry point
│   └── index.css              # Global styles + animations
├── package.json
├── vite.config.js
└── README.md
```

---

## Roles & Access

### 🎧 Admin / Dispatcher
- Login: kahit anong pangalan + password
- Gumawa ng job orders mula sa client requests
- Mag-assign ng technician per job
- Monitor ng pipeline — Pending → Dispatched → On-Site → Done
- Access sa Reports, Materials management, at Dispatch Board

### 🔧 Technician
- Login: **username** (e.g. `arnel`) + **4-digit PIN**
- Makita ang sariling active tasks
- Mag-update ng task status — On the Way → On-Site → Done
- Para sa installation — mag-submit ng MAC Address at installation details papunta sa IT
- Mag-declare ng materials na ginamit per job
- Dashboard na may daily at monthly records

### 💻 IT / Network
- Login: kahit anong pangalan + password
- Makita ang mga jobs na naka-status `for-approval` (may MAC address na)
- I-configure ang modem gamit ang MAC Address na ibinigay ng tech
- Mag-input ng activation code/config
- Kapag na-activate — makikita agad ng tech ang code

---

## Workflow

### Regular Jobs (Repair, Relocate, Collection)

```
1. Admin/CSR  →  Gumawa ng Job Order
                 (Client Name, Address, Contact, LCP/NAP/Port, Notes)

2. Dispatcher →  I-assign ang Technician
                 Status: PENDING → DISPATCHED

3. Technician →  Papunta Na Ako    (DISPATCHED → ON THE WAY)
             →  Nandito Na Ako    (ON THE WAY → ON-SITE)
             →  Declare Materials  (mga ginamit na items + qty)
             →  TAPOS NA           (ON-SITE → DONE)
```

### Installation Jobs

```
1. Admin/CSR  →  Gumawa ng Install Job Order
                 (Client Name, Address, Contact, Plan, Referral, Install Fee)
                 ⚠ LCP/NAP/Port ay blank pa — tech ang maglalagay

2. Dispatcher →  I-assign ang Technician

3. Technician →  Papunta Na Ako → Nandito Na Ako
             →  Submit Installation Details:
                 - Real Name, Real Address, Contact
                 - Plan, Referral
                 - LCP, NAP, Port  ← siya ang naglalagay nito
                 - MAC Address ng modem
                 - Modem Serial Number
                 - Materials used
                 Status: ON-SITE → FOR APPROVAL

4. IT/Network →  Makita ang pending activation
             →  I-configure ang modem gamit ang MAC Address
             →  I-input ang Activation Code / PPPoE credentials
             →  Status: FOR APPROVAL → ACTIVATED

5. Technician →  Makita ang Activation Code sa kanyang screen
             →  Mark as Done
             Status: ACTIVATED → DONE
```

---

## Features

### Dispatcher Dashboard
- ✅ Pipeline view — 5 stages: Pending, Dispatched, On the Way, On-Site, Done
- ✅ Dispatch Board — queue ng unassigned jobs + available techs
- ✅ Job Orders table — may filter, search, sort
- ✅ Site tracking — Server, Lawa, Bancal, Socorro, Lias, Loma, Bahay Pare, Malolos
- ✅ Jobs by site summary sa dashboard
- ✅ Cancelled jobs tracking — may reason

### Technician View (Mobile-friendly)
- ✅ Dashboard tab — stat cards, today's tasks, 6-month bar chart
- ✅ Tasks tab — active jobs na may action buttons
- ✅ Records tab — daily at monthly history, materials breakdown
- ✅ PIN-based login — secure at madaling gamitin sa phone
- ✅ Cancel task — may selectable reasons + custom message
- ✅ Materials declaration — per job, may running total

### IT Portal
- ✅ For-activation queue — mga jobs na naghihintay ng config
- ✅ MAC Address display — malaki at malinaw
- ✅ Activation code submission — napupunta agad sa tech
- ✅ History ng mga na-activate na

### Reports
- ✅ Daily at Monthly reports
- ✅ Filter by Site at Technician
- ✅ Summary by Site table
- ✅ Detailed job list na may status, materials, cancel reason
- ✅ **Styled Excel export** — 5 sheets:
  - `Job Orders` — color-coded per task type at status
  - `Materials Used` — alternating rows + grand total
  - `Summary by Site` — green headers
  - `Summary by Tech` — blue headers
  - `Cancelled Jobs` — red headers (lalabas lang kung may cancelled)
- ✅ Print-ready format

### Materials Management (Admin only)
- ✅ Add, edit, delete materials/equipment
- ✅ Unit at unit price per item
- ✅ Ginagamit ng technicians para mag-declare ng materials per job

---

## Firebase Setup

### 1. Gumawa ng Firebase Project
1. Pumunta sa [console.firebase.google.com](https://console.firebase.google.com)
2. Add project → pangalanan → Create
3. Sa sidebar → Databases & Storage → **Realtime Database**
4. Create Database → Singapore (asia-southeast1) → **Start in test mode**

### 2. I-update ang Rules
Sa Realtime Database → Rules tab, i-replace ng:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
I-click ang **Publish**.

### 3. I-configure ang `src/firebase/config.js`
```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## Getting Started

### Prerequisites
- Node.js v18+ ([nodejs.org](https://nodejs.org) → LTS version)
- Git (optional)

### Installation

```bash
# 1. Pumunta sa project folder
cd Desktop/Dispatch/fiberdesk

# 2. I-install ang dependencies
npm install

# 3. I-install ang required packages
npm install firebase xlsx react-router-dom

# 4. I-run ang development server
npm run dev
```

Buksan ang browser → `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output ay nasa `dist/` folder — pwedeng i-deploy sa Netlify, Vercel, o Firebase Hosting.

---

## Default Accounts

### Dispatcher / Admin
| Field | Value |
|---|---|
| Role | Admin / Dispatcher |
| Username | Kahit anong pangalan |
| Password | Kahit ano |

### IT / Network
| Field | Value |
|---|---|
| Role | IT / Network |
| Username | Kahit anong pangalan |
| Password | Kahit ano |

### Technicians (PIN-based)

| Technician | Username | PIN | Area |
|---|---|---|---|
| Arnel Bautista | `arnel` | `1111` | Socorro / San Isidro |
| Benny Cruz | `benny` | `2222` | Lawa / Bancal |
| Karl Mendoza | `karl` | `3333` | Socorro / Abangan |
| Danny Flores | `danny` | `4444` | Lias / Loma |
| Edgar Santos | `edgar` | `5555` | Bahay Pare / Malolos |
| Felix Ramos | `felix` | `6666` | Lawa / Bancal |
| Gani Torres | `gani` | `7777` | Socorro / Lias |

> ⚠ Para palitan ang PIN ng isang technician, pumunta sa **Firebase Console → Realtime Database → technicians → [tech ID] → pin** at baguhin ang value.

> ⚠ Para magdagdag ng bagong technician, pumunta sa **Dispatcher → Technicians → + Add Technician**.

---

## Sites

Ang mga site/area na covered ng sistema:

| Site | Description |
|---|---|
| Server | Main server location |
| Lawa | Lawa area |
| Bancal | Bancal area |
| Socorro | Ma. Socorro, Marilao |
| Lias | Lias area |
| Loma | Loma area |
| Bahay Pare | Bahay Pare area |
| Malolos | Malolos area |

Para magdagdag ng site, buksan ang `src/constants.js` at i-edit ang `SITES` array.

---

## Materials / Equipment

### Default Materials

| Item | Unit | Default Price |
|---|---|---|
| Modem Set (ONU) | pc | ₱800 |
| SC/APC Connector (Blue) | pc | ₱25 |
| SC/UPC Connector (Green) | pc | ₱20 |
| FOC (Fiber Optic Cable) | meter | ₱12 |
| Cable Clamp | pc | ₱3 |
| F Clamp | pc | ₱5 |
| Drop Wire | meter | ₱12 |
| Splitter 1x2 | pc | ₱80 |
| Splitter 1x4 | pc | ₱120 |
| Patch Cord SC/APC | pc | ₱60 |
| Alcohol + Cotton | set | ₱10 |
| Cable Tie | pc | ₱2 |
| Electrical Tape | roll | ₱20 |
| Heat Shrink | pc | ₱5 |

> Para mag-edit ng materials, pumunta sa **Dispatcher → Materials** page.

---

## Reports & Export

### Daily Report
- Filter by specific date
- Filter by site at technician
- Summary ng jobs, completion rate, at materials cost
- Exportable sa Excel

### Monthly Report
- Filter by month
- Breakdown per site at per technician
- 6-month trend visible sa Technician dashboard

### Excel Export (5 Sheets)
1. **Job Orders** — buong listahan ng jobs na may color coding
2. **Materials Used** — detalye ng bawat item na ginamit + grand total
3. **Summary by Site** — aggregated per site
4. **Summary by Tech** — aggregated per technician
5. **Cancelled Jobs** — lahat ng cancelled + reason (lalabas lang kung may cancelled)

---

## Task Types & Status Flow

### Task Types
| Type | Color | Description |
|---|---|---|
| INSTALL | 🟢 Green | Bagong connection |
| REPAIR | 🟠 Orange | Troubleshoot / No signal / Slow |
| RELOCATE | 🔵 Blue | Transfer ng connection |
| COLLECTION | 🟡 Yellow | Billing collection |

### Status Flow
```
PENDING → DISPATCHED → ON THE WAY → ON-SITE → DONE
                                          ↓
                                    (Install only)
                                   FOR APPROVAL → CONFIGURING → ACTIVATED → DONE
                                          ↑
                                    (Tech submits MAC Address)
                                          ↑
                                    (IT configures modem)
```

| Status | Description |
|---|---|
| PENDING | Bagong job, hindi pa assigned |
| DISPATCHED | May assigned na technician |
| ON THE WAY | Tech papunta na sa client |
| ON-SITE | Tech nandoon na, nagtatrabaho |
| FOR APPROVAL | Install only — nag-submit na ng MAC, naghihintay ng IT |
| CONFIGURING | IT naka-configure na |
| ACTIVATED | Internet activated, code ibinigay na |
| DONE | Job completed |
| CANCELLED | Job cancelled — may reason |

---

## Development Notes

- Walang authentication system — para sa internal use lang ng kumpanya
- Firebase rules ay naka-set sa `true` (open) — para sa internal network lang gamitin
- Para sa production deployment, i-update ang Firebase rules para may proper authentication
- Ang PIN ng technician ay naka-store sa Firebase bilang plain text — para sa production, i-hash ito

---

## Contact / Support

**FiberDesk** — KeyConnect ISP Dispatch System  
Version: 1.0  
Build Year: 2026

---

*Built with ❤ for KeyConnect ISP Company*
