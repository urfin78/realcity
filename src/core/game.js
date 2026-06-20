// RealCity — Hauptspiel

import { state, spend, startTicks, onTick, COSTS } from './state.js';
import { runSimulation } from './simulation.js';
import { isConnected, hasRoadNeighbor } from './network.js';

const canvas    = document.getElementById('gameCanvas');
const ctx       = canvas.getContext('2d');
const tileInfo  = document.getElementById('tile-info');
const hudMoney  = document.getElementById('hud-money');
const hudPop    = document.getElementById('hud-pop');
const hudTick   = document.getElementById('hud-tick');
const loadBtn   = document.getElementById('load-btn');
const citySelect= document.getElementById('city-select');

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
}

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
}

// --- Karte laden ---
async function loadMap(city) {
  tileInfo.textContent = `Lade ${city}...`;
  loadBtn.disabled = true;
  try {
    const r = await fetch(`maps/${city}.json`);
    if (!r.ok) throw new Error(`maps/${city}.json nicht gefunden`);
    map   = await r.json();
    cells = new Array(GAME_GRID * GAME_GRID).fill(null);
    camera.x    = map.grid / 2;
    camera.y    = map.grid / 2;
    camera.zoom = Math.min(canvas.width, canvas.height) / map.grid;
    tileInfo.textContent = `${map.name} geladen`;
    startTicks(5000);
    updateHUD();
    draw();
  } catch (e) {
    tileInfo.textContent = `Fehler: ${e.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener('click', () => loadMap(citySelect.value));

// --- Tick ---
onTick(() => {
  if (!cells) return;
  const income = runSimulation(cells);
  updateHUD();
  draw();
  if (income > 0) tileInfo.textContent = `Tick ${state.tick} — +${income.toLocaleString('de-DE')} €`;
});

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
    tileInfo.textContent = c
      ? `[${gx},${gy}] ${c.type === 'road' ? 'Straße' : c.zone} Lv${c.level}`
      : `[${gx},${gy}] ${terrain}`;
    return;
  }

  // Löschen bei Doppelklick auf eigenes Objekt
  if (cells[i]?.type === activeTool || cells[i]?.zone === activeTool) {
    cells[i] = null;
    tileInfo.textContent = `[${gx},${gy}] entfernt`;
    draw();
    return;
  }

  // Wasser kann nicht bebaut werden
  if (terrain === 'water') {
    tileInfo.textContent = `[${gx},${gy}] Wasser — nicht bebaubar`;
    return;
  }

  if (activeTool === 'road') {
    if (!spend(COSTS.road)) { tileInfo.textContent = 'Kein Geld!'; return; }
    cells[i] = { type: 'road', level: 0 };
    tileInfo.textContent = `[${gx},${gy}] Straße gebaut (-${COSTS.road.toLocaleString('de-DE')} €)`;
  } else {
    // Zone: muss neben einer Straße liegen
    if (!hasRoadNeighbor(cells, gx, gy)) {
      tileInfo.textContent = `[${gx},${gy}] Zone braucht Straße als Nachbar`;
      return;
    }
    if (!spend(COSTS.zone)) { tileInfo.textContent = 'Kein Geld!'; return; }
    cells[i] = { type: 'zone', zone: activeTool, level: 0 };
    tileInfo.textContent = `[${gx},${gy}] ${activeTool} gesetzt (-${COSTS.zone.toLocaleString('de-DE')} €)`;
  }

  updateHUD();
  draw();
});

// --- Drag ---
let drag = null, dragMoved = false;

canvas.addEventListener('mousedown', e => {
  drag = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
  dragMoved = false;
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
  camera.x = drag.cx - dx / camera.zoom;
  camera.y = drag.cy - dy / camera.zoom;
  draw();
});
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

draw();
