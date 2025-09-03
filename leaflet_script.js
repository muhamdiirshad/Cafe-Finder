let map, markersLayer, userLatLng = null;

function initLeaflet() {
  map = L.map('map').setView([12.9716, 77.5946], 13); // default Bangalore

  // Tile layer from OSM
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  setupUI();
  getUserLocation();
}

window.addEventListener('load', initLeaflet);



/////////////////////////////////////////////////////////////////
//We use Nominatim (free geocoding API) for text search:

async function geocodeAndSearch(query) {
  if (!query) return alert('Type an address and press Enter.');
  
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();

  if (!data.length) return alert('No results found.');

  const first = data[0];
  const lat = parseFloat(first.lat), lon = parseFloat(first.lon);
  userLatLng = L.latLng(lat, lon);

  map.setView(userLatLng, 15);
  L.marker(userLatLng).addTo(map).bindPopup('Search location').openPopup();

  findNearbyCafes(userLatLng);
}


//Attach setupUI 

function setupUI() {
  const input = document.getElementById('search');
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await geocodeAndSearch(input.value);
    }
  });

  document.getElementById('locBtn').addEventListener('click', () => getUserLocation(true));

  const radiusEl = document.getElementById('radius');
  const radiusVal = document.getElementById('radiusVal');
  radiusVal.textContent = radiusEl.value + ' m';

  radiusEl.addEventListener('input', (e) => {
    radiusVal.textContent = e.target.value + ' m';
    if (userLatLng) findNearbyCafes(userLatLng);
  });
}

/////////////////////////////////////////////////////////////////
// Get User Location
function getUserLocation(force=false) {
  if (!navigator.geolocation) {
    userLatLng = map.getCenter();
    return;
  }

  navigator.geolocation.getCurrentPosition((pos) => {
    userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    map.setView(userLatLng, 15);
    L.circleMarker(userLatLng, { radius:6, color:'blue' })
      .addTo(map).bindPopup('You are here').openPopup();
    findNearbyCafes(userLatLng);
  }, (err) => {
    console.warn('Geolocation error', err);
    userLatLng = map.getCenter();
  });
}




/////////////////////////////////////////////////////////////////
// Find Cafes (Overpass API)

// Overpass API lets us query OpenStreetMap data:

async function findNearbyCafes(latlng) {
  const radius = parseInt(document.getElementById('radius').value, 10) || 1500;

  const query = `[out:json][timeout:25];
  (
    node["amenity"="cafe"](around:${radius},${latlng.lat},${latlng.lng});
    way["amenity"="cafe"](around:${radius},${latlng.lat},${latlng.lng});
    relation["amenity"="cafe"](around:${radius},${latlng.lat},${latlng.lng});
  );
  out center;`;

  const url = 'https://overpass-api.de/api/interpreter';
  const res = await fetch(url, { method:'POST', body: query, headers: { 'Content-Type': 'text/plain' } });
  const data = await res.json();

  renderPlaces(data);
}




///////////////////////////////////////////////////////////////////
// Render Cafes
function renderPlaces(data) {
  markersLayer.clearLayers();
  const listEl = document.getElementById('placesList');
  listEl.innerHTML = '';

  if (!data.elements.length) {
    listEl.innerHTML = '<li>No cafes found in radius.</li>';
    return;
  }

  data.elements.forEach(el => {
    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    if (!lat || !lon) return;

    const name = el.tags && el.tags.name ? el.tags.name : 'Cafe';
    const marker = L.marker([lat, lon]).addTo(markersLayer);
    marker.bindPopup(`<strong>${name}</strong>`);

    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${name}</strong></div>`;
    li.addEventListener('click', () => {
      map.setView([lat, lon], 17);
      marker.openPopup();
    });

    listEl.appendChild(li);
  });
}