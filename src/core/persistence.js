// Spielstand-Persistenz — Serialisierung + localStorage-Wrapper
//
// serialize/deserialize sind reine Funktionen (kein DOM, kein localStorage),
// damit sie mit node:test prüfbar sind. save/load kapseln localStorage.

export const GAME_GRID = 64;
const SCHEMA = 1;
const KEY_PREFIX = 'realcity:';

/**
 * Wandelt Spielzustand in einen kompakten JSON-String.
 * Nur belegte Zellen werden gespeichert: [index, kurzcode, level].
 * Kurzcode: 'R' road, 'r' residential, 'c' commercial, 'i' industrial, 'a' admin.
 */
const ZONE_CODE = { residential: 'r', commercial: 'c', industrial: 'i', admin: 'a' };
const CODE_ZONE = { r: 'residential', c: 'commercial', i: 'industrial', a: 'admin' };

function cellCode(cell) {
  if (cell.type === 'road') return 'R';
  return ZONE_CODE[cell.zone] ?? null;
}

export function serialize(cells, state) {
  const packed = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c) continue;
    const code = cellCode(c);
    if (!code) continue;
    packed.push([i, code, c.level | 0]);
  }
  return JSON.stringify({
    schema: SCHEMA,
    grid: GAME_GRID,
    money: state.money,
    population: state.population,
    tick: state.tick,
    cells: packed,
  });
}

/**
 * Liest einen serialisierten Spielstand zurück.
 * Wirft bei ungültigem JSON, falschem Schema oder falscher Grid-Größe.
 * @returns {{ cells: Array, state: {money:number, population:number, tick:number} }}
 */
export function deserialize(json) {
  const data = JSON.parse(json); // wirft bei kaputtem JSON
  if (data.schema !== SCHEMA) throw new Error(`Unbekanntes Schema: ${data.schema}`);
  if (data.grid !== GAME_GRID) throw new Error(`Grid-Größe ${data.grid} ≠ ${GAME_GRID}`);
  if (!Array.isArray(data.cells)) throw new Error('cells fehlt oder ist kein Array');

  const cells = new Array(GAME_GRID * GAME_GRID).fill(null);
  for (const entry of data.cells) {
    const [i, code, level] = entry;
    if (i < 0 || i >= cells.length) throw new Error(`Zell-Index außerhalb: ${i}`);
    if (code === 'R') {
      cells[i] = { type: 'road', level: 0 };
    } else if (CODE_ZONE[code]) {
      cells[i] = { type: 'zone', zone: CODE_ZONE[code], level: Math.max(0, Math.min(3, level | 0)) };
    } else {
      throw new Error(`Unbekannter Zellcode: ${code}`);
    }
  }

  return {
    cells,
    state: {
      money:      Number.isFinite(data.money) ? data.money : 100_000,
      population: Number.isFinite(data.population) ? data.population : 0,
      tick:       Number.isFinite(data.tick) ? data.tick : 0,
    },
  };
}

// --- localStorage-Wrapper (Browser) ---

function storage() {
  // In Node/Tests gibt es kein localStorage → null, Aufrufer behandeln das.
  return (typeof localStorage !== 'undefined') ? localStorage : null;
}

export function save(city, cells, state) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY_PREFIX + city, serialize(cells, state));
    return true;
  } catch {
    return false; // Quota überschritten o.ä.
  }
}

export function load(city) {
  const s = storage();
  if (!s) return null;
  const json = s.getItem(KEY_PREFIX + city);
  if (!json) return null;
  try {
    return deserialize(json);
  } catch {
    return null; // korrupter Stand → ignorieren
  }
}

export function clear(city) {
  const s = storage();
  if (s) s.removeItem(KEY_PREFIX + city);
}

export function hasSave(city) {
  const s = storage();
  return !!(s && s.getItem(KEY_PREFIX + city));
}
