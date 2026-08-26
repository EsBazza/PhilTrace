from curl_cffi import requests
import json

url = "https://api.transparency.dpwh.gov.ph/projects?page=1&limit=3"
headers = {
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://transparency.dpwh.gov.ph/",
    "Origin": "https://transparency.dpwh.gov.ph",
}

res = requests.get(url, headers=headers, impersonate="chrome120", timeout=15)
print(f"HTTP Status: {res.status_code}")
if res.status_code == 200:
    data = res.json()
    print(f"Retrieved {len(data)} live projects from DPWH directly:")
    for idx, p in enumerate(data):
        print(f"[{idx+1}] Contract ID: {p.get('contractId')}")
        print(f"    Name: {p.get('description')}")
        print(f"    Budget: PHP {p.get('budget'):,}")
        print(f"    Progress: {p.get('progress')}%")
        print(f"    Status: {p.get('status')}")
        print(f"    Location: {p.get('location')}")
        print(f"    Contractor: {p.get('contractor')}")
        print(f"    Has Satellite: {p.get('hasSatelliteImage')}")
