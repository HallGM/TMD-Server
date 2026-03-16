require('dotenv').config();
const express = require('express');
const Airtable = require('airtable');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

const TABLES = {
  PERFORMERS: 'tblDLB60lKGmK9Lv5',
  MEDLEYS: 'tblOfE65slr7lFwxk',
  LYRICS: 'tblzrwnA7rhVDF0Yd',
};

const MISTAKE_OPTIONS = [
  'Melody 🎵',
  'Rhythm 🥁',
  'Delivery 🎭',
  'Lyrics 📚',
  'Entry 🚦',
  'Drums 🪘',
  'Guitar 🎸',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all pages from an Airtable table using the given select options. */
function fetchAll(tableId, selectOptions = {}) {
  return new Promise((resolve, reject) => {
    const records = [];
    base(tableId)
      .select(selectOptions)
      .eachPage(
        (page, fetchNext) => {
          records.push(...page);
          fetchNext();
        },
        (err) => {
          if (err) reject(err);
          else resolve(records);
        }
      );
  });
}

/** Batch-update records in groups of 10 (Airtable limit). */
async function batchUpdate(tableId, updates) {
  const results = [];
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const updated = await base(tableId).update(chunk);
    results.push(...updated);
  }
  return results;
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.render('index', { mistakeOptions: MISTAKE_OPTIONS });
});

/** GET /api/performers — returns [{id, initials, name}] */
app.get('/api/performers', async (req, res) => {
  try {
    const records = await fetchAll(TABLES.PERFORMERS, {
      fields: ['performer', 'Name'],
      sort: [{ field: 'Name', direction: 'asc' }],
    });

    const performers = records
      .filter((r) => r.get('performer'))
      .map((r) => ({
        id: r.id,
        initials: r.get('performer').trim(),
        name: r.get('Name') || r.get('performer').trim(),
      }));

    res.json(performers);
  } catch (err) {
    console.error('Error fetching performers:', err);
    res.status(500).json({ error: 'Failed to fetch performers' });
  }
});

/** GET /api/medleys — returns [{id, name}] */
app.get('/api/medleys', async (req, res) => {
  try {
    const records = await fetchAll(TABLES.MEDLEYS, {
      fields: ['Name'],
      sort: [{ field: 'Name', direction: 'asc' }],
    });

    const medleys = records
      .filter((r) => r.get('Name'))
      .map((r) => ({ id: r.id, name: r.get('Name') }));

    res.json(medleys);
  } catch (err) {
    console.error('Error fetching medleys:', err);
    res.status(500).json({ error: 'Failed to fetch medleys' });
  }
});

/**
 * GET /api/lyrics?medleyId=recXXX&performer=GH
 * Returns lyrics linked to the given medley, sorted by order,
 * with existing mistake/notes values for the given performer pre-loaded.
 */
app.get('/api/lyrics', async (req, res) => {
  const { medleyId, performer } = req.query;

  if (!medleyId || !performer) {
    return res.status(400).json({ error: 'medleyId and performer are required' });
  }

  const mistakeField = `${performer} Mistake`;
  const notesField = `${performer} Notes`;

  try {
    // Airtable filterByFormula can't filter by linked record ID directly,
    // so we fetch all and filter in JS. The Lyrics table is bounded in size.
    const records = await fetchAll(TABLES.LYRICS, {
      fields: ['Name', 'order', 'Medley', mistakeField, notesField],
    });

    const lyrics = records
      .filter((r) => {
        const medleys = r.get('Medley');
        return Array.isArray(medleys) && medleys.includes(medleyId);
      })
      .sort((a, b) => (a.get('order') || 0) - (b.get('order') || 0))
      .map((r) => ({
        id: r.id,
        line: r.get('Name') || '',
        order: r.get('order') || 0,
        mistakes: r.get(mistakeField) || [],
        notes: r.get(notesField) || '',
      }));

    res.json(lyrics);
  } catch (err) {
    console.error('Error fetching lyrics:', err);
    res.status(500).json({ error: 'Failed to fetch lyrics' });
  }
});

/**
 * PATCH /api/lyrics
 * Body: { performer: "GH", records: [{id, mistakes: [...], notes: "..."}] }
 * Updates {performer} Mistake and {performer} Notes for each record.
 */
app.patch('/api/lyrics', async (req, res) => {
  const { performer, records } = req.body;

  if (!performer || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'performer and records[] are required' });
  }

  const mistakeField = `${performer} Mistake`;
  const notesField = `${performer} Notes`;

  const updates = records.map(({ id, mistakes, notes }) => ({
    id,
    fields: {
      [mistakeField]: Array.isArray(mistakes) ? mistakes : [],
      [notesField]: notes || '',
    },
  }));

  try {
    await batchUpdate(TABLES.LYRICS, updates);
    res.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error('Error updating lyrics:', err);
    res.status(500).json({ error: 'Failed to update lyrics' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lyric Mistakes app running on http://localhost:${PORT}`);
});
