# 🇵🇭 PhilTrace — National Public Infrastructure Transparency Platform

> **Google Maps for Philippine Public Works & Infrastructure.**  
> Cross-referencing official DPWH claims, verified citizen whistleblower reports, and ESRI Wayback satellite ground-truth across **248,220+ public contracts** totaling **₱2.4 Trillion+** in tracked national infrastructure funds.

---

## 🌟 Key Features

### 1. 🗺️ Full-Screen Google Maps Engine (`/map`)
- **Archipelago-Locked Canvas**: Smooth pan and zoom strictly bounded to Philippine coordinates.
- **Free Roam Mode**: Dynamic density and public budget expenditure heatmaps dissolving into clustered markers and individual project pins.
- **Guided Drill-Down Mode**: Hierarchical step navigation (`Philippines > Region > Province > Municipality > Barangay`) with smooth camera transitions and boundary masking.
- **Basemap Switcher**: Satellite imagery, Dark mode, and Topographical Terrain.

### 2. 📑 Slide-Out Project Inspection Drawer
- **🛰️ ESRI Wayback Past vs. Present Satellite Slider**: Split-screen before/after satellite slider to visually verify whether roads/bridges were actually constructed.
- **🚶 360° Google Street View**: Ground panorama embedded at exact project GPS coordinates.
- **🤖 Gemini AI Executive Summary**: Instant plain Tagalog/English translation of complex engineering scope and citizen sentiment analysis.
- **📊 Budget vs. Disbursement Contrast**: Identifies overdue contracts, stalled works, and overpaid anomalies (<30% progress with >70% payouts).

### 3. ⭐ 5-Star Multi-Criteria Citizen Reviews & Whistleblowing
- **Multi-Criteria Scoring**: Rate physical completion perception, structural build quality, and active worker presence.
- **Ground Photo Uploads**: Community photo submissions with timestamp verification.
- **Anti-Spam Phone OTP**: Verified with SMS OTP.
- **Corroboration**: Local community members can upvote and corroborate eyewitness reports.

### 4. 🏢 National Contractor Joint-Venture Network (`/contractors`)
- **Cytoscape.js Alliance Graph**: Interactive network graph mapping joint-venture co-occurrences across 73,449 multi-contractor awards.
- **Performance Leaderboard**: Ranked table of 11,162 contractors by total public funds won, completion rates, and delay flags.

### 5. 📍 Near Me Proximity Scanner (`/nearby`)
- Mobile-friendly geolocation radar finding infrastructure contracts within 1km to 25km of the citizen's live GPS coordinates.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (Turbopack, App Router)](https://nextjs.org/) & React 19
- **Mapping & Geo**: [Mapbox GL JS](https://www.mapbox.com/) & ESRI Wayback Satellite API
- **Graph Visualization**: [Cytoscape.js](https://js.cytoscape.org/) & React-CytoscapeJS
- **Database & ORM**: PostgreSQL via [Supabase](https://supabase.com/) & [Prisma ORM](https://www.prisma.io/)
- **AI Intelligence**: [Google Gemini Flash](https://ai.google.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/EsBazza/PhilTrace.git
cd PhilTrace/philtrace
npm install
```

### 2. Configure Environment Variables
Create a `.env` file inside `philtrace/`:
```env
DATABASE_URL="your-postgresql-database-url"
NEXT_PUBLIC_MAPBOX_TOKEN="your-mapbox-token"
GEMINI_API_KEY="your-gemini-api-key"
DEMO_OTP_BYPASS="true"
```

### 3. Run Database Migrations
```bash
npx prisma db push
```

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ⚖️ Civic Mission & License
PhilTrace is an open-source public interest civic technology initiative created to empower Filipino taxpayers, journalists, and local communities with transparency and accountability.
