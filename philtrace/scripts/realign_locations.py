import os
import psycopg2

db_url = None
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

print("Fetching all provinces from database...")
cursor.execute('SELECT id, name, "psgcCode" FROM "Province" ORDER BY LENGTH(name) DESC')
provinces = cursor.fetchall()
print(f"Loaded {len(provinces)} provinces.")

# Build SQL case statements for province name matching in description
# We match longer province names first to avoid partial conflicts (e.g. "Davao del Norte" before "Davao")
print("Re-aligning project provinces using high-precision description matching...")

updated_count = 0
for prov_id, prov_name, psgc in provinces:
    # Skip very short or generic words if any
    name_clean = prov_name.replace(" DEO", "").strip()
    if len(name_clean) < 3:
        continue

    # Update projects where the description explicitly mentions this province name,
    # especially where province was set to a default regional fallback
    sql = """
        UPDATE "Project" p
        SET "provinceId" = %s
        FROM "Province" cur_prov
        WHERE p."provinceId" = cur_prov.id
        AND p.name ILIKE %s
        AND cur_prov.name != %s;
    """
    pattern = f"%{name_clean}%"
    cursor.execute(sql, (prov_id, pattern, prov_name))
    if cursor.rowcount > 0:
        print(f"  -> Re-assigned {cursor.rowcount:,} projects to '{prov_name}' (matched in description)")
        updated_count += cursor.rowcount

conn.commit()

# Specific famous cities mapping
city_mappings = [
    ("Manila", "Metropolitan Manila"),
    ("Quezon City", "Metropolitan Manila"),
    ("Makati", "Metropolitan Manila"),
    ("Pasig", "Metropolitan Manila"),
    ("Taguig", "Metropolitan Manila"),
    ("Caloocan", "Metropolitan Manila"),
    ("Parañaque", "Metropolitan Manila"),
    ("Las Piñas", "Metropolitan Manila"),
    ("Muntinlupa", "Metropolitan Manila"),
    ("Valenzuela", "Metropolitan Manila"),
    ("Marikina", "Metropolitan Manila"),
    ("Pasay", "Metropolitan Manila"),
    ("Mandaluyong", "Metropolitan Manila"),
    ("San Juan", "Metropolitan Manila"),
    ("Cebu City", "Cebu"),
    ("Mandaue", "Cebu"),
    ("Lapu-Lapu", "Cebu"),
    ("Davao City", "Davao del Sur"),
    ("San Fernando, Pampanga", "Pampanga"),
    ("Angeles City", "Pampanga"),
    ("San Fernando, La Union", "La Union"),
    ("Baguio City", "Benguet"),
    ("Bacolod City", "Negros Occidental"),
    ("Iloilo City", "Iloilo"),
    ("Cagayan de Oro", "Misamis Oriental"),
    ("General Santos", "South Cotabato"),
    ("Zamboanga City", "Zamboanga del Sur"),
    ("Tacloban City", "Leyte"),
    ("Butuan City", "Agusan del Norte"),
    ("Iligan City", "Lanao del Norte"),
    ("Puerto Princesa", "Palawan"),
    ("Olongapo", "Zambales"),
    ("Lucena", "Quezon"),
    ("Batangas City", "Batangas"),
    ("Lipa City", "Batangas"),
    ("Tagaytay", "Cavite"),
    ("Antipolo", "Rizal"),
    ("Calamba", "Laguna"),
    ("Santa Rosa", "Laguna"),
    ("San Pablo", "Laguna"),
]

print("\nRe-aligning major city projects to their respective provinces...")
for city, prov_name in city_mappings:
    cursor.execute('SELECT id FROM "Province" WHERE name = %s LIMIT 1', (prov_name,))
    row = cursor.fetchone()
    if row:
        target_pid = row[0]
        cursor.execute("""
            UPDATE "Project" p
            SET "provinceId" = %s
            FROM "Province" cur_prov
            WHERE p."provinceId" = cur_prov.id
            AND p.name ILIKE %s
            AND cur_prov.name != %s;
        """, (target_pid, f"%{city}%", prov_name))
        if cursor.rowcount > 0:
            print(f"  -> Re-assigned {cursor.rowcount:,} '{city}' projects to '{prov_name}'")
            updated_count += cursor.rowcount

conn.commit()

# Re-calculate stats for all regions
cursor.execute("""
    SELECT r.name, COUNT(p.id)
    FROM "Region" r
    JOIN "Province" pv ON pv."regionId" = r.id
    JOIN "Project" p ON p."provinceId" = pv.id
    GROUP BY r.name
    ORDER BY COUNT(p.id) DESC;
""")
stats = cursor.fetchall()
print("\nUpdated Project Distribution Across All 18 Regions:")
for rname, count in stats:
    print(f"  - {rname}: {count:,} projects")

cursor.close()
conn.close()
print(f"\nLocation alignment complete! {updated_count:,} total project locations adjusted.")
