# PhilTrace Production-Readiness & Project Dossier System Design Spec

**Date:** 2026-09-12  
**Status:** Approved  
**Platform:** Next.js 16.3.4 (App Router), React 19.2.8, TypeScript 5, Mapbox GL JS 3, PostgreSQL 16, Prisma ORM 6.19.3, Google Gemini Flash 2.5  

---

## 1. Executive Summary & Objective

This specification details the architecture, data models, forensic algorithms, and UI components for **PhilTrace's Production-Readiness Overhaul**.

The objectives are:
1. **Full Project Dossier Page (`/projects/[id]`)**: Replace the restrictive slide-out drawer with a comprehensive, Wikipedia-style dossier page featuring a 4-card hero section and 6 tabbed panels (Overview, Satellite Evidence, News & Media, Financials & BOQ, Community Reports, and Connections).
2. **Resilient Satellite Timeline (`SatelliteComparison.tsx`)**: Rebuild the ESRI Wayback integration with pre-flight coverage catalog checks, tile error recovery, side-by-side split-screen comparison (contract start vs. present), and `sessionStorage` caching.
3. **Contract Document PDF Resilience**: Implement an inline PDF viewer with pre-flight HEAD validation and automated Wayback Machine CDX API fallback (`archive.org/wayback/available?url=...`).
4. **Media Intelligence & News Scraper Pipeline (`news-scraper.ts`)**: Ingest infrastructure news via Google News RSS (0-config), NewsAPI, and Bing News; calculate a composite relevance score ($0.0–1.0$); and generate factual Gemini Flash summaries.
5. **Focused Contractor & Signatory Panel (`ContractorConnectionPanel.tsx`)**: Replace heavyweight Cytoscape rendering on project pages with a pure React hierarchical tree showing joint ventures, linked politicians, shell companies, and signing engineers with badges and source URLs.
6. **Composite Risk Scoring ($0–100$)**: Compute a holistic risk score dynamically based on payment-to-progress gaps, overdue milestones, stalled activity, grace-period-checked start milestones, and verified negative citizen reviews.
7. **Security & Performance Hardening**: Block demo OTP bypasses in production environments, enforce server-side geofencing, add 3-second `AbortController` timeouts on external requests, and apply strict cache-control headers.

---

## 2. System Architecture & Component Hierarchy

```mermaid
graph TD
    subgraph Client Pages & Components
        MAP[/map<br/>Mapbox Canvas] --> MINI_DRAWER[Project Inspection Drawer<br/>Lightweight Preview]
        MINI_DRAWER -->|Open Full Dossier| PAGE[/projects/id<br/>Dedicated Dossier Page]
        
        PAGE --> HERO[Hero Header<br/>Breadcrumb + Flags + 4 Stat Cards]
        PAGE --> TAB_BAR[Tab Navigation<br/>Zero-Layout-Shift CSS Switching]
        
        TAB_BAR --> TAB1[OverviewTab<br/>AI Briefing + Payment/Progress Chart]
        TAB_BAR --> TAB2[SatelliteTab<br/>SatelliteComparison Split-Screen]
        TAB_BAR --> TAB3[NewsTab<br/>Scraped Media + AI Summaries]
        TAB_BAR --> TAB4[FinancialsTab<br/>BOQ Table + PDF Viewer]
        TAB_BAR --> TAB5[CommunityTab<br/>Reviews + Geofence Badges + OTP Modal]
        TAB_BAR --> TAB6[ConnectionsTab<br/>ContractorConnectionPanel Tree]
    end

    subgraph Backend Services & APIs
        PAGE <--> API_PROJ[GET /api/projects/id<br/>Returns Project + Computed Risk Score]
        TAB3 <--> API_NEWS[GET /api/news?projectId=id<br/>NewsArticle Records]
        TAB4 <--> API_BOQ[GET /api/contracts/id/boq<br/>BOQ + Benchmarks]
        TAB6 <--> API_CONN[GET /api/contractors/id/connections<br/>Contractor Alliances]
        
        API_NEWS <--> SCRAPER[News Scraper Service<br/>src/lib/news-scraper.ts]
        SCRAPER <--> GNEWS[Google News RSS]
        SCRAPER <--> GEMINI[Google Gemini Flash 2.5]
    end
```

---

## 3. Detailed Technical Specifications

### 3.1 Data Models & Prisma Schema Extension (`prisma/schema.prisma`)

Add the `NewsArticle` model linked to `Project`:

```prisma
model NewsArticle {
  id             String   @id @default(cuid())
  projectId      String?
  contractorName String?
  location       String?
  title          String
  description    String
  url            String   @unique
  source         String
  publishedAt    DateTime
  relevanceScore Float    @default(0)
  aiIngested     Boolean  @default(false)
  aiSummary      String?
  createdAt      DateTime @default(now())
  project        Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([location])
  @@index([contractorName])
  @@index([publishedAt])
}
```

The `Project` model in `prisma/schema.prisma` is updated to include the relation:
```prisma
newsArticles NewsArticle[]
```

---

### 3.2 Composite Risk Scoring Algorithm (`src/lib/anomaly-flags.ts`)

Function signature:
```ts
export function computeRiskScore(project: Project & { reviews?: Review[] }): number
```

#### Scoring Rules (0–100 Max):
1. **Payment-to-Progress Gap (0–35 points)**:
   $$\text{gap} = \left(\frac{\text{amountPaid}}{\text{budgetPHP}}\right) - \left(\frac{\text{progress}}{100}\right)$$
   If $\text{gap} > 0$, points $= \min(35, \text{round}(\text{gap} \times 50))$.
2. **Stalled (20 points)**:
   `flagStalled == true` $\rightarrow +20\text{ pts}$.
3. **Overdue (15 points)**:
   `flagOverdue == true` $\rightarrow +15\text{ pts}$.
4. **Never Started with Grace Period (15 points)**:
   `flagNeverStarted == true` AND `now > startDate + 90 days` $\rightarrow +15\text{ pts}$. (Prevents false positives on day 1 of newly awarded contracts).
5. **Overpaid (10 points)**:
   `flagOverpaid == true` $\rightarrow +10\text{ pts}$.
6. **Community Whistleblower Corroboration (0–5 points)**:
   Count verified reviews (`phoneVerified == true`) with `rating <= 2`. Points $= \min(5, \text{count} \times 2)$.
7. **Total Score**: $\min(100, \sum \text{points})$.

#### UI Tier Mapping:
- **0–30**: 🟢 Low Risk (Badge: `text-emerald-400 bg-emerald-950/40 border-emerald-800`)
- **31–60**: 🟡 Moderate Risk (Badge: `text-amber-400 bg-amber-950/40 border-amber-800`)
- **61–80**: 🟠 High Risk (Badge: `text-orange-400 bg-orange-950/40 border-orange-800`)
- **81–100**: 🔴 Critical Risk (Badge: `text-rose-400 bg-rose-950/40 border-rose-800`)

---

### 3.3 Full Dedicated Project Page (`src/app/projects/[id]/page.tsx`)

#### Layout & Navigation:
- Coordinator page using TanStack Query to fetch `/api/projects/[id]`.
- Responsive layout: collapses from 2 columns to 1 column on `<768px`.
- Tab bar rendered with horizontal scrolling on mobile.
- All 6 tab panels stay mounted in DOM; visibility toggled via `hidden` vs `block` to avoid layout shifts and preserve WebGL/Mapbox contexts.

#### Hero Section:
1. **Breadcrumb**: `Map (/map?project={id}) › Region › Province › Municipality › Project ID`.
2. **Flag Pills**: Rendered for active flags (`Overpaid`, `Stalled`, `Overdue`, `Never Started`, `Payment Pending`).
3. **Title & Contractor**: Cleaned title via `cleanTitle()`, sanitized contractor via `cleanContractorName()`.
4. **Stat Cards Grid (1×4 Desktop, 2×2 Mobile)**:
   - Budget (₱ formatted)
   - Amount Disbursed (₱ formatted + % of budget)
   - Physical Progress (claimed % + progress bar)
   - Risk Score (0–100 numerical badge + risk tier label)
5. **Action Bar**:
   - **View Full Contract**: Checks PDF availability; opens live link or Wayback archive in new tab.
   - **Share**: Copies URL to clipboard with confirmation toast.
   - **File FOI Request**: Opens template modal for eFOI portal.

---

### 3.4 Tab Implementations (`src/app/projects/[id]/components/`)

#### 1. `OverviewTab.tsx`
- **AI Briefing Card**: Rendered Gemini Flash summary or fallback to generated technical summary.
- **Disbursement vs. Progress Chart**: Recharts bar/timeline comparison with highlighted divergence warning if gap $>30\%$.
- **Contractor at a Glance**: Total value won, total contracts, overdue count, and link to network profile.
- **News Teaser**: Displays top 3 matched articles with direct link to News tab.
- **Mini Satellite Preview**: Snapshot thumbnail linking to Satellite tab.

#### 2. `SatelliteTab.tsx` & `SatelliteComparison.tsx`
- **Pre-Flight Coverage Catalog Check**:
  - Fetches ESRI Wayback metadata (`World_Imagery/MapServer?f=json` & `WMTSCapabilities.xml`) using a 3-second `AbortController`.
  - Caches available years in `sessionStorage` under `wayback_{lat}_{lng}`.
  - Filters out years with zero coverage.
  - Displays graceful empty state if no imagery exists for rural coordinates.
- **Side-by-Side Split View**:
  - Left panel: Base year closest to `startDate`.
  - Right panel: Latest available capture year.
  - Dual independent year selectors (`Viewing: YYYY ▾`).
- **Tile Error Boundary**:
  - Attaches `map.on('error')` on `wayback-source` to capture 500/503/404 tile errors and show an inline recovery notice.

#### 3. `NewsTab.tsx`
- Fetches articles from `/api/news?projectId={id}`.
- Displays cards with publisher badge, publication date, relevance score badge, and clean title.
- Shows ingested AI factual summary if `aiIngested == true`.
- Links out to original source article (`target="_blank" rel="noopener noreferrer"`).

#### 4. `FinancialsTab.tsx`
- Fetches BOQ data from `/api/contracts/[id]/boq`.
- Renders itemized civil works table with benchmark variance:
  - Red row highlight for `flagUnitPriceAnomaly` ($>30\%$ above national average).
  - Amber banner for `flagMobilizationInflated` (Item B.9 $>5\%$ of contract).
- Embedded Contract PDF Viewer:
  - Responsive `<iframe src={verifiedPdfUrl} />` with fallback to Wayback Machine CDX API.
  - Buttons for "Open in New Tab ↗" and "Download".

#### 5. `CommunityTab.tsx`
- Rating summary breakdown (5★ to 1★ counts, average rating).
- Physical completion perception gauge vs. DPWH official claim.
- Workforce presence indicator (% active vs. abandoned).
- Eyewitness reports feed with distance badge (`<5km Resident`, `<15km Observer`), phone verification badge, and corroboration count.
- "Submit Eyewitness Report" button opening `ReviewModal`.

#### 6. `ConnectionsTab.tsx` & `ContractorConnectionPanel.tsx`
- Pure React tree-style component replacing Cytoscape on project pages.
- Primary Contractor Header Card (license, budget sum, risk badge).
- Indented connection rows with color-coded badges:
  - Joint Venture (Amber)
  - Politician (Red) · source: BetterGov Open Congress
  - Shell Company (Purple) · source: Shared address
  - District Engineer (Blue) · contracts signed & risk flags
- CTA button linking to `/contractors?highlight={contractorName}`.

---

### 3.5 News Scraper Engine (`src/lib/news-scraper.ts` & `/api/news`)

#### Source Cascade:
1. **Google News RSS (Primary, 0-Config)**:
   - URL: `https://news.google.com/rss/search?q={query}&hl=en-PH&gl=PH&ceid=PH:en`
   - Generated queries:
     - `"{municipality}" "{province}" DPWH OR "flood control" OR "infrastructure"`
     - `"{contractorName}" DPWH OR contractor OR irregularity`
     - `"{projectNameWords}" site:philstar.com OR site:inquirer.net OR site:rappler.com`
   - Parsed server-side using `@xmldom/xmldom`.
2. **NewsAPI.org (Enhanced)**:
   - Queried only if `process.env.NEWS_API_KEY` is defined.
3. **Bing News Search (Enhanced)**:
   - Queried only if `process.env.BING_NEWS_KEY` is defined.

#### Scoring Algorithm ($0.0–1.0$, Threshold: $\ge 0.3$ to save):
- $+0.4$ Contractor name match in title/description.
- $+0.3$ Municipality name match.
- $+0.2$ Province name match.
- $+0.2$ Forensic keyword match (*"DPWH"*, *"flood control"*, *"irregularity"*, *"COA"*, *"ghost project"*).
- $+0.1$ Published within 90 days ($+0.1$ extra if within 30 days).
- Capped at $1.0$.

#### AI Ingestion Worker:
- For articles with `relevanceScore >= 0.5` and `aiIngested == false`:
- Prompts Gemini Flash to extract a factual 2–3 sentence summary focused strictly on pesos, contractors, locations, officials, and status.
- Sets `aiSummary` and `aiIngested = true`.

---

### 3.6 Security & Production Hardening Invariants

1. **Production Guard on Demo OTP Bypass**:
   ```ts
   if (process.env.DEMO_OTP_BYPASS === 'true' && process.env.NODE_ENV === 'production') {
     throw new Error('DEMO_OTP_BYPASS is prohibited in production.');
   }
   ```
2. **Server-Side Geofencing**: All proximity checks must run server-side in `src/lib/geo.ts` using the Haversine formula; client-supplied distances are never trusted.
3. **AbortControllers on External Requests**: All fetch calls to ESRI Wayback, DPWH PDFs, and Internet Archive CDX APIs must use a 3-second timeout.
4. **Cache-Control Headers**:
   - Project dossier: `Cache-Control: public, max-age=60, stale-while-revalidate=300`
   - News feed: `Cache-Control: public, max-age=300, stale-while-revalidate=900`
   - Satellite catalog: `sessionStorage` + `Cache-Control: public, max-age=86400`

---

## 4. Implementation Phasing

- **Phase 1**: Data models (`NewsArticle` schema migration) + Composite Risk Scoring (`src/lib/anomaly-flags.ts`) + API extensions.
- **Phase 2**: Dedicated Project Dossier Page (`/projects/[id]/page.tsx`) + Hero + Overview & Financials Tabs.
- **Phase 3**: Resilient Satellite Comparison Component (`SatelliteComparison.tsx`) + Community Reports Tab.
- **Phase 4**: Pure React Contractor Connection Panel (`ContractorConnectionPanel.tsx`) + Connections Tab.
- **Phase 5**: News Scraper Engine (`news-scraper.ts`) + `/api/news` routes + News Tab.
- **Phase 6**: Mapbox Drawer Hybrid Integration + Verification & End-to-End Testing.
