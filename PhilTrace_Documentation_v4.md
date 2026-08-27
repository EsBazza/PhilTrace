PHILTRACE

Project Documentation — Revision 4

AI-Powered Transparency Platform for Philippine Public Infrastructure

Revised to incorporate live DPWH Transparency API integration,

PSA PSGC geographic classification, real contractor network analysis,

and removal of all seeded placeholder data.


| Detail | Value |
| --- | --- |
| Document Version | Revision 4 — August 2026 |
| Platform | Next.js 16 · TypeScript 5 · Vercel |
| AI Provider | Google Gemini API (gemini-2.5-flash) |
| Data Source | DPWH Transparency API (Live — No Key Required) |
| Geographic Data | PSA PSGC Classification API |
| Total Real Projects | 264,440 contracts · ₱6.5 trillion |
| Status | Hackathon MVP — Production-Ready Architecture |



# 0. Revision Summary

This document is Revision 4 of the PhilTrace project specification. It supersedes all prior revisions. The primary change in this revision is the replacement of all manually seeded placeholder data with a live integration against the DPWH Transparency API — a publicly accessible, no-auth-required JSON API that exposes 264,440 real Philippine infrastructure contracts worth ₱6.5 trillion. This single change transforms PhilTrace from a demo prototype into a real transparency tool backed by official government data.


|  | KEY UPGRADE The DPWH Transparency API (https://api.transparency.dpwh.gov.ph/projects) requires no API key, no authentication, and no scraping. It returns real-time structured JSON including GPS coordinates, progress percentages, contractor names, budget figures, and livestream URLs — covering every public works project in the Philippines. |
| --- | --- |



|  | ALIGNMENT WITH 2026 LAW The 2026 General Appropriations Bill mandates the Philippine Space Agency (PhilSA) to monitor flood control projects via satellite and publish findings on a public platform. PhilTrace already implements this vision. Mentioning this alignment during the pitch is strongly recommended. |
| --- | --- |



## 0.1 What Changed From Revision 3


| Area | Rev 3 (Old) | Rev 4 (New) |
| --- | --- | --- |
| Project data | Manually seeded fake data (10 projects) | Live DPWH API — 264,440 real contracts |
| Geographic data | Hardcoded region/province names | PSA PSGC API — official gov. codes |
| Contractor data | 6 fake contractors, 3 sharing addresses | Real contractors from 264K contracts |
| Shell-company detection | Seeded fake pattern | Real joint-venture & repeat-winner analysis |
| GPS coordinates | Made-up lat/lng | Real coordinates from DPWH API |
| AI briefing (aiBriefing) | Gemini extracts from PDF at seed time | Removed — API provides structured data |
| Satellite flag | Unknown per project | hasSatelliteImage field from DPWH API |
| Livestream | Not present | isLive + livestreamUrl from DPWH API |
| Data freshness | Static, only updated by reseeding | Always current via nightly Vercel Cron sync |



# 1. Executive Summary

PhilTrace is a citizen-facing transparency platform for Philippine public infrastructure spending. It gives every Filipino — on a mobile phone, on a slow connection, without creating an account — the ability to investigate any infrastructure project funded by their taxes: where it is, who built it, how much it cost, how complete it is, and what other citizens are saying about it.

The platform is built as a single Next.js 16 application deployable to Vercel in one step. It uses the live DPWH Transparency API as its primary data source, the PSA PSGC API for official geographic classifications, and Google Gemini for three specific AI tasks: answering natural-language questions about the dataset, scoring the credibility of citizen whistleblower reports, and summarizing project context in plain Filipino-friendly English.

This revision adds four capabilities that substantially raise the quality of the transparency story: a real contractor network graph built from actual joint-venture data, a budget-versus-paid gap detector that surfaces financial red flags, a "Near Me" feature that uses device GPS to show projects within 5 km of the user, and a live construction cam embed for projects that DPWH is actively streaming.


## 1.1 The Transparency Story in One Paragraph


|  | THE PITCH A citizen opens PhilTrace on their phone, taps "Near Me," and sees three infrastructure projects within walking distance. One is 97% complete on paper but shows no visible construction activity in satellite imagery. The DPWH agency update claims 80% done. The whistleblower thread — verified by phone OTP, corroborated by four independent reports — says the site has been abandoned for six months. PhilTrace surfaces that contradiction automatically, in under 30 seconds, without the citizen needing to file an FOI request or know a contractor's name. That is the product. |
| --- | --- |



# 2. Architecture and Scope

PhilTrace is a single deployable Next.js 16 application. There is no second service, no Docker container, no separate backend. The frontend, all API routes, and all business logic live in one repository and deploy as one Vercel project connected to one managed PostgreSQL database.


| Layer | Technology | Purpose |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) | Full-stack — frontend + API routes |
| Language | TypeScript 5.x (strict mode) | Type safety across all layers |
| Styling | Tailwind CSS + shadcn/ui | Mobile-first component system |
| PH Region Map | react-simple-maps + PH TopoJSON | Interactive choropleth home map |
| Satellite Map | Mapbox GL JS 3.x | GPS project map + current satellite tiles |
| Historical Imagery | Esri World Imagery Wayback | Before/after satellite comparison |
| Contractor Graph | Cytoscape.js 3.x + react-cytoscapejs | Network visualization |
| Data Fetching | TanStack Query 5.x | Client-side cache + background refetch |
| Database | PostgreSQL 16 (Neon/Supabase) | Persistent store for reports + agency updates |
| ORM | Prisma ORM 7 | Type-safe DB access with driver adapter |
| AI | Google Gemini API (gemini-2.5-flash) | Chatbot, severity scoring |
| Primary Data | DPWH Transparency API (no key) | 264,440 live infrastructure contracts |
| Geographic Data | PSA PSGC API (token provided) | Official PH regions, provinces, barangays |
| Report Verification | SMS/OTP (Semaphore or Twilio) | Phone verification on report submission |
| Hosting | Vercel + managed Postgres | Single deployable unit |



## 2.1 High-Level Request Flow

All users — citizens and government/contractor accounts — interact only with the Next.js frontend. The frontend calls the API routes layer, which is the only component that directly touches the database, calls Gemini, fetches from the DPWH API, and reads map tile providers. Neither the browser nor the user ever calls any external service directly.


|  | ARCHITECTURE PRINCIPLE The DPWH API is called server-side only, through Next.js API routes. This protects against rate limiting (all PhilTrace users share one server-side request pool), keeps API logic testable, and allows caching responses at the route layer. Client components never fetch from api.transparency.dpwh.gov.ph directly. |
| --- | --- |



## 2.2 File Structure

The following table lists every meaningful route and what it does. New routes added in this revision are marked.


| Path | Purpose |
| --- | --- |
| /app/page.tsx | Interactive PH region choropleth map — home page |
| /app/regions/[region]/page.tsx | Province/city list with project counts + anomaly filter |
| /app/projects/[id]/page.tsx | Project detail: satellite, agency updates, whistleblower thread |
| /app/contractors/page.tsx | Contractor network graph + leaderboard (NEW: real data) |
| /app/nearby/page.tsx | "Near Me" — GPS-based project locator (NEW) |
| /app/agency/page.tsx | Agency login + progress update form |
| /app/search/page.tsx | Full-text project search across all contracts (NEW) |
| /app/api/chat/route.ts | Gemini chatbot — streaming responses |
| /app/api/report/route.ts | OTP check + Gemini severity scoring + insert |
| /app/api/agency-update/route.ts | Agency auth check + progress update insert |
| /app/api/projects/route.ts | Proxy to DPWH API — adds caching + filtering (NEW) |
| /app/api/projects/[id]/route.ts | Single contract detail from DPWH API (NEW) |
| /app/api/contractors/graph/route.ts | Cytoscape node/edge payload — real JV network (UPDATED) |
| /app/api/nearby/route.ts | Haversine distance query — GPS-based project lookup (NEW) |
| /app/api/cron/sync/route.ts | Nightly Vercel Cron — upserts DPWH data to Postgres (NEW) |
| /app/api/psgc/route.ts | PSA PSGC region/province lookup with caching (NEW) |



# 3. Data Sources


## 3.1 DPWH Transparency API (Primary — No Auth Required)

The DPWH Transparency API is the foundation of this revision. It is a public REST API maintained by the Philippine Department of Public Works and Highways, accessible without authentication, rate-limited to approximately 300 requests per 10 minutes.


| Endpoint | Description |
| --- | --- |
| GET /projects | Paginated list of all contracts (264,440 total) |
| GET /projects?region=Region III | Filter by region name |
| GET /projects?status=On-Going | Filter by status |
| GET /projects?page=2&limit=50 | Pagination control |
| GET /projects/{contractId} | Full detail for a single contract |


Every project record in the API response includes the following fields, which map directly to PhilTrace UI elements:


| API Field | Type | PhilTrace Usage |
| --- | --- | --- |
| contractId | string | Primary key — project URL /projects/{contractId} |
| description | string | Project name on cards and detail page |
| category | string | Filter chips: Roads, Bridges, Flood Control, etc. |
| status | string | Anomaly flag source + status badge |
| budget | float | Budget display + budget-vs-paid gap calculation |
| amountPaid | int | Financial red flag detection |
| progress | float (0–100) | Progress bar + stalled/overdue anomaly flag |
| location.province | string | Province drill-down navigation |
| location.region | string | Region map coloring |
| contractor | string | Contractor card + network graph |
| startDate | date | Timeline display + never-started flag |
| completionDate | date | Overdue flag calculation |
| latitude / longitude | float | GPS map pin + Near Me radius query |
| hasSatelliteImage | bool | Show/hide satellite comparison slider |
| isLive / livestreamUrl | bool / string | Embed live construction cam on detail page |
| reportCount | int | Displayed as community engagement metric |
| infraYear | string | Year filter on project list |
| sourceOfFunds | string | Funding source badge (GAA, ODA, etc.) |



## 3.2 PSA PSGC Classification API (Geographic)

The Philippine Standard Geographic Code (PSGC) API, maintained by the Philippine Statistics Authority, provides the official hierarchical list of all administrative units in the Philippines — regions, provinces, cities, municipalities, and barangays — with standardized codes used across all government systems.

PhilTrace uses the PSGC API to replace hardcoded region and province names in the database with official government-recognized names and codes. This ensures geographic consistency between PhilTrace data and official DPWH records, enables accurate drill-down navigation, and future-proofs the geographic layer against boundary changes.


| PSGC Endpoint | Usage in PhilTrace |
| --- | --- |
| GET /psgc/{version}/regions | Populate Region table on deploy |
| GET /psgc/{version}/provinces?reg={code} | Populate Province table per region |
| GET /psgc/{version}/cities?prv={code} | City-level drill-down (phase 2: barangay) |
| GET /psgc/{version}/barangays?mun={code} | Future: barangay-level project lookup |



## 3.3 Data Sync Strategy

Rather than querying the DPWH API on every page load — which would be slow and wasteful — PhilTrace uses a two-layer data strategy:

- Layer 1 — Nightly Vercel Cron sync: A scheduled function runs at 2 AM PHT daily, fetches pages of DPWH data filtered to recently updated contracts, and upserts them into the local PostgreSQL database. This means the database is always at most 24 hours stale.
- Layer 2 — On-demand DPWH proxy: For individual project detail pages, the Next.js API route fetches from DPWH directly and caches the response for 1 hour using Next.js fetch caching. This ensures project details are never more than 1 hour out of date.
- Layer 3 — Citizen data is always real-time: Comments, agency updates, and whistleblower reports are written and read directly from PostgreSQL with no caching, since they are user-generated and time-sensitive.

# 4. Feature Specification


## 4.1 Interactive Region Map (Retained + Enhanced)

The home page remains an interactive choropleth map of the Philippines built with react-simple-maps. Each region is shaded by anomaly density — the more stalled, overdue, or never-started projects, the darker the region appears. This transforms the home page from a browsing tool into an investigation starting point.

- Hover: region name, total project count, anomaly count
- Click: zoom to region view with province/city sidebar
- Filter chips: All · Stalled · Never Started · Overdue · Ongoing · Completed
- Category filter: All · Roads · Bridges · Flood Control · Buildings · Water
- Summary bar: "Region III — ₱48.2B allocated · 1,204 projects · 89 overdue"

## 4.2 Project Detail Page (Retained + Enhanced)

The project detail page is the core investigation surface. It combines official DPWH data with satellite imagery, citizen reports, and agency claims — all visible side-by-side without any signup.


### 4.2.1 Project Header

- Contract ID, full description, category badge, funding source
- Status badge (color-coded: green = Completed, amber = On-Going, red = Stalled/Overdue)
- Budget vs. Amount Paid gap bar — visually shows financial discrepancy
- Progress ring with completion percentage

### 4.2.2 Live Construction Cam (NEW)


|  | NEW FEATURE If isLive is true and livestreamUrl is populated in the DPWH API response, the project detail page embeds the live construction cam directly. No other civic tech platform in the Philippines shows this. For demo purposes, at least one seeded project should have isLive: true. |
| --- | --- |



### 4.2.3 Satellite Before/After Comparison (Retained)

- Esri World Imagery Wayback tile for the closest capture to the project start date = "Before"
- Mapbox current satellite tileset = "After"
- Two-position toggle (not a continuous scrubber — Esri Wayback tiles are discrete)
- Label: "Imagery: Esri Wayback [date captured] vs. Mapbox Current"
- hasSatelliteImage field from DPWH API controls whether this section is shown

### 4.2.4 Agency Progress Updates (Retained)

- Official updates posted by verified Agency accounts
- Visually distinct card style from citizen reports (different background, government icon)
- Fields: status, percent complete, note, optional photo, timestamp
- The gap between agency claims and citizen reports is the core transparency story

### 4.2.5 Whistleblower Thread (Retained + Enhanced)

- Phone OTP verification required to submit (PH mobile numbers only)
- At least one photo attachment required per report
- Gemini severity badge: low / medium / high / critical with one-line rationale
- Corroboration count: independent reports on same project raise trust weight
- Rate limiting by device/IP to prevent flooding

## 4.3 Near Me (NEW)


|  | NEW FEATURE "Near Me" is the highest-impact mobile feature in this revision. A citizen can open PhilTrace on their phone, tap "Near Me," grant location permission, and instantly see all infrastructure projects within 5 km of their current position — with their status, budget, contractor, and anomaly flags. This makes the data tangible: they can look out their window at a construction site and pull up its contract in seconds. |
| --- | --- |


Implementation: the browser Geolocation API returns lat/lng, which is sent to /api/nearby. The API route runs a Haversine distance query against the projects table and returns all contracts within the specified radius, sorted by distance. No external service is required — the GPS coordinates come from the DPWH API and are already stored in Postgres.

- Default radius: 5 km (adjustable via slider: 1 km / 5 km / 10 km / 25 km)
- Results sorted by distance, closest first
- Each result card shows: project name, distance, status badge, anomaly flag if any
- Tapping a result navigates to the full project detail page
- Fallback if location denied: show a search bar to enter a barangay or city name

## 4.4 Full-Text Project Search (NEW)

A persistent search bar in the site header allows users to search across all 264,440 contracts by project description, contractor name, or contract ID. This is particularly important for judges and power users who do not want to navigate the map funnel every time.

- Searches description, contractor, contractId fields
- Results group by region for context
- Debounced input — searches on keystroke pause, not on submit
- Filters (region, status, category) apply on top of search results

## 4.5 Contractor Network Graph (Retained — Completely Rebuilt)

The contractor graph now uses real data from 264,440 DPWH contracts instead of seeded fake contractors. The analysis is fundamentally different and significantly more credible.


### 4.5.1 Real Shell-Company Detection

With real data, the graph can surface patterns that actually matter:

- Joint ventures: DPWH contractor strings sometimes contain multiple companies separated by "&" or "/" — these are parsed into edges on the graph
- Repeat winners: contractors that win an unusually high number of contracts in a single region within a single year — a procurement red flag
- Dominance analysis: one contractor holding more than X% of total contract value in a region
- Sudden appearance: contractors with no prior contracts suddenly winning large projects

### 4.5.2 Contractor Leaderboard (NEW)


|  | NEW FEATURE A sortable table below the graph ranks contractors by: most contracts won, total contract value, average completion rate, number of overdue projects, and number of terminated contracts. This "Contractor Scorecard" is newsworthy, shareable, and requires zero additional API calls — it is computed from data already in Postgres. |
| --- | --- |



## 4.6 Budget vs. Amount Paid Gap Detector (NEW)

The DPWH API returns both budget (the allocated contract amount) and amountPaid (what has actually been disbursed). The gap between these two figures is a meaningful financial signal that PhilTrace now surfaces automatically.

- Projects with progress = 100% but amountPaid = 0 are flagged as "Payment Pending" — potentially completed projects where funds have not been released
- Projects with progress < 30% but amountPaid > 80% of budget are flagged as "Overpaid" — funds disbursed disproportionate to reported work
- These flags appear as additional anomaly chips alongside Stalled / Overdue / Never Started

## 4.7 Anomaly Detection (Retained + Enhanced)

Rule-based anomaly flags are computed from DPWH API fields and stored in the local database. No AI call is required — these are pure SQL/business logic rules.


| Flag | Condition | Data Source |
| --- | --- | --- |
| Stalled | status = On-Going AND no agency update in 6+ months AND progress unchanged | DPWH API + AgencyUpdate table |
| Never Started | startDate has passed AND progress = 0 AND no reports exist | DPWH API |
| Overdue | completionDate has passed AND status ≠ Completed | DPWH API |
| Payment Pending | progress = 100 AND amountPaid = 0 | DPWH API |
| Overpaid | progress < 30 AND amountPaid > 80% of budget | DPWH API |
| Abandoned | status changed from On-Going to Terminated without Completion | DPWH API (status history) |



## 4.8 Gemini AI Components (Retained — Scope Reduced)

With real structured data coming from the DPWH API, the role of Gemini is narrower and more focused than in previous revisions. Gemini no longer extracts project data from PDFs. It now does three specific tasks:


### 4.8.1 Floating Chatbot (/api/chat)

- Answers natural-language questions across the dataset: "Which region has the most overdue flood control projects?" or "Show me contractors with more than 50 stalled projects"
- Context injected into each prompt: project counts, anomaly counts, top contractors, regional summaries pulled from Postgres
- Streams via Gemini SDK so the response feels responsive

### 4.8.2 Whistleblower Severity Scoring (/api/report)

- On submission, comment text is sent to Gemini with a strict-JSON prompt
- Returns: severity (low / medium / high / critical) + one-sentence rationale
- Both stored on the Comment row and rendered as a colored badge with rationale visible
- The rationale is always shown so a human reader can catch Gemini misjudgments

### 4.8.3 Project Plain-Language Summary (NEW, Lightweight)

- On the project detail page, a "Explain this project simply" button triggers a single Gemini call
- Prompt: the DPWH project description + budget + status + anomaly flags → plain Filipino-friendly English summary
- Result is cached in Postgres so subsequent page loads do not re-call Gemini
- This replaces the removed seed-time aiBriefing extraction

## 4.9 Government / Contractor Agency Accounts (Retained)

Agency accounts remain as a core feature. An Agency user can post a Progress Update on any project assigned to their account: status, percent complete, a short note, and an optional photo. These updates appear on the public project page in a visually distinct card, clearly separate from citizen reports.

- Agency accounts are provisioned manually for the hackathon (seeded accounts per demo agency)
- The contrast between agency claims and citizen observations is the strongest transparency demo moment
- Self-service agency onboarding remains a Phase 2 item

# 5. Features Removed in This Revision

The following features from Revision 3 have been removed because the DPWH Transparency API makes them unnecessary, redundant, or misleading.


| Removed Feature | Reason for Removal | What Replaces It |
| --- | --- | --- |
| prisma/seed.ts PDF extraction | DPWH API provides structured data — no PDFs needed | Nightly cron sync from DPWH API |
| aiBriefing JSON column | DPWH API already provides all briefing fields | Direct rendering of DPWH API fields |
| sourcePdfUrl field | No PDFs in the new architecture | contractId links to DPWH portal |
| Seed-time Gemini PDF call | Expensive, brittle, unnecessary | On-demand Gemini summary (cached) |
| Fake contractor seed data | Real contractors available from 264K contracts | Real DPWH contractor network analysis |
| Fake project GPS coordinates | Real lat/lng from DPWH API on every project | DPWH API latitude/longitude fields |
| Manual province/region seeding | PSA PSGC API provides official names + codes | PSGC API integration at deploy time |
| 10-project demo seed script | Replaced by real data — credibility risk eliminated | Live DPWH API + nightly sync |



|  | IMPORTANT NOTE Removing the seed script does NOT remove the PostgreSQL database. The database still stores: citizen Comment records, AgencyUpdate records, computed anomaly flags, cached Gemini summaries, and Agency account credentials. It is lighter but still essential. |
| --- | --- |



# 6. Database Schema (Prisma 7)

The schema has been significantly simplified from Revision 3. The Project table is now a lightweight local mirror of DPWH API data used primarily for anomaly flag storage, relation management, and caching. It is no longer the source of truth for project content.


## 6.1 Schema Overview


| Model | Purpose | Primary Data Source |
| --- | --- | --- |
| Project | DPWH contract mirror + anomaly flags | DPWH Transparency API (synced nightly) |
| Region | Official PH regions | PSA PSGC API (populated at deploy) |
| Province | Official PH provinces | PSA PSGC API (populated at deploy) |
| Contractor | Parsed from DPWH contract strings | Derived from Project records |
| Comment | Citizen whistleblower reports | User-submitted via PhilTrace |
| AgencyUpdate | Official agency progress updates | Agency accounts via PhilTrace |
| AgencyAccount | Authenticated agency/contractor logins | Manually provisioned |



## 6.2 Prisma Schema

model Project {
  id               String        @id  // DPWH contractId
  name             String            // description from API
  provinceId       String
  province         Province      @relation(fields: [provinceId], references: [id])
  gpsLat           Float
  gpsLng           Float
  budgetPHP        Float
  amountPaid       Float         @default(0)
  progress         Float         @default(0)
  startDate        DateTime
  completionDate   DateTime?
  status           String        // "On-Going"|"Completed"|"Terminated"
  category         String        // "Roads"|"Bridges"|"Flood Control"|...
  contractorRaw    String        // raw contractor string from DPWH
  sourceOfFunds    String?
  programName      String?
  infraYear        String?
  isLive           Boolean       @default(false)
  livestreamUrl    String?
  hasSatelliteImage Boolean      @default(false)
  reportCount      Int           @default(0)
  // Anomaly flags — computed by cron, stored for fast queries
  flagStalled      Boolean       @default(false)
  flagNeverStarted Boolean       @default(false)
  flagOverdue      Boolean       @default(false)
  flagPaymentPending Boolean     @default(false)
  flagOverpaid     Boolean       @default(false)
  lastActivityAt   DateTime?
  aiSummary        String?       // cached Gemini plain-language summary
  comments         Comment[]
  agencyUpdates    AgencyUpdate[]
  updatedAt        DateTime      @updatedAt
}


# 7. API Integrations


| API | Auth | Rate Limit | Usage in PhilTrace |
| --- | --- | --- | --- |
| DPWH Transparency API | None required | ~300 req/10 min | Primary project data source |
| PSA PSGC API | Token (provided) | Not published | Region/province geographic data |
| Google Gemini API | API key (AI Studio) | Pay-as-you-go | Chatbot, severity scoring, summaries |
| Mapbox GL JS | Access token | 50k loads/month free | GPS project map + current satellite |
| Esri World Imagery Wayback | None required | None published | Historical satellite "before" tiles |
| SMS/OTP (Semaphore/Twilio) | API key | Pay-as-you-go | Phone verification on report submit |
| Browser Geolocation API | User permission | N/A (browser) | "Near Me" feature — device GPS |



## 7.1 DPWH API Usage Example

// Next.js API route — server-side proxy with caching
// /app/api/projects/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region") ?? ""
  const status = searchParams.get("status") ?? ""
  const page   = searchParams.get("page") ?? "1"

  const url = new URL("https://api.transparency.dpwh.gov.ph/projects")
  if (region) url.searchParams.set("region", region)
  if (status) url.searchParams.set("status", status)
  url.searchParams.set("page", page)

  // Cache for 30 minutes at the edge
  const res = await fetch(url.toString(), {
    next: { revalidate: 1800 }
  })
  const data = await res.json()
  return Response.json(data)
}


# 8. User Journeys


## 8.1 Citizen Journey


| Step | Screen | What Citizen Sees |
| --- | --- | --- |
| 1 | Home Map | Interactive PH map shaded by anomaly density. Hover for region stats. |
| 2 | Region View | Province list + project counts. Filter chips: Stalled / Overdue / Category. |
| 3 | Project List | Cards with name, contractor, budget, status badge, anomaly flags. |
| 4 | Project Detail | Satellite slider, live cam (if active), agency update, whistleblower thread. |
| 5 | Report | Phone OTP → photo upload → comment → AI severity badge assigned instantly. |
| Alt | Near Me | Tap location → see projects within 5 km sorted by distance. |
| Alt | Search | Type contractor name / project name → filtered results across all 264K contracts. |
| Any | Chatbot | Ask anything in plain language about the dataset. |



## 8.2 Government / Agency Journey


| Step | Screen | What Agency User Does |
| --- | --- | --- |
| 1 | Agency Login | Log in with provisioned credentials (email + password, no public signup). |
| 2 | Project List | See only projects assigned to their agency/contractor account. |
| 3 | Post Update | Submit status, % complete, note, optional photo. |
| 4 | Public Effect | Update appears on public project page as "Agency Update" card, timestamped. |



# 9. UX and Friction Principles

PhilTrace is built for a Filipino citizen on a mid-range Android phone using mobile data. Every UX decision should be evaluated against this persona — not the hackathon judge on a MacBook.


| Principle | Implementation |
| --- | --- |
| No signup to browse | Only OTP is required — only for report submission. Map, briefings, reports: all open. |
| Mobile-first | Tailwind responsive classes. Map, satellite slider, and report form tested at 375px width. |
| Fast project detail loads | DPWH data cached. Satellite tiles lazy-loaded. No loading spinner on core content. |
| Visual trust separation | Agency updates: blue government card. Citizen reports: white card with severity badge. Never combined. |
| Honest AI | Gemini severity rationale always visible. No AI label without explanation. |
| Accessible language | Project descriptions from DPWH are often bureaucratic. "Explain simply" button provides plain-language summary. |
| Search shortcut | Header search bar bypasses the map funnel — essential for judges during the demo. |
| Graceful fallback | Near Me falls back to manual barangay search if location permission is denied. |



# 10. Known Limitations and Mitigations


| Limitation | Impact | Mitigation |
| --- | --- | --- |
| DPWH API rate limit (300 req/10 min) | Could slow nightly sync for 264K records | Sync only changed/new records. Use pagination with delay between batches. |
| amountPaid = 0 on most records | Budget-vs-paid gap feature has limited data | Surface as "Payment data unavailable" where 0. Flag when progress=100 and paid=0. |
| Esri Wayback tiles are discrete | Before/after dates may not align exactly with project start | Label clearly: "Closest available capture to [start date]" |
| Phone OTP delivery reliability | Semaphore/Twilio may fail under load or with some PH networks | Pre-test with Globe and Smart SIMs. Add demo bypass for a hardcoded test number. |
| Contractor strings are not normalized | Joint venture parsing may miss some patterns | Use fuzzy matching + manual review of top contractors before demo. |
| Agency accounts provisioned manually | No self-service onboarding | Acceptable for MVP. Phase 2: agency self-registration with email verification. |
| Gemini severity misjudgment on sarcasm | Occasional mis-tagged reports | Always show rationale. Human override is the mitigation. |
| No barangay-level drill-down in MVP | Navigation stops at province/city level | PSGC API has barangay data. Phase 2: add barangay as a navigation level. |



# 11. Demo Script

Five minutes total. Every beat is achievable with the live DPWH API and real data. The script is designed so that each beat independently demonstrates a different dimension of the transparency story.


| Beat | Time | Script | Tech Shown |
| --- | --- | --- | --- |
| 1 — Home | 20s | "This is PhilTrace. Every region of the Philippines, shaded by how many projects are stalled or overdue. Not demo data — 264,440 real DPWH contracts, updated nightly." | Choropleth map + real stats |
| 2 — Near Me | 30s | "On mobile, a citizen taps Near Me. [tap] Three projects within 2 km. Let's open the closest one." | GPS + Haversine query |
| 3 — Project Detail | 80s | "The agency update says 85% complete. The whistleblower thread — verified by phone OTP, corroborated by four independent reports — says the site has been empty for seven months. The satellite comparison confirms: no visible change. Judge for yourself." | All three signals side by side |
| 4 — Live Cam | 20s | "One more thing — this project is being live-streamed right now by DPWH. That's their camera. We just embedded it." | isLive embed |
| 5 — Contractor Graph | 40s | "These four contractors keep appearing together in Region III flood control projects. Same projects, same years. The graph catches it automatically from real contract data." | Real JV network graph |
| 6 — Chatbot | 20s | "And you can ask it anything. [type] Which contractors have the most overdue projects in Region III? Powered by Gemini, grounded in 264,000 real contracts." | Gemini chatbot |



|  | DEMO DAY CHECKLIST Before the demo: (1) Confirm DPWH API is reachable. (2) Pre-load Region III projects. (3) Verify one project has isLive=true and livestreamUrl works. (4) Test OTP with a real PH number. (5) Confirm the contractor graph renders with real JV data. (6) Have the chatbot answer one question in rehearsal. |
| --- | --- |



# 12. Phase 2 Roadmap

The following features are explicitly out of scope for the hackathon MVP but represent the natural next steps if PhilTrace is developed into a production product.


| Feature | Description | Prerequisite |
| --- | --- | --- |
| Barangay-level drill-down | Use PSGC barangay data to navigate to project level within a barangay | PSGC API already in place |
| PhilGEPS integration | Link projects to procurement records — bidding history, losing bidders, red flags | PhilGEPS API access request |
| PhilSA satellite partnership | Official satellite imagery from Philippine Space Agency for flood control projects | Formal MOU with PhilSA |
| Self-service agency onboarding | Agencies register with email verification, not manual provisioning | Email verification service |
| FOI request helper | Pre-filled FOI.gov.ph request template for any project, one tap | FOI.gov.ph form mapping |
| Push notifications | Alert citizens when a project near them is flagged as stalled or overdue | PWA + push service |
| Contractor financial history | Link to SEC/DTI records for corporate structure verification | SEC API or web scraping |
| Multilingual support | Filipino/Tagalog interface for non-English-dominant regions | i18n + translation |
| Offline mode | Cache project data for areas with unreliable mobile data | Service worker + IndexedDB |


PhilTrace v4 — Real data. Real contractors. Real transparency.

Document prepared August 2026 · For hackathon mentor review
