import requests
import json

brouter_url = "https://brouter.de/brouter"
params = {
    "lonlats": "2.3522,48.8566|2.3622,48.8666",
    "profile": "trekking",
    "alternativeidx": 0,
    "format": "geojson"
}
resp = requests.get(brouter_url, params=params)
data = resp.json()

features = data.get("features", [])
if not features:
    print("No features")
else:
    msgs = features[0].get("properties", {}).get("messages", [])
    if not msgs:
        print("No messages")
    else:
        headers = msgs[0]
        try:
            way_tag_idx = headers.index('WayTags')
        except ValueError:
            print("No WayTags column")
            way_tag_idx = None
            
        if way_tag_idx is not None:
            tags = [m[way_tag_idx] for m in msgs[1:]]
            print(list(set(tags)))
