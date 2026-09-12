# PhilTrace Production-Readiness Implementation Plan

> **Design Spec:** [`docs/superpowers/specs/2026-09-12-philtrace-production-readiness-design.md`](../specs/2026-09-12-philtrace-production-readiness-design.md)  
> **Goal:** Transform PhilTrace from a prototype drawer interface into a production-ready civic transparency platform featuring a full Wikipedia-style project dossier (`/projects/[id]`), resilient satellite comparison, contract PDF fallback engine, media intelligence pipeline, pure React contractor connection panel, and composite risk scoring ($0–100$).

---

## Architecture & Dependency Map

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Core Foundation & Data Layer                             │
│    • Prisma schema (NewsArticle model)                      │
│    • src/lib/anomaly-flags.ts (computeRiskScore)            │
│    • GET /api/projects/[id] (returns riskScore + relations) │
│    • POST /api/report/otp (production bypass guard)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 2. Dossier Page & Core Tabs  │        │ 3. Resilient Satellite &     │
│    • /projects/[id]/page.tsx │        │    Community Tabs            │
│    • Hero (Stat cards, flags)│        │    • SatelliteComparison.tsx │
│    • OverviewTab.tsx         │        │    • SatelliteTab.tsx        │
│    • FinancialsTab.tsx (BOQ) │        │    • CommunityTab.tsx        │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               └───────────────────────┬───────────────┘
                                       │
       ┌───────────────────────────────┴───────────────┐
       ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 4. Contractor Panel          │        │ 5. News Scraper & Media      │
│    • ContractorConnection-   │        │    Intelligence Pipeline     │
│      Panel.tsx               │        │    • src/lib/news-scraper.ts │
│    • ConnectionsTab.tsx      │        │    • GET/POST /api/news      │
│                              │        │    • NewsTab.tsx             │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               └───────────────────────┬───────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Map Hybrid Integration & Verification                    │
│    • project-inspection-drawer.tsx ("Open Full Dossier" CTA)│
│    • End-to-end build & strict TypeScript validation        │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Foundation, Schema & Data Layer

### Task 1.1: Add `NewsArticle` Model to Prisma Schema
- **File:** `philtrace/prisma/schema.prisma`
- **Changes:**
  - Define model `NewsArticle` with fields: `id`, `projectId`, `contractorName`, `location`, `title`, `description`, `url` (unique), `source`, `publishedAt`, `relevanceScore`, `aiIngested`, `aiSummary`, `createdAt`, and `project` relation.
  - Add `newsArticles NewsArticle[]` relation to `Project` model.
- **Verification:** Run `npx prisma validate` and `npx prisma db push` inside `philtrace/`.

### Task 1.2: Implement `computeRiskScore` & Grace Period
- **File:** `philtrace/src/lib/anomaly-flags.ts`
- **Changes:**
  - Implement `computeRiskScore(project: Project & { reviews?: Review[] }): number` returning integer $0–100$.
  - Payment-to-progress gap: up to 35 pts based on `disbursementPct - progressPct`.
  - Stalled: 20 pts.
  - Overdue: 15 pts.
  - Never started: 15 pts, gated by `now > startDate + 90 days`.
  - Overpaid: 10 pts.
  - Community corroboration: up to 5 pts based on verified reviews with rating $\le 2$.
  - Export helper `getRiskScoreTier(score: number): { label: string; color: string; badgeClass: string }`.
- **Verification:** Unit test with mock project objects representing clean, moderate, high, and critical risk.

### Task 1.3: Update Project Profile API Endpoint
- **File:** `philtrace/src/app/api/projects/[id]/route.ts`
- **Changes:**
  - In `GET /api/projects/[id]`, include `reviews` (ordered by `createdAt desc`) and `contractDocument` relations.
  - Compute `riskScore` using `computeRiskScore(project)`.
  - Return `{ project: { ...project, riskScore } }`.
  - Set response header: `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- **Verification:** Query `GET /api/projects/test-id` and verify response schema includes `riskScore`.

### Task 1.4: Add Security Guard for Demo OTP in Production
- **File:** `philtrace/src/app/api/report/otp/route.ts`
- **Changes:**
  - Insert runtime guard at the top of the route:
    ```ts
    if (process.env.DEMO_OTP_BYPASS === 'true' && process.env.NODE_ENV === 'production') {
      return Response.json(
        { error: 'DEMO_OTP_BYPASS is prohibited in production environments.' },
        { status: 403 }
      );
    }
    ```
- **Verification:** Verify non-production bypass works; verify production check errors.

---

## Phase 2: Dedicated Project Dossier Page & Core Tabs

### Task 2.1: Implement Dossier Page Route & Hero Section
- **File:** `philtrace/src/app/projects/[id]/page.tsx`
- **Responsibilities:**
  - Fetch project data via TanStack Query (`useProjectDetail(id)`).
  - Breadcrumb navigation: `Map (/map?project={id}) › Region › Province › Municipality › Project ID`.
  - Active anomaly flag pills (`Overpaid`, `Stalled`, `Overdue`, `Never Started`, `Payment Pending`).
  - Project title cleaned via `cleanTitle()`, contractor name via `cleanContractorName()`.
  - 4 Stat Cards in responsive grid ($1\times4$ desktop, $2\times2$ mobile):
    1. Contract Budget (₱ formatted)
    2. Amount Disbursed (₱ formatted + % of budget)
    3. Physical Progress (percentage + progress bar)
    4. Composite Risk Score (numerical value + risk tier badge)
  - Hero Action Buttons:
    - *View Full Contract* (executes pre-flight check and opens live PDF or Wayback fallback)
    - *Share* (copies link to clipboard + toast)
    - *File FOI Request* (opens eFOI modal/template)
  - Zero-layout-shift tab navigation bar (Overview, Satellite Evidence, News & Media, Financials & BOQ, Community Reports, Connections).
- **Verification:** Load route in browser, verify layout at 375px and 1280px widths.

### Task 2.2: Implement `OverviewTab.tsx`
- **File:** `philtrace/src/app/projects/[id]/components/OverviewTab.tsx`
- **Responsibilities:**
  - AI forensic summary card (displays `project.aiSummary` or generates plain-language briefing).
  - Disbursement vs. physical progress visual contrast bar chart with anomaly threshold callout ($>30\%$ gap).
  - Contractor at a glance card with link to `/contractors`.
  - Preview of top 3 related news items with "View all in News tab" shortcut.
  - Mini satellite snapshot thumbnail switching to Satellite tab on click.
- **Verification:** Confirm all elements render without layout shift.

### Task 2.3: Implement `FinancialsTab.tsx` & PDF Viewer
- **File:** `philtrace/src/app/projects/[id]/components/FinancialsTab.tsx`
- **Responsibilities:**
  - Fetch BOQ data via `GET /api/contracts/[id]/boq`.
  - Render itemized table with columns: Code, Description, Quantity, Unit, Unit Cost, Total Cost, National Benchmark Variance.
  - Soft red highlight for lines with `flagUnitPriceAnomaly` ($>30\%$ above national average).
  - Amber banner for `flagMobilizationInflated` (Item B.9 $>5\%$ of contract).
  - Contract Document PDF Viewer section:
    - Pre-flight HEAD check to `sourcePdfUrl` with 2-second `AbortController`.
    - Automated fallback to `https://archive.org/wayback/available?url={encodedUrl}` if DPWH link returns non-200 or times out.
    - Responsive `<iframe src={verifiedPdfUrl} />` with "Open in New Tab ↗" and "Download" buttons.
- **Verification:** Test with valid PDF URL and test fallback behavior with a broken URL.

---

## Phase 3: Resilient Satellite Comparison & Community Reports

### Task 3.1: Rebuild Satellite Comparison Component
- **File:** `philtrace/src/components/satellite-comparison.tsx`
- **Responsibilities:**
  - Query ESRI Wayback metadata (`World_Imagery/MapServer?f=json` & `WMTSCapabilities.xml`) with 3-second `AbortController`.
  - Cache coverage in `sessionStorage` (`wayback_{lat}_{lng}`).
  - Only show year pills for years with verified coverage; render empty state if zero coverage exists for rural coordinates.
  - Side-by-side static split comparison: Left panel shows start-date year; Right panel shows latest year.
  - Dual independent year selectors (`Viewing: YYYY ▾`).
  - Tile error boundary: listen for `map.on('error')` on `wayback-source` and display inline error notice instead of broken tile grid.
- **Verification:** Render component with valid coordinates; verify side-by-side maps and year selector.

### Task 3.2: Implement `SatelliteTab.tsx`
- **File:** `philtrace/src/app/projects/[id]/components/SatelliteTab.tsx`
- **Responsibilities:**
  - Wraps `SatelliteComparison` with project coordinates and contract dates.
  - Provides contextual note explaining satellite ground-truth methodology and alignment with 2026 General Appropriations Act.
- **Verification:** Switch to Satellite tab, confirm both panels initialize smoothly without WebGL memory leaks.

### Task 3.3: Implement `CommunityTab.tsx`
- **File:** `philtrace/src/app/projects/[id]/components/CommunityTab.tsx`
- **Responsibilities:**
  - Citizen metrics summary: average star rating, star distribution bars (5★ to 1★), physical completion perception gauge, active workforce percentage.
  - Eyewitness reports feed: verified resident badges (`<5km`), observer badges (`<15km`), phone verified badges, corroboration upvotes.
  - Photo gallery modal for citizen field photos.
  - "Submit Eyewitness Report" button opening existing `ReviewModal`.
- **Verification:** Submit review, verify distance badge, corroboration counter, and rating recalculation.

---

## Phase 4: Focused Contractor Connection Panel

### Task 4.1: Implement `ContractorConnectionPanel.tsx`
- **File:** `philtrace/src/components/contractor-connection-panel.tsx`
- **Responsibilities:**
  - Pure React hierarchical tree component (no Cytoscape dependency).
  - Fetches data from `GET /api/contractors/[id]/connections`.
  - Primary Contractor Header Card (name, total awards, risk badge).
  - Indented connection rows with color-coded badges:
    - 🤝 Joint Venture (Amber)
    - 🏛️ Politician (Red) · source: BetterGov Open Congress
    - 🏢 Shell Company (Purple) · source: Shared address
    - 📐 District Engineer (Blue) · signatory count & risk flags
  - Direct CTA button: *"Explore in Full National Network Graph ↗"* linking to `/contractors?highlight={contractorName}`.
- **Verification:** Verify clean visual tree rendering without canvas/Cytoscape overhead.

### Task 4.2: Implement `ConnectionsTab.tsx`
- **File:** `philtrace/src/app/projects/[id]/components/ConnectionsTab.tsx`
- **Responsibilities:**
  - Wraps `ContractorConnectionPanel` with project contractor details.
  - Includes forensic intelligence disclaimer regarding public record sources.
- **Verification:** Switch to Connections tab, confirm responsive cards at mobile widths.

---

## Phase 5: News Scraper & Media Intelligence Pipeline

### Task 5.1: Implement Core Scraper Service
- **File:** `philtrace/src/lib/news-scraper.ts`
- **Responsibilities:**
  - Source 1: Google News RSS Search (`https://news.google.com/rss/search?q=...`) parsed via XML parser with 3 queries per project (location, contractor, project title).
  - Source 2: NewsAPI.org integration (conditional on `NEWS_API_KEY`).
  - Source 3: Bing News Search integration (conditional on `BING_NEWS_KEY`).
  - Relevance scoring ($0.0–1.0$): contractor match (+0.4), municipality match (+0.3), province match (+0.2), forensic keywords (+0.2), recency (+0.1 to +0.2).
  - Upsert articles with `relevanceScore >= 0.3` to `NewsArticle` table.
  - Gemini Flash factual summarization for articles with `relevanceScore >= 0.5`.
- **Verification:** Run standalone test script on sample project, check scraped records in database.

### Task 5.2: Create News API Routes
- **File:** `philtrace/src/app/api/news/route.ts`
- **Responsibilities:**
  - `GET /api/news?projectId={id}`: Returns matched articles sorted by relevance and date. Headers: `Cache-Control: public, max-age=300, stale-while-revalidate=900`.
  - `POST /api/news/fetch`: Triggers fresh scrape for project (protected by `CRON_SECRET`).
- **Verification:** Curl `GET /api/news?projectId={id}` and verify returned JSON.

### Task 5.3: Implement `NewsTab.tsx`
- **File:** `philtrace/src/app/projects/[id]/components/NewsTab.tsx`
- **Responsibilities:**
  - Fetches news from `/api/news?projectId={id}`.
  - Renders article cards with publisher badge, date, relevance score badge, and clean title.
  - Ingested AI factual summary callout.
  - Outbound link to original publication (`target="_blank" rel="noopener noreferrer"`).
- **Verification:** Confirm news tab renders correctly with both populated and empty states.

### Task 5.4: Integrate News Ingestion into Cron Sync
- **File:** `philtrace/src/app/api/cron/sync/route.ts`
- **Responsibilities:**
  - After DPWH records sync, trigger `fetchNewsForProject()` for up to 10 flagged or recently updated projects per run.
- **Verification:** Trigger cron endpoint with `CRON_SECRET`, verify background execution.

---

## Phase 6: Mapbox Hybrid Integration & System Verification

### Task 6.1: Update Inspection Drawer on `/map`
- **File:** `philtrace/src/components/project-inspection-drawer.tsx`
- **Responsibilities:**
  - Retain drawer as a lightweight preview on the map canvas.
  - Add primary action button: **"Open Full Project Dossier ↗"** that links to `/projects/[id]`.
- **Verification:** Click pin on map, open drawer, click "Open Full Project Dossier ↗", verify navigation.

### Task 6.2: End-to-End Build & Validation
- **Commands:**
  - `npm run lint` (ESLint 9 checks)
  - `npx tsc --noEmit` (Strict TypeScript type-checking)
  - `npm run build` (Next.js 16 production build with Turbopack)
- **Verification:** Build completes with zero errors or unresolved types.

---

## Rollout Order & File Execution Sequence

```
1. philtrace/prisma/schema.prisma
2. npx prisma db push && npx prisma generate
3. philtrace/src/lib/anomaly-flags.ts
4. philtrace/src/app/api/projects/[id]/route.ts
5. philtrace/src/app/api/report/otp/route.ts
6. philtrace/src/components/satellite-comparison.tsx
7. philtrace/src/components/contractor-connection-panel.tsx
8. philtrace/src/lib/news-scraper.ts
9. philtrace/src/app/api/news/route.ts
10. philtrace/src/app/projects/[id]/components/OverviewTab.tsx
11. philtrace/src/app/projects/[id]/components/SatelliteTab.tsx
12. philtrace/src/app/projects/[id]/components/NewsTab.tsx
13. philtrace/src/app/projects/[id]/components/FinancialsTab.tsx
14. philtrace/src/app/projects/[id]/components/CommunityTab.tsx
15. philtrace/src/app/projects/[id]/components/ConnectionsTab.tsx
16. philtrace/src/app/projects/[id]/page.tsx
17. philtrace/src/components/project-inspection-drawer.tsx
18. philtrace/src/app/api/cron/sync/route.ts
19. Production build verification
```
