// Unit-Tests für Terrain-Interaktion (Hang-Aufschlag, Lage-Boni).
// Node-Standardbibliothek, kein npm. Reine Logik aus terrain.js plus die
// Bonus-Verrechnung in runSimulation.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  slopeCostFactor, isTooSteep, terrainBonus,
  SLOPE_MAX_FACTOR, SLOPE_FULL_AT, SLOPE_BLOCK,
  WATER_BONUS, FOREST_BONUS,
} from '../src/core/terrain.js';
import { runSimulation } from '../src/core/simulation.js';
import { state, resetState, setTaxRate, INCOME } from '../src/core/state.js';

const GRID = 64;
const idx = (gx, gy) => gy * GRID + gx;
function emptyCells() { return new Array(GRID * GRID).fill(null); }
const road = () => ({ type: 'road', level: 0 });
const zone = (z, level = 0, terrainBonus = 1) => ({ type: 'zone', zone: z, level, terrainBonus });
const neverGrow = () => 0.999; // kein Wachstums-Wurf trifft

beforeEach(() => { resetState(); });

// --- Hang-Aufschlag ---------------------------------------------------------

test('slopeCostFactor: flaches Gelände → Faktor 1', () => {
  assert.equal(slopeCostFactor(0), 1);
});

test('slopeCostFactor: steigt mit dem Gradienten', () => {
  const flat   = slopeCostFactor(0.05);
  const medium = slopeCostFactor(0.20);
  assert.ok(medium > flat, 'steiler muss teurer sein');
});

test('slopeCostFactor: erreicht SLOPE_MAX_FACTOR ab SLOPE_FULL_AT', () => {
  assert.equal(slopeCostFactor(SLOPE_FULL_AT), SLOPE_MAX_FACTOR);
  assert.equal(slopeCostFactor(SLOPE_FULL_AT + 0.5), SLOPE_MAX_FACTOR); // gedeckelt
});

test('isTooSteep: sperrt erst ab SLOPE_BLOCK', () => {
  assert.equal(isTooSteep(SLOPE_BLOCK - 0.01), false);
  assert.equal(isTooSteep(SLOPE_BLOCK), true);
});

// --- Lage-Boni --------------------------------------------------------------

test('terrainBonus: nur Wohnzonen profitieren', () => {
  assert.equal(terrainBonus({ zone: 'commercial', nearWater: true }), 1);
  assert.equal(terrainBonus({ zone: 'industrial', nearForest: true }), 1);
});

test('terrainBonus: Wasser- und Waldnähe addieren sich für Wohnzonen', () => {
  assert.equal(terrainBonus({ zone: 'residential' }), 1);
  assert.equal(terrainBonus({ zone: 'residential', nearWater: true }), 1 + WATER_BONUS);
  assert.equal(terrainBonus({ zone: 'residential', nearForest: true }), 1 + FOREST_BONUS);
  assert.equal(
    terrainBonus({ zone: 'residential', nearWater: true, nearForest: true }),
    1 + WATER_BONUS + FOREST_BONUS,
  );
});

// --- Integration: Bonus verstärkt die Einnahmen -----------------------------

test('runSimulation: Wohnzone mit Lage-Bonus bringt mehr Einnahmen', () => {
  function income(bonus) {
    resetState();
    const cells = emptyCells();
    for (let x = 3; x <= 8; x++) cells[idx(x, 10)] = road();
    cells[idx(3, 9)] = { type: 'power', level: 0 }; // Strom: sonst Verfall trotz Anbindung
    cells[idx(5, 11)] = zone('residential', 3, bonus);
    // Commercial-Nachbar + Strom sorgen dafür, dass canGrow=true → kein Verfall.
    // neverGrow verhindert zugleich das Hochwachsen, das Level bleibt also 3.
    cells[idx(6, 11)] = zone('commercial', 3);
    setTaxRate('residential', 0.10);
    setTaxRate('commercial', 0); // Commercial trägt nichts zur Einnahme bei
    state.money = 50_000;
    const before = state.money;
    runSimulation(cells, neverGrow);
    return state.money - before; // Netto (Einnahme − Unterhalt), beides konstant
  }
  const plain = income(1);
  const waterfront = income(1 + WATER_BONUS);
  // runSimulation rundet den Netto-Cashflow (Math.round) → Toleranz ≤ 1 €.
  const expectedDelta = INCOME.residential * 3 * 0.10 * WATER_BONUS;
  assert.ok(waterfront > plain, 'Lage-Bonus muss die Einnahme erhöhen');
  assert.ok(Math.abs((waterfront - plain) - expectedDelta) <= 1, 'Bonus-Differenz ≈ erwartet');
});

test('runSimulation: fehlender terrainBonus wird wie 1 behandelt', () => {
  const cells = emptyCells();
  for (let x = 3; x <= 8; x++) cells[idx(x, 10)] = road();
  const c = { type: 'zone', zone: 'residential', level: 3 }; // kein terrainBonus-Feld
  cells[idx(5, 11)] = c;
  setTaxRate('residential', 0.10);
  state.money = 50_000;
  assert.doesNotThrow(() => runSimulation(cells, neverGrow));
});
