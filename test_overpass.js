fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ data: `[out:json][timeout:20];(node(around:200,48.8566,2.3522)["amenity"~"cafe"];);out body;` })
}).then(r=>r.text()).then(d=>console.log(d)).catch(console.error);
