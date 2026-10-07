# 🇵🇭 PhilTrace Modernization & Architecture Design Specification

**Document Version:** 1.0  
**Date:** 2026-10-08  
**Status:** Approved  
**Target Platform:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Prisma ORM, PostgreSQL (Supabase), Mapbox GL JS, Sigma.js, Google Gemini  

---

## 1. Executive Summary & Goals

PhilTrace (*MapaTunAI*) is an open-source civic technology platform for public works transparency across the Philippines, tracking **248,000+ public contracts** totaling **₱2.4T+** in national infrastructure funds.

This specification details the comprehensive architectural overhaul to:
1. **Achieve Production Vercel Deployment Readiness** by resolving serverless filesystem writes, cron method mismatches, and build scripts.
2. **Enforce a Strict Zero-Fake-Data Policy** by eliminating all synthetic comments, mock contractors, and hardcoded stats.
3. **Overhaul the Geospatial Map Engine** with a floating glassmorphic command HUD, native vector circle layers, and non-destructive basemap switching.
4. **Migrate the Network Graph from Cytoscape.js to Sigma.js**, creating a GPU-accelerated Bipartite (Contractors + Projects) cartel intelligence visualizer.
5. **Modernize AI & Forensics** using Gemini Multimodal Vision for satellite verification, structured function-calling for database queries, and BOQ price-padding detection.

---

## 2. Vercel Production Hardening & Cloud Infrastructure

### 2.1 Supabase Storage for Citizen Whistleblower Photos
* **Target Bucket:** Public bucket `review-photos` on Supabase Storage.
* **API Route (`src/app/api/upload/route.ts`):**
  * Remove local `fs.writeFile` to `process.cwd()/public/uploads` (which fails with `EROFS` on Vercel).
  * Stream multipart file uploads directly to `@supabase/supabase-js`.
  * Validate image magic-byte signatures (JPEG, PNG, WebP) up to 10MB.
  * Generate collision-resistant paths: `${projectId}/${Date.now()}_${crypto.randomUUID()}.${ext}`.
  * Return persistent public CDN URL.

### 2.2 Vercel Runtime & Build Configurations
* **`package.json` Build Script:** Update `"build"` to `"prisma generate && next build"`.
* **Repository Root:** Configure Vercel Project Settings **Root Directory** to `philtrace`.
* **Cron Route (`src/app/api/cron/sync/route.ts`):**
  * Export `GET` handler (`export { POST as GET }`) to support Vercel Cron triggers.
  * Add `export const maxDuration = 60;` for serverless function duration.
* **Boundary Route (`src/app/api/locations/boundary/route.ts`):**
  * Replace runtime filesystem directory scanning of gitignored `public/geo/raw_*` with a bundled static JSON registry or pre-compiled lookup, preventing `500 ENOENT` errors in production.
* **Git Repository Hygiene:** Remove large raw archives (`geojson_*.zip`, totaling 113MB) from Git tracking.

---

## 3. Zero-Fake-Data Policy & Security Hardening

### 3.1 Elimination of Synthetic / Mock Artifacts
* **`scripts/seed-all.ts` Sanitization:**
  * Remove all 11 hardcoded fake Tagalog whistleblower comments (`seedWhistleblowerAndUpdates`).
  * Remove all 13 synthetic contractor corporations (`generateFallbackProjects`).
  * Remove mock agency accounts (`dpwh-admin@philtrace.ph`).
  * Standardize all data population strictly on `scripts/sync-real-data.ts` and `scripts/sync_live_dpwh.py`.
* **`src/components/review-modal.tsx` Sanitization:**
  * Remove default demo phone `+639000000000` and OTP `123456` from React state.
* **`src/app/contractors/page.tsx` Sanitization:**
  * Replace static hardcoded summary counts (`5,240 Clean`, `1,120 Overdue`, `42 Terminated`) with live database counts via Prisma (`/api/contractors/stats`).

### 3.2 Security & Rate Limiting
* **SMS Rate Limiting (`src/app/api/report/otp/route.ts`):**
  * Enforce maximum **3 OTP requests per phone number per hour** and **10 per IP per day** to prevent SMS toll fraud.
  * Use `crypto.randomInt(100000, 999999)` for cryptographically secure OTP generation.
* **Fix Throttling Lockout Bug (`src/app/api/report/route.ts`):**
  * Correct query from `where: { projectId }` to `where: { projectId, phoneHash }` so that accumulating 30 comments on a project does not lock out subsequent community whistleblowers.
* **Corroboration Upvote Deduplication:**
  * Require a hashed device fingerprint or phone verification token to prevent bot upvote inflation on `/api/report/corroborate` and `/api/reviews/corroborate`.

---

## 4. Architecture Deprecations & Cleanups

1. **Deprecate Regex Chatbot Intent Router (`src/app/api/chat/route.ts`):**
   * Remove brittle keyword checks like `lower.includes('delayed')`.
   * Replace with Gemini Function Calling mapping directly to Prisma search parameters.
2. **Eliminate Standalone `/engineers` Page (`src/app/engineers/page.tsx`):**
   * Merge District Engineers into the unified network graph under `/contractors`.
3. **Remove Synchronous PDF Parsing from API Routes (`src/app/api/contracts/[id]/boq`):**
   * Restrict Gemini PDF OCR to background CLI workers (`scripts/parse_contracts.ts`), reading pre-extracted records from PostgreSQL.
4. **Unify Prisma Feedback Models (`prisma/schema.prisma`):**
   * Deprecate the legacy `Comment` model; standardize exclusively on `Review` (with GPS proximity, photo proof, and SHA-256 phone hashing).

---

## 5. Mapbox UI & Performance Overhaul

### 5.1 Floating Command Center HUD
* **Glassmorphic Breadcrumb:**
  * Floating top pill: `[ 🇵🇭 Philippines > Region III > Pampanga > Candaba ]` with smooth jump-back navigation.
* **Risk Filter Chips:**
  * Quick filter toggles: `[ 🔴 Overdue ] [ 🟡 Overpaid ] [ 🔵 Active ] [ 🟢 Completed ]`.
* **Project Inspection Drawer:**
  * Slides smoothly from the right upon marker click, keeping the map visible on the left.

### 5.2 Performance & Rendering
* **Non-Destructive Basemap Switcher:**
  * Use `map.setStyle()` preserving camera coordinates, pitch, and zoom instead of calling `map.remove()` and destroying the Mapbox instance.
* **WebGL Vector Circle Layers:**
  * Replace 150 heavy HTML DOM markers with native Mapbox GL circle layers with pulse animations for high-risk projects.
* **ESRI Wayback Catalog Unification:**
  * Consolidate conflicting catalogs into a single, shared release mapping in `@/lib/constants`.

---

## 6. Sigma.js Bipartite Network Graph

### 6.1 WebGL Hardware Acceleration
* **Library Migration:** Replace Cytoscape.js with **Sigma.js v3** and **Graphology**.
* **Off-Thread Layout:** Execute Graphology's **ForceAtlas2** physics layout inside a Web Worker.
* **Community Detection:** Use built-in Louvain algorithms to identify and color-code bidding syndicates automatically.

### 6.2 Bipartite Architecture (Contractors + Projects)
* **Contractor Nodes (Circles):** Sized by total contract value won ($\log_{10}$), colored by risk:
  * 🟢 Clean Record
  * 🟡 1–2 Delays
  * 🔴 Multi-Defaulter ($>3$ overdue or terminated)
* **Project Nodes (Squares/Diamonds):** High-value ($\ge$ ₱30M) and flagged projects, sized by budget (₱), colored by status:
  * 🔵 On-Going
  * 🟢 Completed
  * 🔴 Stalled / Overdue / Overpaid
* **Interactive Bridge:** Clicking any Project node immediately slides open the **Project Inspection Drawer** with ESRI satellite before/after comparison and street view.

---

## 7. Advanced AI Implementations & High-Value Additions

| Feature | Technical Implementation | Impact |
| :--- | :--- | :--- |
| **Multimodal Satellite Ground-Truth Verification** | Gemini 2.5 Flash Vision | Compares before/after ESRI Wayback satellite crops against declared DPWH completion claims, generating a **Ground-Truth Match Confidence Score (0–100%)**. |
| **Automated BOQ Price-Padding Detection** | Structured Gemini Document Parsing | Compares contract unit costs against regional benchmarks (`UnitPriceBenchmark`), flagging anomalous markups (e.g. +75% concrete markup). |
| **Natural Language Text-to-Database Engine** | Gemini Function / Tool Calling | Translates natural language prompts into validated Prisma queries. |
| **COA Audit Report Cross-Referencing** | RAG + Document Embeddings | Matches project records with COA Annual Audit Reports, flagging Notice of Disallowances. |
| **One-Click Audit Dossier (PDF Export)** | `@react-pdf/renderer` | Generates a 2-page evidentiary PDF summary for journalists and civic watchdogs. |
| **Citizen Watchlists & Subscriptions** | Prisma User Watchlist | Allows taxpayers to subscribe to their hometown municipality for project updates. |
| **Data Integrity Hashing** | SHA-256 Digest | Records cryptographic hashes of raw DPWH source documents for evidentiary integrity. |

---

## 8. Implementation Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Zero-Fake-Data, Security Hardening & Vercel Readiness          │
│ • Supabase Storage integration for /api/upload                         │
│ • Fix package.json build command & Vercel cron GET handler             │
│ • Purge synthetic data from seed-all.ts, review-modal, & contractors   │
│ • Fix 30-comment lockout bug & add SMS rate limiting                   │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 2: Mapbox UI Overhaul & Performance Optimization                 │
│ • Floating glassmorphic command HUD & filter chips                     │
│ • Native WebGL vector circle layers (deprecate DOM markers)            │
│ • Non-destructive basemap style switching without camera resets        │
│ • Unify ESRI Wayback catalogs into single constant                     │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 3: Sigma.js Bipartite Network Graph                              │
│ • Install sigma & graphology; migrate off Cytoscape.js                 │
│ • ForceAtlas2 layout in Web Worker                                     │
│ • Render Contractors (circles) + Projects (squares)                    │
│ • Connect Project node clicks directly to Project Inspection Drawer    │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 4: Advanced AI Intelligence & Civic Tooling                      │
│ • Gemini Function Calling for natural language project search          │
│ • Automated BOQ price-padding benchmark anomaly flags                  │
│ • One-Click COA / Ombudsman Audit Dossier (PDF export)                 │
└────────────────────────────────────────────────────────────────────────┘
```
