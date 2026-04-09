/* ── Public map JS ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  // ── YouTube helper ──────────────────────────────────────────────────────────

  function extractYouTubeId(url) {
    if (!url) return null;
    const m = url.match(
      /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    );
    return m ? m[1] : null;
  }

  function buildEmbedUrl(videoUrl) {
    const id = extractYouTubeId(videoUrl);
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  }

  // ── Date formatter ──────────────────────────────────────────────────────────

  function formatDate(isoDate) {
    if (!isoDate) return "";
    try {
      return new Date(isoDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return isoDate;
    }
  }

  // ── Modal ───────────────────────────────────────────────────────────────────

  const modal = document.getElementById("video-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalDate = document.getElementById("modal-date");
  const modalVideoTitle = document.getElementById("modal-video-title");
  const modalIframe = document.getElementById("video-iframe");
  const modalClose = document.getElementById("modal-close");
  const backdrop = modal.querySelector(".video-modal-backdrop");

  let previousFocus = null; // element to return focus to on close

  /** Return all keyboard-focusable elements inside the modal. */
  function getFocusableElements() {
    return Array.from(
      modal.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function openModal(location) {
    previousFocus = document.activeElement;

    modalTitle.textContent = location.title;
    modalDate.textContent = formatDate(location.gigDate);
    modalVideoTitle.textContent = location.videoTitle || "";
    const embedUrl = buildEmbedUrl(location.videoUrl);
    if (embedUrl) modalIframe.src = embedUrl;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Move focus into the modal
    modalClose.focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
    modalIframe.src = ""; // stop playback
    document.body.style.overflow = "";

    // Restore focus to the element that opened the modal
    if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  modalClose.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); return; }

    // Trap Tab / Shift+Tab inside the modal when it is open
    if (e.key === "Tab" && !modal.classList.contains("hidden")) {
      const focusable = getFocusableElements();
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // ── Map ─────────────────────────────────────────────────────────────────────

  mapboxgl.accessToken = window.MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [0, 20],
    zoom: 1.5,
    attributionControl: true,
  });

  // Add zoom and rotation controls
  map.addControl(new mapboxgl.NavigationControl(), "top-right");

  // ── Load and render locations ────────────────────────────────────────────────

  async function loadLocations() {
    let locations;
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      locations = await res.json();
    } catch (err) {
      console.error("Failed to load locations:", err);
      return;
    }

    if (!locations || locations.length === 0) return;

    // Fit map to show all markers
    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach((loc) => {
      if (loc.latitude == null || loc.longitude == null) return;

      const lngLat = [loc.longitude, loc.latitude];
      bounds.extend(lngLat);

      // Custom marker element
      const el = document.createElement("div");
      el.className = "tmd-marker";
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", loc.title);
      el.setAttribute("tabindex", "0");

      el.addEventListener("click", () => openModal(loc));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") openModal(loc);
      });

      new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
    });

    // Fit to all markers with padding
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 10,
        animate: false,
      });
    }
  }

  map.on("load", loadLocations);
})();
