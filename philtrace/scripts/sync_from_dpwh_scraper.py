import os
import sys
import json
import time
import math
import tarfile
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values

# 1. Determine Database Connection URL
db_url = None
direct_url = None
env_file = os.path.join(os.path.dirname(__file__), "..", ".env")

if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("DIRECT_URL="):
                direct_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("DATABASE_URL=") and not direct_url:
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

connect_url = direct_url or db_url
if not connect_url:
    print("Error: DATABASE_URL or DIRECT_URL not found in .env")
    sys.exit(1)

if "?pgbouncer" in connect_url:
    connect_url = connect_url.split("?")[0]

print("Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(connect_url)
cursor = conn.cursor()

# 2. Cache Provinces and Regions
cursor.execute('SELECT id, name, "regionId" FROM "Province"')
provinces = cursor.fetchall()
province_map = {p[1].lower().strip(): p[0] for p in provinces}

cursor.execute('SELECT id, name FROM "Region"')
regions = cursor.fetchall()
region_map = {r[1].lower().strip(): r[0] for r in regions}
default_province_id = provinces[0][0] if provinces else None

def normalize_province(deo_name, region_name):
    if not deo_name:
        return default_province_id
    clean = str(deo_name).replace(" 1st DEO", "").replace(" 2nd DEO", "").replace(" 3rd DEO", "").replace(" 4th DEO", "").replace(" City DEO", "").replace(" DEO", "").strip().lower()
    if clean in province_map:
        return province_map[clean]
    for name, pid in province_map.items():
        if clean in name or name in clean:
            return pid
    if region_name:
        reg_clean = str(region_name).strip().lower()
        if reg_clean in region_map:
            reg_id = region_map[reg_clean]
            for p in provinces:
                if p[2] == reg_id:
                    return p[0]
    return default_province_id

# 3. Locate DPWH Scraper Archive
scraper_tar = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dpwh-scraper", "tar-data", "base-data-json.tar.xz"))
if not os.path.exists(scraper_tar):
    scraper_tar = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dpwh-scraper", "base-data", "base-data-json.tar.xz"))

if not os.path.exists(scraper_tar):
    print(f"Scraper archive not found at: {scraper_tar}")
    sys.exit(1)

print(f"Opening DPWH Transparency API Scraper Archive: {scraper_tar}")

now = datetime.now()
batch_size = 2000
batch_dict = {}
total_synced = 0
start_time = time.time()

insert_sql = """
    INSERT INTO "Project" (
        id, name, "provinceId", "gpsLat", "gpsLng", "budgetPHP", "amountPaid",
        progress, "startDate", "completionDate", status, category, "contractorRaw",
        "sourceOfFunds", "programName", "infraYear", "isLive", "livestreamUrl",
        "hasSatelliteImage", "reportCount", "flagStalled", "flagNeverStarted",
        "flagOverdue", "flagPaymentPending", "flagOverpaid", "syncSource", "updatedAt"
    ) VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "provinceId" = EXCLUDED."provinceId",
        "gpsLat" = EXCLUDED."gpsLat",
        "gpsLng" = EXCLUDED."gpsLng",
        "budgetPHP" = EXCLUDED."budgetPHP",
        "amountPaid" = EXCLUDED."amountPaid",
        progress = EXCLUDED.progress,
        status = EXCLUDED.status,
        "flagNeverStarted" = EXCLUDED."flagNeverStarted",
        "flagOverdue" = EXCLUDED."flagOverdue",
        "flagOverpaid" = EXCLUDED."flagOverpaid",
        "flagPaymentPending" = EXCLUDED."flagPaymentPending",
        "updatedAt" = NOW();
"""

with tarfile.open(scraper_tar, "r:xz") as tar:
    # Process the most recent pages (e.g. pages 1 to 3: ~15,000 recent 2024-2025 contracts)
    pages_to_process = [f"json/dump-page-{p}-5000.json" for p in range(1, 4)]
    
    for page_name in pages_to_process:
        if page_name not in tar.getnames():
            continue
        
        print(f"\nProcessing {page_name} from DPWH Transparency Scraper...")
        f = tar.extractfile(page_name)
        data = json.load(f)
        items = data.get("data", {}).get("data", [])
        print(f"Loaded {len(items):,} contracts from {page_name}")
        
        for row in items:
            cid = str(row.get("contractId") or "").strip()
            if not cid:
                continue
            
            name = str(row.get("description") or "DPWH Infrastructure Project")[:500]
            loc = row.get("location") or {}
            prov_str = ""
            reg_str = ""
            if isinstance(loc, dict):
                prov_str = loc.get("province", "")
                reg_str = loc.get("region", "")
            
            pid = normalize_province(prov_str, reg_str)
            
            try:
                lat = float(row.get("latitude") or 14.5995)
                if math.isnan(lat): lat = 14.5995
            except:
                lat = 14.5995
                
            try:
                lng = float(row.get("longitude") or 120.9842)
                if math.isnan(lng): lng = 120.9842
            except:
                lng = 120.9842
                
            try:
                budget = float(row.get("budget") or 0.0)
                if math.isnan(budget): budget = 0.0
            except:
                budget = 0.0
                
            try:
                paid = float(row.get("amountPaid") or 0.0)
                if math.isnan(paid): paid = 0.0
            except:
                paid = 0.0
                
            try:
                progress = float(row.get("progress") or 0.0)
                if math.isnan(progress): progress = 0.0
            except:
                progress = 0.0
                
            s_date_raw = row.get("startDate")
            try:
                if s_date_raw and str(s_date_raw) not in ("None", "nan", "NaT"):
                    s_date = datetime.strptime(str(s_date_raw)[:10], "%Y-%m-%d")
                else:
                    s_date = now
            except:
                s_date = now
                
            c_date_raw = row.get("completionDate")
            try:
                if c_date_raw and str(c_date_raw) not in ("None", "nan", "NaT"):
                    c_date = datetime.strptime(str(c_date_raw)[:10], "%Y-%m-%d")
                else:
                    c_date = None
            except:
                c_date = None
                
            status = str(row.get("status") or "On-Going")[:50]
            category = str(row.get("category") or "Roads")[:50]
            contractor = str(row.get("contractor") or "Unassigned Contractor")[:255]
            if not contractor or contractor in ("None", "nan"):
                contractor = "Unassigned Contractor"
                
            source_funds = str(row.get("sourceOfFunds") or "")[:100] if row.get("sourceOfFunds") else None
            prog_name = str(row.get("programName") or "")[:255] if row.get("programName") else None
            infra_yr = str(row.get("infraYear") or "")[:10] if row.get("infraYear") else None
            is_live = bool(row.get("isLive"))
            live_url = str(row.get("livestreamUrl"))[:500] if row.get("livestreamUrl") else None
            has_sat = bool(row.get("hasSatelliteImage", True))
            
            flag_never_started = bool(s_date < now and progress == 0.0)
            flag_overdue = bool(c_date is not None and c_date < now and status != "Completed")
            flag_overpaid = bool(progress < 30.0 and paid > 0 and paid > 0.8 * budget)
            flag_payment_pending = bool(progress == 100.0 and paid == 0.0)
            flag_stalled = False
            
            batch_dict[cid] = (
                cid, name, pid, lat, lng, budget, paid, progress, s_date, c_date,
                status, category, contractor, source_funds, prog_name, infra_yr,
                is_live, live_url, has_sat, 0, flag_stalled, flag_never_started,
                flag_overdue, flag_payment_pending, flag_overpaid, "dpwh_transparency_api_scraper", now
            )
            
            if len(batch_dict) >= batch_size:
                batch_records = list(batch_dict.values())
                execute_values(cursor, insert_sql, batch_records, page_size=batch_size)
                conn.commit()
                total_synced += len(batch_records)
                print(f"  -> Synced {total_synced:,} contracts from scraper...")
                batch_dict = {}

if batch_dict:
    batch_records = list(batch_dict.values())
    execute_values(cursor, insert_sql, batch_records, page_size=len(batch_records))
    conn.commit()
    total_synced += len(batch_records)
    print(f"  -> Synced final batch. Total synced: {total_synced:,}")

# 4. Attach Default Contract Documents for newly synced projects
print("\nAttaching DPWH Transparency Portal document links...")
cursor.execute("""
    INSERT INTO "ContractDocument" (id, "projectId", "sourcePdfUrl", "extractionStatus", "parsedAt")
    SELECT 
        'cd_' || p.id,
        p.id,
        'https://transparency.dpwh.gov.ph/?search=' || p.id,
        'PARSED'::"ExtractionStatus",
        NOW()
    FROM "Project" p
    WHERE NOT EXISTS (
        SELECT 1 FROM "ContractDocument" cd WHERE cd."projectId" = p.id
    )
    ON CONFLICT ("projectId") DO NOTHING;
""")
conn.commit()
print("Contract document links attached.")

# 5. Aggregate Contractor metrics
print("\nAggregating Contractor metrics...")
cursor.execute("""
    INSERT INTO "Contractor" (id, name, "totalContracts", "totalValuePHP", "avgProgress", "overdueCount", "terminatedCount")
    SELECT 
        md5("contractorRaw"),
        "contractorRaw",
        COUNT(*),
        COALESCE(SUM("budgetPHP"), 0),
        COALESCE(AVG(progress), 0),
        COUNT(*) FILTER (WHERE "flagOverdue" = true),
        COUNT(*) FILTER (WHERE status = 'Terminated')
    FROM "Project"
    GROUP BY "contractorRaw"
    ON CONFLICT (name) DO UPDATE SET
        "totalContracts" = EXCLUDED."totalContracts",
        "totalValuePHP" = EXCLUDED."totalValuePHP",
        "avgProgress" = EXCLUDED."avgProgress",
        "overdueCount" = EXCLUDED."overdueCount",
        "terminatedCount" = EXCLUDED."terminatedCount";
""")
conn.commit()

cursor.execute('SELECT COUNT(*) FROM "Project"')
p_count = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM "Contractor"')
c_count = cursor.fetchone()[0]

print("\n=======================================================")
print("DPWH TRANSPARENCY API SCRAPER SYNC COMPLETED!")
print(f"Total Projects in Database: {p_count:,}")
print(f"Total Contractors in Database: {c_count:,}")
print(f"Execution Time: {(time.time() - start_time):.1f}s")
print("=======================================================")

cursor.close()
conn.close()
