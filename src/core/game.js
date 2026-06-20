import { TileMap }   from './tilemap.js';
import { Renderer }  from '../map/renderer.js';
import { loadCity }  from '../map/osmloader.js';
import { EventBus }  from './eventbus.js';
import { TileLabels } from '../data/tiletypes.js';
import { TILE_SIZE }  from '../map/geoconverter.js';

const canvas    = document.getElementById('gameCanvas');
const tileInfo  = document.getElementById('tile-info');
const statusEl  = document.getElementById('status');
const loadBtn   = document.getElementById('load-btn');
const cityInput = document.getElementById('city-input');

const tilemap  = new TileMap(0, 0);
const renderer = new Renderer(canvas);

const camera = {
  x: 0, y: 0,
  zoom: 3,
  dirty: true,
};

// --- Canvas-Größe ---
function resizeCanvas() {
  const container = canvas.parentElement;
  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.markDirty();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Kamera zentrieren ---
function centerCamera() {
  camera.x = (canvas.width  - tilemap.width  * TILE_SIZE * camera.zoom) / 2;
  camera.y = (canvas.height - tilemap.height * TILE_SIZE * camera.zoom) / 2;
  camera.dirty = true;
}

// --- Stadt laden ---
async function loadAndRender(cityName) {
  loadBtn.disabled = true;
  try {
    const { grid, width, height } = await loadCity(cityName, msg => {
      statusEl.textContent = msg;
    });
    tilemap.loadGrid(grid);
    centerCamera();
    renderer.markDirty();
  } catch (e) {
    statusEl.textContent = `Fehler: ${e.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener('click', () => loadAndRender(cityInput.value));

// --- Render-Loop ---
function loop() {
  renderer.render(tilemap, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Input: Drag ---
let drag = null;
canvas.addEventListener('mousedown', e => {
  drag = { startX: e.clientX - camera.x, startY: e.clientY - camera.y };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  camera.x = e.clientX - drag.startX;
  camera.y = e.clientY - drag.startY;
  camera.dirty = true;
});
window.addEventListener('mouseup', () => { drag = null; });

// --- Input: Zoom (Mausrad) ---
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  // Zoom um Mausposition
  camera.x = mouseX - (mouseX - camera.x) * factor;
  camera.y = mouseY - (mouseY - camera.y) * factor;
  camera.zoom = Math.max(0.5, Math.min(10, camera.zoom * factor));
  camera.dirty = true;
}, { passive: false });

// --- Input: Klick → Tile-Info ---
canvas.addEventListener('click', e => {
  if (drag) return; // war ein Drag
  const tileSize = TILE_SIZE * camera.zoom;
  const tx = Math.floor((e.clientX - camera.x) / tileSize);
  const ty = Math.floor((e.clientY - camera.y) / tileSize);
  const type = tilemap.getTile(tx, ty);
  if (type !== null) {
    tileInfo.textContent = `[${tx}, ${ty}] ${TileLabels[type] ?? type}`;
    EventBus.emit('tile:selected', { x: tx, y: ty, type });
  }
});

// --- Touch-Support: Drag ---
let lastTouch = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && lastTouch) {
    camera.x += e.touches[0].clientX - lastTouch.x;
    camera.y += e.touches[0].clientY - lastTouch.y;
    camera.dirty = true;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { lastTouch = null; });

// Beim Start direkt Dresden laden
loadAndRender('Dresden');
