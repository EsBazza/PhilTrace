# 🇵🇭 PhilTrace — Comprehensive Master Documentation & Developer Handbook

> **AI-Powered National Public Infrastructure Transparency Platform**  
> *"The Google Maps for Philippine Public Works & Infrastructure"*  
> Cross-referencing official Department of Public Works and Highways (DPWH) claims, verified citizen whistleblowers, and satellite ground-truth across 248,000+ public contracts totaling ₱2.4T to ₱6.5T in national infrastructure spending.

---

## 📑 Table of Contents

1. [Executive Summary & Civic Mission](#1-executive-summary--civic-mission)
2. [High-Level Architecture & Tech Stack](#2-high-level-architecture--tech-stack)
3. [Repository & Codebase Structure](#3-repository--codebase-structure)
4. [Data Ingestion, Geocoding & Geospatial Pipelines](#4-data-ingestion-geocoding--geospatial-pipelines)
5. [Database Architecture & Data Models (Prisma)](#5-database-architecture--data-models-prisma)
6. [Forensic Red-Flag & Anomaly Detection Algorithms](#6-forensic-red-flag--anomaly-detection-algorithms)
7. [Core Application Features & Modules](#7-core-application-features--modules)
   - 7.1 [Full-Screen Mapbox Engine (`/map`) & Web Worker Clustering](#71-full-screen-mapbox-engine-map--web-worker-clustering)
   - 7.2 [Project Inspection Drawer & Ground-Truth Verification](#72-project-inspection-drawer--ground-truth-verification)
   - 7.3 [Multi-Year Satellite Timeline (ESRI Wayback API)](#73-multi-year-satellite-timeline-esri-wayback-api)
   - 7.4 [Citizen Whistleblower Engine & Proximity-Gated Reviews](#74-citizen-whistleblower-engine--proximity-gated-reviews)
   - 7.5 [Contractor Joint-Venture & Alliance Graph (`/contractors`)](#75-contractor-joint-venture--alliance-graph-contractors)
   - 7.6 [District Engineer Signature Network (`/engineers`)](#76-district-engineer-signature-network-engineers)
   - 7.7 [Near Me Geolocation Radar (`/nearby`)](#77-near-me-geolocation-radar-nearby)
   - 7.8 [PDF Contract & Bill of Quantities (BOQ) Parser](#78-pdf-contract--bill-of-quantities-boq-parser)
   - 7.9 [Strict RAG AI Chatbot (`/api/chat`, `/search`)](#79-strict-rag-ai-chatbot-apichat-search)
8. [Complete REST API Reference (26 Endpoints)](#8-complete-rest-api-reference-26-endpoints)
9. [Developer Onboarding, Environment & Runbook](#9-developer-onboarding-environment--runbook)
10. [Engineering Best Practices & Roadmap for Incoming Developers](#10-engineering-best-practices--roadmap-for-incoming-developers)

---

## 1. Executive Summary & Civic Mission

PhilTrace is an open-source civic technology platform built to provide radical transparency and forensic auditing over Philippine public infrastructure investments.

### The Problem
- **Information Asymmetry**: Hundreds of thousands of infrastructure allocations are siloed in inaccessible government portals, non-standard PDFs, or fragmented databases.
- **Ghost & Abandoned Projects**: Contracts declared "100% Completed" or heavily disbursed on paper often sit half-built or abandoned in physical reality.
- **Cartel Collusion & Repeat Defaulters**: Contractors blacklisted or chronically delayed in one legislative district often bid and win multi-million-peso awards in another under joint-venture entities.
- **Inflated Bill of Quantities (BOQ)**: Unchecked unit pricing for standard civil works materials (e.g., rebar, concrete, mobilization) exceeding reasonable market benchmarks by 30%–300%.

### The PhilTrace Solution
PhilTrace continuously ingests data from the **DPWH Transparency API** and standardizes it against the **Philippine Statistics Authority (PSA) Standard Geographic Codes (PSGC)**. The platform equips citizens, journalists, and watchdog institutions with:
1. **Interactive Geospatial Visualization**: View every road, bridge, flood control dike, and school on a nationwide map.
2. **Independent Ground-Truth Comparison**: Compare historical vs. present satellite imagery (ESRI Wayback API) and 360° Google Street View against declared DPWH milestones.
3. **Verified Whistleblower Reporting**: Collects ground photos and ratings with SMS OTP verification, SHA-256 phone hashing, and live GPS proximity geofencing.
4. **Network Cartel Intelligence**: Interactive graph uncovering contractor alliances, joint ventures, and repeat defaulters.
5. **Constitutional Alignment**: Aligned with Article III, Section 7 of the 1987 Philippine Constitution (Right to Information), Executive Order No. 2 (s. 2016), and the 2026 General Appropriations Act mandate for Philippine Space Agency (PhilSA) satellite verification of public infrastructure.

---

## 2. High-Level Architecture & Tech Stack

```mermaid
graph TD
    subgraph Data Layer & External APIs
        DPWH[DPWH Transparency API<br/>248k+ Contracts]
        PSGC[PSA PSGC API<br/>17 Regions, 82 Provinces, Cities, Barangays]
        ESRI[ESRI Wayback Imagery<br/>Historical Satellite Tiles]
        GSV[Google Street View API<br/>360 Ground Panoramas]
        GEMINI_API[Google Gemini Flash API<br/>gemini-2.5-flash]
        SEMAPHORE[Semaphore SMS API<br/>Citizen OTP Verification]
    end

    subgraph Backend & Data Processing
        PRISMA[Prisma ORM 6/7<br/>PostgreSQL on Supabase / Neon]
        CRON[Next.js App Router API Routes<br/>Nightly Cron & Ingestion Pipelines]
        PARSER[Gemini PDF & BOQ Parser Worker]
    end

    subgraph Frontend Client Engine
        MAPBOX[Mapbox GL JS 3.x<br/>LOD GeoJSON Polygons & Points]
        WORKER[Web Worker Cluster Engine<br/>Supercluster Off-Main-Thread]
        CYTO[Cytoscape.js<br/>Contractor & Engineer Alliance Graphs]
        REACT[Next.js 16 App Router<br/>React 19 + Tailwind CSS v4 + TanStack Query]
    end

    DPWH --> CRON
    PSGC --> CRON
    CRON --> PRISMA
    PRISMA <--> CRON
    CRON --> PARSER
    PARSER <--> GEMINI_API
    CRON <--> REACT
    REACT <--> MAPBOX
    MAPBOX <--> WORKER
    REACT <--> CYTO
    REACT <--> ESRI
    REACT <--> GSV
    REACT <--> SEMAPHORE
```

### Complete Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Turbopack) | `16.3.4` | Full-stack serverless web application |
| **Runtime & Language** | Node.js + TypeScript | `Node 20+`, `TS 5.x` | Strict end-to-end type safety |
| **Frontend Library** | React | `19.2.8` | Component model & concurrent rendering |
| **Styling** | Tailwind CSS + PostCSS | `@tailwindcss/postcss ^4` | Mobile-first utility-driven design |
| **State & Cache** | TanStack Query | `^5.102.8` | Client-side query caching & deduping |
| **Mapping Engine** | Mapbox GL JS | `^3.29.0` | High-performance vector tiles, 3D terrain, camera flight |
| **Spatial Clustering** | Supercluster + Web Worker | `^9.1.0` | Off-thread clustering of 248k+ coordinate pins |
| **Network Graphs** | Cytoscape.js + react-cytoscapejs | `^3.34.2` | Interactive joint-venture and engineer relationship graphs |
| **Database & ORM** | PostgreSQL 16 + Prisma ORM | `@prisma/client 6.19.3` | Scalable relational storage & schema migrations |
| **AI Layer** | Google GenAI SDK (`@google/genai`) | `^2.21.0` | `gemini-2.5-flash` for RAG chatbot & BOQ PDF parsing |
| **Satellite Imagery** | ESRI World Imagery Wayback API | REST | Multi-year historical satellite time-series comparison |
| **Authentication/Security** | BcryptJS + JSONWebToken | `bcryptjs ^3.0.3` | Password hashing & admin session tokens |
| **SMS Verification** | Semaphore SMS API / Twilio | REST | Whistleblower phone verification with demo bypass |

---

## 3. Repository & Codebase Structure

The repository is organized cleanly as a monorepo-style setup where `philtrace/` contains the full-stack Next.js application:

```
PhilTrace final/
├── README.md                           # Public high-level landing documentation
├── docs/                               # Architecture specs and design overhauls
│   └── superpowers/specs/
│       ├── 2026-08-26-philtrace-design.md
│       └── 2026-08-30-philtrace-comprehensive-overhaul-design.md
├── geojson_*.zip                       # Raw compressed PSA PSGC boundary polygons
└── philtrace/                          # Next.js 16 Application Root
    ├── package.json                    # Dependencies and scripts
    ├── tsconfig.json                   # Strict TypeScript compiler options
    ├── next.config.ts                  # Next.js build and optimization flags
    ├── prisma/
    │   └── schema.prisma               # Complete Prisma schema definition
    ├── public/
    │   ├── MAPATUNAI.png               # Project branding assets
    │   ├── data/
    │   │   ├── ph-provinces.json       # Static province lists
    │   │   └── ph-regions.json         # Static region lists
    │   └── geo/
    │       ├── all_projects.json       # Precomputed project records for worker clustering
    │       ├── full_location_hierarchy.json # PSGC hierarchical tree (Region > Province > City > Brgy)
    │       ├── spatial_province_polygons.json # Polygon definitions for point-in-polygon resolution
    │       ├── initial_clusters.json   # Nationwide overview clusters
    │       ├── region_centroids.json   # Pre-calculated geographic centers
    │       ├── raw_region/             # Raw GeoJSON polygons by Region
    │       ├── raw_province/           # Raw GeoJSON polygons by Province
    │       ├── raw_city/               # Raw GeoJSON polygons by Municipality/City
    │       └── raw_barangay/           # Raw GeoJSON polygons by Barangay
    ├── scripts/                        # Ingestion, ETL, and utility scripts
    │   ├── seed-all.ts                 # Full database seed script (Regions, Provinces, Projects, Accounts)
    │   ├── generate-map-data.ts        # Mapbox pre-computation generator
    │   ├── generate-real-centroids.ts  # Pre-computes exact polygon centroids
    │   ├── parse_contracts.ts          # Gemini PDF contract & BOQ extraction worker
    │   ├── sync_live_dpwh.py           # Python crawler for live DPWH Transparency API
    │   ├── fast_realign.py             # Spatial alignment script
    │   └── realign_locations.py        # Normalizes location strings against PSGC
    └── src/
        ├── app/                        # Next.js 16 App Router Pages & APIs
        │   ├── layout.tsx              # Root HTML and metadata layout
        │   ├── page.tsx                # Homepage with national statistics and quick search
        │   ├── globals.css             # Tailwind CSS v4 styling rules
        │   ├── map/                    # Full-screen interactive Mapbox application
        │   │   ├── page.tsx            # Main Map page component
        │   │   ├── components/         # Map UI subcomponents (DrillDownPanel, ProjectSidebar)
        │   │   ├── hooks/              # Map hooks (useMapInstance, useSupercluster, useDrillDown)
        │   │   └── workers/
        │   │       └── cluster.worker.ts # Dedicated Web Worker running Supercluster
        │   ├── contractors/page.tsx    # Contractor Cytoscape graph & leaderboard
        │   ├── engineers/page.tsx      # District Engineer signature relationship graph
        │   ├── nearby/page.tsx         # Proximity geolocation radar (<25km)
        │   ├── projects/page.tsx       # Searchable, filterable project directory
        │   ├── regions/page.tsx        # Regional breakdown and performance directory
        │   ├── search/page.tsx         # Natural-language and parameter search
        │   └── api/                    # 26 REST API Route Endpoints
        ├── components/                 # Reusable UI Components
        │   ├── header.tsx              # Top navigation bar
        │   ├── chatbot.tsx             # Floating RAG AI conversational assistant
        │   ├── project-inspection-drawer.tsx # Slide-out inspection drawer
        │   ├── wayback-slider.tsx      # ESRI Wayback satellite comparison slider
        │   ├── street-view-embed.tsx   # Google Street View 360 panorama embed
        │   ├── review-modal.tsx        # Citizen review submission modal with OTP
        │   ├── search-bar.tsx          # Quick search bar with autocomplete
        │   └── project-card.tsx        # Project summary card component
        ├── hooks/
        │   └── use-projects.ts         # TanStack Query custom hooks
        └── lib/                        # Core Utilities & Business Logic
            ├── prisma.ts               # Global Prisma client singleton
            ├── env.ts                  # Environment variable schema validation
            ├── format.ts               # Currency, date, and contractor string formatters
            ├── geo.ts                  # Haversine distance and geofence checkers
            ├── geo-spatial.ts          # Point-in-polygon spatial resolution
            ├── province-normalizer.ts  # PSGC fuzzy matching & province lookup
            ├── anomaly-flags.ts        # Forensic red-flag detection rules
            └── constants.ts            # Project statuses, categories, and colors
```

---

## 4. Data Ingestion, Geocoding & Geospatial Pipelines

### 4.1 Ingestion from DPWH Transparency API
The DPWH Transparency API provides real-time public works records. PhilTrace extracts:
- `project_id`, `project_name`
- `latitude`, `longitude` (WGS84)
- `contract_cost`, `amount_paid`, `physical_progress`
- `start_date`, `completion_date`, `status`
- `contractor_name`, `source_of_funds`, `infra_year`
- `source_pdf_url` (Link to original scanned contract documents)

### 4.2 PSGC Spatial Normalization Pipeline
Raw DPWH project entries often use inconsistent naming conventions (e.g., *"Brgy. Poblacion, San Fdo, Pamp."* vs *"City of San Fernando, Pampanga"*). PhilTrace resolves these using a two-tier spatial pipeline:
1. **String Matcher (`province-normalizer.ts`)**: Normalizes typographical variants and colloquial names against official PSA PSGC province codes.
2. **Point-in-Polygon Resolver (`geo-spatial.ts`)**: For projects with valid GPS coordinates, PhilTrace performs a Ray-Casting algorithm against `public/geo/spatial_province_polygons.json` to assign the exact Region and Province by geometric containment.

```ts
// Example Ray-Casting Point-in-Polygon from src/lib/geo-spatial.ts
function pointInPolygon(point: [number, number], vs: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = vs[i];
    const [xj, yj] = vs[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

### 4.3 Co-Located Coordinates Golden Angle Dispersion
Many municipal projects are assigned identical coordinates (the municipal hall centroid). If rendered directly, hundreds of pins stack atop one another. PhilTrace employs a **Golden Angle Spiral Dispersion Algorithm** in `clusters/route.ts`:

```ts
// src/app/api/map/clusters/route.ts
if (idx > 0) {
  const angle = idx * 2.39996; // Golden angle in radians
  const radius = 0.00018 * Math.sqrt(idx);
  lng = Number((lng + (radius / Math.cos((lat * Math.PI) / 180)) * Math.cos(angle)).toFixed(6));
  lat = Number((lat + radius * Math.sin(angle)).toFixed(6));
}
```

---

## 5. Database Architecture & Data Models (Prisma)

The database schema is defined in `philtrace/prisma/schema.prisma`. It is structured into 6 logical domains:

```mermaid
erDiagram
    REGION ||--o{ PROVINCE : contains
    PROVINCE ||--o{ PROJECT : contains
    PROJECT ||--o{ REVIEW : receives
    PROJECT ||--o{ COMMENT : has
    PROJECT ||--o| CONTRACT_DOCUMENT : references
    CONTRACT_DOCUMENT ||--o{ BILL_OF_QUANTITY : details
    CONTRACT_DOCUMENT ||--o| ENGINEER_SIGNATURE : signs
    CONTRACTOR ||--o{ CONTRACTOR_CONNECTION : connects
    UNIT_PRICE_BENCHMARK }o--|| REGION : benchmarks

    PROJECT {
        string id PK
        string name
        string provinceId FK
        float gpsLat
        float gpsLng
        float budgetPHP
        float amountPaid
        float progress
        datetime startDate
        datetime completionDate
        string status
        string category
        string contractorRaw
        boolean flagStalled
        boolean flagNeverStarted
        boolean flagOverdue
        boolean flagPaymentPending
        boolean flagOverpaid
        string aiSummary
    }

    REVIEW {
        string id PK
        string projectId FK
        float rating
        float progressRating
        float qualityRating
        boolean workersActive
        string comment
        string photoUrl
        string phoneHash
        boolean phoneVerified
        float userLat
        float userLng
        float distanceKm
        int corroborations
    }

    CONTRACT_DOCUMENT {
        string id PK
        string projectId FK
        string sourcePdfUrl
        string contractorLegalName
        string tinNumber
        int contractDurationDays
        ExtractionStatus extractionStatus
    }

    BILL_OF_QUANTITY {
        string id PK
        string contractDocId FK
        string itemCode
        string description
        float quantity
        string unit
        float unitCostPhp
        float totalPhp
    }

    ENGINEER_SIGNATURE {
        string id PK
        string contractDocId FK
        string engineerName
        string engineerTitle
        string district
    }
```

### 5.1 Geographic Models
- `Region`: 17 administrative regions with unique `psgcCode` (e.g., `'0300000000'` for Region III) and unique `name`.
- `Province`: 82 provinces + NCR, linked to `Region` via `regionId`. Unique index on `[name, regionId]`.

### 5.2 Core Project Model (`Project`)
- `id`: DPWH Contract Identification String (e.g. `'21AB0045'`).
- `provinceId`: Foreign key to `Province.id`.
- `gpsLat`, `gpsLng`: Float coordinates indexed together for spatial bounding box filtering.
- `budgetPHP`, `amountPaid`, `progress`: Financial and milestone figures.
- `flagStalled`, `flagNeverStarted`, `flagOverdue`, `flagPaymentPending`, `flagOverpaid`: Boolean forensic anomaly flags. Composite index `@@index([flagOverdue, flagOverpaid, flagStalled, flagNeverStarted])`.

### 5.3 Citizen Engagement Models (`Review` & `Comment`)
- `Review`: Stores multi-criteria ratings (1-5 stars, physical progress estimate `0-100%`, structural build quality `1-5`, `workersActive` boolean).
- `phoneHash`: SHA-256 hash of the reviewer's phone number ensuring 1 review per project per phone (`@@unique([projectId, phoneHash])`).
- `userLat`, `userLng`, `distanceKm`: Reviewer coordinates and calculated distance from the site at submission.

### 5.4 Contract Forensic Models (`ContractDocument`, `BillOfQuantity`, `EngineerSignature`)
- `ContractDocument`: Contains PDF extraction metadata and status (`PENDING`, `PARSED`, `FAILED`).
- `BillOfQuantity`: Itemized breakdown of materials and civil works items (Item code, description, quantity, unit cost, line total).
- `EngineerSignature`: Captured signatures of DPWH District Engineers approving the contract.
- `UnitPriceBenchmark`: Regional and national price benchmark database for anomaly variance calculations.

### 5.5 Contractor Intelligence Models (`Contractor`, `ContractorConnection`, `Politician`)
- `Contractor`: Aggregated contractor metrics (`totalContracts`, `totalValuePHP`, `avgProgress`, `overdueCount`, `terminatedCount`).
- `ContractorConnection`: Tracked associations between contractors, shell companies, and elected politicians (`connectionType`: `NEWS_MENTION`, `SHARED_ADDRESS`, `CONGRESS_RECORD`).
- `Politician`: Open Congress political profile data.

---

## 6. Forensic Red-Flag & Anomaly Detection Algorithms

PhilTrace implements rule-based forensic algorithms in `philtrace/src/lib/anomaly-flags.ts` and API routes:

| Red Flag | Code Identifier | Formula / Evaluation Rule | Severity | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Overpaid / Ghost Risk** | `flagOverpaid` | `progress < 30%` AND `amountPaid > 0` AND `amountPaid > 0.80 * budgetPHP` | 🚨 **Critical** | Major budget payout disbursed while construction site is barely started. |
| **Stalled / Abandoned** | `flagStalled` | `status == 'On-Going'` AND `Days since last agency activity >= 180` | ⚠️ **High** | Work officially designated active, but untouched for 6+ months. |
| **Never Started** | `flagNeverStarted` | `Now > startDate` AND `progress == 0` AND `reviewCount == 0` | ⚠️ **High** | Start milestone passed, funds assigned, but 0% progress achieved. |
| **Overdue / Delayed** | `flagOverdue` | `Now > completionDate` AND `status != 'Completed'` | 🟡 **Medium** | Contract deadline exceeded without project completion. |
| **Payment Pending** | `flagPaymentPending` | `progress == 100%` AND `amountPaid == 0` | ℹ️ **Info** | Contractor completed physical works, awaiting DPWH check release. |
| **Unit Price Inflation** | `flagUnitPriceAnomaly` | `item.unitCostPhp >= 1.30 * nationalBenchmark.unitCostPhp` | 🚨 **Critical** | Specific BOQ line item billed at $\ge 30\%$ above national average. |
| **Inflated Mobilization** | `flagMobilizationInflated` | `mobilizationCost / contractBudget > 0.05` (5%) | ⚠️ **High** | Item B.9 (Mobilization/Demobilization) exceeds 5% of total project cost. |
| **Contractor High Risk** | `isHighRisk` | `contractor.overdueCount > 3` OR `contractor.terminatedCount > 0` | 🚨 **Critical** | Chronic repeat defaulter with multiple liquidated or stalled projects. |
| **Engineer Conflict** | `hasRisk` | District Engineer approved 5+ awards to contractor with active red flags | ⚠️ **High** | Questionable concentration of high-risk awards to single vendor. |

---

## 7. Core Application Features & Modules

### 7.1 Full-Screen Mapbox Engine (`/map`) & Web Worker Clustering
- **Map Canvas**: Mapbox GL JS 3.x with custom basemap switcher (High-res Satellite, Dark Canvas, Streets).
- **Off-Thread Supercluster Worker (`cluster.worker.ts`)**: Ingests all 248,000+ coordinates and pre-aggregates total budget, project counts, flagged counts, and risk distribution inside a dedicated Web Worker thread.
- **Level of Detail (LOD) Rendering**:
  - *Zoom 5–7*: Regional and Provincial GeoJSON choropleth polygons shaded by project count and budget concentration.
  - *Zoom 8–10*: Polygons dissolve; dynamic circle clusters appear with badges indicating project count and worst risk color.
  - *Zoom 11–13*: Clusters decompose into individual pins. Close pins (<50m) auto-group or disperse using the golden angle algorithm.
  - *Zoom 14+*: High-detail project markers with click-to-inspect triggers.
- **Hierarchical Drill-Down**: Step navigation (`Philippines > Region > Province > Municipality > Barangay`). Automatically fits bounding boxes and renders an inverted global mask to spotlight the selected territory.

### 7.2 Project Inspection Drawer & Ground-Truth Verification
Clicking any pin opens `src/components/project-inspection-drawer.tsx`:
- **Disbursement vs. Progress Contrast**: Dual-line chart comparing cumulative financial payout against claimed physical completion. Red fill highlights dangerous gaps.
- **AI Executive Summary**: Plain-language Taglish/English briefing summarizing project scope, expenditure status, and known delays.
- **Direct BOQ Breakdown**: Itemized civil works cost table with anomaly highlighting.
- **Contractor & Politician Dossier**: Connections to elected officials and joint-venture partners.

### 7.3 Multi-Year Satellite Timeline (ESRI Wayback API)
Implemented in `src/components/wayback-slider.tsx`:
- Discovers all historical ESRI Wayback snapshots available for the project's coordinates between contract `startDate` and present.
- Interactive timeline bar allows citizens to scrub through years (e.g. `2019`, `2021`, `2023`, `2025`).
- Dynamically updates raster tile layer URL:
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{itemId}/{z}/{y}/{x}`
- Proves ground truth: exposes "completed" flood control dikes that were never physically constructed.

### 7.4 Citizen Whistleblower Engine & Proximity-Gated Reviews
- **15km GPS Geofencing**: Server-side distance check calculates Haversine distance between reviewer GPS coordinates and project coordinates. Submissions $>15\text{ km}$ away are rejected.
- **Sybil Resistance**: Reviewer phone numbers are hashed with SHA-256 (`phoneHash`). Maximum 1 review per phone per project.
- **SMS OTP Verification**: Integrated with Semaphore API (and `DEMO_OTP_BYPASS` for testing).
- **Eyewitness Corroboration**: Local community members can corroborate reports (`POST /api/reviews/corroborate`), boosting report credibility score.

### 7.5 Contractor Joint-Venture & Alliance Graph (`/contractors`)
- Built using **Cytoscape.js** and `react-cytoscapejs`.
- **Nodes**: Contractors sized by total won contract value (logarithmic scale) and colored by compliance record:
  - 🟢 Green: Clean record, high average progress.
  - 🟡 Amber: Contains overdue projects.
  - 🔴 Red: Chronic defaulter (>3 overdue contracts or terminated awards).
- **Edges**: Joint-venture partnerships. Bolds sudden new joint ventures on awards $>₱10\text{M}$.
- **Performance Leaderboard**: Paginated table sorting contractors by total contracts won, sum of budget, overdue penalties, and average completion.

### 7.6 District Engineer Signature Network (`/engineers`)
- Interactive Cytoscape graph linking DPWH District Engineers to awarded contractors.
- Detects cozy bidding rings where a specific District Engineer repeatedly signs off on contracts awarded to the same vendor, especially when those projects later stall or become overpaid.

### 7.7 Near Me Geolocation Radar (`/nearby`)
- Mobile-first interface requesting browser HTML5 Geolocation (`navigator.geolocation`).
- Queries projects within a user-configurable radius ($1\text{ km}$ to $25\text{ km}$).
- Instant filters: *All Projects*, *Delayed*, *Stalled*, *Overpaid*, or *Flood Control*.

### 7.8 PDF Contract & Bill of Quantities (BOQ) Parser
- Located in `scripts/parse_contracts.ts` and `src/app/api/contracts/[id]/boq/route.ts`.
- Extracts structured tables from scanned DPWH contract PDFs via Gemini Flash.
- Normalizes unit descriptions (`cu.m.`, `sq.m.`, `kg`, `l.s.`) and cross-references item codes against `UnitPriceBenchmark` table.

### 7.9 Strict RAG AI Chatbot (`/api/chat`, `/search`)
- Built with `@google/genai` using `gemini-2.5-flash`.
- **Step 1 — Intent Extraction**: Parses the user's natural-language message for regions, provinces, contractors, red flags, and categories without wasting a separate LLM round-trip.
- **Step 2 — SQL Query**: Fetches the top 20 most relevant projects from PostgreSQL matching the exact parameters.
- **Step 3 — Grounded Injection**: Injects the structured records into the system prompt with strict instructions forbidding hallucinations or fabricating data outside the injected context.
- **Step 4 — Streaming Response**: Streams server-sent events (`text/event-stream`) directly to the floating chatbot UI with clickable project links.

---

## 8. Complete REST API Reference (26 Endpoints)

All endpoints are hosted under `/api/*` and return JSON responses unless specified as SSE streams.

### 8.1 Projects & Search

#### `GET /api/projects`
List and filter public infrastructure projects.
- **Query Parameters**:
  - `provinceId` (string, optional): Filter by province ID.
  - `regionId` (string, optional): Filter by region ID.
  - `category` (string, optional): Filter by category (e.g. `'Flood Control'`).
  - `status` (string, optional): Filter by DPWH status (`'On-Going'`, `'Completed'`).
  - `flag` (string, optional): Filter by anomaly (`'stalled'`, `'neverStarted'`, `'overdue'`, `'overpaid'`, `'paymentPending'`).
  - `q` (string, optional): Search keyword in project name or contractor.
  - `page` (number, default: 1): Page number.
  - `limit` (number, default: 20, max: 100): Items per page.
- **Response**: `{ projects: Project[], total: number, page: number, totalPages: number }`

#### `GET /api/projects/[id]`
Retrieve complete project profile including province, region, reviews, and contract documents.
- **URL Parameter**: `id` (DPWH Contract ID)
- **Response**: `{ project: ProjectWithRelations }`

#### `GET /api/nearby`
Find projects within a geographical radius of the user.
- **Query Parameters**:
  - `lat` (number, required): User latitude.
  - `lng` (number, required): User longitude.
  - `radiusKm` (number, default: 5, max: 25): Search radius in kilometers.
  - `flag` (string, optional): Filter by anomaly flag.
- **Response**: `{ projects: (Project & { distanceKm: number })[], userLat: number, userLng: number, radiusKm: number }`

---

### 8.2 Map & Geospatial Endpoints

#### `GET /api/map/clusters`
Viewport-bounded query returning GeoJSON FeatureCollection for Mapbox clustering.
- **Query Parameters**:
  - `sw_lat`, `sw_lng`, `ne_lat`, `ne_lng` (floats): Bounding box coordinates.
  - `region`, `province`, `category`, `flag`: Optional filters.
  - `limit` (number, default: 2000, max: 4000).
- **Response**: `GeoJSON.FeatureCollection` (Points with properties: id, name, budgetPHP, progress, status, flags).
- **Caching**: `Cache-Control: public, max-age=60, stale-while-revalidate=300`. In-memory cache for nationwide overview queries.

#### `GET /api/map/choropleth`
Returns aggregated project counts, total budget, and flagged counts per PSGC geographic code.
- **Query Parameters**: `level` (`'region'` | `'province'`).
- **Response**: `{ data: Record<string, { projectCount: number, totalBudget: number, flaggedCount: number }> }`

#### `GET /api/locations/hierarchy`
Returns full PSGC geographic tree (`Region > Province > City/Municipality > Barangay`).
- **Response**: Hierarchical JSON structure.
- **Caching**: `Cache-Control: public, max-age=86400`.

#### `GET /api/locations/boundary`
Returns exact GeoJSON boundary, bounding box, center, and inverted mask polygon for spotlight map masking.
- **Query Parameters**:
  - `type` (`'region'` | `'province'` | `'city'` | `'barangay'`).
  - `name` (string): Administrative name.
  - `file` (string, optional): Direct GeoJSON filename.
- **Response**: `{ boundary: GeoJSON, mask: GeoJSON, bounds: [[minLng, minLat], [maxLng, maxLat]], center: [lng, lat] }`

#### `GET /api/locations/barangays`
Fetch barangay lists for a given city/municipality.
- **Query Parameters**: `cityFile` or `cityName`.
- **Response**: `{ barangays: Array<{ name: string, file: string }> }`

---

### 8.3 Contractor & Engineer Intelligence

#### `GET /api/contractors`
Paginated leaderboard of contractors.
- **Query Parameters**:
  - `q` (string, optional): Search contractor name.
  - `sort` (`'totalValuePHP'` | `'totalContracts'` | `'overdueCount'` | `'avgProgress'`).
  - `order` (`'desc'` | `'asc'`).
  - `page` (number, default: 1), `limit` (number, default: 12).
- **Response**: `{ contractors: Contractor[], total: number, page: number, totalPages: number }`

#### `GET /api/contractors/graph`
Cytoscape-compatible nodes and edges mapping joint-venture alliances.
- **Response**: `{ nodes: CytoscapeNode[], edges: CytoscapeEdge[] }`
- **Caching**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`.

#### `GET /api/contractors/[id]/connections`
Retrieve politician associations, news mentions, and joint ventures for a specific contractor.
- **URL Parameter**: `id` (Contractor Name)
- **Response**: `{ contractor: string, connections: ContractorConnection[] }`

#### `GET /api/engineers/graph`
Returns Cytoscape network mapping DPWH District Engineers to awarded contractors with risk flags.
- **Response**: `{ nodes: CytoscapeNode[], edges: CytoscapeEdge[] }`

---

### 8.4 Contracts, BOQ & Forensics

#### `GET /api/contracts/[id]/pdf`
Returns parsed contract document metadata and engineer signature status.
- **URL Parameter**: `id` (Project ID)
- **Response**: `{ contractDocument: ContractDocument & { engineerSignature: EngineerSignature } }`

#### `GET /api/contracts/[id]/boq`
Itemized Bill of Quantities with variance against national and regional price benchmarks.
- **URL Parameter**: `id` (Project ID)
- **Response**:
  ```json
  {
    "projectId": "21AB0045",
    "extractionStatus": "PARSED",
    "totalBoqCost": 48250000.0,
    "mobilizationCost": 2800000.0,
    "flagMobilizationInflated": true,
    "items": [
      {
        "itemCode": "103(1)a",
        "description": "Structure Excavation (Common Soil)",
        "quantity": 1420.5,
        "unit": "cu.m.",
        "unitCostPhp": 420.0,
        "totalPhp": 596610.0,
        "nationalAvgPhp": 310.0,
        "variancePct": 35.5,
        "flagUnitPriceAnomaly": true
      }
    ]
  }
  ```

---

### 8.5 Whistleblowing, Reviews & OTP

#### `GET /api/reviews`
List all verified citizen reviews for a project with star breakdown.
- **Query Parameter**: `projectId` (string, required)
- **Response**: `{ reviews: Review[], stats: { total: number, avgRating: number, fiveStars: number, ... } }`

#### `POST /api/reviews`
Submit a new multi-criteria citizen rating and field report.
- **Request Body**:
  ```json
  {
    "projectId": "string",
    "rating": 1,
    "progressRating": 20,
    "qualityRating": 2,
    "workersActive": false,
    "comment": "Site has been abandoned for 4 months. No heavy equipment present.",
    "photoUrl": "https://...",
    "phone": "+639171234567",
    "otp": "839201",
    "userLat": 14.5995,
    "userLng": 120.9842
  }
  ```
- **Validation**: Enforces 15km geofence, single review per phone number, and single-use valid OTP.
- **Response**: `{ success: true, review: Review, distanceKm: number }`

#### `POST /api/reviews/corroborate`
Upvote/corroborate an eyewitness review.
- **Request Body**: `{ reviewId: "string" }`
- **Response**: `{ success: true, corroborations: number }`

#### `POST /api/report/otp`
Request an SMS verification code for report submission.
- **Request Body**: `{ phone: "+639171234567", projectId: "string" }`
- **Response**: `{ success: true, message: "OTP sent successfully" }` (or bypass code in demo mode).

#### `POST /api/upload`
Upload field inspection photographs.
- **Request**: Multipart Form Data (`file: File`).
- **Response**: `{ url: "string", success: true }`

---

### 8.6 AI & Analytics

#### `POST /api/chat`
Server-Sent Events (SSE) streaming endpoint for RAG AI conversational query answering.
- **Request Body**: `{ message: "Show me stalled flood control projects in Bulacan" }`
- **Response**: `text/event-stream` returning `{ sourceIds: string[] }` followed by text chunks and `[DONE]`.

#### `POST /api/ai/summarize`
Generates or retrieves Gemini Flash plain-language summary for a contract.
- **Request Body**: `{ projectId: "string" }`
- **Response**: `{ summary: string }`

#### `GET /api/stats`
Nationwide aggregated figures.
- **Response**: `{ totalProjects: 248220, totalBudgetPHP: 2410500000000, flaggedProjects: 14820, stalledCount: 3120, overdueCount: 8940, overpaidCount: 2760 }`

---

### 8.7 System & Administration

#### `POST /api/cron/sync`
Background task triggering automated synchronization against DPWH API.
- **Headers**: `Authorization: Bearer <CRON_SECRET>`
- **Response**: `{ success: true, syncedCount: number, timestamp: string }`

#### `POST /api/psgc/populate`
Utility endpoint to initialize and verify PSGC geographic codes.

#### `POST /api/seed`
Developer utility endpoint for database seeding.

---

## 9. Developer Onboarding, Environment & Runbook

### 9.1 Prerequisites
- **Node.js**: v20.x or v22.x LTS
- **Package Manager**: `npm` (v10+)
- **Database**: PostgreSQL 16 instance (Supabase or Neon recommended)
- **API Keys**:
  - Google Gemini API Key (from Google AI Studio)
  - Mapbox Public Access Token (from Mapbox Dashboard)
  - Semaphore API Key (Optional; `DEMO_OTP_BYPASS="true"` can be used locally)

### 9.2 Environment Configuration
Create a `.env` file inside `philtrace/`:

```bash
# Database Connections (Supabase Transaction Pooler & Direct)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Google Gemini API Key
GEMINI_API_KEY="AIzaSy..."

# Mapbox Public Client Token
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1IjoieW91ci11c2VyIiwiYSI6Ii4uLiJ9"

# PSA PSGC Token (Optional for live PSA lookups)
PSA_PSGC_TOKEN="your-psgc-token"

# SMS OTP Provider
SEMAPHORE_API_KEY="your-semaphore-api-key"

# Security & Secrets
JWT_SECRET="generate-a-random-64-character-hex-string"
CRON_SECRET="generate-a-random-cron-secret-string"

# Local Developer Testing Flags
DEMO_OTP_BYPASS="true"
```

### 9.3 Installation & Database Setup Runbook

```bash
# 1. Clone repository and navigate to application
cd "C:\Users\admin\Desktop\PhilTrace final\philtrace"

# 2. Install all dependencies
npm install

# 3. Push Prisma schema to your PostgreSQL database
npx prisma db push

# 4. Generate the Prisma Client
npx prisma generate

# 5. Populate database with complete PSGC regions, provinces, and real projects
# (This seeds 17 regions, 82 provinces, and sample DPWH projects)
npm run seed

# 6. Precompute Mapbox clustering artifacts (if updating geo data)
npm run generate:map

# 7. Start the local development server with Turbopack
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 10. Engineering Best Practices & Roadmap for Incoming Developers

### 10.1 Key Engineering Rules & Invariants

1. **Offload Heavy Geospatial Processing**:
   - Never run Supercluster clustering on the React main thread. All viewport-independent clustering must remain inside `cluster.worker.ts` to prevent UI thread stutter.
2. **Server-Side Proximity Validation**:
   - Never trust the client's claimed location. `isWithinReviewRadius` in `src/lib/geo.ts` must always be calculated server-side inside `POST /api/reviews`.
3. **Strict AI Hallucination Guardrails**:
   - In `src/app/api/chat/route.ts`, Gemini Flash is provided an explicit `systemInstruction` constraining answers *strictly* to the injected PostgreSQL project records. Never allow the chatbot to generate project budgets or statuses out of thin air.
4. **Contractor Name Cleansing**:
   - DPWH contractors frequently have IDs attached like `"ROYAL CROWN CONST. (38491)"`. Always run contractor strings through `cleanContractorName()` in `src/lib/format.ts` before database queries or Cytoscape node aggregation.
5. **Database Connections & Pooling**:
   - Next.js serverless functions can exhaust PostgreSQL connection pools. Always use `prisma.$disconnect()` or rely on Supabase PgBouncer via `DATABASE_URL` with transaction pooling enabled.
6. **Preserve Clickable IDs in Responses**:
   - Every UI summary, chatbot answer, or whistleblower alert must link to the canonical project drawer via `?project=[id]`.

### 10.2 Suggested Roadmap & Next Milestones

- [ ] **Multi-Image Citizen Uploads**: Expand `Review` model to support multiple eyewitness photos with automated EXIF metadata GPS and timestamp extraction.
- [ ] **Automated Satellite Change Detection**: Integrate an automated image difference pipeline using PhilSA / Sentinel-2 multispectral imagery to compute NDVI or building footprint changes over time.
- [ ] **FOI Direct Filing Generator**: Add a button on flagged projects generating a pre-filled eFOI (Freedom of Information) request letter formatted according to DPWH standards.
- [ ] **Push Notifications / Geofence Alerts**: Implement Web Push notifications alerting subscribed citizens whenever a new project is awarded or flagged within $5\text{ km}$ of their home barangay.
