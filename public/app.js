/* ── State ─────────────────────────────────────────────────────────────────── */

const state = {
  performer: null,   // { id, initials, name }
  medley: null,      // { id, name }
  lyrics: [],        // [{ id, line, formattedLine, order, mistakes, notes }]
  dirty: new Map(),  // recordId → { mistakes, notes }
};

/* ── DOM refs ──────────────────────────────────────────────────────────────── */

const performerSelect = document.getElementById('performer-select');
const medleySelect    = document.getElementById('medley-select');
const stepMedley      = document.getElementById('step-medley');
const stepLyrics      = document.getElementById('step-lyrics');
const lyricsTbody     = document.getElementById('lyrics-tbody');
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
  if (state.medley) loadLyrics();
});

// Close any open mistake dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.mistake-dropdown')) {
    document.querySelectorAll('.mistake-panel').forEach((p) => p.classList.remove('open'));
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
  lyricsTbody.innerHTML = '';
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
    console.error(err);
  }
}

function renderLyrics(lyrics) {
  lyricsTbody.innerHTML = '';

  lyrics.forEach((lyric) => {
    const tr = document.createElement('tr');
    tr.dataset.id = lyric.id;

    // ── Lyric text cell ──
    const tdLine = document.createElement('td');
    tdLine.className = 'lyric-cell';
    tdLine.innerHTML = lyric.formattedLine || escapeHtml(lyric.line);

    // ── Mistake dropdown cell ──
    const tdMistake = document.createElement('td');
    tdMistake.className = 'mistake-cell';
    tdMistake.appendChild(buildMistakeDropdown(lyric));

    // ── Notes cell ──
    const tdNotes = document.createElement('td');
    tdNotes.className = 'notes-cell';
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Notes…';
    textarea.rows = 1;
    textarea.value = lyric.notes;
    textarea.addEventListener('input', () => markDirty(lyric.id));
    tdNotes.appendChild(textarea);

    tr.appendChild(tdLine);
    tr.appendChild(tdMistake);
    tr.appendChild(tdNotes);
    lyricsTbody.appendChild(tr);
  });
}

/** Build a custom multi-select dropdown for mistake options. */
function buildMistakeDropdown(lyric) {
  const wrap = document.createElement('div');
  wrap.className = 'mistake-dropdown';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mistake-btn';
  updateBtnLabel(btn, lyric.mistakes);

  const panel = document.createElement('div');
  panel.className = 'mistake-panel';

  window.MISTAKE_OPTIONS.forEach((option) => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = option;
    cb.checked = lyric.mistakes.includes(option);
    cb.addEventListener('change', () => {
      markDirty(lyric.id);
      updateBtnLabel(btn, getSelectedMistakes(wrap));
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + option));
    panel.appendChild(label);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.mistake-panel.open').forEach((p) => {
      if (p !== panel) p.classList.remove('open');
    });
    panel.classList.toggle('open');
  });

  wrap.appendChild(btn);
  wrap.appendChild(panel);
  return wrap;
}

function getSelectedMistakes(dropdownWrap) {
  return Array.from(dropdownWrap.querySelectorAll('input[type="checkbox"]:checked'))
    .map((cb) => cb.value);
}

function updateBtnLabel(btn, selected) {
  if (selected.length === 0) {
    btn.textContent = 'None ▾';
    btn.classList.remove('has-value');
  } else if (selected.length === 1) {
    btn.textContent = selected[0] + ' ▾';
    btn.classList.add('has-value');
  } else {
    btn.textContent = `${selected.length} selected ▾`;
    btn.classList.add('has-value');
  }
}

function markDirty(recordId) {
  const tr = lyricsTbody.querySelector(`[data-id="${recordId}"]`);
  const mistakes = getSelectedMistakes(tr.querySelector('.mistake-dropdown'));
  const notes = tr.querySelector('textarea').value;
  state.dirty.set(recordId, { mistakes, notes });
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
