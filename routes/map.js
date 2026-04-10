const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getBase } = require("../lib/airtable");

const router = express.Router();

// ── Airtable ──────────────────────────────────────────────────────────────────

const LOCATIONS_TABLE = "tblijHhtJW0XVEPaa";
const VALID_TIERS = ["standard", "good", "crash"];

// Web Mercator projection limit — Mapbox uses this projection and will
// destabilise (spinning map, GL crash) for latitudes beyond this bound.
const MAX_MERCATOR_LAT = 85.051129;

/** Fetch all location records and return as plain objects. */
async function fetchAllLocations() {
  const base = getBase();
  return new Promise((resolve, reject) => {
    const records = [];
    base(LOCATIONS_TABLE)
      .select({
        sort: [{ field: "gigDate", direction: "desc" }],
      })
      .eachPage(
        (page, next) => {
          records.push(...page);
          next();
        },
        (err) => {
          if (err) return reject(err);
          resolve(
            records
              .map((r) => ({
                id: r.id,
                title: r.get("title") || "",
                gigDate: r.get("gigDate") || null,
                videoTitle: r.get("videoTitle") || "",
                videoUrl: r.get("videoUrl") || "",
                latitude: r.get("latitude") ?? null,
                longitude: r.get("longitude") ?? null,
                tier: r.get("tier") || "standard",
              }))
              .filter((loc) => {
                // Only serve records with coordinates renderable by Mapbox.
                // Web Mercator projection breaks beyond ±85.051129° latitude.
                const { latitude: lat, longitude: lng } = loc;
                return (
                  lat != null && lng != null &&
                  lat > -MAX_MERCATOR_LAT && lat < MAX_MERCATOR_LAT &&
                  lng >= -180 && lng <= 180
                );
              }),
          );
        },
      );
  });
}

// ── YouTube helpers ───────────────────────────────────────────────────────────

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
];

/**
 * Extract the YouTube video ID from a URL.
 * Returns the ID string, or null if the URL is not a recognised YouTube URL.
 */
function extractYouTubeId(url) {
  if (!url) return null;
  for (const pattern of YT_PATTERNS) {
    const m = url.match(pattern);
    if (m) return m[1];
  }
  return null;
}

/** Validate that a URL is a recognised YouTube URL. */
function isValidYouTubeUrl(url) {
  return extractYouTubeId(url) !== null;
}

// ── Request helpers ───────────────────────────────────────────────────────────

/**
 * Validate and parse the common location fields from a request body.
 * Returns { error } on failure, or { fields } with coerced values on success.
 */
function validateLocationBody(body) {
  const { title, gigDate, videoTitle, videoUrl, latitude, longitude, tier } = body;

  if (!title || !title.trim()) {
    return { error: "title is required" };
  }
  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return { error: "A valid YouTube URL is required" };
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (latitude == null || longitude == null || !isFinite(lat) || !isFinite(lng)) {
    return { error: "latitude and longitude are required" };
  }
  if (lat < -MAX_MERCATOR_LAT || lat > MAX_MERCATOR_LAT) {
    return { error: `latitude must be between -${MAX_MERCATOR_LAT} and ${MAX_MERCATOR_LAT}` };
  }
  if (lng < -180 || lng > 180) {
    return { error: "longitude must be between -180 and 180" };
  }

  const coercedTier = VALID_TIERS.includes(tier) ? tier : "standard";

  return {
    fields: {
      title: title.trim(),
      gigDate: gigDate || null,
      videoTitle: (videoTitle || "").trim(),
      videoUrl: videoUrl.trim(),
      latitude: lat,
      longitude: lng,
      tier: coercedTier,
    },
  };
}

/** Shape a saved Airtable record into the standard API response object. */
function locationRecordToJson(record) {
  return {
    id: record.id,
    title: record.get("title"),
    gigDate: record.get("gigDate") || null,
    videoTitle: record.get("videoTitle") || "",
    videoUrl: record.get("videoUrl"),
    latitude: record.get("latitude"),
    longitude: record.get("longitude"),
    tier: record.get("tier") || "standard",
  };
}

// ── Public map page ───────────────────────────────────────────────────────────

// GET /map  — public, no auth required
router.get("/map", (req, res) => {
  res.render("map-public");
});

// ── Public locations API ──────────────────────────────────────────────────────

// GET /api/locations  — public, read-only
router.get("/api/locations", async (req, res) => {
  try {
    const locations = await fetchAllLocations();
    res.json(locations);
  } catch (err) {
    console.error("Error fetching locations:", err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// ── Admin map page ────────────────────────────────────────────────────────────

// GET /map/admin
router.get(
  "/map/admin",
  requireAuth(["super_admin", "admin"]),
  (req, res) => {
    res.render("map-admin");
  },
);

// ── Admin locations API ───────────────────────────────────────────────────────

// POST /api/locations — create
router.post(
  "/api/locations",
  requireAuth(["super_admin", "admin"]),
  async (req, res) => {
    const { error, fields } = validateLocationBody(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const base = getBase();
      const [record] = await base(LOCATIONS_TABLE).create([{ fields }]);
      res.status(201).json(locationRecordToJson(record));
    } catch (err) {
      console.error("Error creating location:", err);
      res.status(500).json({ error: "Failed to create location" });
    }
  },
);

// PUT /api/locations/:id — update
router.put(
  "/api/locations/:id",
  requireAuth(["super_admin", "admin"]),
  async (req, res) => {
    const { id } = req.params;
    const { error, fields } = validateLocationBody(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const base = getBase();
      const [record] = await base(LOCATIONS_TABLE).update([{ id, fields }]);
      res.json(locationRecordToJson(record));
    } catch (err) {
      console.error("Error updating location:", err);
      res.status(500).json({ error: "Failed to update location" });
    }
  },
);

// DELETE /api/locations/:id — delete
router.delete(
  "/api/locations/:id",
  requireAuth(["super_admin", "admin"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const base = getBase();
      await base(LOCATIONS_TABLE).destroy(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting location:", err);
      res.status(500).json({ error: "Failed to delete location" });
    }
  },
);

module.exports = router;
