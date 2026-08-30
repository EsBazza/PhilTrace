# PhilTrace Architecture & Feature Expansion Design Spec

**Date:** 2026-08-30  
**Status:** Approved  
**Platform:** Next.js 16 (App Router), React 19, TypeScript 5, Mapbox GL JS 3, PostgreSQL 16, Prisma ORM 7, Google Gemini Flash  

---

## 1. Objectives & Overview

This specification outlines the comprehensive 7-phase overhaul of **PhilTrace** — an open-source civic transparency platform for Philippine public infrastructure.

The overhaul focuses on:
1. **Cleaning up legacy modules** (removing unused agency & live-streaming endpoints).
2. **Replacing point-density heatmaps with a Level-of-Detail (LOD) GeoJSON Polygon Choropleth** and viewport-bounded clustering with multi-level drill-down down to the Barangay level.
3. **Automated DPWH PDF Contract & Bill of Quantities (BOQ) parsing** via Gemini Flash with structured schema extraction.
4. **Multi-Year Satellite Timeline Selector** via the ESRI Wayback API replacing binary comparisons.
5. **Forensic Analytics Suite**: Dual-line Payment vs Progress timeline charts, BOQ unit-price benchmarking against national/regional averages, and District Engineer signature network graphs.
6. **Contractor Network Intelligence**: Monopolies, sudden JVs, bid clustering, and BetterGov Open Congress politician citations.
7. **Strict RAG AI Chatbot**: Structured natural-language-to-SQL intent extraction and grounded Gemini Flash context injection.

---

## 2. Phase-by-Phase Technical Specifications

### Phase 1 — Clean & Legacy Removal
1. **Prisma Model Updates**:
   - Remove `isLive` (Boolean) and `livestreamUrl` (String?) fields from `Project` model in `philtrace/prisma/schema.prisma`.
   - Remove `AgencyAccount` and `AgencyUpdate` models if present.
   - Run `npx prisma validate` and `npx prisma db push` / migrations.
2. **Component & Route Cleanup**:
   - Delete `philtrace/src/app/agency/` directory.
   - Delete `philtrace/src/app/api/agency/` and `philtrace/src/app/api/agency-update/` directories.
   - Remove `LiveStreamEmbed` component and references from `project-inspection-drawer.tsx` and project cards.
3. **Documentation Update**:
   - Update API references and documentation to reflect the clean state.

---

### Phase 2 — Map Overhaul & GeoJSON LOD Engine
1. **GeoJSON Boundary Storage & Chunking**:
   - Extract `geojson_region.zip`, `geojson_province.zip`, `geojson_city.zip`, `geojson_barangay.zip` into `philtrace/public/geo/` organized hierarchically by PSGC code.
2. **Level-of-Detail (LOD) Rendering**:
   - **Zoom 5–7**: Province-level filled GeoJSON choropleth polygons colored by project density (light yellow to dark red).
   - **Zoom 8–10**: Choropleth polygons fade; viewport-bounded clustered circle markers with count badges appear.
   - **Zoom 11–13**: Clusters decompose into individual pins colored by their worst anomaly flag. Close pins (<50m) auto-group into micro-clusters.
   - **Zoom 14+**: Full individual pins with project name labels on hover/view.
3. **Hierarchical Drill-Down Mode**:
   - `Philippines > Region > Province > Municipality > Barangay`.
   - Active boundary highlighted with outer area polygon masking.
   - Barangay level includes a sliding project list drawer for pinpoint ground auditing.
4. **New API Endpoints**:
   - `GET /api/map/choropleth`: Returns project count, total funds, and flagged project count per PSGC code.
   - `GET /api/map/clusters`: Accepts bounding box (`sw_lat`, `sw_lng`, `ne_lat`, `ne_lng`, `zoom`) and returns GeoJSON FeatureCollection of clusters/pins within viewport.

---

### Phase 3 — PDF Contract Parser & BOQ Extraction
1. **Database Schema Additions**:
   - `ContractDocument`: projectId, sourcePdfUrl, contractorLegalName, contractorAddress, authorizedOfficer, tinNumber, contractDurationDays, extractionStatus (`PENDING`, `PARSED`, `FAILED`), parsedAt.
   - `BillOfQuantity`: contractDocId, itemCode, description, quantity, unit, unitCostPhp, totalPhp.
   - `EngineerSignature`: contractDocId, engineerName, engineerTitle, district.
2. **Gemini Extraction Worker & Prompt**:
   - Streams PDF buffers from DPWH `sourcePdfUrl` to Gemini Flash (`gemini-2.5-flash`) with structured schema response.
   - Hybrid execution: Batch CLI worker (`scripts/parse_contracts.ts`) + on-demand fallback when a citizen views an unparsed contract.
3. **New API Endpoints**:
   - `GET /api/contracts/[id]/pdf`: Returns parsed contract metadata, engineer signatures, and parsing status.
   - `GET /api/contracts/[id]/boq`: Returns itemized BOQ lines with variance against national unit-price benchmarks.

---

### Phase 4 — Multi-Year Satellite Timeline Selector
1. **Wayback Capabilities Integration**:
   - For project coordinates (`gpsLat`, `gpsLng`), query ESRI Wayback capabilities to discover available snapshot item IDs.
   - Select closest snapshot to January 1 for each year between contract `startDate` and `max(completionDate, currentYear)`.
2. **UI Timeline Selector**:
   - Interactive horizontal year bar in the inspection drawer: `[ 2020 🟢 ] [ 2021 ] [ 2022 ] [ 2023 🔴 ] [ 2024 ] [ 2025 ]`.
   - Green dot indicates contract start year; red dot indicates contract target completion year.
   - Swapping years replaces the raster tile layer URL:
     `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{itemId}/{z}/{y}/{x}`
   - Shows verified capture date: *"Showing satellite imagery captured: March 14, 2022"*.

---

### Phase 5 — Forensic Analytics Suite
1. **Payment vs Progress Dual-Line Timeline (Recharts)**:
   - Visualizes % disbursement (`amountPaid / budgetPHP * 100`) vs % reported physical progress over time.
   - Shaded red gap when disbursement outpaces progress.
   - Banner annotation: *"⚠️ Disbursement significantly ahead of physical progress at this date."* when gap exceeds 30%.
2. **Unit-Price Benchmarking**:
   - Computes `AVG(unitCostPhp)` grouped by `itemCode` nationally and per region in `UnitPriceBenchmark` table.
   - Anomaly flags:
     - `flagUnitPriceAnomaly`: BOQ line item $>30\%$ above national average.
     - `flagMobilizationInflated`: Item B.9 (Mobilization) $>5\%$ of total contract value.
3. **District Engineer Signature Network (`/engineers`)**:
   - Cytoscape.js graph connecting DPWH District Engineers to awarded Contractors.
   - Amber flag: Engineer signed 5+ contracts with the same contractor.
   - Red flag: Engineer approved awards to contractors with active `flagStalled` or `flagOverpaid` records.
   - Endpoint: `GET /api/engineers/graph`.

---

### Phase 6 — Contractor Network Intelligence & Politician Connections
1. **Contractor Behavioral Red Flags**:
   - Geographic monopoly ($>60\%$ provincial contract share) $\rightarrow$ Red node.
   - Sudden JV ($>₱10\text{M}$ contract with a new partner) $\rightarrow$ Amber edge labeled `"NEW JV"`.
   - Bid clustering (shared timing and geography) $\rightarrow$ Highlighted community hulls.
2. **Politician-Contractor Connections**:
   - Integrate **BetterGov Open Congress API** (`https://open-congress-api.bettergov.ph/`) to populate `Politician` model.
   - Curated news search worker indexing articles co-mentioning contractor and politician across Rappler, PhilStar, Inquirer, and iSiksik.
   - Store in `ContractorConnection` with `confidence = REPORTED`.
   - UI rule: Always render with neutral citation: *"Mentioned in [Source] → [View Article]"*.
   - Endpoint: `GET /api/contractors/[id]/connections`.

---

### Phase 7 — AI Chat RAG Architecture
1. **Intent Extraction**:
   - Parses natural language query for administrative region, province, contractor name, anomaly flag, category, and date ranges.
2. **Database Query & Context Injection**:
   - Queries PostgreSQL for top 20 relevant projects matching criteria.
   - Serializes projects as clean JSON context injected into Gemini Flash.
3. **Guardrailed System Prompt**:
   - System prompt strictly restricts output to injected JSON context.
   - Output includes structured summaries and clickable project IDs.
   - Endpoint: `POST /api/chat`.

---

## 3. Constraints & Validation Rules
1. **Server-Side Proximity**: Review submission GPS distance check must be enforced server-side.
2. **Bounded Map Queries**: Spatial queries must always be viewport-bounded to protect performance.
3. **Citation Integrity**: Never display contractor-politician connections without a valid verified `sourceUrl`.
4. **Schema Validations**: Run `npx prisma validate` and test migrations before touching dependent features.
5. **Resilient AI Calling**: All Gemini Flash invocations must be wrapped in try/catch fallback handlers.
