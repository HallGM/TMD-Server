/* ── State ─────────────────────────────────────────────────────────────────── */

const state = {
  performer: null,   // { id, initials, name }
  medley: null,      // { id, name }
  lyrics: [],        // [{ id, line, order, mistakes, notes }]
  dirty: new Map(),  // recordId → { mistakes, notes }
};

/* ── DOM refs ──────────────────────────────────────────────────────────────── */

const performerSelect = document.getElementById('performer-select');
const medleySelect    = document.getElementById('medley-select');
const stepMedley      = document.getElementById('step-medley');
const stepLyrics      = document.getElementById('step-lyrics');
const lyricsList      = document.getElementById('lyrics-list');
const medleyTitle     = document.getElementById('medley-title');
const lyricsCount     = document.getElementById('lyrics-count');
const lyricsLoading   = document.getElementById('lyrics-loading');
const lyricsForm      = document.getElementById('lyrics-form');
const saveBtn         = document.getElementById('save-btn');
const saveStatus      = document.getElementById('save-status');

/* ── Bootstrap ─────────────────────────────────────────────────────────────── */

(async function init() {
  const performers = await apiFetch('/api/performers');
  performerSelect.innerHTML = '<option value="" disabled selected>Select your name…</option>';
  performers.forEach(({ id, initials, name }) => {
    const opt = document.createElement('option');
    opt.value = initials;
    opt.dataset.id = id;
    opt.textContent = name;
    performerSelect.appendChild(opt);
  });

  // Also load medleys in parallel (hidden until needed)
  const medleys = await apiFetch('/api/medleys');
  medleySelect.innerHTML = '<option value="" disabled selected>Select a medley…</option>';
  medleys.forEach(({ id, name }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    medleySelect.appendChild(opt);
  });
})();

/* ── Event Listeners ───────────────────────────────────────────────────────── */

performerSelect.addEventListener('change', () => {
  const opt = performerSelect.selectedOptions[0];
  state.performer = { id: opt.dataset.id, initials: opt.value, name: opt.textContent };
  stepMedley.hidden = false;
  // Reset lyrics if performer changes mid-session
  if (state.medley) {
    loadLyrics();
  }
});

medleySelect.addEventListener('change', () => {
  const opt = medleySelect.selectedOptions[0];
  state.medley = { id: opt.value, name: opt.textContent };
  loadLyrics();
});

lyricsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveAnnotations();
});

/* ── Core Functions ────────────────────────────────────────────────────────── */

async function loadLyrics() {
  if (!state.performer || !state.medley) return;

  medleyTitle.textContent = state.medley.name;
  stepLyrics.hidden = false;
  lyricsLoading.hidden = false;
  lyricsList.innerHTML = '';
  lyricsCount.textContent = '';
  state.dirty.clear();
  setSaveStatus('');

  try {
    const lyrics = await apiFetch(
      `/api/lyrics?medleyId=${encodeURIComponent(state.medley.id)}&performer=${encodeURIComponent(state.performer.initials)}`
    );
    state.lyrics = lyrics;
    lyricsLoading.hidden = true;

    if (lyrics.length === 0) {
      lyricsCount.textContent = 'No lyrics found for this medley.';
      return;
    }

    lyricsCount.textContent = `${lyrics.length} line${lyrics.length !== 1 ? 's' : ''}`;
    renderLyrics(lyrics);
  } catch (err) {
    lyricsLoading.hidden = true;
    lyricsCount.textContent = 'Error loading lyrics. Please try again.';
  }
}

function renderLyrics(lyrics) {
  lyricsList.innerHTML = '';

  lyrics.forEach((lyric) => {
    const row = document.createElement('article');
    row.className = 'lyric-row';
    row.dataset.id = lyric.id;

    // Line text
    const lineEl = document.createElement('p');
    lineEl.className = 'lyric-line';
    lineEl.textContent = lyric.line;

    // Mistake checkboxes
    const mistakesWrap = document.createElement('div');
    mistakesWrap.className = 'mistake-options';

    window.MISTAKE_OPTIONS.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'mistake-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option;
      checkbox.checked = lyric.mistakes.includes(option);
      checkbox.addEventListener('change', () => markDirty(lyric.id));

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + option));
      mistakesWrap.appendChild(label);
    });

    // Notes textarea
    const notesLabel = document.createElement('label');
    notesLabel.className = 'notes-label';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Notes (optional)';
    textarea.rows = 2;
    textarea.value = lyric.notes;
    textarea.addEventListener('input', () => markDirty(lyric.id));

    notesLabel.appendChild(textarea);

    row.appendChild(lineEl);
    row.appendChild(mistakesWrap);
    row.appendChild(notesLabel);
    lyricsList.appendChild(row);
  });
}

function markDirty(recordId) {
  const row = lyricsList.querySelector(`[data-id="${recordId}"]`);
  const checkboxes = row.querySelectorAll('input[type="checkbox"]');
  const textarea = row.querySelector('textarea');

  const mistakes = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  state.dirty.set(recordId, { mistakes, notes: textarea.value });
  setSaveStatus('');
}

async function saveAnnotations() {
  if (state.dirty.size === 0) {
    setSaveStatus('No changes to save.');
    return;
  }

  saveBtn.setAttribute('aria-busy', 'true');
  saveBtn.disabled = true;
  setSaveStatus('');

  const records = Array.from(state.dirty.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));

  try {
    const result = await apiFetch('/api/lyrics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performer: state.performer.initials, records }),
    });

    state.dirty.clear();
    setSaveStatus(`✓ Saved ${result.updated} record${result.updated !== 1 ? 's' : ''}`);
  } catch (err) {
    setSaveStatus('✗ Save failed. Please try again.');
  } finally {
    saveBtn.removeAttribute('aria-busy');
    saveBtn.disabled = false;
  }
}

/* ── Utilities ─────────────────────────────────────────────────────────────── */

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function setSaveStatus(msg) {
  saveStatus.textContent = msg;
}
