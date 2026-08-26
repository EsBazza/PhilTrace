import os
import sys
import json
import time
from datetime import datetime
from curl_cffi import requests
import psycopg2

db_url = None
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not db_url:
    print("Error: DATABASE_URL not found in .env")
    sys.exit(1)

print("Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Get province mapping
cursor.execute('SELECT id, name, "regionId" FROM "Province"')
provinces = cursor.fetchall()
province_map = {p[1].lower(): p[0] for p in provinces}

cursor.execute('SELECT id, name FROM "Region"')
regions = cursor.fetchall()
region_map = {r[1].lower(): r[0] for r in regions}

def normalize_province(deo_name, region_name):
    clean = deo_name.replace(" 1st DEO", "").replace(" 2nd DEO", "").replace(" 3rd DEO", "").replace(" 4th DEO", "").replace(" City DEO", "").replace(" DEO", "").strip().lower()
    if clean in province_map:
        return province_map[clean]
    for name, pid in province_map.items():
        if clean in name or name in clean:
            return pid
    reg_clean = region_name.strip().lower()
    if reg_clean in region_map:
        reg_id = region_map[reg_clean]
        for p in provinces:
            if p[2] == reg_id:
                return p[0]
    return provinces[0][0] if provinces else None

url_base = "https://api.transparency.dpwh.gov.ph/projects"
headers = {
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://transparency.dpwh.gov.ph/",
    "Origin": "https://transparency.dpwh.gov.ph",
}

print("Fetching LIVE contracts directly from DPWH Transparency API...")
page = 1
limit = 100
max_pages = 10  # Sync 1,000 live DPWH contracts
total_inserted = 0

while page <= max_pages:
    print(f"Fetching page {page} ({limit} projects/page)...")
    res = requests.get(f"{url_base}?page={page}&limit={limit}", headers=headers, impersonate="chrome120", timeout=25)
    
    if res.status_code != 200:
        print(f"Error on page {page}: {res.status_code}")
        break
        
    payload = res.json()
    items = payload.get("data", {}).get("data", [])
    if not items:
        print("No more items.")
        break
        
    for item in items:
        cid = item.get("contractId")
        if not cid:
            continue
            
        name = item.get("description", "DPWH Infrastructure Project")
        loc = item.get("location", {})
        prov_name = loc.get("province", "")
        reg_name = loc.get("region", "")
        pid = normalize_province(prov_name, reg_name)
        
        lat = float(item.get("latitude") or 14.5995)
        lng = float(item.get("longitude") or 120.9842)
        budget = float(item.get("budget") or 0.0)
        paid = float(item.get("amountPaid") or 0.0)
        progress = float(item.get("progress") or 0.0)
        
        s_date_str = item.get("startDate")
        try:
            start_date = datetime.strptime(s_date_str[:10], "%Y-%m-%d") if s_date_str else datetime.now()
        except:
            start_date = datetime.now()
            
        c_date_str = item.get("completionDate")
        try:
            comp_date = datetime.strptime(c_date_str[:10], "%Y-%m-%d") if c_date_str else None
        except:
            comp_date = None
            
        status = item.get("status", "On-Going")
        category = item.get("category", "Roads")
        contractor = item.get("contractor", "Unassigned Contractor")
        source_funds = item.get("sourceOfFunds")
        prog_name = item.get("programName")
        infra_yr = str(item.get("infraYear") or "")
        is_live = bool(item.get("isLive", False))
        live_url = item.get("livestreamUrl")
        has_sat = bool(item.get("hasSatelliteImage", False))
        
        # Anomaly flags calculation
        now = datetime.now()
        flag_never_started = bool(start_date < now and progress == 0.0)
        flag_overdue = bool(comp_date is not None and comp_date < now and status != "Completed")
        flag_overpaid = bool(progress < 30.0 and paid > 0 and paid > 0.8 * budget)
        flag_payment_pending = bool(progress == 100.0 and paid == 0.0)
        flag_stalled = False
        
        cursor.execute("""
            INSERT INTO "Project" (
                id, name, "provinceId", "gpsLat", "gpsLng", "budgetPHP", "amountPaid",
                progress, "startDate", "completionDate", status, category, "contractorRaw",
                "sourceOfFunds", "programName", "infraYear", "isLive", "livestreamUrl",
                "hasSatelliteImage", "reportCount", "flagStalled", "flagNeverStarted",
                "flagOverdue", "flagPaymentPending", "flagOverpaid", "syncSource", "updatedAt"
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0,
                %s, %s, %s, %s, %s, 'dpwh_live', NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "gpsLat" = EXCLUDED."gpsLat",
                "gpsLng" = EXCLUDED."gpsLng",
                "budgetPHP" = EXCLUDED."budgetPHP",
                progress = EXCLUDED.progress,
                status = EXCLUDED.status,
                "flagNeverStarted" = EXCLUDED."flagNeverStarted",
                "flagOverdue" = EXCLUDED."flagOverdue",
                "flagOverpaid" = EXCLUDED."flagOverpaid",
                "flagPaymentPending" = EXCLUDED."flagPaymentPending",
                "updatedAt" = NOW();
        """, (
            cid, name, pid, lat, lng, budget, paid, progress, start_date, comp_date,
            status, category, contractor, source_funds, prog_name, infra_yr, is_live,
            live_url, has_sat, flag_stalled, flag_never_started, flag_overdue,
            flag_payment_pending, flag_overpaid
        ))
        total_inserted += 1
        
    conn.commit()
    print(f"[OK] Page {page} processed ({total_inserted} live projects saved in Supabase).")
    page += 1
    time.sleep(0.3)

print("Aggregating Contractor metrics...")
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

print("==========================================")
print("LIVE SYNC COMPLETE!")
print(f"Total Live Projects in Database: {p_count}")
print(f"Total Live Contractors in Database: {c_count}")
print("==========================================")

cursor.close()
conn.close()
