# PhilTrace: Google Maps-Style Civic Transparency Platform Design

**Date**: 2026-08-26  
**Status**: Approved  
**Author**: Full-Stack Engineering Team  

---

## 1. Overview & Vision

PhilTrace transforms into a **Google Maps-style civic intelligence platform** for Philippine public infrastructure. Instead of browsing commercial venues or restaurants, Filipino citizens browse and inspect **248,220+ Department of Public Works and Highways (DPWH) infrastructure projects** across all 18 administrative regions, 86 provinces, 1,634 municipalities/cities, and 42,046 barangays.

Citizens can:
1. **Free Roam** across the entire Philippine archipelago with dynamic budget and density heatmaps that dissolve into interactive project pins.
2. **Guided Drill-Down** hierarchically from Region -> Province -> Municipality -> Barangay with bounding box camera animations and geographic boundary masking.
3. **Inspect Projects** via a slide-out Google Maps-style drawer containing 360° Google Street View, ESRI Wayback past vs. present satellite sliders, Gemini AI summaries, and contractor background checks.
4. **Rate & Review** projects using a multi-criteria 5-star rating system, photo uploads, and phone OTP verification.
5. **Explore Leaderboards** of top-rated vs. most-flagged public works contracts.

---

## 2. Information Architecture & Navigation

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [🇵🇭 PhilTrace]   [Home / About]   [🗺️ Full Map]   [📍 Near Me]   [🏢 Contractors]     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Route Structure
- `/` — **Home / Mission & About**: Explains PhilTrace, the 3-signal contrast story, national expenditure metrics, creator credits, and launch CTA to `/map`.
- `/map` — **Full-Screen Google Maps Engine**: Boundary-locked to the Philippines (`[4.5, 116.0]` to `[21.5, 127.0]`). Houses the dual map modes, search, layer switcher, and the slide-out project inspection drawer.
- `/nearby` — **Near Me Proximity Scanner**: GPS proximity finder (1km to 25km radius).
- `/contractors` — **Contractor JV Network & Leaderboard**: Cytoscape.js alliance graph and performance rankings across 11,162 contractors.
- `/search` — **National Search & Audit Registry**: Full-text search across projects, contractors, and municipalities.

---

## 3. Dual Map Engine Specifications (`/map`)

### 3.1 Mode 1: Free Roam Mode
- **Heatmap Layer ($Zoom < 8$)**:
  - Weight metric toggle: `Project Volume (Counts)` vs. `Public Expenditure (₱ Billions)`.
  - Color gradient: Cyan -> Lime -> Yellow -> Orange -> Red for high expenditure/anomaly hotspots.
- **Cluster Layer ($Zoom\ 8 - 12$)**:
  - Dynamic circle clusters with aggregate counts and dominant status colors.
- **Project Pins ($Zoom \ge 12$)**:
  - Color-coded: 🟢 Completed/On-Track, 🔴 Overdue/Overpaid, 🔵 Live Stream Cam.
  - Hover tooltip: Project name, contractor, budget, progress, and citizen rating.
  - Click: Slides out the Project Inspection Drawer.

### 3.2 Mode 2: Specific Guided Drill-Down Mode
- **Breadcrumb Navigation**:
  `[🇵🇭 Philippines] > [Region III] > [Pampanga] > [Candaba] > [Brgy. Bahay Pare]`
- **Hierarchy Stepping**:
  - **Region**: Highlights region boundary, dims other regions, fits camera bounds.
  - **Province**: Highlights provincial boundary and reveals municipal boundaries.
  - **Municipality / City**: Zooms into town borders.
  - **Barangay**: Filters map pins strictly to that barangay.
- **Hybrid Interaction**: Users can click breadcrumb dropdowns OR click directly on map polygons.

---

## 4. Slide-Out Project Inspection Drawer

Slides out from the left (width: 440px on desktop, bottom sheet on mobile) without unloading the map.

### 4.1 Drawer Components
1. **Header**: Title, Contract ID, Status Badge, Overall Star Rating (e.g. ⭐ 4.2 / 5.0).
2. **Visual Proof Tabs**:
   - **Tab 1: 🛰️ ESRI Wayback Past vs Present Satellite Slider**: Interactive split-screen slider comparing 2021 vs 2024/2026 imagery.
   - **Tab 2: 🚶 360° Google Street View**: Embedded Street View panorama at project GPS coordinates.
   - **Tab 3: 📸 Citizen Ground Photos**: Uploaded photos with EXIF timestamps.
3. **Gemini AI "Explain Simply"**: Plain Tagalog / English scope breakdown and citizen sentiment synthesis.
4. **Financial & Contractor Audit**: Budget vs. Amount Paid bar, contractor profile link, and anomaly red flags.
5. **Citizen Reviews & Whistleblower Thread**:
   - Multi-criteria breakdown (Physical Progress, Build Quality, Site Activity).
   - Verified reviews with OTP badges and corroboration buttons.
   - **"+ Rate & Review" Button**: Opens phone OTP verification modal.

---

## 5. Database Schema Additions (Prisma)

```prisma
model Review {
  id               String   @id @default(cuid())
  projectId        String
  project          Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  rating           Float    // 1.0 to 5.0
  progressRating   Float?   // Physical progress perception (0 - 100)
  qualityRating    Float?   // 1 - 5 stars
  workersActive    Boolean? // Active vs Abandoned
  comment          String
  photoUrl         String?
  phoneHash        String   // SHA-256 hashed phone number
  phoneVerified    Boolean  @default(false)
  corroborations   Int      @default(0)
  createdAt        DateTime @default(now())

  @@index([projectId])
  @@index([rating])
}
```

---

## 6. Implementation Roadmap

1. **Step 1: Database & API Updates**: Add `Review` model, compute project average ratings, create `/api/reviews` endpoints.
2. **Step 2: Full-Screen Map Component (`/map`)**: Mapbox engine with boundary lock, Free Roam Heatmaps, and Specific Mode drill-down breadcrumbs.
3. **Step 3: Slide-Out Inspection Drawer**: Responsive left drawer with ESRI Wayback slider, Google Street View, and Gemini AI summary.
4. **Step 4: Citizen Review & Rating Modal**: Multi-criteria 5-star scoring, photo upload, and Semaphore/Demo OTP verification.
5. **Step 5: Homepage (`/`) Redesign**: About PhilTrace, mission story, creator credits, and national metrics banner.
