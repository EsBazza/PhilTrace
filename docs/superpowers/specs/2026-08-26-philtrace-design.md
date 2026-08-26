# PhilTrace — Civic Transparency Platform Design Spec

**Date:** 2026-08-26
**Status:** Draft → Pending Review

---

## 1. Project Overview

PhilTrace is a civic transparency platform for Philippine public infrastructure. It lets Filipino citizens investigate any DPWH infrastructure project: where it is, who built it, how much it cost, how complete it is, and what other citizens are reporting about it.

The core transparency story is the **contrast between three signals**:
1. What the government agency claims (agency progress update)
2. What citizens observe (whistleblower thread)
3. What satellite imagery shows (before/after comparison)

### 1.1 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, TypeScript 5 strict) |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma ORM 7 with driver adapter |
| Database | PostgreSQL (Supabase, connection pooling) |
| AI | Google Gemini API (`gemini-3.5-flash`) via `@google/genai` |
| Maps (satellite) | Mapbox GL JS 3.x |
| Maps (choropleth) | react-simple-maps + PH TopoJSON |
| Graphs | Cytoscape.js + react-cytoscapejs |
| Client caching | TanStack Query 5.x |
| SMS | Semaphore (Philippine SMS gateway) |
| Deployment | Vercel + Vercel Cron |

### 1.2 Primary Data Sources

**DPWH Transparency API** (no auth, no API key):
```
Base: https://api.transparency.dpwh.gov.ph/projects
Single project: https://api.transparency.dpwh.gov.ph/projects/{contractId}
Filter by region: ?region=Region III
Filter by status: ?status=On-Going
Paginate: ?page=1&limit=20
```
Returns 264,440 real contracts with GPS coordinates, progress %, contractor names, budget, livestream URLs, and `hasSatelliteImage` boolean.

**HuggingFace Dataset Mirror** (fallback when DPWH API is unreachable):
```
https://datasets-server.huggingface.co/first-rows?dataset=bettergovph%2Fdpwh-transparency-data&config=default&split=train
```
Same data shape as DPWH API. Used for initial seed and as fallback during nightly sync.

**PSA PSGC API** (token required):
```
https://classification.psa.gov.ph/psgc/{version}/regions?token=YOUR_TOKEN
https://classification.psa.gov.ph/psgc/{version}/provinces?token=YOUR_TOKEN&reg={code}
```
Populates Region and Province tables with official Philippine government geographic codes.

---

## 2. Architecture

### 2.1 System Diagram

```
┌───────────────────────────────────────────────────────┐
│                  Next.js App (Vercel)                  │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ App Router   │  │ API Routes   │  │ Vercel Cron  │ │
│  │ (Pages)      │  │ (/app/api)   │  │ 02:00 PHT    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                  │         │
│         └────────┬────────┘                  │         │
│                  │                           │         │
│       ┌──────────▼──────────┐    ┌───────────▼───────┐ │
│       │    PostgreSQL       │    │  Data Sync Layer  │ │
│       │    (Supabase)       │◄───│  DPWH → HF → DB  │ │
│       │    All reads        │    └───────────┬───────┘ │
│       └─────────────────────┘                │         │
│                                   ┌──────────┴───────┐ │
│                                   │ External APIs    │ │
│                                   │ • DPWH (primary) │ │
│                                   │ • HF (fallback)  │ │
│                                   │ • Gemini 3.5     │ │
│                                   │ • Semaphore SMS  │ │
│                                   │ • Mapbox tiles   │ │
│                                   │ • Esri Wayback   │ │
│                                   │ • PSA PSGC       │ │
│                                   └──────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 2.2 Architectural Rules (Never Break)

1. **Single Next.js deployment** — no Docker, no second service, no separate backend
2. **All external API calls go through `/app/api/` routes** — never from client components
3. **DB-first reads** — all page data comes from Postgres, no live DPWH API calls during page loads
4. **PostgreSQL stores**: citizen comments, agency updates, anomaly flags, cached Gemini summaries, agency account credentials, the nightly-synced project mirror, region/province data
5. **Never seed fake data** — all project data comes from the live DPWH API or HuggingFace mirror
6. **TypeScript strict mode** — no `any` types, no `ts-ignore`
7. **Mobile-first** — every component must work at 375px width on a slow connection

### 2.3 Data Flow

**Nightly Sync (02:00 PHT):**
```
Vercel Cron → /api/cron/sync (CRON_SECRET check)
├── Try DPWH API (paginate all pages, 200ms delay between requests)
│   ├── Success → upsert into Project table, syncSource = "dpwh"
│   └── Fail (403/timeout) → Try HuggingFace dataset API
│       ├── Success → upsert, syncSource = "huggingface"
│       └── Fail → Log error, skip sync, keep existing data
├── Recompute anomaly flags for all modified projects
├── Recompute Contractor aggregate stats
└── Update lastSyncAt timestamp
```

**Initial Seed (first deploy only):**
- `/api/seed` route (protected with `CRON_SECRET`)
- Fetches from HuggingFace dataset API using the `/rows` endpoint (supports `offset` + `length` pagination for full dataset access — the `/first-rows` endpoint only returns ~100 rows)
- API: `https://datasets-server.huggingface.co/rows?dataset=bettergovph%2Fdpwh-transparency-data&config=default&split=train&offset=0&length=100`
- Batch upserts in chunks of 1000
- Estimated time: ~5-10 minutes for full 264K dataset

**User-Facing Reads:**
All pages query Postgres directly. No live external API calls during page loads (except Mapbox/Esri tile requests from the client for satellite imagery).

---

## 3. Database Schema

### 3.1 Prisma Schema

```prisma
model Region {
  id         String     @id @default(cuid())
  psgcCode   String     @unique
  name       String     @unique
  provinces  Province[]
}

model Province {
  id        String    @id @default(cuid())
  psgcCode  String    @unique
  name      String
  regionId  String
  region    Region    @relation(fields: [regionId], references: [id])
  projects  Project[]
  @@unique([name, regionId])
}

model Project {
  id                 String         @id   // DPWH contractId
  name               String
  provinceId         String
  province           Province       @relation(fields: [provinceId], references: [id])
  gpsLat             Float
  gpsLng             Float
  budgetPHP          Float
  amountPaid         Float          @default(0)
  progress           Float          @default(0)
  startDate          DateTime
  completionDate     DateTime?
  status             String
  category           String
  contractorRaw      String
  sourceOfFunds      String?
  programName        String?
  infraYear          String?
  isLive             Boolean        @default(false)
  livestreamUrl      String?
  hasSatelliteImage  Boolean        @default(false)
  reportCount        Int            @default(0)
  flagStalled        Boolean        @default(false)
  flagNeverStarted   Boolean        @default(false)
  flagOverdue        Boolean        @default(false)
  flagPaymentPending Boolean        @default(false)
  flagOverpaid       Boolean        @default(false)
  lastActivityAt     DateTime?
  aiSummary          String?
  syncSource         String?        // "dpwh" | "huggingface"
  comments           Comment[]
  agencyUpdates      AgencyUpdate[]
  updatedAt          DateTime       @updatedAt
}

model Contractor {
  id              String  @id @default(cuid())
  name            String  @unique
  totalContracts  Int     @default(0)
  totalValuePHP   Float   @default(0)
  avgProgress     Float   @default(0)
  overdueCount    Int     @default(0)
  terminatedCount Int     @default(0)
}

model Comment {
  id                 String   @id @default(cuid())
  projectId          String
  project            Project  @relation(fields: [projectId], references: [id])
  text               String
  severity           String
  rationale          String
  phoneVerified      Boolean  @default(false)
  corroborationCount Int      @default(0)
  photoUrl           String?
  createdAt          DateTime @default(now())
}

model AgencyUpdate {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  agencyName  String
  percentDone Int
  note        String
  photoUrl    String?
  createdAt   DateTime @default(now())
}

model AgencyAccount {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  agencyName   String
  createdAt    DateTime @default(now())
}
```

### 3.2 Field Mapping (DPWH/HuggingFace → Prisma)

| Source Field | Prisma Field | Transform |
|---|---|---|
| `contractId` | `id` | Direct |
| `description` | `name` | Direct |
| `location.region` | → lookup Region → Province | Region name match |
| `location.province` | → Province table via normalizer | Strip DEO suffix |
| `latitude` | `gpsLat` | Direct |
| `longitude` | `gpsLng` | Direct |
| `budget` | `budgetPHP` | Direct |
| `amountPaid` | `amountPaid` | int → float |
| `progress` | `progress` | Direct |
| `startDate` | `startDate` | ISO parse |
| `completionDate` | `completionDate` | Nullable ISO parse |
| `status` | `status` | Direct |
| `category` | `category` | Direct |
| `contractor` | `contractorRaw` | Direct (includes ID in parens) |
| `sourceOfFunds` | `sourceOfFunds` | Direct |
| `programName` | `programName` | Direct |
| `infraYear` | `infraYear` | Direct |
| `isLive` | `isLive` | Direct |
| `livestreamUrl` | `livestreamUrl` | Direct |
| `reportCount` | `reportCount` | Direct |
| `hasSatelliteImage` | `hasSatelliteImage` | Direct |

### 3.3 Province Name Normalizer

The DPWH API returns `location.province` as DEO names (e.g., `"Pampanga 1st DEO"`, `"Metro Manila 3rd DEO"`). These must be normalized to match the Province table populated from PSA PSGC.

**Algorithm:**
1. Strip DEO suffixes: `" 1st DEO"`, `" 2nd DEO"`, `" 3rd DEO"`, `" 4th DEO"`, `" City DEO"`, `" DEO"`
2. Look up cleaned name in Province table (case-insensitive)
3. If match → use that province's ID
4. If no match → check a static fallback mapping table for known edge cases (e.g., `"Region V"` → region-level, `"Tacloban City DEO"` → `"Leyte"`)
5. If still no match → log as unmapped, assign to an "Unknown" province under the correct region

---

## 4. Anomaly Flag System

### 4.1 Two-Tier Classification

**Anomaly Flags** (counted in choropleth density, shown as colored chips):
| Flag | Rule | Rationale |
|---|---|---|
| `flagStalled` | status = "On-Going" AND no AgencyUpdate in 180+ days AND progress unchanged since last sync | Project appears abandoned |
| `flagNeverStarted` | startDate < now AND progress = 0 AND no Comments exist | Past start date, zero progress |
| `flagOverdue` | completionDate < now AND status ≠ "Completed" | Deadline passed, not done |
| `flagOverpaid` | progress < 30 AND amountPaid > 0 AND amountPaid > 0.8 × budgetPHP | Most money paid but little work done |

**Informational Flags** (shown on project detail page only, gray info badge, not counted in density):
| Flag | Rule | Rationale |
|---|---|---|
| `flagPaymentPending` | progress = 100 AND amountPaid = 0 | Data reporting artifact — nearly all completed projects show zero disbursement |

### 4.2 `computeAnomalyFlags(project)` Function

```typescript
interface AnomalyFlags {
  flagStalled: boolean;
  flagNeverStarted: boolean;
  flagOverdue: boolean;
  flagOverpaid: boolean;
  flagPaymentPending: boolean;
}

function computeAnomalyFlags(
  project: ProjectWithRelations,
  latestAgencyUpdate: AgencyUpdate | null,
  commentCount: number
): AnomalyFlags;
```

Called during nightly sync after each project upsert.

---

## 5. Pages & Routes

### 5.1 Route Structure

| Route | Description |
|---|---|
| `/` | Choropleth home map |
| `/regions/[region]` | Region project list + filters |
| `/projects/[id]` | Project detail (6 sections) |
| `/nearby` | Geolocation-based nearby projects |
| `/contractors` | Network graph + leaderboard |
| `/search` | Full-text search |
| `/agency` | Agency login + update form |

### 5.2 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/projects` | GET | List projects from DB. Query params: `region`, `status`, `category`, `page`, `limit`, `flag` |
| `/api/projects/[id]` | GET | Single project detail from DB with comments + agency updates |
| `/api/nearby` | GET | Haversine distance query. Params: `lat`, `lng`, `radius` (km) |
| `/api/contractors/graph` | GET | Cytoscape node/edge payload |
| `/api/ai/summarize` | POST | Gemini "Explain Simply" (cached in DB) |
| `/api/chat` | POST | Gemini chatbot (streaming) |
| `/api/report` | POST | Whistleblower submission + OTP verification |
| `/api/report/otp` | POST | Send OTP to phone number |
| `/api/report/corroborate` | POST | Increment corroboration count |
| `/api/agency-update` | POST | Agency progress update (auth required) |
| `/api/agency-update` | GET | Get agency updates for a project |
| `/api/agency/login` | POST | Agency login → JWT cookie |
| `/api/cron/sync` | POST | Nightly data sync (CRON_SECRET protected) |
| `/api/psgc/populate` | POST | One-time PSA region/province population |
| `/api/seed` | POST | One-time initial data load from HuggingFace |

### 5.3 Page Details

#### Home Page (`/`)
- react-simple-maps with PH regions TopoJSON (17 regions)
- Choropleth color scale: green (0% anomaly density) → yellow → red (high density)
- Anomaly density = flagged projects / total projects per region (excluding `flagPaymentPending`)
- Hover tooltip: region name, total projects, flagged count, anomaly density %
- Click → `/regions/[regionName]`
- Floating summary bar: total contracts, total budget (₱), last sync timestamp

#### Region Page (`/regions/[region]`)
- Left sidebar: province list (filterable)
- Main content: paginated project cards
- Filter chips: All · Stalled · Never Started · Overdue · Overpaid
- Category filter: All · Roads · Bridges · Flood Control · Buildings · Water
- Sort options: budget (desc), progress (asc), start date (newest)
- Project card: name (2 lines), contractor, budget (₱X.XXM/B), status badge, anomaly chips, progress bar

#### Project Detail Page (`/projects/[id]`)

**Section A — Header:**
- Contract ID, full description, category badge, funding source, infra year
- Status badge (green=Completed, blue=On-Going, gray=Not Started, red=Terminated)
- Progress ring (circular progress indicator)
- Budget vs. Amount Paid gap bar: two-color horizontal bar
- If amountPaid = 0 AND progress = 100: gray "Payment Data Unavailable" info badge

**Section B — Live Construction Cam (conditional):**
- Render only if `isLive === true` AND `livestreamUrl !== null`
- Embed livestream iframe
- Red "LIVE" pulsing badge

**Section C — Satellite Before/After (conditional):**
- Render only if `hasSatelliteImage === true`
- "Before": Esri World Imagery Wayback tile for date closest to `startDate`
- "After": Mapbox current satellite tile
- Two-position toggle (not a slider)
- Label: "Esri Wayback [date] vs. Mapbox Current"

**Section D — Agency Progress Updates:**
- Fetch from `/api/agency-update?projectId=X`
- Blue government-styled card with "Official Update" label
- Fields: agency name, percent done, note, photo (if any), timestamp
- If no updates: "No official agency updates posted"

**Section E — Whistleblower Thread:**
- All verified comments for this project
- Comment card: severity badge (low=gray, medium=amber, high=orange, critical=red), AI rationale, corroboration count, timestamp
- "Agree with this report" button → increments corroboration (no OTP required)
- Report submission form at bottom → requires phone OTP

**Section F — "Explain Simply" Button:**
- POST to `/api/ai/summarize`
- Check DB cache (`aiSummary`) → if hit, return cached → if miss, call Gemini, cache, return
- Gemini prompt (verbatim):
  ```
  You are helping a Filipino citizen understand a government project. In 3 plain sentences, explain what this project is, its current status, and any concerns based on these flags: [flags]. Project: [description]. Budget: ₱[budget]. Progress: [progress]%. Respond in clear, simple English.
  ```

#### Near Me Page (`/nearby`)
- Request browser geolocation on page load
- On granted: query `/api/nearby?lat=X&lng=Y&radius=5`
- Results sorted by distance ascending with "X.X km away" badge
- On denied: barangay/city name search input fallback
- Each result links to project detail page

#### Contractors Page (`/contractors`)
- **Top: Network Graph**
  - Cytoscape.js with cose-bilkent layout
  - Nodes = contractors, size ∝ total contract value
  - Edges = co-appeared in a contract (joint ventures parsed from `contractorRaw`)
  - Contractor parsing: split on `"&"`, `"/"`, `"JOINT VENTURE"`, trim whitespace
- **Bottom: Leaderboard Table**
  - Sortable columns: Contractor Name, Total Contracts, Total Value (₱), Avg Progress %, Overdue Count, Terminated Count
  - Red row highlight if overdueCount > 5

#### Search Page (`/search`)
- SQL `ILIKE` query against `Project.name` and `Project.contractorRaw`
- Also searchable by `contractId`
- Persistent search bar in root layout header

#### Agency Page (`/agency`)
- Login form: email + password
- On login success: JWT httpOnly cookie
- After login: project search → post update form (percent done, note, optional photo URL)

### 5.4 Chatbot Widget
- Renders on every page, bottom-right, collapsible
- `/api/chat` endpoint: streaming Gemini response
- Context object built from DB aggregates:
  ```typescript
  interface ChatContext {
    totalProjects: number;
    byStatus: { completed: number; ongoing: number; notStarted: number };
    byRegion: Array<{ region: string; count: number; flaggedCount: number }>;
    anomalyCounts: {
      stalled: number;
      neverStarted: number;
      overdue: number;
      paymentPending: number;
      overpaid: number;
    };
    topFlaggedRegions: string[];
    lastSyncAt: string;
  }
  ```
- System prompt (verbatim):
  ```
  You are a civic transparency assistant for PhilTrace, a platform tracking Philippine government infrastructure projects. Answer questions using only the data context provided. Be concise and factual. If asked about a specific project, say you can only answer aggregate questions and suggest the user search for it directly. Context: [JSON.stringify(context)]
  ```
- Stream response using `TransformStream`

---

## 6. External Integrations

### 6.1 Google Gemini (`@google/genai`)
- **Model:** `gemini-3.5-flash`
- **Integration points:**
  1. "Explain Simply" — cached, single-shot
  2. Whistleblower severity classification — JSON-only response, strict parsing
  3. Chatbot — streaming, aggregate context
- **Severity classification prompt (verbatim):**
  ```
  You are a civic transparency AI. A citizen submitted the following report about a Philippine government infrastructure project.
  Return ONLY valid JSON in this exact format, nothing else:
  {"severity": "low|medium|high|critical", "rationale": "one sentence explaining your severity rating"}

  Report text: [comment text]
  Project status: [status]
  Current anomaly flags: [list of active flags]
  ```
- **JSON parse safety:** Strip markdown code fences (` ```json ` / ` ``` `) before `JSON.parse()` if present

### 6.2 Mapbox GL JS 3.x
- Client-side satellite tile rendering
- Access via `NEXT_PUBLIC_MAPBOX_TOKEN`
- Used in project detail Section C ("After" image)

### 6.3 Esri World Imagery Wayback
- Free, no API key
- "Before" image in satellite comparison
- Query Wayback API for capture date closest to project `startDate`
- Tile URL: `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{timestamp}/{z}/{y}/{x}`

### 6.4 Semaphore SMS
- **API:** POST `https://api.semaphore.co/api/v4/messages`
- **Payload:** `{ apikey, number, message: "Your PhilTrace verification code is: XXXXXX" }`
- **OTP flow:**
  1. User submits phone number → `/api/report/otp` generates 6-digit code, sends via Semaphore, stores code with 5-min TTL
  2. User submits report + OTP code → `/api/report` verifies code, classifies with Gemini, stores Comment
- **Rate limits:**
  - Max 3 reports per phone number per project
  - Max 10 reports per IP per day
- **Demo bypass:** If `DEMO_OTP_BYPASS=true` AND phone = `+639000000000` → skip SMS, auto-verify

### 6.5 PSA PSGC API
- One-time call via `/api/psgc/populate`
- Populates Region (17 rows) and Province (~82 rows) tables
- Token via `PSA_PSGC_TOKEN` env var

---

## 7. Security

| Concern | Implementation |
|---|---|
| Agency auth | bcryptjs password hashing, JWT in httpOnly cookie signed with `JWT_SECRET` |
| Cron/seed protection | `CRON_SECRET` header check |
| Report rate limiting | Per-phone (3/project) and per-IP (10/day) |
| External API isolation | All external calls through `/app/api/` routes |
| No client-side storage | No `localStorage`, no `sessionStorage` |
| Input validation | All POST routes validate and sanitize inputs |
| No social login | Only custom agency account system |

---

## 8. Environment Variables

```bash
DATABASE_URL           # Supabase Postgres connection string
GEMINI_API_KEY         # Google Gemini API key
NEXT_PUBLIC_MAPBOX_TOKEN # Mapbox GL JS token (public, client-safe)
PSA_PSGC_TOKEN         # PSA PSGC API token
SEMAPHORE_API_KEY      # Semaphore SMS API key
JWT_SECRET             # Secret for signing agency JWT cookies
CRON_SECRET            # Secret for protecting cron/seed routes
DEMO_OTP_BYPASS        # "true" to enable demo OTP bypass
```

---

## 9. Coding Standards

- `async/await` only — no `.then()` chains
- All API routes return `Response.json(data)` or `Response.json({ error: 'message' }, { status: 4xx })`
- All client data fetching uses TanStack Query hooks — no raw `useEffect` + `fetch`
- Currency formatting: `₱${(value / 1_000_000).toFixed(2)}M` for millions, `₱${(value / 1_000_000_000).toFixed(2)}B` for billions
- Date formatting: `Intl.DateTimeFormat('en-PH')` — Philippine locale
- Tailwind classes mobile-first: default = mobile, `sm:` = tablet, `lg:` = desktop
- Every `fetch()` to external APIs must have `try/catch` with fallback
- No hardcoded region names — always from DB
- Loading skeletons for: project list cards, project detail sections, chatbot responses
- Error boundaries for: map component, Cytoscape graph, satellite tile loader

---

## 10. What Not To Build

- No seed script that generates fake project data
- No Gemini calls for PDF extraction (DPWH API provides structured data)
- No `aiBriefing` JSON column (removed in Revision 4)
- No `localStorage` or `sessionStorage`
- No Docker, Redis, or second service
- No social login (Google, GitHub)
- No external API calls from client components

---

## 11. Implementation Chunks

The spec will be implemented in 4 chunks, each with its own implementation plan:

**Chunk 1 — Foundation + Data Layer (Phases 1-2)**
- Project scaffolding, Prisma setup, env config
- DPWH data sync layer (DPWH API + HuggingFace fallback)
- PSA PSGC region/province population
- Initial data seed from HuggingFace
- Anomaly flag computation
- Nightly cron sync
- All API routes for data access

**Chunk 2 — Maps + Browsing (Phases 3-4, 6)**
- Home choropleth map
- Region project list with filters
- Search page
- Header search bar
- Project cards component
- Near Me geolocation page

**Chunk 3 — Project Detail + Interactions (Phases 5, 7-9)**
- Project detail page (all 6 sections)
- Satellite before/after toggle
- Livestream embed
- Whistleblower report flow + OTP (Semaphore)
- Gemini "Explain Simply"
- Agency accounts + updates
- Agency login/auth (JWT)

**Chunk 4 — Chatbot + Polish (Phases 10-11)**
- Floating chatbot widget
- Gemini streaming chat
- Mobile layout verification (375px)
- Loading skeletons
- Error boundaries
- Demo mode OTP bypass
- README.md

---

## 12. Demo Validation Checklist

- [ ] DPWH data loaded in DB with real `contractId`, `latitude`, `longitude`
- [ ] No TypeScript errors (`tsc --noEmit` passes clean)
- [ ] Page loads under 2 seconds on simulated slow 3G (Lighthouse)
- [ ] All pages render correctly at 375px width
- [ ] Anomaly flags display on at least one real project
- [ ] Satellite toggle shows two distinct images
- [ ] Chatbot streams a response without timeout
- [ ] OTP bypass works with `+639000000000` in demo mode

---

## 13. Deviations from Original Spec

These are intentional design decisions made during brainstorming that differ from the original prompt:

1. **DB-first architecture instead of live API proxy**: All user-facing reads come from Postgres instead of proxying live DPWH API calls. This is faster, more reliable, and enables SQL queries (Haversine, aggregations, full-text search). The original spec called for cached `fetch()` calls with `revalidate` — we replaced this with a nightly sync into the DB.

2. **HuggingFace dataset as fallback data source**: Added `bettergovph/dpwh-transparency-data` on HuggingFace as a fallback when the DPWH API returns 403 (observed during testing). Same data shape, same 264K records.

3. **Two-tier anomaly flag system**: Reclassified `flagPaymentPending` as an informational flag (not counted in choropleth density) because nearly all completed projects in the real data show `amountPaid: 0` — this is a data reporting artifact, not a genuine anomaly.

4. **Added `syncSource` field to Project**: Tracks whether data came from "dpwh" or "huggingface" for debugging purposes.

5. **Gemini model changed to `gemini-3.5-flash`**: Per user request (original spec used `gemini-2.5-flash`).

6. **Semaphore SMS instead of generic OTP provider**: User confirmed Semaphore as the SMS provider.

7. **Supabase for Postgres**: User confirmed Supabase with connection pooling.
