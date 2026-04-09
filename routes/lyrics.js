const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getBase } = require("../lib/airtable");

const router = express.Router();

const TABLES = {
  PERFORMERS: "tblDLB60lKGmK9Lv5",
  MEDLEYS: "tblOfE65slr7lFwxk",
  LYRICS: "tblzrwnA7rhVDF0Yd",
};

const MISTAKE_OPTIONS = ["Melody 🎵", "Rhythm 🥁", "Delivery 🎭", "Lyrics 📚", "Entry 🚦", "Drums 🪘", "Guitar 🎸"];

/**
 * Sanitise HTML from Airtable's `codified text` field.
 * Only <b> and <i> (and <em>/<strong>) are kept; asterisk-wrapped text
 * is converted to <em> for records not yet processed by lyricsItalicsAndBold.
 */
function formatLyricHtml(str) {
  if (!str) return "";
  let html = str.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/<(?!\/?(?:b|i|em|strong)\b)[^>]*>/gi, "");
  return html;
}

/** Fetch all pages from an Airtable table using the given select options. */
function fetchAll(tableId, selectOptions = {}) {
  return new Promise((resolve, reject) => {
    const records = [];
    getBase()(tableId)
      .select(selectOptions)
      .eachPage(
        (page, fetchNext) => {
          records.push(...page);
          fetchNext();
        },
        (err) => {
          if (err) reject(err);
          else resolve(records);
        },
      );
  });
}

/** Batch-update records in groups of 10 (Airtable limit). */
async function batchUpdate(tableId, updates) {
  const base = getBase();
  const results = [];
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const updated = await base(tableId).update(chunk);
    results.push(...updated);
  }
  return results;
}

// ── GET /lyrics ───────────────────────────────────────────────────────────────

router.get(
  "/lyrics",
  requireAuth(["super_admin", "admin", "performer"]),
  (req, res) => {
    res.render("lyrics", { mistakeOptions: MISTAKE_OPTIONS });
  },
);

// ── GET /api/performers ───────────────────────────────────────────────────────

router.get(
  "/api/performers",
  requireAuth(["super_admin", "admin", "performer"]),
  async (req, res) => {
    try {
      const records = await fetchAll(TABLES.PERFORMERS, {
        fields: ["performer", "Name"],
        sort: [{ field: "Name", direction: "asc" }],
      });

      const performers = records
        .filter((r) => r.get("performer"))
        .map((r) => ({
          id: r.id,
          initials: r.get("performer").trim(),
          name: r.get("Name") || r.get("performer").trim(),
        }));

      res.json(performers);
    } catch (err) {
      console.error("Error fetching performers:", err);
      res.status(500).json({ error: "Failed to fetch performers" });
    }
  },
);

// ── GET /api/medleys ──────────────────────────────────────────────────────────

router.get(
  "/api/medleys",
  requireAuth(["super_admin", "admin", "performer"]),
  async (req, res) => {
    try {
      const records = await fetchAll(TABLES.MEDLEYS, {
        fields: ["Name"],
        sort: [{ field: "Name", direction: "asc" }],
      });

      const medleys = records
        .filter((r) => r.get("Name"))
        .map((r) => ({ id: r.id, name: r.get("Name") }));

      res.json(medleys);
    } catch (err) {
      console.error("Error fetching medleys:", err);
      res.status(500).json({ error: "Failed to fetch medleys" });
    }
  },
);

// ── GET /api/lyrics ───────────────────────────────────────────────────────────

router.get(
  "/api/lyrics",
  requireAuth(["super_admin", "admin", "performer"]),
  async (req, res) => {
    const { medleyId, performer } = req.query;

    if (!medleyId || !performer) {
      return res.status(400).json({ error: "medleyId and performer are required" });
    }

    const mistakeField = `${performer} Mistake`;
    const notesField = `${performer} Notes`;

    try {
      const records = await fetchAll(TABLES.LYRICS, {
        fields: ["Name", "codified text", "order", "Medley", mistakeField, notesField],
      });

      const lyrics = records
        .filter((r) => {
          const medleys = r.get("Medley");
          return Array.isArray(medleys) && medleys.includes(medleyId);
        })
        .sort((a, b) => (a.get("order") || 0) - (b.get("order") || 0))
        .map((r) => ({
          id: r.id,
          line: r.get("Name") || "",
          formattedLine: formatLyricHtml(r.get("codified text") || r.get("Name") || ""),
          order: r.get("order") || 0,
          mistakes: r.get(mistakeField) || [],
          notes: r.get(notesField) || "",
        }));

      res.json(lyrics);
    } catch (err) {
      console.error("Error fetching lyrics:", err);
      res.status(500).json({ error: "Failed to fetch lyrics" });
    }
  },
);

// ── PATCH /api/lyrics ─────────────────────────────────────────────────────────

router.patch(
  "/api/lyrics",
  requireAuth(["super_admin", "admin", "performer"]),
  async (req, res) => {
    const { performer, records } = req.body;

    if (!performer || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "performer and records[] are required" });
    }

    const mistakeField = `${performer} Mistake`;
    const notesField = `${performer} Notes`;

    const updates = records.map(({ id, mistakes, notes }) => ({
      id,
      fields: {
        [mistakeField]: Array.isArray(mistakes) ? mistakes : [],
        [notesField]: notes || "",
      },
    }));

    try {
      await batchUpdate(TABLES.LYRICS, updates);
      res.json({ success: true, updated: updates.length });
    } catch (err) {
      console.error("Error updating lyrics:", err);
      res.status(500).json({ error: "Failed to update lyrics" });
    }
  },
);

module.exports = router;
