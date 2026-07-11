/* Recipe shell v1 — generic renderer. Reads one recipe JSON file and renders it.
   No recipe content is hardcoded here — this file only knows how to DISPLAY
   whatever shape of data the schema allows. */

const STAGE_COLOURS = {
  yellow: 'var(--stage-yellow)',
  green:  'var(--stage-green)',
  amber:  'var(--stage-amber)',
  red:    'var(--stage-red)'
};

/* ---------- small utilities ---------- */

function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Bold key measures: temperatures, time durations/ranges, weights, volumes,
// dimensions, percentages. Pattern-based only — no judgement about "importance"
// beyond "this looks like a measurement." Single regex avoids double-wrapping
// overlapping matches (e.g. a range followed by a unit).
const MEASURE_RE = /\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:°C|°F|kg\b|g\b|ml\b|l\b|cm\b|mm\b|tbsp\b|tsp\b|cups?\b|hours?\b|hrs?\b|minutes?\b|mins?\b|%)/gi;

function formatStepBody(text){
  const escaped = escapeHtml(text);
  return escaped.replace(MEASURE_RE, (m) => `<strong>${m}</strong>`);
}

// Lighten parenthetical substitution/prep text within ingredient names.
function formatIngredientName(text){
  const escaped = escapeHtml(text);
  return escaped.replace(/\(([^)]+)\)/g, (m, inner) => `(<span class="ing-sub">${inner}</span>)`);
}

function fmtNum(n){
  const r = Math.round(n * 100) / 100;
  return r % 1 === 0 ? r.toString() : r.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
}

/* ---------- storage (per-recipe namespaced, plain localStorage) ---------- */

function storageKey(recipeSlug, key){
  return `recipe-app:${recipeSlug}:${key}`;
}
function sGet(recipeSlug, key){
  try{
    const raw = localStorage.getItem(storageKey(recipeSlug, key));
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function sSet(recipeSlug, key, value){
  try{ localStorage.setItem(storageKey(recipeSlug, key), JSON.stringify(value)); }catch(e){}
}
function sDelete(recipeSlug, key){
  try{ localStorage.removeItem(storageKey(recipeSlug, key)); }catch(e){}
}

/* ---------- validation ---------- */

function validateRecipe(data){
  const errors = [];
  if(!data || typeof data !== 'object'){ errors.push('File is not a valid JSON object.'); return errors; }
  if(!data.title) errors.push('Missing required field: "title".');
  if(!Array.isArray(data.ingredients) || data.ingredients.length === 0){
    errors.push('Missing or empty required field: "ingredients".');
  } else {
    data.ingredients.forEach((g, i) => {
      if(!g.id || !g.title || !Array.isArray(g.items)) errors.push(`Ingredient group ${i+1} is missing "id", "title", or "items".`);
    });
  }
  if(!Array.isArray(data.steps) || data.steps.length === 0){
    errors.push('Missing or empty required field: "steps".');
  } else {
    data.steps.forEach((s, i) => {
      if(s.number == null || !s.body) errors.push(`Step ${i+1} is missing "number" or "body".`);
    });
  }
  return errors;
}

/* ---------- batch scaling ---------- */

function scaleAmount(item, mult){
  if(item.amount == null) return null;
  const raw = item.amount * mult;
  const mode = item.scaleMode || 'weight';
  if(mode === 'weight' || mode === 'volume'){
    return fmtNum(raw);
  }
  // whole, whole_range, or anything else countable — round to a sensible whole number
  return String(Math.max(1, Math.round(raw)));
}

function renderIngredientAmount(item, mult){
  if(item.amount == null) return ''; // free-text / to-taste item, no amount to show
  if(item.display && mult === 1){
    return escapeHtml(item.display);
  }
  const scaled = scaleAmount(item, mult);
  return escapeHtml(item.unit ? `${scaled} ${item.unit}` : scaled);
}

/* ---------- fermentation tracker ---------- */

function stageColour(name){ return STAGE_COLOURS[name] || 'var(--stage-green)'; }

function renderGauge(stages){
  const maxToDay = Math.max(...stages.map(s => s.toDay != null ? s.toDay : (s.fromDay + 10)));
  return stages.map(s => {
    const from = s.fromDay || 0;
    const to = s.toDay != null ? s.toDay : maxToDay;
    const widthPct = ((to - from) / maxToDay) * 100;
    return `<div class="gauge-zone" style="flex:0 0 ${widthPct}%; background:${stageColour(s.colour)};">
      <span>${escapeHtml(s.label)}</span>
    </div>`;
  }).join('');
}

function stageForDay(stages, day){
  for(const s of stages){
    const from = s.fromDay || 0;
    const to = s.toDay != null ? s.toDay : Infinity;
    if(day >= from && day <= to) return s;
  }
  return stages[stages.length - 1];
}

function renderFermentationTracker(recipe, slug, container){
  const tracker = recipe.fermentationTracker;
  if(!tracker || !Array.isArray(tracker.stages) || tracker.stages.length === 0) return;

  const section = document.createElement('section');
  section.innerHTML = `<div class="sec-head"><h2>Fermentation Tracker</h2><div class="rule"></div></div>
    <div id="tracker-slot"></div>`;
  container.appendChild(section);
  const slot = section.querySelector('#tracker-slot');

  function draw(){
    const stored = sGet(slug, 'batch-start');
    if(!stored || !stored.startTs){
      slot.innerHTML = `<div class="tracker-prompt">
        <span>Start the tracker once jars are packed.</span>
        <button class="btn btn-primary" id="startTrackerBtn">Start tracker — jars packed</button>
      </div>`;
      slot.querySelector('#startTrackerBtn').addEventListener('click', () => {
        sSet(slug, 'batch-start', { startTs: Date.now() });
        draw();
      });
      return;
    }
    const days = (Date.now() - stored.startTs) / 86400000;
    const stage = stageForDay(tracker.stages, days);
    const maxToDay = Math.max(...tracker.stages.map(s => s.toDay != null ? s.toDay : (s.fromDay + 10)));
    const pct = Math.min(100, Math.max(0, (days / maxToDay) * 100));
    slot.innerHTML = `<div class="tracker">
        <div class="tracker-status" aria-live="polite"><b>Day ${Math.floor(days)}</b> — ${escapeHtml(stage.label)}</div>
        <div class="gauge">${renderGauge(tracker.stages)}<div class="marker" style="left:${pct}%;"></div></div>
        <div class="tracker-actions">
          <button class="btn btn-on-dark" id="resetTrackerBtn">Reset</button>
        </div>
      </div>`;
    slot.querySelector('#resetTrackerBtn').addEventListener('click', () => {
      sDelete(slug, 'batch-start');
      draw();
    });
  }
  draw();
  setInterval(draw, 60000);
}

/* ---------- timers ---------- */

function formatDuration(sec, showHours){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if(showHours) return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
  return [m,s].map(v=>String(v).padStart(2,'0')).join(':');
}

function attachTimer(box, timer, slug){
  const showHours = timer.seconds >= 3600;
  const display = box.querySelector('.timer-display');
  const startBtn = box.querySelector('[data-action="start"]');
  const resetBtn = box.querySelector('[data-action="reset"]');
  let interval = null;

  function tick(endTs){
    const remaining = Math.round((endTs - Date.now())/1000);
    if(remaining <= 0){
      display.textContent = showHours ? '00:00:00' : '00:00';
      startBtn.textContent = 'Done';
      clearInterval(interval);
      return;
    }
    display.textContent = formatDuration(remaining, showHours);
  }

  const stored = sGet(slug, `timer:${timer.id}`);
  if(stored && stored.endTs > Date.now()){
    startBtn.textContent = 'Running…';
    tick(stored.endTs);
    interval = setInterval(()=>tick(stored.endTs), 1000);
  }

  startBtn.addEventListener('click', () => {
    if(startBtn.textContent === 'Running…') return;
    const endTs = Date.now() + timer.seconds*1000;
    sSet(slug, `timer:${timer.id}`, { endTs });
    startBtn.textContent = 'Running…';
    clearInterval(interval);
    tick(endTs);
    interval = setInterval(()=>tick(endTs), 1000);
  });
  resetBtn.addEventListener('click', () => {
    clearInterval(interval);
    sDelete(slug, `timer:${timer.id}`);
    display.textContent = formatDuration(timer.seconds, showHours);
    startBtn.textContent = 'Start';
  });
}

/* ---------- main render ---------- */

function renderRecipe(recipe, slug, root){
  const mult = { value: 1 };

  // ---- header ----
  const header = document.createElement('div');
  header.className = 'label';
  let statsHtml = '';
  const stats = [];
  if(recipe.times) recipe.times.forEach(t => stats.push({ b: t.value, s: t.label }));
  if(recipe.servings) stats.push({ b: `${recipe.servings.quantity ?? ''} ${recipe.servings.unit ?? ''}`.trim(), s: 'Servings', id:'servings-stat' });
  if(recipe.yield) stats.push({ b: `${recipe.yield.quantity ?? ''} ${recipe.yield.unit ?? ''}`.trim(), s: 'Makes', id:'yield-stat' });
  if(stats.length){
    statsHtml = `<div class="stats">${stats.map(s=>`<div class="stat" ${s.id?`id="${s.id}"`:''}><b>${escapeHtml(s.b)}</b><span>${escapeHtml(s.s)}</span></div>`).join('')}</div>`;
  }

  header.innerHTML = `
    <div class="eyebrow">Recipe</div>
    <h1>${escapeHtml(recipe.title)}</h1>
    ${recipe.alternateNames ? `<div class="alt-names">${recipe.alternateNames.map(escapeHtml).join(' · ')}</div>` : ''}
    ${recipe.description ? `<p class="description">${escapeHtml(recipe.description)}</p>` : ''}
    ${recipe.attribution ? `<div class="attribution">${recipe.attribution.author ? `By ${escapeHtml(recipe.attribution.author)}` : ''}${recipe.attribution.adaptedBy ? `${recipe.attribution.author?' · ':''}Adapted by ${escapeHtml(recipe.attribution.adaptedBy)}` : ''}</div>` : ''}
    ${statsHtml}
    ${(recipe.servings || recipe.yield) ? `<div class="batch">
      <div class="batch-label">Batch size</div>
      <div class="stepper">
        <button id="dec" aria-label="Smaller batch">–</button>
        <output id="multOut">1×</output>
        <button id="inc" aria-label="Larger batch">+</button>
      </div>
    </div>` : ''}
  `;
  root.appendChild(header);

  function updateBatchStats(){
    const out = header.querySelector('#multOut');
    if(out) out.textContent = fmtNum(mult.value) + '×';
    const yEl = header.querySelector('#yield-stat b');
    if(yEl && recipe.yield) yEl.textContent = `${fmtNum((recipe.yield.quantity||0)*mult.value)} ${recipe.yield.unit||''}`.trim();
    const sEl = header.querySelector('#servings-stat b');
    if(sEl && recipe.servings) sEl.textContent = `${fmtNum((recipe.servings.quantity||0)*mult.value)} ${recipe.servings.unit||''}`.trim();
  }

  // ---- ingredients ----
  const ingSection = document.createElement('section');
  ingSection.innerHTML = `<div class="sec-head"><h2>Ingredients</h2><div class="rule"></div></div><div id="ing-groups"></div>`;
  root.appendChild(ingSection);
  const ingGroups = ingSection.querySelector('#ing-groups');

  function renderIngredients(){
    ingGroups.innerHTML = recipe.ingredients.map(g => `
      <div class="card ${g.items.length > 6 ? 'wide-cols' : ''}">
        <h3>${escapeHtml(g.title)}</h3>
        ${g.items.map(item => `
          <div class="ing-row">
            <span class="ing-name">${formatIngredientName(item.name)}</span>
            <span class="ing-amt">${renderIngredientAmount(item, mult.value)}</span>
          </div>`).join('')}
      </div>`).join('');
  }
  renderIngredients();

  if(header.querySelector('#inc')){
    header.querySelector('#inc').addEventListener('click', () => {
      mult.value = Math.min(3, mult.value + 0.5);
      updateBatchStats(); renderIngredients();
    });
    header.querySelector('#dec').addEventListener('click', () => {
      mult.value = Math.max(0.5, mult.value - 0.5);
      updateBatchStats(); renderIngredients();
    });
  }

  // ---- method ----
  const methodSection = document.createElement('section');
  methodSection.innerHTML = `<div class="sec-head"><h2>Method</h2><div class="rule"></div></div><div id="steps"></div>`;
  root.appendChild(methodSection);
  const stepsEl = methodSection.querySelector('#steps');

  recipe.steps.forEach(step => {
    const div = document.createElement('div');
    div.className = 'step';
    let metaParts = [];
    if(step.temperature) metaParts.push(step.temperature);
    if(step.elapsedMinutes){
      const em = step.elapsedMinutes;
      metaParts.push(em.to != null && em.to !== em.from ? `${em.from}–${em.to} min mark` : `${em.from} min mark`);
    }
    div.innerHTML = `
      <div class="step-num">${step.number}</div>
      <div class="step-body">
        ${step.title ? `<p class="step-title">${escapeHtml(step.title)}</p>` : ''}
        ${metaParts.length ? `<p class="step-meta">${metaParts.map(escapeHtml).join(' · ')}</p>` : ''}
        <p class="step-text">${formatStepBody(step.body)}</p>
        ${step.timer ? `<div class="timer" data-timer-id="${escapeHtml(step.timer.id)}">
          <span class="timer-display">${formatDuration(step.timer.seconds, step.timer.seconds>=3600)}</span>
          <button class="btn btn-primary" data-action="start">Start</button>
          <button class="btn btn-ghost" data-action="reset">Reset</button>
          <span class="timer-note">Saved in this browser — keeps running if you close the tab.</span>
        </div>` : ''}
      </div>`;
    stepsEl.appendChild(div);
    if(step.timer) attachTimer(div.querySelector('.timer'), step.timer, slug);
  });

  // ---- fermentation tracker (optional, only if present) ----
  renderFermentationTracker(recipe, slug, root);

  // ---- variations (optional) ----
  if(Array.isArray(recipe.variations) && recipe.variations.length){
    const s = document.createElement('section');
    s.innerHTML = `<div class="sec-head"><h2>Variations</h2><div class="rule"></div></div>
      <div class="variations-list">${recipe.variations.map(v => `
        <div class="item"><b>${escapeHtml(v.name)}</b><p>${escapeHtml(v.description)}</p></div>`).join('')}</div>`;
    root.appendChild(s);
  }

  // ---- notes (optional) ----
  if(Array.isArray(recipe.notes) && recipe.notes.length){
    const s = document.createElement('section');
    s.innerHTML = `<div class="sec-head"><h2>Notes</h2><div class="rule"></div></div>
      <div class="notes-list">${recipe.notes.map(n => `
        <div class="item"><b>${escapeHtml(n.label)}</b><p>${escapeHtml(n.body)}</p></div>`).join('')}</div>`;
    root.appendChild(s);
  }

  updateBatchStats();
}

function renderError(errors, root, context){
  const div = document.createElement('div');
  div.className = 'error-card';
  div.innerHTML = `<b>Couldn't load this recipe${context ? ` (${escapeHtml(context)})` : ''}.</b>
    <ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
  root.appendChild(div);
}

/* ---------- entry point for recipe.html ---------- */

async function loadAndRenderRecipe(){
  const root = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const slug = params.get('recipe');
  if(!slug){
    renderError(['No recipe specified. Use recipe.html?recipe=SLUG.'], root);
    return;
  }
  try{
    const res = await fetch(`../recipes/${slug}.json`);
    if(!res.ok){
      renderError([`Recipe file not found (HTTP ${res.status}). Check the file exists at recipes/${slug}.json.`], root, slug);
      return;
    }
    const data = await res.json();
    const errors = validateRecipe(data);
    if(errors.length){
      renderError(errors, root, slug);
      return;
    }
    document.title = data.title;
    renderRecipe(data, slug, root);
  }catch(e){
    renderError([
      'Could not load or parse the recipe file.',
      'If you opened this page directly (file://), your browser likely blocked the request — this app needs to be served over http(s), e.g. via GitHub Pages or a local server.',
      `Technical detail: ${e.message}`
    ], root, slug);
  }
}

/* ---------- entry point for index.html ---------- */

async function loadAndRenderIndex(){
  const root = document.getElementById('app');
  try{
    const res = await fetch('../recipes/manifest.json');
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    root.innerHTML = (data.recipes || []).map(r => `
      <a class="recipe-card" href="recipe.html?recipe=${encodeURIComponent(r.slug)}">
        <h3>${escapeHtml(r.title)}</h3>
        <span>${escapeHtml(r.type || 'recipe')}</span>
      </a>`).join('');
  }catch(e){
    renderError([
      'Could not load the recipe list.',
      'If you opened this page directly (file://), your browser likely blocked the request — serve this app over http(s), e.g. via GitHub Pages or a local server.',
      `Technical detail: ${e.message}`
    ], root);
  }
}
