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

print("Sanitizing NaN float values in PostgreSQL...")
cursor.execute("""
    UPDATE "Project" 
    SET "gpsLat" = 14.5995 
    WHERE "gpsLat" = 'NaN'::float8;
""")
print(f"Updated gpsLat NaNs: {cursor.rowcount}")

cursor.execute("""
    UPDATE "Project" 
    SET "gpsLng" = 120.9842 
    WHERE "gpsLng" = 'NaN'::float8;
""")
print(f"Updated gpsLng NaNs: {cursor.rowcount}")

cursor.execute("""
    UPDATE "Project" 
    SET "budgetPHP" = 0.0 
    WHERE "budgetPHP" = 'NaN'::float8;
""")
print(f"Updated budgetPHP NaNs: {cursor.rowcount}")

cursor.execute("""
    UPDATE "Project" 
    SET "amountPaid" = 0.0 
    WHERE "amountPaid" = 'NaN'::float8;
""")
print(f"Updated amountPaid NaNs: {cursor.rowcount}")

cursor.execute("""
    UPDATE "Project" 
    SET "progress" = 0.0 
    WHERE "progress" = 'NaN'::float8;
""")
print(f"Updated progress NaNs: {cursor.rowcount}")

conn.commit()
cursor.close()
conn.close()
print("All NaN values successfully sanitized!")
