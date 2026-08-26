from curl_cffi import requests
import json

url = "https://api.transparency.dpwh.gov.ph/projects?page=1&limit=3"
headers = {
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://transparency.dpwh.gov.ph/",
    "Origin": "https://transparency.dpwh.gov.ph",
}

res = requests.get(url, headers=headers, impersonate="chrome120", timeout=15)
print(f"Status: {res.status_code}")
data = res.json()
print("Data type:", type(data))
if isinstance(data, dict):
    print("Keys:", list(data.keys()))
    print("Sample:", json.dumps({k: str(v)[:100] for k, v in data.items()}, indent=2))
elif isinstance(data, list):
    print("List length:", len(data))
    print("Item 0 type:", type(data[0]))
    print("Item 0:", data[0])
