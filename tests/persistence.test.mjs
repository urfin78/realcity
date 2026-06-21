// Unit-Tests für die Spielstand-Persistenz (src/core/persistence.js)
// Node-Standardbibliothek, kein npm.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize, GAME_GRID } from '../src/core/persistence.js';

const idx = (gx, gy) => gy * GAME_GRID + gx;

function emptyCells() {
  return new Array(GAME_GRID * GAME_GRID).fill(null);
}
const road = () => ({ type: 'road', level: 0 });
const zone = (z, level = 1) => ({ type: 'zone', zone: z, level });

test('Round-Trip: serialize → deserialize erhält Zellen und state', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();
  cells[idx(6, 5)] = road();
  cells[idx(5, 6)] = zone('residential', 2);
  cells[idx(7, 7)] = zone('industrial', 3);
  cells[idx(9, 9)] = zone('admin', 1);
  const state = { money: 42_000, population: 350, tick: 17 };

  const { cells: out, state: outState } = deserialize(serialize(cells, state));

  assert.equal(outState.money, 42_000);
  assert.equal(outState.population, 350);
  assert.equal(outState.tick, 17);

  assert.deepEqual(out[idx(5, 5)], { type: 'road', level: 0 });
  assert.deepEqual(out[idx(5, 6)], { type: 'zone', zone: 'residential', level: 2 });
  assert.deepEqual(out[idx(7, 7)], { type: 'zone', zone: 'industrial', level: 3 });
  assert.deepEqual(out[idx(9, 9)], { type: 'zone', zone: 'admin', level: 1 });
  // Unbelegte Zellen bleiben null
  assert.equal(out[idx(0, 0)], null);
});

test('Round-Trip: Wirtschaftsfelder (Steuer, Schulden, Bankrott) bleiben erhalten', () => {
  const cells = emptyCells();
  cells[idx(1, 1)] = road();
  const state = {
    money: 5_000, population: 0, tick: 3,
    taxRates: { residential: 0.05, commercial: 0.15, industrial: 0.2 },
    debt: 12_345, brokeTicks: 2, gameOver: false,
  };
  const { state: out } = deserialize(serialize(cells, state));
  assert.equal(out.taxRates.residential, 0.05);
  assert.equal(out.taxRates.commercial, 0.15);
  assert.equal(out.taxRates.industrial, 0.2);
  assert.equal(out.debt, 12_345);
  assert.equal(out.brokeTicks, 2);
  assert.equal(out.gameOver, false);
});

test('deserialize: altes Schema-1-Format bekommt Wirtschafts-Defaults', () => {
  const old = JSON.stringify({
    schema: 1, grid: GAME_GRID, money: 9_000, population: 10, tick: 4,
    cells: [[idx(2, 2), 'r', 1]],
  });
  const { state } = deserialize(old);
  assert.equal(state.debt, 0);
  assert.equal(state.gameOver, false);
  assert.equal(state.taxRates.residential, 0.1, 'Default-Steuer 10 %');
});

test('serialize speichert nur belegte Zellen (kompakt)', () => {
  const cells = emptyCells();
  cells[idx(1, 1)] = road();
  const data = JSON.parse(serialize(cells, { money: 0, population: 0, tick: 0 }));
  assert.equal(data.cells.length, 1);
  assert.equal(data.grid, GAME_GRID);
});

test('deserialize weist kaputtes JSON ab', () => {
  assert.throws(() => deserialize('{nicht valide'));
});

test('deserialize weist falsche Grid-Größe ab', () => {
  const bad = JSON.stringify({ schema: 1, grid: 32, cells: [], money: 0, population: 0, tick: 0 });
  assert.throws(() => deserialize(bad), /Grid-Größe/);
});

test('deserialize weist unbekanntes Schema ab', () => {
  const bad = JSON.stringify({ schema: 999, grid: GAME_GRID, cells: [] });
  assert.throws(() => deserialize(bad), /Schema/);
});

test('deserialize weist Zell-Index außerhalb des Rasters ab', () => {
  const bad = JSON.stringify({
    schema: 1, grid: GAME_GRID, money: 0, population: 0, tick: 0,
    cells: [[GAME_GRID * GAME_GRID + 10, 'R', 0]],
  });
  assert.throws(() => deserialize(bad), /außerhalb/);
});

test('deserialize klemmt Zonen-Level auf 0..3', () => {
  const data = JSON.stringify({
    schema: 1, grid: GAME_GRID, money: 0, population: 0, tick: 0,
    cells: [[idx(2, 2), 'r', 99]],
  });
  const { cells } = deserialize(data);
  assert.equal(cells[idx(2, 2)].level, 3);
});
