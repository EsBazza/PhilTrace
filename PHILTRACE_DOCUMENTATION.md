# 🇵🇭 PhilTrace — Comprehensive Master Documentation

> **AI-Powered National Public Infrastructure Transparency Platform**  
> *"The Google Maps for Philippine Public Works & Infrastructure"*  
> Cross-referencing official DPWH claims, verified citizen whistleblowers, and satellite ground-truth across 248,000+ public contracts totaling ₱2.4T+ to ₱6.5T+ in public funds.

---

## 📑 Table of Contents
1. [Executive Summary & Civic Mission](#1-executive-summary--civic-mission)
2. [High-Level Architecture & Tech Stack](#2-high-level-architecture--tech-stack)
3. [Database Schema & Data Models](#3-database-schema--data-models)
4. [Data Ingestion, Geocoding & Sync Pipeline](#4-data-ingestion-geocoding--sync-pipeline)
5. [Core Features & Application Modules](#5-core-features--application-modules)
   - [5.1 Full-Screen Mapbox Engine (`/map`)](#51-full-screen-mapbox-engine-map)
   - [5.2 Project Inspection Drawer & Ground-Truth Verification](#52-project-inspection-drawer--ground-truth-verification)
   - [5.3 Multi-Criteria Citizen Reviews & Whistleblowing Engine](#53-multi-criteria-citizen-reviews--whistleblowing-engine)
   - [5.4 Contractor Joint-Venture & Alliance Graph (`/contractors`)](#54-contractor-joint-venture--alliance-graph-contractors)
   - [5.5 Near Me Geolocation Radar (`/nearby`)](#55-near-me-geolocation-radar-nearby)
   - [5.6 AI Conversational Intelligence & Search (`/api/chat`, `/search`)](#56-ai-conversational-intelligence--search-apichat-search)
   - [5.7 Government Agency Portal (`/agency`)](#57-government-agency-portal-agency)
6. [Forensic Red-Flag & Anomaly Detection Algorithms](#6-forensic-red-flag--anomaly-detection-algorithms)
7. [Full API Reference](#7-full-api-reference)
8. [Environment Variables, Setup & Deployment](#8-environment-variables-setup--deployment)
9. [Legal & Governance Alignment](#9-legal--governance-alignment)

---

## 1. Executive Summary & Civic Mission

PhilTrace is an open-source civic technology platform created to empower Filipino taxpayers, investigative journalists, non-governmental organizations, and local government units with radical transparency and accountability over public infrastructure projects.

### The Problem
- **Information Asymmetry**: Millions of public infrastructure allocations are buried in non-standardized government records or obscure PDF documents.
- **Ghost & Abandoned Projects**: Contracts declared "completed" or given massive payouts on paper often sit half-finished or abandoned in physical reality.
- **Cartel Collusion & Repeat Defaulters**: Contractors blacklisted or chronically delayed in one region often bid and win multi-million-peso contracts in another under joint-venture entities.

### The PhilTrace Solution
PhilTrace continuously pulls structured data from the **Department of Public Works and Highways (DPWH) Transparency API** and standardizes it against the **Philippine Statistics Authority (PSA) Standard Geographic Codes (PSGC)**. It equips citizens with:
1. **Interactive Geospatial Visualization**: View every road, bridge, flood control dike, and building on a nationwide map.
2. **Independent Ground-Truth Comparison**: Compare historical vs. present satellite imagery (ESRI Wayback API) and 360° Google Street View against declared DPWH progress.
3. **Verified Whistleblower Reporting**: Collects ground photos and ratings with SMS OTP verification and live GPS proximity scoring.
4. **Network Cartel Intelligence**: Interactive graph uncovering contractor alliances, joint ventures, and repeat defaulters.

---

## 2. High-Level Architecture & Tech Stack

```mermaid
graph TD
    subgraph Data Sources
        DPWH[DPWH Transparency API<br>248k+ Contracts]
        PSGC[PSA PSGC API<br>Regions & Provinces]
        ESRI[ESRI Wayback Satellite<br>Time-series Imagery]
        GSV[Google Street View<br>360 Ground Panoramas]
    end

    subgraph Backend & Processing
        SYNC[Nightly Sync Cron & Python Ingestion]
        API[Next.js 16 Serverless App Router API]
        PG[(PostgreSQL + Prisma ORM<br>Supabase / Neon)]
        GEMINI[Google Gemini Flash API<br>gemini-2.5-flash]
    end

    subgraph Frontend Application
        MAP[Mapbox GL JS<br>Archipelago Map & Heatmaps]
        CYTO[Cytoscape.js<br>Contractor Network Graph]
        UI[React 19 + Tailwind CSS<br>Mobile-First Responsive Web]
    end

    DPWH --> SYNC
    PSGC --> SYNC
    SYNC --> PG
    PG <--> API
    API <--> UI
    GEMINI <--> API
    ESRI --> UI
    GSV --> UI
    API --> MAP
    API --> CYTO
```

### Complete Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) | Full-stack serverless web application |
| **Language** | TypeScript 5.x | Strict end-to-end type safety |
| **Frontend UI** | React 19, Tailwind CSS, Lucide Icons, Framer Motion | Modern, responsive, mobile-first design |
| **Mapping Engine** | Mapbox GL JS 3.x, `react-simple-maps` | 3D terrain, satellite tiles, clustering, heatmaps |
| **Satellite History** | ESRI World Imagery Wayback API | Multi-year historical satellite comparison |
| **Graph Visuals** | Cytoscape.js 3.x + `react-cytoscapejs` | Dynamic joint-venture and contractor alliance graphs |
| **Database** | PostgreSQL 16 (Supabase / Neon) | Scalable relational storage for projects & reviews |
| **ORM** | Prisma ORM 7 (`@prisma/client`) | Type-safe query building and migrations |
| **AI Layer** | Google Gemini Flash (`gemini-2.5-flash`) | Engineering jargon translation & AI assistant |
| **Verification** | SMS OTP (Semaphore / Twilio / Bypass Demo) | Anti-spam citizen whistleblower verification |

---

## 3. Database Schema & Data Models

The relational schema is configured in `philtrace/prisma/schema.prisma`:

```mermaid
erDiagram
    REGION ||--o{ PROVINCE : contains
    PROVINCE ||--o{ PROJECT : contains
    PROJECT ||--o{ REVIEW : has
    PROJECT ||--o{ COMMENT : has
    PROJECT ||--o{ AGENCY_UPDATE : receives
    CONTRACTOR }|..|{ PROJECT : executes

    REGION {
        string id PK
        string psgcCode UK
        string name UK
    }

    PROVINCE {
        string id PK
        string psgcCode UK
        string name
        string regionId FK
    }

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
        boolean flagOverpaid
        boolean flagPaymentPending
        string aiSummary
        boolean isLive
        string livestreamUrl
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
        datetime createdAt
    }

    CONTRACTOR {
        string id PK
        string name UK
        int totalContracts
        float totalValuePHP
        float avgProgress
        int overdueCount
        int terminatedCount
    }
```

---

## 4. Data Ingestion, Geocoding & Sync Pipeline

1. **DPWH Data Ingestion**:
   - Ingestion scripts (`scripts/sync_live_dpwh.py`, `scripts/ingest_all_dpwh.py`) stream structured contract records from DPWH.
   - Extracts coordinates, project categories (Flood Control, Bridges, Highways, Buildings), contractor names, milestones, and funding amounts.
2. **PSGC Geographic Normalization**:
   - Matches raw DPWH project locations against the PSA PSGC database via `province-normalizer.ts`, resolving legacy and colloquial names into standard hierarchical boundaries.
3. **Contractor Name Disambiguation & JV Split**:
   - Parses complex joint venture strings (e.g. `"ALPHA BUILDERS / BETA CONST. (JV)"`) into discrete entities via `format.ts: parseContractors()`.
   - Aggregates contractor total values, average progress, and overdue counts.
4. **Nightly Synchronization**:
   - An automated cron endpoint (`/api/cron/sync`) runs on schedule to refresh updated project statuses and agency updates.

---

## 5. Core Features & Application Modules

### 5.1 Full-Screen Mapbox Engine (`/map`)
- **Archipelago-Locked Bounding Box**: Coordinates strictly bounded to the Philippine territorial limits.
- **Free Roam Mode**: Smooth zooming transitioning from national density heatmaps to cluster bubbles, and finally to individual color-coded project pins.
- **Guided Drill-Down Mode**: Structured selector navigation: `Philippines > Region > Province > Municipality > Project`.
- **Basemap Modes**: Seamless switching between Mapbox Satellite Imagery, Dark Carto Mode, and Topographical 3D Terrain.

### 5.2 Project Inspection Drawer & Ground-Truth Verification
When any project pin is clicked:
- **ESRI Wayback Satellite Comparison**: An interactive split-screen slider comparing past satellite imagery with recent captures to verify ground truth.
- **360° Google Street View Embed**: Automatically loads ground-level imagery at the exact GPS coordinate.
- **Gemini AI Plain-Language Executive Summary**: Translates engineering project titles into concise Tagalog/English summaries explaining project purpose and current state.
- **Live Stream Embed**: Embeds live CCTV construction camera streams for supported DPWH projects.

### 5.3 Multi-Criteria Citizen Reviews & Whistleblowing Engine
- **3-Pillar Rating System**:
  1. *Physical Completion Perception* (0% - 100%)
  2. *Structural Build Quality* (1 to 5 Stars)
  3. *Workforce Activity Status* (Active vs. Abandoned Site)
- **Anti-Spam Verification & Geo-Proximity**:
  - SMS OTP verification creates an irreversible SHA-256 `phoneHash`.
  - Reviewer GPS is compared to the project site using the Haversine formula to compute `distanceKm`. Verified on-site reports (<5km) receive priority badges.
- **Community Corroboration**: Nearby citizens can upvote and corroborate filed reports.

### 5.4 Contractor Joint-Venture & Alliance Graph (`/contractors`)
- **Cytoscape.js Network Graph**: Maps relationships between top contractors who frequently bid together in joint ventures.
  - Node Size: Proportional to total public funds won (log scale).
  - Node Color: Green (Clean / On-time), Amber (Has Overdue Projects), Red (High Risk / Multiple Overdue or Terminated Contracts).
  - Edge Weight: Frequency of joint venture partnerships.
- **Contractor Leaderboard**: Searchable and filterable table sorting contractors by total contracts won, combined value in PHP, average completion rate, and overdue penalty counts.

### 5.5 Near Me Geolocation Radar (`/nearby`)
- Mobile-optimized interface that uses HTML5 Geolocation to detect all public works within a configurable 1km - 25km radius.
- Categorizes nearby projects into *Active*, *Completed*, *Overdue*, and *Stalled*.

### 5.6 AI Conversational Intelligence & Search (`/api/chat`, `/search`)
- Natural-language interface powered by **Google Gemini Flash**.
- Citizens can ask queries like:
  - *"Saan may flood control projects sa Pampanga na overdue?"*
  - *"Who are the top contractors with delayed bridge projects in Region VII?"*
- Synthesizes live database context into structured answers with direct links to project records.

### 5.7 Government Agency Portal (`/agency`)
- Secure login for verified DPWH and LGU officials to post official milestone updates, progress revisions, and site inspection photos to address citizen whistleblower claims directly.

---

## 6. Forensic Red-Flag & Anomaly Detection Algorithms

PhilTrace executes real-time anomaly analysis implemented in `anomaly-flags.ts`:

| Anomaly Flag | Trigger Condition / Formula | Red Flag Severity |
| :--- | :--- | :--- |
| **`flagOverpaid`** (Ghost Risk) | `progress < 30%` AND `amountPaid > 0.80 * budgetPHP` | 🚨 **Critical**: High disbursement with minimal physical progress. |
| **`flagStalled`** (Abandoned) | `status = "On-Going"` AND `Days since last update >= 180 days` | ⚠️ **High**: No construction progress in over 6 months. |
| **`flagNeverStarted`** | `Now > startDate` AND `progress = 0%` AND `comments = 0` | ⚠️ **High**: Funds released and start date passed without groundbreaking. |
| **`flagOverdue`** | `Now > completionDate` AND `status != "Completed"` | 🟡 **Medium**: Contract is past deadline without completion. |
| **`flagPaymentPending`** | `progress = 100%` AND `amountPaid = 0` | ℹ️ **Informational**: Work finished, waiting for government disbursement. |

---

## 7. Full API Reference

| Endpoint | Method | Purpose & Parameters |
| :--- | :--- | :--- |
| `/api/projects` | `GET` | List/filter projects. Params: `provinceId`, `regionId`, `category`, `status`, `flag`, `q`, `page`, `limit` |
| `/api/projects/[id]` | `GET` | Retrieve full project profile with comments, reviews, agency updates, and AI summary |
| `/api/nearby` | `GET` | Proximity search. Params: `lat`, `lng`, `radiusKm` (default 5km, max 25km) |
| `/api/contractors` | `GET` | Paginated contractor leaderboard. Params: `q`, `sort`, `order`, `page`, `limit` |
| `/api/contractors/graph`| `GET` | Cytoscape nodes and edges for joint-venture network |
| `/api/reviews` | `GET, POST`| Fetch project reviews or submit a new verified citizen review |
| `/api/reviews/corroborate` | `POST` | Upvote/corroborate an eyewitness citizen review |
| `/api/report/otp` | `POST` | Send or bypass SMS verification OTP for whistleblower reporting |
| `/api/ai/summarize` | `POST` | Generate Gemini Flash plain-language breakdown for a specific contract |
| `/api/chat` | `POST` | Interactive conversational query engine with database context |
| `/api/stats` | `GET` | Aggregated national numbers: total contracts, budget sum, red flag counts |
| `/api/agency/login` | `POST` | Agency official authentication |
| `/api/agency-update` | `POST` | Publish official agency progress report |
| `/api/cron/sync` | `POST` | Trigger background sync against DPWH data source |

---

## 8. Environment Variables, Setup & Deployment

### Environment Configuration (`.env`)

```env
# Database Connections
DATABASE_URL="postgresql://user:password@host:5432/philtrace?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/philtrace"

# Mapbox & Geocoding
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJ..."

# AI Intelligence
GEMINI_API_KEY="AIzaSy..."

# SMS Verification (Set true for local dev testing)
DEMO_OTP_BYPASS="true"
SEMAPHORE_API_KEY=""
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
```

### Installation & Local Run

```bash
# 1. Navigate to application folder
cd philtrace

# 2. Install dependencies
npm install

# 3. Synchronize database schema
npx prisma db push

# 4. (Optional) Run dataset ingestion
npx tsx scripts/sync-real-data.ts

# 5. Start development server
npm run dev
```

The application will be live at `http://localhost:3000`.

---

## 9. Legal & Governance Alignment

- **Philippine Constitution, Art. III, Sec. 7**: *"The right of the people to information on matters of public concern shall be recognized."*
- **Executive Order No. 2 (s. 2016)**: Operationalizing the People's Right to Information (Freedom of Information).
- **2026 General Appropriations Mandate**: Recommends the Philippine Space Agency (PhilSA) and DPWH to cross-reference public works with satellite monitoring to ensure transparency against flood control and infrastructure corruption.
