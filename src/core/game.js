// RealCity — Hauptspiel

import { state, spend, earn, startTicks, onTick, applyState, resetState,
         setTaxRate, takeLoan, COSTS, TAX_MAX } from './state.js';
import { runSimulation } from './simulation.js';
import { isConnected, hasRoadNeighbor } from './network.js';
import { save, load, clear } from './persistence.js';
import { slopeCostFactor, isTooSteep, terrainBonus, FOREST_CLEAR_REWARD } from './terrain.js';
import { computePowered } from './utilities.js';

const LOAN_AMOUNT = 50_000;

const canvas    = document.getElementById('gameCanvas');
const ctx       = canvas.getContext('2d');
const tileInfo  = document.getElementById('tile-info');
const hudMoney  = document.getElementById('hud-money');
const hudPop    = document.getElementById('hud-pop');
const hudTick   = document.getElementById('hud-tick');
const hudCash   = document.getElementById('hud-cashflow');
const hudZones  = document.getElementById('hud-zones');
const hudRoads  = document.getElementById('hud-roads');
const hudDebt   = document.getElementById('hud-debt');
const loadBtn   = document.getElementById('load-btn');
const resetBtn  = document.getElementById('reset-btn');
const citySelect= document.getElementById('city-select');
const loanBtn   = document.getElementById('loan-btn');
const gameoverEl     = document.getElementById('gameover');
const gameoverReset  = document.getElementById('gameover-reset');

// Anteil der Baukosten, der beim Abriss erstattet wird
const REFUND = 0.5;
let currentCity = null;
let lastIncome  = 0;

// --- Terrain-Farben ---
const TERRAIN_COLORS = {
  water:    '#7aaedc',
  forest:   '#4a8a40',
  lowland:  '#a8c080',
  flatland: '#b0c878',
  hills:    '#c0a860',
  steep:    '#907858',
};

// Zonenfarben nach Level [0..3]
const ZONE_COLORS = {
  road:        ['#555'],
  power:       ['#d84a4a'],
  residential: ['#2d6e2d', '#3a9a3a', '#4dbe4d', '#6adf6a'],
  commercial:  ['#1a4a7a', '#2060a0', '#3080c8', '#50a0e8'],
  industrial:  ['#4a4a4a', '#686868', '#888', '#aaa'],
  admin:       ['#6a5000', '#a07800', '#c89a00', '#f0c000'],
};

function zoneColor(cell) {
  const palette = ZONE_COLORS[cell.zone ?? cell.type];
  if (!palette) return 'rgba(255,255,255,0.3)';
  return palette[Math.min(cell.level ?? 0, palette.length - 1)];
}

const GAME_GRID = 64;
let map   = null;
let cells = null;
let activeTool = 'inspect';
// Zell-Indizes gerodeter Wald-Tiles (verlieren den Naherholungs-Bonus, werden
// als Bauland behandelt). Wird mit dem Spielstand persistiert.
let clearedForest = new Set();

// --- Kamera ---
const camera = { x: 64, y: 64, zoom: 4 };

// --- Canvas ---
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); draw(); });
resizeCanvas();

// --- Terrain-Sampling ---
function sampleBilinear(data, grid, fx, fy) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0+1, grid-1), y1 = Math.min(y0+1, grid-1);
  const tx = fx-x0, ty = fy-y0;
  return (1-tx)*(1-ty)*data[y0*grid+x0] + tx*(1-ty)*data[y0*grid+x1]
       + (1-tx)*ty   *data[y1*grid+x0] + tx*ty   *data[y1*grid+x1];
}
function sampleNearest(data, grid, fx, fy) {
  const x = Math.round(Math.max(0, Math.min(grid-1, fx)));
  const y = Math.round(Math.max(0, Math.min(grid-1, fy)));
  return data[y*grid+x];
}
function sampleAny(data, grid, fx, fy, r=1) {
  for (let dy=-r; dy<=r; dy++)
    for (let dx=-r; dx<=r; dx++)
      if (sampleNearest(data, grid, fx+dx, fy+dy)) return 1;
  return 0;
}
function terrainAt(fx, fy) {
  if (!map) return 'flatland';
  const g = map.grid;
  const e = sampleBilinear(map.elevation, g, fx, fy);
  const w = sampleAny(map.water, g, fx, fy, 1);
  const f = sampleNearest(map.forest, g, fx, fy);
  if (w) return 'water';
  if (f) return 'forest';
  if (e < 0.25) return 'lowland';
  if (e < 0.55) return 'flatland';
  if (e < 0.80) return 'hills';
  return 'steep';
}

// Höhen-Gradient an einer Terrain-Position: größte Höhendifferenz zur
// Nachbarschaft (ein Spielfeld-Schritt in jede Richtung). 0 = flach.
function slopeAt(fx, fy) {
  if (!map) return 0;
  const g = map.grid;
  const d = (map.grid - 1) / GAME_GRID; // ein Spielfeld-Schritt in Terrain-Einheiten
  const e0 = sampleBilinear(map.elevation, g, fx, fy);
  let max = 0;
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const e = sampleBilinear(map.elevation, g, fx + dx*d, fy + dy*d);
    max = Math.max(max, Math.abs(e - e0));
  }
  return max;
}

// Prüft, ob in einem kleinen Radius (in Spielfeld-Schritten) Wasser bzw.
// ungerodeter Wald liegt. Gerodete Wald-Tiles sind in clearedForest vermerkt.
function nearTerrain(gx, gy, kind, radius = 2) {
  const step = (map.grid - 1) / GAME_GRID;
  const g = map.grid;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const fx = (gx + dx + 0.5) * step;
      const fy = (gy + dy + 0.5) * step;
      if (kind === 'water' && sampleAny(map.water, g, fx, fy, 1)) return true;
      if (kind === 'forest' && sampleNearest(map.forest, g, fx, fy)
          && !clearedForest.has(cellIdx(gx + dx, gy + dy))) return true;
    }
  }
  return false;
}

// Lage-Bonus einer Zone an (gx,gy): Wasser-/Waldnähe (nur Wohnzonen).
function bonusFor(zone, gx, gy) {
  return terrainBonus({
    zone,
    nearWater:  nearTerrain(gx, gy, 'water'),
    nearForest: nearTerrain(gx, gy, 'forest'),
  });
}

// Schreibt den aktuellen Lage-Bonus auf eine einzelne Zonen-Zelle.
function applyBonus(gx, gy) {
  const c = cells[cellIdx(gx, gy)];
  if (c?.type === 'zone') c.terrainBonus = bonusFor(c.zone, gx, gy);
}

// Aktualisiert den Bonus der Zelle selbst und aller Zonen im Bonus-Radius
// (Rodung/Bebauung kann deren Wald-/Wasserlage verändern).
function recomputeBonusAround(gx, gy, radius = 2) {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = gx + dx, ny = gy + dy;
      if (nx >= 0 && nx < GAME_GRID && ny >= 0 && ny < GAME_GRID) applyBonus(nx, ny);
    }
}

// Berechnet den Lage-Bonus für alle Zonen neu (z.B. nach dem Laden).
function recomputeAllBonuses() {
  if (!cells || !map) return;
  for (let gy = 0; gy < GAME_GRID; gy++)
    for (let gx = 0; gx < GAME_GRID; gx++) applyBonus(gx, gy);
}

// --- Koordinaten ---
function terrainToCanvas(tx, ty) {
  return {
    x: (tx - camera.x) * camera.zoom + canvas.width  / 2,
    y: (ty - camera.y) * camera.zoom + canvas.height / 2,
  };
}
function canvasToTerrain(cx, cy) {
  return {
    x: (cx - canvas.width  / 2) / camera.zoom + camera.x,
    y: (cy - canvas.height / 2) / camera.zoom + camera.y,
  };
}
function cellToTerrain(gx, gy) {
  if (!map) return null;
  const step = (map.grid - 1) / GAME_GRID;
  return { x: gx * step, y: gy * step, w: step, h: step };
}
function terrainToCell(tx, ty) {
  if (!map) return null;
  const step = (map.grid - 1) / GAME_GRID;
  const gx = Math.floor(tx / step);
  const gy = Math.floor(ty / step);
  if (gx < 0 || gx >= GAME_GRID || gy < 0 || gy >= GAME_GRID) return null;
  return { gx, gy };
}
function cellIdx(gx, gy) { return gy * GAME_GRID + gx; }

// --- HUD aktualisieren ---
function updateHUD() {
  hudMoney.textContent = state.money.toLocaleString('de-DE') + ' €';
  hudPop.textContent   = state.population.toLocaleString('de-DE');
  hudTick.textContent  = state.tick;

  // Saldo des letzten Ticks
  const sign = lastIncome > 0 ? '+' : (lastIncome < 0 ? '−' : '±');
  hudCash.textContent = `${sign}${Math.abs(lastIncome).toLocaleString('de-DE')} €`;
  hudCash.className = lastIncome > 0 ? 'value pos' : (lastIncome < 0 ? 'value neg' : 'value');

  // Zonen-/Straßen-Zähler
  let r = 0, c = 0, ind = 0, a = 0, roads = 0;
  if (cells) {
    for (const cell of cells) {
      if (!cell) continue;
      if (cell.type === 'road') { roads++; continue; }
      if (cell.zone === 'residential') r++;
      else if (cell.zone === 'commercial') c++;
      else if (cell.zone === 'industrial') ind++;
      else if (cell.zone === 'admin') a++;
    }
  }
  hudZones.textContent = `${r}/${c}/${ind}/${a}`;
  hudRoads.textContent = roads;

  hudDebt.textContent = Math.round(state.debt).toLocaleString('de-DE') + ' €';

  updateDemandBars();

  // Game-Over-Overlay ein-/ausblenden
  gameoverEl.classList.toggle('show', state.gameOver === true);
}

// RCI-Nachfragebalken: füllt je Zonentyp einen Balken nach rechts (positiv,
// grün) oder links (negativ, rot) entsprechend state.demand ∈ [-1, 1].
const RCI_ZONES = ['residential', 'commercial', 'industrial'];
function updateDemandBars() {
  for (const z of RCI_ZONES) {
    const fill = document.getElementById(`rci-${z}`);
    if (!fill) continue;
    const d = Math.max(-1, Math.min(1, state.demand?.[z] ?? 0));
    fill.style.width = `${Math.abs(d) * 50}%`;
    fill.style.left  = d >= 0 ? '50%' : `${50 - Math.abs(d) * 50}%`;
    fill.style.background = d >= 0 ? '#5cb85c' : '#c0392b';
  }
}

// --- Steuer-Regler: Slider-Position aus dem State spiegeln ---
const TAX_ZONES = ['residential', 'commercial', 'industrial'];
function syncTaxSliders() {
  for (const z of TAX_ZONES) {
    const slider = document.getElementById(`tax-${z}`);
    const pct    = document.getElementById(`tax-${z}-pct`);
    if (!slider || !pct) continue;
    const percent = Math.round((state.taxRates[z] ?? 0) * 100);
    slider.value = percent;
    pct.textContent = `${percent} %`;
  }
}

TAX_ZONES.forEach(z => {
  const slider = document.getElementById(`tax-${z}`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const percent = Math.max(0, Math.min(TAX_MAX * 100, Number(slider.value)));
    setTaxRate(z, percent / 100);
    document.getElementById(`tax-${z}-pct`).textContent = `${percent} %`;
    autoSave();
  });
});

// --- Render ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!map) {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stadt wählen und "Laden" klicken', canvas.width/2, canvas.height/2);
    return;
  }

  const g  = map.grid;
  const tl = canvasToTerrain(0, 0);
  const br = canvasToTerrain(canvas.width, canvas.height);
  const x0 = Math.max(0, Math.floor(tl.x));
  const y0 = Math.max(0, Math.floor(tl.y));
  const x1 = Math.min(g-1, Math.ceil(br.x));
  const y1 = Math.min(g-1, Math.ceil(br.y));
  const px = camera.zoom;

  // Terrain
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      ctx.fillStyle = TERRAIN_COLORS[terrainAt(tx, ty)];
      const p = terrainToCanvas(tx, ty);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(px)+1, Math.ceil(px)+1);
    }
  }

  // Spielraster
  if (!cells) return;
  const step  = (g-1) / GAME_GRID;
  const cellPx = step * camera.zoom;

  for (let gy = 0; gy < GAME_GRID; gy++) {
    for (let gx = 0; gx < GAME_GRID; gx++) {
      const ct = cellToTerrain(gx, gy);
      const p  = terrainToCanvas(ct.x, ct.y);
      const pw = ct.w * camera.zoom;
      const ph = ct.h * camera.zoom;

      const cell = cells[cellIdx(gx, gy)];
      if (cell) {
        ctx.fillStyle = zoneColor(cell);
        ctx.fillRect(p.x, p.y, pw, ph);
      }

      if (cellPx >= 8) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(p.x, p.y, pw, ph);
      }
    }
  }

  // Bau-Vorschau (Hover-Overlay)
  if (hover) {
    const ct = cellToTerrain(hover.gx, hover.gy);
    const p  = terrainToCanvas(ct.x, ct.y);
    const pw = ct.w * camera.zoom, ph = ct.h * camera.zoom;
    ctx.lineWidth = 2;
    ctx.strokeStyle = hover.ok ? 'rgba(80,230,80,0.95)' : 'rgba(230,70,70,0.95)';
    ctx.fillStyle   = hover.ok ? 'rgba(80,230,80,0.18)' : 'rgba(230,70,70,0.15)';
    ctx.fillRect(p.x, p.y, pw, ph);
    ctx.strokeRect(p.x + 1, p.y + 1, pw - 2, ph - 2);
  }
}

// --- Karte laden ---
async function loadMap(city) {
  tileInfo.textContent = `Lade ${city}...`;
  loadBtn.disabled = true;
  try {
    const r = await fetch(`maps/${city}.json`);
    if (!r.ok) throw new Error(`maps/${city}.json nicht gefunden`);
    map   = await r.json();
    currentCity = city;

    // Gespeicherten Spielstand wiederherstellen, sonst frisch starten
    const saved = load(city);
    if (saved) {
      cells = saved.cells;
      clearedForest = new Set(saved.cleared ?? []);
      applyState(saved.state);
      recomputeAllBonuses();
      tileInfo.textContent = `${map.name} — Spielstand geladen (Tick ${state.tick})`;
    } else {
      cells = new Array(GAME_GRID * GAME_GRID).fill(null);
      clearedForest = new Set();
      resetState();
      tileInfo.textContent = `${map.name} geladen`;
    }

    camera.x    = map.grid / 2;
    camera.y    = map.grid / 2;
    camera.zoom = Math.min(canvas.width, canvas.height) / map.grid;
    startTicks(5000);
    syncTaxSliders();
    updateHUD();
    draw();
  } catch (e) {
    tileInfo.textContent = `Fehler: ${e.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener('click', () => { if (citySelect.value) loadMap(citySelect.value); });

// --- Städteliste aus dem Manifest (nur wirklich vorhandene Karten) ---
async function loadCityList() {
  try {
    const r = await fetch('maps/index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('maps/index.json fehlt');
    const { maps } = await r.json();
    citySelect.innerHTML = '';
    if (!maps || !maps.length) {
      citySelect.innerHTML = '<option value="">Keine Karten</option>';
      return;
    }
    for (const m of maps) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      citySelect.appendChild(opt);
    }
    tileInfo.textContent = `${maps.length} Karte(n) verfügbar — „Laden" klicken`;
  } catch (e) {
    citySelect.innerHTML = '<option value="">Keine Karten</option>';
    tileInfo.textContent = `Städteliste nicht ladbar: ${e.message}`;
  }
}
loadCityList();

// --- Tick ---
onTick(() => {
  if (!cells) return;
  lastIncome = runSimulation(cells);
  updateHUD();
  draw();
  const sign = lastIncome >= 0 ? '+' : '−';
  tileInfo.textContent = `Tick ${state.tick} — ${sign}${Math.abs(lastIncome).toLocaleString('de-DE')} €`;
  if (state.gameOver) tileInfo.textContent = 'Bankrott — Spiel beendet';
  autoSave();
});

// --- Auto-Save (am Tick) ---
function autoSave() {
  if (currentCity && cells) save(currentCity, cells, state, clearedForest);
}

// --- Bau-Vorschau ---
let hover = null; // { gx, gy, ok, reason, cost }

// Baukosten eines Werkzeugs auf (gx,gy) inkl. Hang-Aufschlag.
// Wald wird beim Bau gerodet → einmalige Gutschrift verrechnet (senkt die Kosten).
function buildCost(tool, gx, gy, terrain) {
  const step = (map.grid - 1) / GAME_GRID;
  const base   = tool === 'road' ? COSTS.road : (tool === 'power' ? COSTS.power : COSTS.zone);
  const factor = slopeCostFactor(slopeAt((gx + 0.5) * step, (gy + 0.5) * step));
  let cost = Math.round(base * factor);
  if (terrain === 'forest' && !clearedForest.has(cellIdx(gx, gy))) cost -= FOREST_CLEAR_REWARD;
  return cost;
}

// Basis-Baukosten einer bestehenden Zelle (für die Abriss-Erstattung).
function refundBase(cell) {
  if (cell.type === 'road')  return COSTS.road;
  if (cell.type === 'power') return COSTS.power;
  return COSTS.zone;
}

// Bewertet, ob das aktive Werkzeug auf (gx,gy) anwendbar ist.
function evaluateBuild(gx, gy) {
  if (!cells || activeTool === 'inspect') return null;
  const i = cellIdx(gx, gy);
  const step = (map.grid - 1) / GAME_GRID;
  const cx = (gx + 0.5) * step, cy = (gy + 0.5) * step;
  const terrain = terrainAt(cx, cy);

  if (activeTool === 'bulldoze') {
    return cells[i]
      ? { ok: true,  cost: -Math.round(refundBase(cells[i]) * REFUND) }
      : { ok: false, reason: 'leer' };
  }
  if (cells[i]) return { ok: false, reason: 'belegt' };
  if (terrain === 'water') return { ok: false, reason: 'Wasser' };
  if (isTooSteep(slopeAt(cx, cy))) return { ok: false, reason: 'zu steil' };

  const cost = buildCost(activeTool, gx, gy, terrain);

  // Straße und Kraftwerk sind Infrastruktur (kein Straßen-Nachbar nötig).
  if (activeTool === 'road' || activeTool === 'power') {
    return state.money >= cost
      ? { ok: true, cost }
      : { ok: false, reason: 'kein Geld', cost };
  }
  // Zone
  if (!hasRoadNeighbor(cells, gx, gy)) return { ok: false, reason: 'keine Straße', cost };
  return state.money >= cost
    ? { ok: true, cost }
    : { ok: false, reason: 'kein Geld', cost };
}

// --- Toolbar ---
document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTool = btn.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// --- Klick: Werkzeug anwenden ---
canvas.addEventListener('click', e => {
  if (dragMoved || !map) return;
  const t    = canvasToTerrain(e.clientX, e.clientY);
  const cell = terrainToCell(t.x, t.y);
  if (!cell) return;
  const { gx, gy } = cell;
  const i = cellIdx(gx, gy);

  // Terrain-Typ an dieser Spielfeld-Mitte
  const step = (map.grid - 1) / GAME_GRID;
  const terrain = terrainAt((gx + 0.5) * step, (gy + 0.5) * step);

  if (activeTool === 'inspect') {
    const c = cells[i];
    if (c) {
      const bonus = c.type === 'zone' && c.terrainBonus > 1
        ? ` (Lage +${Math.round((c.terrainBonus - 1) * 100)} %)` : '';
      const power = c.type === 'zone' && !computePowered(cells).has(i) ? ' ⚡✗' : '';
      const name = c.type === 'road' ? 'Straße' : (c.type === 'power' ? 'Kraftwerk' : c.zone);
      tileInfo.textContent = `[${gx},${gy}] ${name} Lv${c.level}${bonus}${power}`;
    } else {
      const cleared = clearedForest.has(i) ? ' (gerodet)' : '';
      tileInfo.textContent = `[${gx},${gy}] ${terrain}${cleared}`;
    }
    return;
  }

  // Abriss: belegte Zelle entfernen, Teil der Baukosten erstatten
  if (activeTool === 'bulldoze') {
    const c = cells[i];
    if (!c) { tileInfo.textContent = `[${gx},${gy}] nichts zum Abreißen`; return; }
    const refund = Math.round(refundBase(c) * REFUND);
    cells[i] = null;
    earn(refund);
    tileInfo.textContent = `[${gx},${gy}] abgerissen (+${refund.toLocaleString('de-DE')} €)`;
    updateHUD();
    draw();
    autoSave();
    return;
  }

  // Wasser kann nicht bebaut werden
  if (terrain === 'water') {
    tileInfo.textContent = `[${gx},${gy}] Wasser — nicht bebaubar`;
    return;
  }
  // Sehr steile Hänge sind gesperrt (wie Wasser)
  if (isTooSteep(slopeAt((gx + 0.5) * step, (gy + 0.5) * step))) {
    tileInfo.textContent = `[${gx},${gy}] zu steil — nicht bebaubar`;
    return;
  }

  // Kosten inkl. Hang-Aufschlag und ggf. Wald-Rodungsgutschrift.
  const cost = buildCost(activeTool, gx, gy, terrain);
  // Wald wird durch den Bau gerodet (verliert seinen Naherholungs-Bonus).
  const clearsForest = terrain === 'forest' && !clearedForest.has(i);

  if (activeTool === 'road' || activeTool === 'power') {
    if (cost > 0 && !spend(cost)) { tileInfo.textContent = 'Kein Geld!'; return; }
    if (cost <= 0) earn(-cost);
    cells[i] = { type: activeTool, level: 0 };
  } else {
    // Zone: muss neben einer Straße liegen
    if (!hasRoadNeighbor(cells, gx, gy)) {
      tileInfo.textContent = `[${gx},${gy}] Zone braucht Straße als Nachbar`;
      return;
    }
    if (cost > 0 && !spend(cost)) { tileInfo.textContent = 'Kein Geld!'; return; }
    if (cost <= 0) earn(-cost);
    cells[i] = { type: 'zone', zone: activeTool, level: 0, terrainBonus: 1 };
  }

  if (clearsForest) clearedForest.add(i);
  // Lage-Boni neu berechnen: gebaute Zone selbst und Wohnzonen in der
  // Umgebung (Rodung kann deren Wald-Bonus entfernen).
  recomputeBonusAround(gx, gy);

  const money = cost < 0 ? `+${(-cost).toLocaleString('de-DE')} €` : `-${cost.toLocaleString('de-DE')} €`;
  const label = activeTool === 'road' ? 'Straße gebaut'
              : activeTool === 'power' ? 'Kraftwerk gebaut'
              : `${activeTool} gesetzt`;
  const note  = clearsForest ? ' (Wald gerodet)' : '';
  tileInfo.textContent = `[${gx},${gy}] ${label}${note} (${money})`;

  updateHUD();
  draw();
  autoSave();
});

// --- Kredit aufnehmen ---
loanBtn.addEventListener('click', () => {
  if (!currentCity) { tileInfo.textContent = 'Erst eine Stadt laden'; return; }
  if (state.gameOver) return;
  takeLoan(LOAN_AMOUNT);
  tileInfo.textContent = `Kredit aufgenommen (+${LOAN_AMOUNT.toLocaleString('de-DE')} €) — Schulden steigen`;
  updateHUD();
  autoSave();
});

// --- Reset-Button ---
function resetCity() {
  if (!currentCity) { tileInfo.textContent = 'Erst eine Stadt laden'; return false; }
  clear(currentCity);
  cells = new Array(GAME_GRID * GAME_GRID).fill(null);
  clearedForest = new Set();
  resetState();
  lastIncome = 0;
  tileInfo.textContent = `${map?.name ?? currentCity} zurückgesetzt`;
  syncTaxSliders();
  updateHUD();
  draw();
  return true;
}

resetBtn.addEventListener('click', () => {
  if (!currentCity) { tileInfo.textContent = 'Erst eine Stadt laden'; return; }
  if (!confirm('Stadt wirklich zurücksetzen? Der Spielstand geht verloren.')) return;
  resetCity();
});

gameoverReset.addEventListener('click', () => { resetCity(); });

// --- Drag ---
let drag = null, dragMoved = false;

canvas.addEventListener('mousedown', e => {
  drag = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
  dragMoved = false;
});
window.addEventListener('mousemove', e => {
  if (drag) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    camera.x = drag.cx - dx / camera.zoom;
    camera.y = drag.cy - dy / camera.zoom;
    draw();
    return;
  }
  // Bau-Vorschau aktualisieren
  if (!map) return;
  const t = canvasToTerrain(e.clientX, e.clientY);
  const cell = terrainToCell(t.x, t.y);
  const next = cell ? { gx: cell.gx, gy: cell.gy, ...evaluateBuild(cell.gx, cell.gy) } : null;
  // Nur neu zeichnen, wenn sich die Hover-Zelle ändert (spart Renders)
  if (!sameHover(hover, next)) {
    hover = next;
    if (next && next.cost !== undefined && activeTool !== 'inspect') {
      const c = next.cost;
      const money = c < 0 ? `+${(-c).toLocaleString('de-DE')} €` : `-${c.toLocaleString('de-DE')} €`;
      tileInfo.textContent = next.ok
        ? `[${next.gx},${next.gy}] ${activeTool} → ${money}`
        : `[${next.gx},${next.gy}] ${next.reason ?? 'nicht baubar'}`;
    } else if (next && !next.ok && activeTool !== 'inspect') {
      tileInfo.textContent = `[${next.gx},${next.gy}] ${next.reason ?? 'nicht baubar'}`;
    }
    draw();
  }
});
function sameHover(a, b) {
  if (!a || !b) return a === b;
  return a.gx === b.gx && a.gy === b.gy && a.ok === b.ok;
}
canvas.addEventListener('mouseleave', () => { if (hover) { hover = null; draw(); } });
window.addEventListener('mouseup', () => { drag = null; });

// --- Zoom ---
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1/1.15;
  const t = canvasToTerrain(e.clientX, e.clientY);
  camera.zoom = Math.max(1, Math.min(64, camera.zoom * factor));
  camera.x = t.x - (e.clientX - canvas.width/2)  / camera.zoom;
  camera.y = t.y - (e.clientY - canvas.height/2) / camera.zoom;
  draw();
}, { passive: false });

// --- Touch ---
let lastTouch = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1)
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, cx: camera.x, cy: camera.y };
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length !== 1 || !lastTouch) return;
  camera.x = lastTouch.cx - (e.touches[0].clientX - lastTouch.x) / camera.zoom;
  camera.y = lastTouch.cy - (e.touches[0].clientY - lastTouch.y) / camera.zoom;
  draw();
}, { passive: true });
canvas.addEventListener('touchend', () => { lastTouch = null; });

// --- Versionsanzeige ---
// version.json wird beim Release auf gh-pages erzeugt; lokal liegt ein
// "dev"-Platzhalter. Best effort — fehlt die Datei, bleibt "RealCity" stehen.
(async function showVersion() {
  const el = document.getElementById('version');
  if (!el) return;
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    if (!r.ok) return;
    const v = await r.json();
    el.textContent = `RealCity ${v.version || 'dev'}`;
    if (v.commit && v.commit !== 'local') el.title = `Commit ${v.commit} · ${v.date || ''}`;
  } catch {
    /* offline / file:// — Anzeige bleibt beim Standard */
  }
})();

draw();
