/* ── Map admin JS ────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  // ── State ───────────────────────────────────────────────────────────────────

  let locations = [];      // current list fetched from API
  let editingId = null;    // record ID being edited, or null for new
  let marker = null;       // active draggable Mapbox marker
  let pendingDeleteId = null;

  // ── DOM refs ────────────────────────────────────────────────────────────────

  const form            = document.getElementById("location-form");
  const formHeading     = document.getElementById("form-heading");
  const formError       = document.getElementById("form-error");
  const formSuccess     = document.getElementById("form-success");
  const editIdField     = document.getElementById("edit-id");
  const latField        = document.getElementById("field-lat");
  const lngField        = document.getElementById("field-lng");
  const titleField      = document.getElementById("field-title");
  const dateField       = document.getElementById("field-date");
  const videoTitleField = document.getElementById("field-video-title");
  const videoUrlField   = document.getElementById("field-video-url");
  const coordsLabel     = document.getElementById("coords-label");
  const saveBtn         = document.getElementById("form-save-btn");
  const cancelBtn       = document.getElementById("form-cancel-btn");
  const locationList    = document.getElementById("location-list");
  const locationCount   = document.getElementById("location-count");
  const listLoading     = document.getElementById("location-list-loading");
  const mapHint         = document.getElementById("map-hint");

  const geocodeInput    = document.getElementById("geocode-input");
  const geocodeBtn      = document.getElementById("geocode-btn");
  const geocodeResults  = document.getElementById("geocode-results");

  const deleteDialog    = document.getElementById("delete-dialog");
  const deleteDialogName = document.getElementById("delete-dialog-name");
  const deleteConfirmBtn = document.getElementById("delete-confirm-btn");
  const deleteCancelBtn  = document.getElementById("delete-cancel-btn");

  // ── YouTube validation ──────────────────────────────────────────────────────

  function extractYouTubeId(url) {
    if (!url) return null;
    const m = url.match(
      /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    );
    return m ? m[1] : null;
  }

  function isValidYouTubeUrl(url) {
    return extractYouTubeId(url) !== null;
  }

  // ── Mapbox map ──────────────────────────────────────────────────────────────

  mapboxgl.accessToken = window.MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: "admin-map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [0, 20],
    zoom: 1.5,
  });

  map.addControl(new mapboxgl.NavigationControl(), "top-right");

  // ── Marker helpers ──────────────────────────────────────────────────────────

  function removeMarker() {
    if (marker) {
      marker.remove();
      marker = null;
    }
  }

  function placeMarker(lngLat) {
    removeMarker();
    marker = new mapboxgl.Marker({ draggable: true, color: "#e03c31" })
      .setLngLat(lngLat)
      .addTo(map);

    updateCoordsFromMarker();

    marker.on("dragend", updateCoordsFromMarker);
  }

  function updateCoordsFromMarker() {
    if (!marker) return;
    const { lat, lng } = marker.getLngLat();
    latField.value = lat.toFixed(7);
    lngField.value = lng.toFixed(7);
    coordsLabel.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    mapHint.classList.add("hidden");
  }

  // ── Geocoding ───────────────────────────────────────────────────────────────

  async function geocode(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${window.MAPBOX_TOKEN}&limit=5`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
    const data = await res.json();
    return data.features || [];
  }

  function showGeocodeResults(features) {
    geocodeResults.innerHTML = "";
    if (features.length === 0) {
      geocodeResults.classList.add("hidden");
      return;
    }
    features.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f.place_name;
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "-1");
      li.addEventListener("click", () => {
        const [lng, lat] = f.center;
        geocodeResults.classList.add("hidden");
        geocodeInput.value = f.place_name;
        // Pre-fill the title if empty
        if (!titleField.value.trim()) {
          titleField.value = f.text || f.place_name;
        }
        map.flyTo({ center: [lng, lat], zoom: 12 });
        placeMarker([lng, lat]);
      });
      geocodeResults.appendChild(li);
    });
    geocodeResults.classList.remove("hidden");
  }

  geocodeBtn.addEventListener("click", async () => {
    const query = geocodeInput.value.trim();
    if (!query) return;
    geocodeBtn.setAttribute("aria-busy", "true");
    geocodeBtn.disabled = true;
    try {
      const features = await geocode(query);
      showGeocodeResults(features);
    } catch (err) {
      showFormError("Geocoding search failed. Please try again.");
    } finally {
      geocodeBtn.removeAttribute("aria-busy");
      geocodeBtn.disabled = false;
    }
  });

  geocodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); geocodeBtn.click(); }
  });

  // Close results when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#geocode-wrap")) {
      geocodeResults.classList.add("hidden");
    }
  });

  // ── Form helpers ────────────────────────────────────────────────────────────

  function showFormError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
    formSuccess.classList.add("hidden");
  }

  function showFormSuccess(msg) {
    formSuccess.textContent = msg;
    formSuccess.classList.remove("hidden");
    formError.classList.add("hidden");
  }

  function clearFormMessages() {
    formError.classList.add("hidden");
    formSuccess.classList.add("hidden");
  }

  function resetForm() {
    form.reset();
    editIdField.value = "";
    latField.value = "";
    lngField.value = "";
    coordsLabel.textContent = "No marker placed yet";
    editingId = null;
    formHeading.textContent = "Add location";
    saveBtn.textContent = "Save location";
    geocodeInput.value = "";
    geocodeResults.classList.add("hidden");
    removeMarker();
    clearFormMessages();
    mapHint.classList.remove("hidden");
  }

  cancelBtn.addEventListener("click", resetForm);

  // ── Form submit ─────────────────────────────────────────────────────────────

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormMessages();

    const title = titleField.value.trim();
    const videoUrl = videoUrlField.value.trim();
    const lat = latField.value;
    const lng = lngField.value;

    if (!title) { showFormError("Location name is required."); return; }
    if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
      showFormError("A valid YouTube URL is required (youtube.com or youtu.be).");
      return;
    }
    if (!lat || !lng) { showFormError("Please search for and place a marker on the map."); return; }

    const payload = {
      title,
      gigDate: dateField.value || null,
      videoTitle: videoTitleField.value.trim(),
      videoUrl,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
    };

    saveBtn.setAttribute("aria-busy", "true");
    saveBtn.disabled = true;

    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `/api/locations/${editingId}` : "/api/locations";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        showFormError(data.error || "Failed to save location.");
        return;
      }

      showFormSuccess(editingId ? "Location updated." : "Location saved.");
      resetForm();
      await loadLocations();
    } catch (err) {
      showFormError("Network error. Please try again.");
    } finally {
      saveBtn.removeAttribute("aria-busy");
      saveBtn.disabled = false;
    }
  });

  // ── Location list ───────────────────────────────────────────────────────────

  function formatDate(isoDate) {
    if (!isoDate) return "—";
    try {
      return new Date(isoDate).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch { return isoDate; }
  }

  function renderLocationList() {
    locationCount.textContent = `(${locations.length})`;
    locationList.innerHTML = "";

    if (locations.length === 0) {
      locationList.innerHTML = '<li style="font-size:0.85rem;color:var(--pico-muted-color)">No locations yet.</li>';
      return;
    }

    locations.forEach((loc) => {
      const li = document.createElement("li");
      li.className = "location-item";

      li.innerHTML = `
        <div class="location-item-info">
          <div class="location-item-title" title="${escapeHtml(loc.title)}">${escapeHtml(loc.title)}</div>
          <div class="location-item-date">${formatDate(loc.gigDate)}</div>
        </div>
        <div class="location-item-actions">
          <button class="secondary outline" data-action="edit" data-id="${loc.id}">Edit</button>
          <button class="contrast outline" data-action="delete" data-id="${loc.id}">Delete</button>
        </div>
      `;

      li.querySelector("[data-action='edit']").addEventListener("click", () => startEdit(loc));
      li.querySelector("[data-action='delete']").addEventListener("click", () => startDelete(loc));

      locationList.appendChild(li);
    });
  }

  async function loadLocations() {
    listLoading.hidden = false;
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      locations = await res.json();
      renderLocationList();
    } catch (err) {
      console.error("Failed to load locations:", err);
    } finally {
      listLoading.hidden = true;
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function startEdit(loc) {
    clearFormMessages();
    editingId = loc.id;
    editIdField.value = loc.id;
    titleField.value = loc.title;
    dateField.value = loc.gigDate || "";
    videoTitleField.value = loc.videoTitle || "";
    videoUrlField.value = loc.videoUrl || "";
    latField.value = loc.latitude != null ? loc.latitude : "";
    lngField.value = loc.longitude != null ? loc.longitude : "";

    formHeading.textContent = "Edit location";
    saveBtn.textContent = "Update location";

    if (loc.latitude != null && loc.longitude != null) {
      const lngLat = [loc.longitude, loc.latitude];
      map.flyTo({ center: lngLat, zoom: 10 });
      placeMarker(lngLat);
    }

    // Scroll sidebar to top
    document.querySelector(".map-admin-sidebar").scrollTop = 0;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function startDelete(loc) {
    pendingDeleteId = loc.id;
    deleteDialogName.textContent = `"${loc.title}"`;
    deleteDialog.showModal();
  }

  deleteCancelBtn.addEventListener("click", () => {
    pendingDeleteId = null;
    deleteDialog.close();
  });

  deleteConfirmBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;
    deleteConfirmBtn.setAttribute("aria-busy", "true");
    deleteConfirmBtn.disabled = true;

    const idToDelete = pendingDeleteId;

    try {
      const res = await fetch(`/api/locations/${idToDelete}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        deleteDialog.close();
        pendingDeleteId = null;
        showFormError(d.error || "Failed to delete location.");
        return;
      }
      deleteDialog.close();
      pendingDeleteId = null;
      // If we were editing this record, reset the form
      if (editingId === idToDelete) resetForm();
      await loadLocations();
    } catch (err) {
      deleteDialog.close();
      pendingDeleteId = null;
      showFormError("Network error. Please try again.");
    } finally {
      deleteConfirmBtn.removeAttribute("aria-busy");
      deleteConfirmBtn.disabled = false;
    }
  });

  // ── Utilities ───────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  map.on("load", loadLocations);
})();
