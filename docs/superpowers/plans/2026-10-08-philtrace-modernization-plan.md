# 🇵🇭 PhilTrace Modernization Implementation Plan

> **Based on Design Spec:** `docs/superpowers/specs/2026-10-08-philtrace-modernization-design.md`  
> **Target:** Vercel Production Readiness, Zero-Fake-Data Enforcement, Security Hardening, Mapbox UI Modernization, and Sigma.js Migration.

---

## 🎯 Task Breakdown by Phase

### Phase 1: Vercel Readiness, Storage & Security Hardening
- [ ] **Task 1.1: Install Supabase Client & Update Package Scripts**
  - Install `@supabase/supabase-js` in `philtrace/`.
  - Update `package.json` build command to `"prisma generate && next build"`.
  - Update `philtrace/.gitignore` to track `.env.example` (`!.env.example`).
  - Add `DIRECT_URL` and `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` to `.env.example`.
- [ ] **Task 1.2: Refactor `/api/upload` to Supabase Storage**
  - Replace local `fs.writeFile` to `public/uploads/` with direct Supabase Storage stream to bucket `review-photos`.
  - Validate image magic bytes and file size limits.
  - Return permanent public Supabase CDN URLs.
- [ ] **Task 1.3: Fix Vercel Serverless Route Incompatibilities**
  - Add `GET` export to `src/app/api/cron/sync/route.ts` for Vercel Cron.
  - Configure `export const maxDuration = 60;` on long-running routes.
  - Resolve `src/app/api/locations/boundary/route.ts` to bundle or safely fallback without reading uncommitted directories.
- [ ] **Task 1.4: Purge All Fake & Synthetic Data**
  - Strip 11 fake Tagalog comments, 13 synthetic contractor companies, and mock admin accounts from `scripts/seed-all.ts`.
  - Remove hardcoded demo phone `+639000000000` and OTP `123456` state defaults from `src/components/review-modal.tsx`.
  - Replace static fake summary cards (`5,240 Clean`, `1,120 Overdue`, `42 Terminated`) in `src/app/contractors/page.tsx` with dynamic DB aggregates.
- [ ] **Task 1.5: Security & Throttling Fixes**
  - Add rate limiting to `src/app/api/report/otp/route.ts` (max 3/phone/hour, 10/IP/day) and switch to `crypto.randomInt()`.
  - Fix comment query in `src/app/api/report/route.ts` to filter by `phoneHash`, resolving the country-wide 30-comment project lockout bug.
  - Deprecate `Comment` in `prisma/schema.prisma` or ensure cascade deletes.

---

### Phase 2: Mapbox UI & Performance Overhaul
- [ ] **Task 2.1: Floating Glassmorphic Command Pill HUD**
  - Build top floating breadcrumb navigation: `[ 🇵🇭 Philippines > Region > Province > City ]`.
  - Add quick risk filter toggle chips: `[ 🔴 Overdue ] [ 🟡 Overpaid ] [ 🔵 Active ] [ 🟢 Completed ]`.
- [ ] **Task 2.2: Native WebGL Vector Circle Layers**
  - Deprecate 150 HTML DOM markers (`new mapboxgl.Marker()`) in `src/components/philippines-map.tsx` and `/map/page.tsx`.
  - Implement native Mapbox GL circle layers with risk pulse effects.
- [ ] **Task 2.3: Non-Destructive Basemap Switcher**
  - Refactor `useMapInstance.ts` and `philippines-map.tsx` to use `map.setStyle()` preserving camera center, pitch, and zoom.
- [ ] **Task 2.4: Consolidate ESRI Wayback Satellite Catalogs**
  - Unify `satellite-comparison.tsx` and `wayback-slider.tsx` to use a single shared release catalog in `src/lib/constants.ts`.

---

### Phase 3: Sigma.js Bipartite Network Graph
- [ ] **Task 3.1: Install Sigma.js & Graphology**
  - Install `sigma`, `graphology`, `graphology-layout-forceatlas2`, `@react-sigma/core`.
- [ ] **Task 3.2: Build Bipartite Graph Route**
  - Update `/api/contractors/graph` to return typed nodes for both Contractors (circles) and Projects (squares/diamonds with status colors).
- [ ] **Task 3.3: Implement WebGL Network Canvas**
  - Replace Cytoscape canvas in `src/app/contractors/page.tsx` with Sigma.js WebGL renderer.
  - Run ForceAtlas2 layout in a Web Worker.
  - Connect Project node clicks directly to open `ProjectInspectionDrawer`.
- [ ] **Task 3.4: Consolidate Engineers into Network**
  - Merge `/engineers` data into the `/contractors` network graph filter.

---

### Phase 4: Advanced AI & Forensic Intelligence
- [ ] **Task 4.1: Natural Language Text-to-Database Engine**
  - Replace naive regex keyword matching in `src/app/api/chat/route.ts` with Gemini Structured Function Calling.
- [ ] **Task 4.2: Automated BOQ Price Padding Checker**
  - Compare unit prices against `UnitPriceBenchmark` and highlight anomalies in the inspection drawer.
- [ ] **Task 4.3: One-Click Audit Dossier (PDF Export)**
  - Add printable/exportable investigation summary for civic watchdogs.
