import sys
import json
from curl_cffi import requests

def fetch_project(contract_id: str):
    url = f"https://api.transparency.dpwh.gov.ph/projects/{contract_id}"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://transparency.dpwh.gov.ph",
        "Referer": "https://transparency.dpwh.gov.ph/",
    }
    try:
        r = requests.get(url, headers=headers, impersonate="chrome120", timeout=15)
        if r.status_code == 200:
            data = r.json()
            return data.get("data", {})
        else:
            return {"error": f"HTTP {r.status_code}", "raw": r.text[:200]}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else "24CD0103"
    result = fetch_project(cid)
    print(json.dumps(result, indent=2))
