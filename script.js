// script.js
let map, infoWindow, placesService;
let markers = [];
let userLocation = null; // google.maps.LatLng

// initMap is called by Google Maps API when the library loads (callback)
function initMap() {
  // sensible default center (can be any)
  const defaultCenter = { lat: 12.9716, lng: 77.5946 };

  map = new google.maps.Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: 14,
    gestureHandling: 'greedy'
  });

  infoWindow = new google.maps.InfoWindow();
  placesService = new google.maps.places.PlacesService(map);

  setupUI();
  getUserLocation(); // try to center on user's device
}

/* ---------------- UI wiring ---------------- */
function setupUI(){
  const input = document.getElementById('search');
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.bindTo('bounds', map);

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      alert('No location details available for that input.');
      return;
    }
    map.panTo(place.geometry.location);
    map.setZoom(15);
    userLocation = place.geometry.location;
    findNearbyPlaces(userLocation);
  });

  document.getElementById('locBtn').addEventListener('click', () => {
    getUserLocation(true); // force locate again
  });

  const radiusEl = document.getElementById('radius');
  const radiusVal = document.getElementById('radiusVal');
  radiusVal.textContent = radiusEl.value + ' m';
  radiusEl.addEventListener('input', (e) => {
    radiusVal.textContent = e.target.value + ' m';
  });
}

/* ---------------- Geolocation ---------------- */
function getUserLocation(wantFresh = false){
  if (!navigator.geolocation) {
    showMessage('Geolocation not supported in this browser.');
    // fallback to current map center
    userLocation = map.getCenter();
    return;
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    userLocation = new google.maps.LatLng(lat, lng);

    map.panTo(userLocation);
    map.setZoom(15);

    // small marker for "you"
    new google.maps.Marker({
      map,
      position: userLocation,
      title: 'You are here',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff'
      }
    });

    // perform search once we have location
    findNearbyPlaces(userLocation);
  }, (err) => {
    console.warn('Geolocation error:', err);
    showMessage('Unable to access location. Use the search box instead.');
    userLocation = map.getCenter();
  }, { enableHighAccuracy: true, timeout: 8000 });
}

/* ---------------- Find nearby cafes ---------------- */
function findNearbyPlaces(location){
  if (!location) { showMessage('No location chosen yet.'); return; }

  const radius = parseInt(document.getElementById('radius').value, 10) || 1500;

  const request = {
    location,
    radius,
    type: ['cafe'] // look for cafes
  };

  placesService.nearbySearch(request, (results, status, pagination) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      showMessage('Places search failed: ' + status);
      return;
    }

    clearMarkers();
    clearList();
    renderPlaces(results);

    // Google may return multiple pages — optionally fetch more
    if (pagination && pagination.hasNextPage) {
      // per docs, call nextPage() after a short delay
      setTimeout(() => { pagination.nextPage(); }, 2000);
    }
  });
}

/* ---------------- Render list & markers ---------------- */
function renderPlaces(places){
  const listEl = document.getElementById('placesList');

  places.forEach(place => {
    // marker
    const marker = new google.maps.Marker({
      map,
      position: place.geometry.location,
      title: place.name
    });
    markers.push(marker);

    // click marker => show details
    marker.addListener('click', () => {
      showPlaceDetails(place, marker);
    });

    // list item
    const li = document.createElement('li');
    li.className = 'place';
    li.innerHTML = `
      <div>
        <strong>${place.name}</strong>
        ${place.rating ? `<span class="meta"> — ⭐ ${place.rating}</span>` : ''}
      </div>
      <div class="meta">${place.vicinity || ''}</div>
    `;

    // compute straight-line distance if userLocation & geometry lib available
    if (userLocation && google.maps.geometry && google.maps.geometry.spherical) {
      const distMeters = google.maps.geometry.spherical.computeDistanceBetween(userLocation, place.geometry.location);
      const km = (distMeters / 1000).toFixed(2);
      const dspan = document.createElement('div');
      dspan.className = 'distance';
      dspan.textContent = km + ' km';
      li.querySelector('div').appendChild(dspan);
    }

    li.addEventListener('click', () => {
      map.panTo(place.geometry.location);
      map.setZoom(16);
      showPlaceDetails(place, marker);
    });

    listEl.appendChild(li);
  });
}

/* ---------------- Place details (info window) ---------------- */
function showPlaceDetails(place, marker){
  // request a few fields for the detail card
  const request = {
    placeId: place.place_id,
    fields: ['name','formatted_address','formatted_phone_number','opening_hours','rating','website','photos']
  };

  placesService.getDetails(request, (details, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !details) {
      infoWindow.setContent('<div>Details not available</div>');
      infoWindow.open(map, marker);
      return;
    }

    let content = `<div class="iw-title">${details.name}</div>`;

    if (details.photos && details.photos.length) {
      const url = details.photos[0].getUrl({ maxWidth: 300 });
      content += `<div><img src="${url}" alt="${details.name}" style="max-width:100%;height:auto;margin-bottom:8px" /></div>`;
    }

    content += `<div>${details.formatted_address || ''}</div>`;
    if (details.formatted_phone_number) content += `<div>📞 ${details.formatted_phone_number}</div>`;
    if (details.rating) content += `<div>Rating: ${details.rating} ⭐</div>`;
    if (details.opening_hours && details.opening_hours.weekday_text) {
      content += `<div style="margin-top:6px">${details.opening_hours.weekday_text.join('<br>')}</div>`;
    }
    if (details.website) content += `<div style="margin-top:6px"><a href="${details.website}" target="_blank">Website</a></div>`;

    infoWindow.setContent(content);
    infoWindow.open(map, marker);
  });
}

/* ---------------- Helpers ---------------- */
function clearMarkers(){
  markers.forEach(m => m.setMap(null));
  markers = [];
}
function clearList(){
  document.getElementById('placesList').innerHTML = '';
}
function showMessage(msg){
  // lightweight UI; you can expand to a banner/toast
  console.log('[Cafe Finder] ' + msg);
}
