import os
import sys
import json
import time
from datetime import datetime
import pyarrow.parquet as pq
import psycopg2
from psycopg2.extras import execute_values

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

print("Reading parquet dataset into memory...")
table = pq.read_table("dpwh_transparency_data.parquet")
total_rows = table.num_rows
print(f"Loaded {total_rows:,} records from parquet.")

df = table.to_pandas()

print("Preparing batch data with anomaly calculations...")
now = datetime.now()

batch_size = 2500
records = []
total_inserted = 0

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

start_time = time.time()

for idx, row in df.iterrows():
    cid = str(row.get('contractId') or '').strip()
    if not cid:
        continue

    name = str(row.get('description') or 'DPWH Infrastructure Project')[:500]
    
    loc = row.get('location')
    prov_str = ""
    reg_str = ""
    if isinstance(loc, dict):
        prov_str = loc.get('province', '')
        reg_str = loc.get('region', '')
    elif isinstance(loc, str):
        try:
            loc_dict = json.loads(loc)
            prov_str = loc_dict.get('province', '')
            reg_str = loc_dict.get('region', '')
        except:
            prov_str = loc

    pid = normalize_province(prov_str, reg_str)
    
    try:
        lat = float(row.get('latitude') or 14.5995)
    except:
        lat = 14.5995
    try:
        lng = float(row.get('longitude') or 120.9842)
    except:
        lng = 120.9842
    try:
        budget = float(row.get('budget') or 0.0)
    except:
        budget = 0.0
    try:
        paid = float(row.get('amountPaid') or 0.0)
    except:
        paid = 0.0
    try:
        progress = float(row.get('progress') or 0.0)
    except:
        progress = 0.0

    s_date_raw = row.get('startDate')
    try:
        if s_date_raw and str(s_date_raw) != 'None' and str(s_date_raw) != 'nan':
            s_date = datetime.strptime(str(s_date_raw)[:10], "%Y-%m-%d")
        else:
            s_date = now
    except:
        s_date = now

    c_date_raw = row.get('completionDate')
    try:
        if c_date_raw and str(c_date_raw) != 'None' and str(c_date_raw) != 'nan':
            c_date = datetime.strptime(str(c_date_raw)[:10], "%Y-%m-%d")
        else:
            c_date = None
    except:
        c_date = None

    status = str(row.get('status') or 'On-Going')[:50]
    category = str(row.get('category') or 'Roads')[:50]
    contractor = str(row.get('contractor') or 'Unassigned Contractor')[:255]
    source_funds = str(row.get('sourceOfFunds') or '')[:100] if row.get('sourceOfFunds') else None
    prog_name = str(row.get('programName') or '')[:255] if row.get('programName') else None
    infra_yr = str(row.get('infraYear') or '')[:10] if row.get('infraYear') else None
    is_live = bool(row.get('isLive'))
    live_url = str(row.get('livestreamUrl'))[:500] if row.get('livestreamUrl') else None
    has_sat = bool(row.get('hasSatelliteImage'))

    # Anomaly flags
    flag_never_started = bool(s_date < now and progress == 0.0)
    flag_overdue = bool(c_date is not None and c_date < now and status != 'Completed')
    flag_overpaid = bool(progress < 30.0 and paid > 0 and paid > 0.8 * budget)
    flag_payment_pending = bool(progress == 100.0 and paid == 0.0)
    flag_stalled = False

    records.append((
        cid, name, pid, lat, lng, budget, paid, progress, s_date, c_date,
        status, category, contractor, source_funds, prog_name, infra_yr,
        is_live, live_url, has_sat, 0, flag_stalled, flag_never_started,
        flag_overdue, flag_payment_pending, flag_overpaid, 'dpwh_national_archive', now
    ))

    if len(records) >= batch_size:
        execute_values(cursor, insert_sql, records, page_size=batch_size)
        conn.commit()
        total_inserted += len(records)
        elapsed = time.time() - start_time
        rate = total_inserted / elapsed if elapsed > 0 else 0
        print(f"  -> Inserted {total_inserted:,} / {total_rows:,} projects ({rate:.0f} rows/sec)...")
        records = []

if records:
    execute_values(cursor, insert_sql, records, page_size=len(records))
    conn.commit()
    total_inserted += len(records)
    print(f"  -> Inserted final batch. Total projects inserted: {total_inserted:,}")

print("\nAggregating complete national Contractor metrics...")
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

print("=====================================================")
print("ALL PHILIPPINE DPWH PROJECTS INGESTED SUCCESSFULLY!")
print(f"Total Projects in Database: {p_count:,}")
print(f"Total Contractors in Database: {c_count:,}")
print(f"Total Execution Time: {(time.time() - start_time):.1f}s")
print("=====================================================")

cursor.close()
conn.close()
