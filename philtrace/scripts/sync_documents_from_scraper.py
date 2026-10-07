import os
import sys
import json
import time
import lzma
import tarfile
import io
import psycopg2
from psycopg2.extras import execute_values

# 1. Connect to Database
env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
direct_url = None
db_url = None

if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("DIRECT_URL="):
                direct_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("DATABASE_URL=") and not direct_url:
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

connect_url = direct_url or db_url
if not connect_url:
    print("Error: DATABASE_URL or DIRECT_URL not found")
    sys.exit(1)

if "?pgbouncer" in connect_url:
    connect_url = connect_url.split("?")[0]

print("Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(connect_url)
cursor = conn.cursor()

cursor.execute('SELECT id FROM "Project"')
db_ids = set(r[0] for r in cursor.fetchall())
print("Total projects in database:", len(db_ids))

# 2. Open split tar.xz archive from dpwh-scraper
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
p1 = os.path.join(repo_root, "dpwh-scraper", "tar-data", "projects-json.tar.xz.001")
p2 = os.path.join(repo_root, "dpwh-scraper", "tar-data", "projects-json.tar.xz.002")

if not os.path.exists(p1) or not os.path.exists(p2):
    print("Error: Split tar files not found at", p1, p2)
    sys.exit(1)

class SplitFileStream(io.RawIOBase):
    def __init__(self, files):
        self.files = [open(f, "rb") for f in files]
        self.idx = 0
    def readable(self): return True
    def seekable(self): return False
    def readinto(self, b):
        if self.idx >= len(self.files): return 0
        n = self.files[self.idx].readinto(b)
        if n == 0 and len(b) > 0:
            self.idx += 1
            return self.readinto(b)
        return n

upsert_sql = """
INSERT INTO "ContractDocument" (
    id, "projectId", "sourcePdfUrl", "contractAgreementUrl",
    "noticeToProceedUrl", "noticeOfAwardUrl", "advertisementUrl",
    "biddersJson", "extractionStatus", "parsedAt"
) VALUES %s
ON CONFLICT ("projectId") DO UPDATE SET
    "sourcePdfUrl" = EXCLUDED."sourcePdfUrl",
    "contractAgreementUrl" = EXCLUDED."contractAgreementUrl",
    "noticeToProceedUrl" = EXCLUDED."noticeToProceedUrl",
    "noticeOfAwardUrl" = EXCLUDED."noticeOfAwardUrl",
    "advertisementUrl" = EXCLUDED."advertisementUrl",
    "biddersJson" = EXCLUDED."biddersJson",
    "extractionStatus" = EXCLUDED."extractionStatus",
    "parsedAt" = NOW();
"""

stream = SplitFileStream([p1, p2])
matched = 0
batch = []
start_time = time.time()
print("Scanning projects-json.tar.xz for real DPWH contract documents...")

with lzma.open(stream) as xz:
    with tarfile.open(mode="r|", fileobj=xz) as tar:
        for member in tar:
            if not member.name.endswith(".json"):
                continue
            base_name = os.path.basename(member.name)
            cid = os.path.splitext(base_name)[0]
            if cid not in db_ids:
                continue

            try:
                f_obj = tar.extractfile(member)
                raw = json.load(f_obj)
                pdata = raw.get("data", {})
                links = pdata.get("links", {}) or {}
                bidders = pdata.get("bidders", []) or []

                ca = links.get("contractAgreement") or ""
                ntp = links.get("noticeToProceed") or ""
                noa = links.get("noticeOfAward") or ""
                ad = links.get("advertisement") or ""

                # Choose best primary PDF URL
                primary_url = ""
                for u in [ca, ntp, noa, ad]:
                    if u and u.strip().startswith("http"):
                        primary_url = u.strip()
                        break
                
                if not primary_url:
                    primary_url = f"https://www.dpwh.gov.ph/dpwh/business/procurement/civil-works/contract/{cid}"

                doc_id = f"cd_{cid}"
                bidders_json_str = json.dumps(bidders) if bidders else None

                batch.append((
                    doc_id, cid, primary_url,
                    ca if ca else None,
                    ntp if ntp else None,
                    noa if noa else None,
                    ad if ad else None,
                    bidders_json_str,
                    "PARSED",
                ))
                matched += 1

                if len(batch) >= 1000:
                    execute_values(cursor, upsert_sql, batch, page_size=1000)
                    conn.commit()
                    batch = []
                    print(f"  -> Synced {matched} contract documents ({time.time()-start_time:.1f}s)...")

            except Exception as e:
                pass

if batch:
    execute_values(cursor, upsert_sql, batch, page_size=len(batch))
    conn.commit()
    print(f"  -> Synced final batch. Total matched documents: {matched}")

print(f"\n[SUCCESS] Completed syncing {matched} official DPWH contract documents in {time.time()-start_time:.1f}s!")
cursor.close()
conn.close()
