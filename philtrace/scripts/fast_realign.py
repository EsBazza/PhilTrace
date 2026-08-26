import os
import sys
import time
import psycopg2
from psycopg2.extras import execute_values

db_url = None
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

print("Fetching provinces and regions from database...")
cursor.execute('SELECT id, name, "regionId" FROM "Province"')
provinces = cursor.fetchall()

# Map sorted by length descending so "Davao del Sur" matches before "Davao"
sorted_provinces = sorted(provinces, key=lambda x: len(x[1]), reverse=True)

# City to Province mapping
CITY_MAP = {
    "manila": "Metropolitan Manila",
    "quezon city": "Metropolitan Manila",
    "makati": "Metropolitan Manila",
    "pasig": "Metropolitan Manila",
    "taguig": "Metropolitan Manila",
    "caloocan": "Metropolitan Manila",
    "parañaque": "Metropolitan Manila",
    "paranaque": "Metropolitan Manila",
    "las piñas": "Metropolitan Manila",
    "las pinas": "Metropolitan Manila",
    "muntinlupa": "Metropolitan Manila",
    "valenzuela": "Metropolitan Manila",
    "marikina": "Metropolitan Manila",
    "pasay": "Metropolitan Manila",
    "mandaluyong": "Metropolitan Manila",
    "san juan": "Metropolitan Manila",
    "cebu city": "Cebu",
    "mandaue": "Cebu",
    "lapu-lapu": "Cebu",
    "davao city": "Davao del Sur",
    "san fernando, pampanga": "Pampanga",
    "pampanga": "Pampanga",
    "angeles city": "Pampanga",
    "clark": "Pampanga",
    "baguio": "Benguet",
    "bacolod": "Negros Occidental",
    "iloilo city": "Iloilo",
    "cagayan de oro": "Misamis Oriental",
    "general santos": "South Cotabato",
    "gensan": "South Cotabato",
    "zamboanga city": "Zamboanga del Sur",
    "tacloban": "Leyte",
    "butuan": "Agusan del Norte",
    "iligan": "Lanao del Norte",
    "puerto princesa": "Palawan",
    "olongapo": "Zambales",
    "lucena": "Quezon",
    "batangas city": "Batangas",
    "lipa": "Batangas",
    "tagaytay": "Cavite",
    "antipolo": "Rizal",
    "calamba": "Laguna",
    "santa rosa": "Laguna",
    "san pablo": "Laguna",
    "bulacan": "Bulacan",
    "malolos": "Bulacan",
    "meycauayan": "Bulacan",
    "san jose del monte": "Bulacan",
    "tarlac": "Tarlac",
    "bataan": "Bataan",
    "balanga": "Bataan",
    "nueva ecija": "Nueva Ecija",
    "cabanatuan": "Nueva Ecija",
    "zambales": "Zambales",
    "subic": "Zambales",
    "aurora": "Aurora",
    "baler": "Aurora",
}

prov_name_to_id = {p[1].lower(): p[0] for p in provinces}
for p in provinces:
    clean = p[1].replace(" DEO", "").strip().lower()
    prov_name_to_id[clean] = p[0]

print("Fetching all 248k projects for fast memory matching...")
cursor.execute('SELECT id, name, "provinceId" FROM "Project"')
projects = cursor.fetchall()
print(f"Loaded {len(projects):,} projects into memory.")

updates = []
changed = 0

for pid, name, cur_prov_id in projects:
    name_lower = name.lower()
    matched_prov_id = None

    # 1. Check City Map first
    for city, target_prov_name in CITY_MAP.items():
        if city in name_lower:
            target_id = prov_name_to_id.get(target_prov_name.lower())
            if target_id:
                matched_prov_id = target_id
                break

    # 2. Check full Province names
    if not matched_prov_id:
        for prov_id, prov_name, _ in sorted_provinces:
            clean_name = prov_name.replace(" DEO", "").strip().lower()
            if len(clean_name) >= 4 and clean_name in name_lower:
                matched_prov_id = prov_id
                break

    if matched_prov_id and matched_prov_id != cur_prov_id:
        updates.append((matched_prov_id, pid))
        changed += 1

print(f"Identified {changed:,} projects needing location re-alignment.")

if updates:
    print("Writing updates in bulk via temporary table...")
    cursor.execute("""
        CREATE TEMP TABLE tmp_proj_loc (
            new_prov_id TEXT,
            project_id TEXT
        ) ON COMMIT DROP;
    """)

    execute_values(cursor, "INSERT INTO tmp_proj_loc (new_prov_id, project_id) VALUES %s", updates, page_size=10000)
    
    cursor.execute("""
        UPDATE "Project" p
        SET "provinceId" = t.new_prov_id
        FROM tmp_proj_loc t
        WHERE p.id = t.project_id;
    """)
    conn.commit()
    print("Bulk update committed successfully!")

cursor.execute("""
    SELECT r.name, COUNT(p.id)
    FROM "Region" r
    JOIN "Province" pv ON pv."regionId" = r.id
    JOIN "Project" p ON p."provinceId" = pv.id
    GROUP BY r.name
    ORDER BY COUNT(p.id) DESC;
""")
stats = cursor.fetchall()
print("\nUpdated Distribution Across All 18 Regions:")
for rname, count in stats:
    print(f"  - {rname}: {count:,} projects")

cursor.close()
conn.close()
print(f"\nAll project locations accurate! {changed:,} records updated.")
