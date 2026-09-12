# 🇵🇭 PhilTrace Application

AI-Powered National Public Infrastructure Transparency Platform ("The Google Maps for Philippine Public Works").

For the complete, comprehensive technical documentation, data models, forensic algorithms, full 26-endpoint API reference, and developer runbooks, see:
👉 **[PHILTRACE_DOCUMENTATION.md](../PHILTRACE_DOCUMENTATION.md)**

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your database and API credentials:
```bash
cp .env.example .env
```

Key variables required:
- `DATABASE_URL`: PostgreSQL connection string (Supabase transaction pooler).
- `DIRECT_URL`: PostgreSQL direct connection string.
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Mapbox GL public token.
- `GEMINI_API_KEY`: Google Gemini API Key.
- `DEMO_OTP_BYPASS`: Set `"true"` for local review testing.

### 3. Database Migration & Seed
```bash
# Push Prisma schema to Postgres
npx prisma db push

# Populate PSA regions, provinces, and DPWH infrastructure projects
npm run seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

