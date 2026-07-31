/* ========================================================
   AI Cinematic Story & Visual Director
   OpenAI ChatGPT Integration
   Supabase — Project Persistence
   ======================================================== */

// ── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  apiKey:  localStorage.getItem('openai_api_key') || '',
  modelId: 'gpt-4o-mini',
};

// ── STATE ────────────────────────────────────────────────
const STATE = {
  idea:        '',
  characters:  null,
  scenes:      null,
  camera:      null,
  visual:      null,
  dialogue:    null,
  dbProjectId: null,   // UUID returned from Supabase after save
  currentTab:  'idea',
  generating:  false,
};

// ── TABS CONFIG ──────────────────────────────────────────
const TABS = [
  { id: 'idea',       label: 'Idea',        icon: '💡' },
  { id: 'characters', label: 'Characters',  icon: '👤' },
  { id: 'scenes',     label: 'Story',       icon: '🎬' },
  { id: 'camera',     label: 'Camera',      icon: '🎥' },
  { id: 'visual',     label: 'Visual Style',icon: '🎨' },
  { id: 'dialogue',   label: 'Dialogue',    icon: '💬' },
  { id: 'plan',       label: 'Final Plan',  icon: '📋' },
  { id: 'history',    label: 'History',     icon: '🗂' },
];

const EXAMPLES = [
  'A college student discovers a hidden talent and tries to achieve his dream.',
  'An elderly artist loses her sight but finds a new way to create.',
  'A young chef must save her family restaurant from bankruptcy.',
  'A rookie detective solves his first case in a city full of secrets.',
  'Two estranged siblings reconnect during a cross-country road trip.',
];

// ── DOM BOOTSTRAP ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);

function boot() {
  document.getElementById('app').innerHTML = buildShell();
  attachEvents();
  renderTab('idea');
}

// ── SUPABASE DB HELPERS ──────────────────────────────────
async function dbSave() {
  try {
    const res = await fetch('/api/db', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        project: {
          idea:       STATE.idea,
          characters: STATE.characters,
          scenes:     STATE.scenes,
          camera:     STATE.camera,
          visual:     STATE.visual,
          dialogue:   STATE.dialogue,
        },
      }),
    });
    if (!res.ok) return;           // silent fail — DB is optional
    const data = await res.json();
    STATE.dbProjectId = data.id;
  } catch (_) { /* silent */ }
}

async function dbList() {
  const res = await fetch('/api/db', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' }),
  });
  if (!res.ok) throw new Error('Failed to load history from database.');
  return res.json();
}

async function dbLoad(projectId) {
  const res = await fetch('/api/db', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'load', projectId }),
  });
  if (!res.ok) throw new Error('Failed to load project from database.');
  return res.json();
}

async function dbDelete(projectId) {
  const res = await fetch('/api/db', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', projectId }),
  });
  if (!res.ok) throw new Error('Failed to delete project.');
  return res.json();
}

function buildShell() {
  return `
    ${buildHeader()}
    ${buildNav()}
    <main id="main">
      ${TABS.map(t => `<div class="panel" id="panel-${t.id}" role="tabpanel"></div>`).join('')}
    </main>
    ${buildConfigModal()}
    <footer id="footer">Made with IBM Bob &nbsp;·&nbsp; Powered by ChatGPT (gpt-4o-mini)</footer>
  `;
}

function buildHeader() {
  return `
    <header id="header">
      <div class="header-brand">
        <div class="brand-icon">🎬</div>
        <div>
          <div class="brand-name">Cinematic Director</div>
          <div class="brand-sub">AI Story & Visual Planner</div>
        </div>
      </div>
      <button class="header-config-btn" id="btn-config">⚙ AI Config</button>
    </header>`;
}

function buildNav() {
  return `
    <nav id="nav">
      ${TABS.map((t, i) => `
        <div class="nav-tab" id="tab-${t.id}" data-tab="${t.id}">
          <span class="tab-num">${i + 1}</span>${t.icon} ${t.label}
        </div>`).join('')}
    </nav>`;
}

function buildConfigModal() {
  const keyStatus = CONFIG.apiKey
    ? `<div style="font-size:12px;color:#2a9d4e;margin-top:4px;">✓ Key saved (${CONFIG.apiKey.slice(0,6)}…${CONFIG.apiKey.slice(-4)})</div>`
    : `<div style="font-size:12px;color:#e05252;margin-top:4px;">⚠ No key saved yet</div>`;
  return `
    <div id="config-modal" role="dialog" aria-modal="true">
      <div class="modal-box">
        <div class="modal-title">🔧 ChatGPT Configuration</div>
        <div class="modal-sub">
          Enter your OpenAI API key. It is stored locally in your browser only.
          Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--accent)">platform.openai.com/api-keys</a>.
        </div>
        <div class="form-group">
          <label class="form-label" for="cfg-apikey">OpenAI API Key</label>
          <input class="form-input" type="password" id="cfg-apikey" placeholder="sk-..." value="${CONFIG.apiKey}" />
          ${keyStatus}
        </div>
        <div id="cfg-save-msg" style="font-size:12px;min-height:18px;"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" id="btn-modal-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="btn-modal-save">Save & Close</button>
        </div>
      </div>
    </div>`;
}

// ── EVENTS ───────────────────────────────────────────────
function attachEvents() {
  // Config modal open button
  document.getElementById('btn-config').addEventListener('click', () =>
    document.getElementById('config-modal').classList.add('open'));
  attachConfigModalEvents();

  // Nav tabs
  document.getElementById('nav').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    const id = tab.dataset.tab;
    if (tab.classList.contains('locked')) return;
    renderTab(id);
  });
}

function saveConfig() {
  const key = document.getElementById('cfg-apikey').value.trim();
  if (!key) {
    document.getElementById('cfg-save-msg').innerHTML =
      '<span style="color:#e05252">⚠ Please paste a valid API key first.</span>';
    return;
  }
  CONFIG.apiKey = key;
  localStorage.setItem('openai_api_key', key);
  document.getElementById('config-modal').classList.remove('open');
  // Rebuild modal so key-status refreshes next time it opens
  const existing = document.getElementById('config-modal');
  existing.outerHTML = buildConfigModal();
  attachConfigModalEvents();
}

function attachConfigModalEvents() {
  document.getElementById('btn-modal-cancel').addEventListener('click', () =>
    document.getElementById('config-modal').classList.remove('open'));
  document.getElementById('btn-modal-save').addEventListener('click', saveConfig);
  document.getElementById('config-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
}

// ── TAB RENDERER ─────────────────────────────────────────
function renderTab(id) {
  STATE.currentTab = id;
  TABS.forEach(t => {
    const tab   = document.getElementById(`tab-${t.id}`);
    const panel = document.getElementById(`panel-${t.id}`);
    if (tab) tab.classList.toggle('active', t.id === id);
    if (panel) panel.classList.toggle('active', t.id === id);
  });
  updateTabStates();

  const panel = document.getElementById(`panel-${id}`);
  switch (id) {
    case 'idea':       renderIdeaPanel(panel);       break;
    case 'characters': renderCharactersPanel(panel); break;
    case 'scenes':     renderScenesPanel(panel);     break;
    case 'camera':     renderCameraPanel(panel);     break;
    case 'visual':     renderVisualPanel(panel);     break;
    case 'dialogue':   renderDialoguePanel(panel);   break;
    case 'plan':       renderFinalPlanPanel(panel);  break;
    case 'history':    renderHistoryPanel(panel);    break;
  }
}

function updateTabStates() {
  const unlocked = ['idea', 'history'];   // history always accessible
  if (STATE.characters) unlocked.push('characters');
  if (STATE.scenes)     unlocked.push('scenes');
  if (STATE.camera)     unlocked.push('camera');
  if (STATE.visual)     unlocked.push('visual');
  if (STATE.dialogue)   unlocked.push('dialogue');
  if (STATE.dialogue)   unlocked.push('plan');

  TABS.forEach(t => {
    const tab = document.getElementById(`tab-${t.id}`);
    if (!tab) return;
    const neverLock = ['idea', 'history'];
    const isDone    = unlocked.includes(t.id) && !neverLock.includes(t.id);
    const isLocked  = !unlocked.includes(t.id);
    tab.classList.toggle('locked', isLocked);
    tab.classList.toggle('done',   isDone);
  });
}

// ── IDEA PANEL ───────────────────────────────────────────
function renderIdeaPanel(panel) {
  panel.innerHTML = `
    <div class="clapboard">
      <div class="clap-icon">🎬</div>
      <div class="clap-title">AI Cinematic Story &amp; Visual Director</div>
      <div class="clap-sub">
        Transform your story idea into a professional cinematic production plan —
        with character development, scene design, camera direction, visual style, and dialogue — powered by ChatGPT.
      </div>
      <div class="step-pills">
        ${TABS.map(t => `<div class="step-pill ${t.id === 'idea' ? 'active' : ''}">${t.icon} ${t.label}</div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot"></span>Your Story Idea</div>
      <div class="idea-box">
        <div class="idea-label">Describe your story idea</div>
        <textarea id="idea-input" placeholder="E.g. A college student discovers a hidden talent and tries to achieve his dream…" rows="4">${STATE.idea}</textarea>
        <div class="idea-label" style="margin-top:14px;">Quick examples — click to use:</div>
        <div class="example-chips">
          ${EXAMPLES.map(e => `<div class="chip" data-example="${e}">${e}</div>`).join('')}
        </div>
      </div>
      <div class="generate-section">
        <button class="btn btn-primary btn-lg" id="btn-generate">
          <span>✨</span> Generate Cinematic Plan
        </button>
        <span class="status-msg" id="generate-status"></span>
      </div>
      <div class="progress-bar-wrap" id="progress-wrap" style="display:none">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <div id="generate-error"></div>
    </div>

    <div class="card" style="background:var(--surface2);">
      <div class="card-title"><span class="dot" style="background:var(--gold)"></span>What the AI will create</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:8px;">
        ${[
          ['👤','Character Profiles','Names, personalities, goals, arcs'],
          ['🎬','Scene Design','Locations, atmosphere, actions'],
          ['🎥','Camera Direction','Shot types with reasoning'],
          ['🎨','Visual Style','Lighting, color, composition'],
          ['💬','Dialogue','Character-driven natural lines'],
          ['📋','Production Plan','Complete cinematic blueprint'],
        ].map(([icon,title,desc]) => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;">
            <div style="font-size:1.3rem;margin-bottom:6px;">${icon}</div>
            <div style="font-size:0.85rem;font-weight:700;margin-bottom:3px;">${title}</div>
            <div style="font-size:0.78rem;color:var(--muted);">${desc}</div>
          </div>`).join('')}
      </div>
    </div>
  `;

  // Example chips
  panel.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      document.getElementById('idea-input').value = c.dataset.example;
      STATE.idea = c.dataset.example;
    });
  });

  // Generate
  document.getElementById('btn-generate').addEventListener('click', handleGenerate);
}

// ── MAIN GENERATION PIPELINE ─────────────────────────────
async function handleGenerate() {
  const idea = document.getElementById('idea-input').value.trim();
  if (!idea) { showError('generate-error', 'Please enter a story idea first.'); return; }
  if (!CONFIG.apiKey) {
    showError('generate-error', 'OpenAI API Key is required. Click ⚙ AI Config to add it.');
    return;
  }
  STATE.idea = idea;
  STATE.generating = true;
  clearError('generate-error');

  const statusEl  = document.getElementById('generate-status');
  const progressEl = document.getElementById('progress-bar');
  const wrapEl    = document.getElementById('progress-wrap');
  const btnEl     = document.getElementById('btn-generate');

  btnEl.disabled = true;
  wrapEl.style.display = 'block';

  const steps = [
    { label: 'Connecting to ChatGPT…',               pct: 8,  fn: null },
    { label: 'Developing characters…',               pct: 22, fn: () => generateCharacters(idea) },
    { label: 'Designing cinematic scenes…',          pct: 38, fn: () => generateScenes(idea) },
    { label: 'Planning camera directions…',          pct: 54, fn: () => generateCamera(idea) },
    { label: 'Crafting visual style…',               pct: 70, fn: () => generateVisualStyle(idea) },
    { label: 'Writing dialogue…',                    pct: 85, fn: () => generateDialogue(idea) },
    { label: 'Saving to database…',                  pct: 95, fn: () => dbSave() },
    { label: 'Finalising cinematic plan…',           pct: 100, fn: null },
  ];

  try {
    for (const step of steps) {
      setStatus(statusEl, progressEl, step.label, step.pct);
      if (step.fn) await step.fn();
    }
    STATE.generating = false;
    updateTabStates();
    setStatus(statusEl, progressEl, '', 100);
    statusEl.innerHTML = '<span style="color:var(--success)">✓ Cinematic plan ready!</span>';
    btnEl.disabled = false;
    setTimeout(() => renderTab('characters'), 700);
  } catch (err) {
    STATE.generating = false;
    btnEl.disabled = false;
    wrapEl.style.display = 'none';
    statusEl.innerHTML = '';
    showError('generate-error', `Error: ${err.message}`);
  }
}

function setStatus(statusEl, progressEl, msg, pct) {
  statusEl.innerHTML = msg
    ? `<div class="spinner"></div><span>${msg}</span>`
    : '';
  progressEl.style.width = pct + '%';
}

// ── CHATGPT INFERENCE — via /api/generate serverless proxy ──
async function callAI(prompt, maxTokens = 1800) {
  const res = await fetch('/api/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      maxTokens,
      apiKey:  CONFIG.apiKey,
      modelId: CONFIG.modelId,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error (${res.status})`);
  }
  const data = await res.json();
  return (data.generated_text || '').trim();
}

// ── AI GENERATION FUNCTIONS ──────────────────────────────
async function generateCharacters(idea) {
  const prompt = `You are a professional screenwriter and character development expert.

Story idea: "${idea}"

Create detailed character profiles for this story. Generate exactly 3 characters: protagonist, supporting character, and antagonist/mentor.

For each character, provide the following fields in this EXACT format:

CHARACTER:
Name: [name]
Age: [age]
Role: [Protagonist / Supporting / Antagonist / Mentor]
Personality: [2-3 sentence personality description]
Background: [2-3 sentence background]
Goal: [main goal in the story]
Strengths: [3 strengths, comma-separated]
Weaknesses: [3 weaknesses, comma-separated]
Motivation: [core motivation]
Conflict: [internal conflict they face]
Arc: [character development from beginning to end]
END_CHARACTER

Generate all 3 characters now:`;

  const raw = await callAI(prompt, 1600);
  STATE.characters = parseCharacters(raw);
}

async function generateScenes(idea) {
  const charNames = STATE.characters
    ? STATE.characters.map(c => c.Name).join(', ')
    : 'main characters';

  const prompt = `You are a professional film director and screenwriter.

Story idea: "${idea}"
Characters: ${charNames}

Design exactly 5 cinematic scenes for this story — covering beginning, rising action, midpoint, climax, and resolution.

For each scene use this EXACT format:

SCENE:
Number: [1-5]
Title: [scene title]
Location: [specific location]
Time: [time of day and setting]
Atmosphere: [emotional atmosphere]
Characters: [characters present]
Action: [what happens — 2-3 sentences]
Emotion: [dominant emotion in this scene]
Visual: [visual description of how it looks — 2 sentences]
Purpose: [story purpose — why this scene matters]
END_SCENE

Generate all 5 scenes now:`;

  const raw = await callAI(prompt, 1800);
  STATE.scenes = parseScenes(raw);
}

async function generateCamera(idea) {
  const sceneList = STATE.scenes
    ? STATE.scenes.map(s => `Scene ${s.Number}: ${s.Title} — Emotion: ${s.Emotion}`).join('\n')
    : 'General cinematic story';

  const prompt = `You are a professional cinematographer and director of photography.

Story idea: "${idea}"
Scenes:
${sceneList}

For each scene, recommend specific camera shots. For EACH scene provide 2-3 shots.

Use this EXACT format:

SHOT:
Scene: [scene number and title]
Type: [Wide Shot / Medium Shot / Close-Up / Extreme Close-Up / Over-the-Shoulder / Low Angle / High Angle / Tracking Shot / Dolly-In / Dolly-Out / POV Shot]
Description: [what the shot shows and how it is framed]
Reason: [why this specific shot fits the character emotion and story moment — be specific]
END_SHOT

Generate camera shots for all 5 scenes now:`;

  const raw = await callAI(prompt, 2000);
  STATE.camera = parseShots(raw);
}

async function generateVisualStyle(idea) {
  const sceneList = STATE.scenes
    ? STATE.scenes.map(s => `Scene ${s.Number}: ${s.Title} — ${s.Atmosphere}`).join('\n')
    : '';

  const prompt = `You are a professional film visual designer and cinematographer.

Story idea: "${idea}"
Scenes:
${sceneList}

For each scene, define the complete visual style. Use this EXACT format:

VISUAL:
Scene: [scene number and title]
Lighting: [lighting style — e.g. soft natural, high-contrast, low-key, neon, golden hour]
Composition: [framing approach — rule of thirds, symmetry, negative space, etc.]
CameraMovement: [static, slow pan, handheld, steady track, crane up, etc.]
DepthOfField: [shallow, deep, rack focus description]
Background: [background elements and their meaning]
ColorMood: [color palette — warm tones, cold blues, desaturated, high saturation, etc.]
Contrast: [visual contrast strategy — light vs shadow, color vs grey, etc.]
Mood: [overall mood the visuals create]
END_VISUAL

Generate visual styles for all 5 scenes now:`;

  const raw = await callAI(prompt, 1800);
  STATE.visual = parseVisual(raw);
}

async function generateDialogue(idea) {
  const chars = STATE.characters
    ? STATE.characters.map(c => `${c.Name} (${c.Role}): ${c.Personality?.slice(0, 80)}`).join('\n')
    : '';
  const sceneList = STATE.scenes
    ? STATE.scenes.map(s => `Scene ${s.Number}: ${s.Title} — Emotion: ${s.Emotion}`).join('\n')
    : '';

  const prompt = `You are a professional screenwriter specializing in character-driven dialogue.

Story idea: "${idea}"
Characters:
${chars}
Scenes:
${sceneList}

Write natural, emotional dialogue for 3 key scenes (scenes 1, 3, and 5).

For each scene, write 3-4 lines of dialogue. Use this EXACT format:

DIALOGUE:
Scene: [scene number and title]
Line:
  Character: [character name]
  Text: [dialogue line — natural and character-specific]
  Note: [acting direction or emotional note]
Line:
  Character: [character name]
  Text: [dialogue line]
  Note: [acting note]
Line:
  Character: [character name]
  Text: [dialogue line]
  Note: [acting note]
END_DIALOGUE

Write dialogue for scenes 1, 3, and 5 now:`;

  const raw = await callAI(prompt, 1600);
  STATE.dialogue = parseDialogue(raw);
}

// ── PARSERS ──────────────────────────────────────────────
function parseCharacters(raw) {
  const blocks = raw.split(/CHARACTER:|END_CHARACTER/g).filter((_, i) => i % 2 === 1);
  if (!blocks.length) return parseFallbackCharacters(raw);
  return blocks.map(block => parseKeyVal(block,
    ['Name','Age','Role','Personality','Background','Goal','Strengths','Weaknesses','Motivation','Conflict','Arc']
  )).filter(c => c.Name);
}

function parseFallbackCharacters(raw) {
  // If structured parse fails, create one fallback character
  return [{
    Name: 'Main Character', Age: '22', Role: 'Protagonist',
    Personality: raw.slice(0, 200),
    Background: 'Background to be developed.',
    Goal: 'Achieve the main story objective.',
    Strengths: 'Determined, Creative, Resilient',
    Weaknesses: 'Self-doubt, Impatient, Isolated',
    Motivation: 'Personal growth and achievement.',
    Conflict: 'Internal battle with self-doubt.',
    Arc: 'Grows from uncertainty to confidence.',
  }];
}

function parseScenes(raw) {
  const blocks = raw.split(/SCENE:|END_SCENE/g).filter((_, i) => i % 2 === 1);
  if (!blocks.length) return [];
  return blocks.map(block => parseKeyVal(block,
    ['Number','Title','Location','Time','Atmosphere','Characters','Action','Emotion','Visual','Purpose']
  )).filter(s => s.Number);
}

function parseShots(raw) {
  const blocks = raw.split(/SHOT:|END_SHOT/g).filter((_, i) => i % 2 === 1);
  if (!blocks.length) return [];
  return blocks.map(block => parseKeyVal(block, ['Scene','Type','Description','Reason'])).filter(s => s.Type);
}

function parseVisual(raw) {
  const blocks = raw.split(/VISUAL:|END_VISUAL/g).filter((_, i) => i % 2 === 1);
  if (!blocks.length) return [];
  return blocks.map(block => parseKeyVal(block,
    ['Scene','Lighting','Composition','CameraMovement','DepthOfField','Background','ColorMood','Contrast','Mood']
  )).filter(v => v.Scene);
}

function parseDialogue(raw) {
  const blocks = raw.split(/DIALOGUE:|END_DIALOGUE/g).filter((_, i) => i % 2 === 1);
  if (!blocks.length) return [];
  return blocks.map(block => {
    const sceneMatch = block.match(/Scene:\s*([^\n]+)/i);
    const scene = sceneMatch ? sceneMatch[1].trim() : 'Unknown Scene';
    const lineBlocks = block.split(/Line:/g).slice(1);
    const lines = lineBlocks.map(lb => ({
      Character: extractField(lb, 'Character'),
      Text:      extractField(lb, 'Text'),
      Note:      extractField(lb, 'Note'),
    })).filter(l => l.Text);
    return { scene, lines };
  }).filter(d => d.lines.length);
}

function parseKeyVal(block, fields) {
  const obj = {};
  fields.forEach(field => {
    obj[field] = extractField(block, field);
  });
  return obj;
}

function extractField(text, field) {
  const regex = new RegExp(`${field}:\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

// ── RENDER PANELS ────────────────────────────────────────
function renderCharactersPanel(panel) {
  if (!STATE.characters || !STATE.characters.length) {
    panel.innerHTML = emptyState('👤', 'No characters yet', 'Generate your cinematic plan from the Idea tab first.');
    return;
  }
  panel.innerHTML = `
    <div class="page-title">👤 Character Development</div>
    <div class="page-sub">Detailed profiles of your story's characters — built for depth and cinematic purpose.</div>
    <div class="char-grid">
      ${STATE.characters.map(c => buildCharCard(c)).join('')}
    </div>
  `;
}

function buildCharCard(c) {
  const initials = (c.Name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const fields = [
    ['Age',         c.Age],
    ['Personality', c.Personality],
    ['Background',  c.Background],
    ['Goal',        c.Goal],
    ['Strengths',   c.Strengths],
    ['Weaknesses',  c.Weaknesses],
    ['Motivation',  c.Motivation],
    ['Conflict',    c.Conflict],
    ['Character Arc', c.Arc],
  ].filter(([, v]) => v);

  return `
    <div class="char-card">
      <div class="char-avatar">${initials}</div>
      <div class="char-name">${esc(c.Name || 'Unknown')}</div>
      <div class="char-role">${esc(c.Role || 'Character')}</div>
      ${fields.map(([k, v]) => `
        <div class="char-field">
          <div class="char-field-label">${k}</div>
          <div class="char-field-val">${esc(v)}</div>
        </div>`).join('')}
    </div>`;
}

function renderScenesPanel(panel) {
  if (!STATE.scenes || !STATE.scenes.length) {
    panel.innerHTML = emptyState('🎬', 'No scenes yet', 'Generate your cinematic plan from the Idea tab first.');
    return;
  }
  panel.innerHTML = `
    <div class="page-title">🎬 Cinematic Scene Design</div>
    <div class="page-sub">Five-act structure — each scene crafted for location, atmosphere, emotion and story purpose.</div>
    <div class="scene-list">
      ${STATE.scenes.map(s => buildSceneCard(s)).join('')}
    </div>
  `;
}

function buildSceneCard(s) {
  return `
    <div class="scene-card">
      <div class="scene-header">
        <span class="scene-num">Scene ${esc(s.Number)}</span>
        <span class="scene-title">${esc(s.Title || '')}</span>
      </div>
      <div class="scene-body">
        <div class="scene-meta">
          ${s.Location ? `<span class="scene-tag">📍 ${esc(s.Location)}</span>` : ''}
          ${s.Time     ? `<span class="scene-tag time">🕐 ${esc(s.Time)}</span>` : ''}
          ${s.Emotion  ? `<span class="scene-tag mood">💭 ${esc(s.Emotion)}</span>` : ''}
        </div>
        ${s.Atmosphere ? `<div class="scene-section-title">Atmosphere</div><div class="scene-text">${esc(s.Atmosphere)}</div>` : ''}
        ${s.Characters ? `<div class="scene-section-title">Characters Present</div><div class="scene-text">${esc(s.Characters)}</div>` : ''}
        ${s.Action     ? `<div class="scene-section-title">Action</div><div class="scene-text">${esc(s.Action)}</div>` : ''}
        ${s.Visual     ? `<div class="scene-section-title">Visual Description</div><div class="scene-text">${esc(s.Visual)}</div>` : ''}
        ${s.Purpose    ? `<div class="scene-section-title">Story Purpose</div><div class="scene-text" style="color:var(--gold)">${esc(s.Purpose)}</div>` : ''}
      </div>
    </div>`;
}

function renderCameraPanel(panel) {
  if (!STATE.camera || !STATE.camera.length) {
    panel.innerHTML = emptyState('🎥', 'No camera directions yet', 'Generate your cinematic plan from the Idea tab first.');
    return;
  }

  // Group by scene
  const grouped = {};
  STATE.camera.forEach(shot => {
    const k = shot.Scene || 'General';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(shot);
  });

  const shotTypeClass = type => {
    const t = (type || '').toLowerCase();
    if (t.includes('wide'))     return 'wide';
    if (t.includes('medium'))   return 'medium';
    if (t.includes('close-up') || t.includes('close up')) return 'close';
    if (t.includes('extreme'))  return 'extreme';
    if (t.includes('pov'))      return 'pov';
    if (t.includes('angle'))    return 'angle';
    return 'movement';
  };

  panel.innerHTML = `
    <div class="page-title">🎥 Professional Camera Direction</div>
    <div class="page-sub">Every shot is selected for a specific cinematic reason — not randomly. Each angle serves the story emotion.</div>
    ${Object.entries(grouped).map(([scene, shots]) => `
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--gold)"></span>${esc(scene)}</div>
        <div class="shot-list">
          ${shots.map(shot => `
            <div class="shot-block ${shotTypeClass(shot.Type)}">
              <div class="shot-type">${esc(shot.Type || 'Shot')}</div>
              <div class="shot-desc">${esc(shot.Description || '')}</div>
              ${shot.Reason ? `<div class="shot-why">Why this shot: ${esc(shot.Reason)}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`).join('')}
  `;
}

function renderVisualPanel(panel) {
  if (!STATE.visual || !STATE.visual.length) {
    panel.innerHTML = emptyState('🎨', 'No visual style yet', 'Generate your cinematic plan from the Idea tab first.');
    return;
  }

  const visualIcons = {
    Lighting:        ['💡', 'Lighting Style'],
    Composition:     ['⬛', 'Composition'],
    CameraMovement:  ['🎥', 'Camera Movement'],
    DepthOfField:    ['🔍', 'Depth of Field'],
    Background:      ['🏞', 'Background Elements'],
    ColorMood:       ['🎨', 'Color Mood'],
    Contrast:        ['◐', 'Visual Contrast'],
    Mood:            ['🌡', 'Overall Mood'],
  };

  panel.innerHTML = `
    <div class="page-title">🎨 Cinematic Visual Style</div>
    <div class="page-sub">A professional visual language for each scene — lighting, color, movement, and composition working together.</div>
    ${STATE.visual.map(v => `
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--accent2)"></span>${esc(v.Scene || '')}</div>
        <div class="visual-grid">
          ${Object.entries(visualIcons).map(([key, [icon, label]]) => v[key] ? `
            <div class="visual-item">
              <div class="visual-item-icon">${icon}</div>
              <div class="visual-item-label">${label}</div>
              <div class="visual-item-val">${esc(v[key])}</div>
            </div>` : '').join('')}
        </div>
      </div>`).join('')}
  `;
}

function renderDialoguePanel(panel) {
  if (!STATE.dialogue || !STATE.dialogue.length) {
    panel.innerHTML = emptyState('💬', 'No dialogue yet', 'Generate your cinematic plan from the Idea tab first.');
    return;
  }
  panel.innerHTML = `
    <div class="page-title">💬 Dialogue &amp; Emotion</div>
    <div class="page-sub">Natural, character-driven dialogue that matches personality, emotion, and story progression.</div>
    <div class="dialogue-list">
      ${STATE.dialogue.map(d => `
        <div class="dialogue-block">
          <div class="dialogue-scene-label">📍 ${esc(d.scene)}</div>
          ${d.lines.map(line => `
            <div class="dialogue-line">
              <div class="dialogue-char">${esc(line.Character || 'Character')}</div>
              <div class="dialogue-text">"${esc(line.Text)}"</div>
              ${line.Note ? `<div class="dialogue-note">🎭 ${esc(line.Note)}</div>` : ''}
            </div>`).join('')}
        </div>`).join('')}
    </div>
  `;
}

function renderFinalPlanPanel(panel) {
  if (!STATE.dialogue) {
    panel.innerHTML = emptyState('📋', 'Final plan not ready', 'Complete the generation from the Idea tab first.');
    return;
  }

  const title = STATE.idea.length > 60 ? STATE.idea.slice(0, 57) + '…' : STATE.idea;

  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  panel.innerHTML = `
    <div class="page-title">📋 Final Cinematic Production Plan</div>
    <div class="page-sub">Your complete cinematic blueprint — ready for pre-production.</div>

    <div class="plan-hero" id="plan-export-target">
      <div class="plan-hero-title">🎬 ${esc(title)}</div>
      <div class="plan-hero-sub">Cinematic Production Plan · Generated ${genDate} · ChatGPT (gpt-4o-mini)</div>
    </div>

    <div class="plan-section">
      <div class="plan-section-title"><span class="plan-section-icon">👤</span> Characters (${STATE.characters?.length || 0})</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${(STATE.characters || []).map(c => `
          <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:0.9rem;">
              ${(c.Name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:700;">${esc(c.Name || '')}</div>
              <div style="font-size:0.75rem;color:var(--gold);margin-bottom:4px;">${esc(c.Role || '')}</div>
              <div style="font-size:0.84rem;color:var(--muted);">${esc(c.Motivation || c.Goal || '')}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="plan-section">
      <div class="plan-section-title"><span class="plan-section-icon">🎬</span> Story Timeline</div>
      <div class="timeline">
        ${(STATE.scenes || []).map(s => `
          <div class="timeline-item">
            <div class="timeline-item-title">Scene ${esc(s.Number)}: ${esc(s.Title || '')}</div>
            <div class="timeline-item-desc">${esc(s.Location || '')}${s.Time ? ' · ' + s.Time : ''} · <em>${esc(s.Emotion || '')}</em></div>
            <div style="font-size:0.82rem;color:var(--text);margin-top:4px;">${esc(s.Purpose || s.Action || '')}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="plan-section">
      <div class="plan-section-title"><span class="plan-section-icon">🎥</span> Camera Strategy Summary</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${[...new Set((STATE.camera || []).map(s => s.Type))].filter(Boolean).map(type => `
          <span style="background:rgba(79,142,247,0.1);border:1px solid rgba(79,142,247,0.3);color:var(--accent);border-radius:20px;padding:4px 12px;font-size:0.78rem;font-weight:600;">
            ${esc(type)}
          </span>`).join('')}
      </div>
    </div>

    <div class="plan-section">
      <div class="plan-section-title"><span class="plan-section-icon">🎨</span> Visual Language Summary</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
        ${(STATE.visual || []).map(v => `
          <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:12px 14px;">
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:4px;">${esc(v.Scene || '')}</div>
            <div style="font-size:0.82rem;color:var(--text);margin-bottom:2px;"><b>Lighting:</b> ${esc(v.Lighting || '')}</div>
            <div style="font-size:0.82rem;color:var(--muted);">${esc(v.ColorMood || v.Mood || '')}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="plan-section">
      <div class="plan-section-title"><span class="plan-section-icon">💬</span> Key Dialogue Moments</div>
      ${(STATE.dialogue || []).map(d => `
        <div style="margin-bottom:12px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:14px 16px;">
          <div style="font-size:0.72rem;font-weight:700;color:var(--accent2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">${esc(d.scene)}</div>
          ${d.lines.slice(0, 2).map(l => `
            <div style="margin-bottom:6px;">
              <span style="font-size:0.73rem;font-weight:700;color:var(--gold);text-transform:uppercase;">${esc(l.Character)}</span>
              <div style="font-size:0.88rem;font-style:italic;color:var(--text);padding-left:10px;">"${esc(l.Text)}"</div>
            </div>`).join('')}
        </div>`).join('')}
    </div>

    <div class="export-bar">
      <button class="btn btn-gold btn-lg" id="btn-print">🖨 Print / Save as PDF</button>
      <button class="btn btn-secondary" id="btn-new-idea">✨ New Story Idea</button>
    </div>
  `;

  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-new-idea').addEventListener('click', () => {
    STATE.idea = ''; STATE.characters = null; STATE.scenes = null;
    STATE.camera = null; STATE.visual = null; STATE.dialogue = null;
    STATE.dbProjectId = null;
    updateTabStates();
    renderTab('idea');
  });
}

// ── HISTORY PANEL ────────────────────────────────────────
async function renderHistoryPanel(panel) {
  panel.innerHTML = `
    <div class="page-title">🗂 Saved Projects</div>
    <div class="page-sub">All cinematic plans saved to Supabase — click to reload any project.</div>
    <div id="history-body">
      <div class="status-msg"><div class="spinner"></div><span>Loading history…</span></div>
    </div>
  `;

  try {
    const projects = await dbList();
    const body = document.getElementById('history-body');

    if (!projects || !projects.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎞</div>
          <div class="empty-state-title">No saved projects yet</div>
          <div class="empty-state-sub">Generate a cinematic plan and it will be saved here automatically.</div>
          <button class="btn btn-primary" style="margin-top:18px;" onclick="renderTab('idea')">Start a New Idea</button>
        </div>`;
      return;
    }

    body.innerHTML = `
      <div class="history-grid">
        ${projects.map(p => {
          const date = new Date(p.created_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
          const shortIdea = p.idea.length > 80 ? p.idea.slice(0, 77) + '…' : p.idea;
          return `
            <div class="history-card" data-project-id="${esc(p.id)}">
              <div class="history-card-icon">🎬</div>
              <div class="history-card-body">
                <div class="history-card-idea">${esc(shortIdea)}</div>
                <div class="history-card-date">📅 ${date}</div>
              </div>
              <div class="history-card-actions">
                <button class="btn btn-primary btn-sm history-load-btn" data-id="${esc(p.id)}">Load</button>
                <button class="btn btn-ghost btn-sm history-delete-btn" data-id="${esc(p.id)}">🗑</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    `;

    // Load
    body.querySelectorAll('.history-load-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '…';
        try {
          const proj = await dbLoad(btn.dataset.id);
          STATE.idea        = proj.idea;
          STATE.characters  = proj.characters;
          STATE.scenes      = proj.scenes;
          STATE.camera      = proj.camera;
          STATE.visual      = proj.visual;
          STATE.dialogue    = proj.dialogue;
          STATE.dbProjectId = proj.id;
          updateTabStates();
          renderTab('plan');
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Load';
          alert('Error loading project: ' + err.message);
        }
      });
    });

    // Delete
    body.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this project permanently?')) return;
        btn.disabled = true;
        try {
          await dbDelete(btn.dataset.id);
          // Remove card from DOM
          const card = btn.closest('.history-card');
          if (card) card.remove();
          // If no cards left show empty state
          if (!body.querySelectorAll('.history-card').length) {
            renderHistoryPanel(panel);
          }
        } catch (err) {
          btn.disabled = false;
          alert('Error deleting project: ' + err.message);
        }
      });
    });

  } catch (err) {
    document.getElementById('history-body').innerHTML = `
      <div class="error-box">
        <span class="error-box-icon">⚠</span>
        <span>${esc(err.message)} — Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel env vars.</span>
      </div>`;
  }
}

// ── UTILITIES ────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emptyState(icon, title, sub) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-sub">${sub}</div>
      <button class="btn btn-primary" style="margin-top:18px;" onclick="renderTab('idea')">Go to Idea Tab</button>
    </div>`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="error-box"><span class="error-box-icon">⚠</span><span>${esc(msg)}</span></div>`;
}

function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
}
