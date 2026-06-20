// Unit-Tests für die Wachstumssimulation (src/core/simulation.js)
// Node-Standardbibliothek, kein npm.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from '../src/core/simulation.js';
import { state, INCOME } from '../src/core/state.js';

const GRID = 64;
const idx = (gx, gy) => gy * GRID + gx;

function emptyCells() {
  return new Array(GRID * GRID).fill(null);
}
const road = () => ({ type: 'road', level: 0 });
const zone = (z, level = 0) => ({ type: 'zone', zone: z, level });

beforeEach(() => {
  state.money = 100_000;
  state.population = 0;
  state.tick = 0;
});

/** Legt eine horizontale Straße y, x=x0..x1 an. */
function road_h(cells, y, x0, x1) {
  for (let x = x0; x <= x1; x++) cells[idx(x, y)] = road();
}

test('Industrie an Straße wächst pro Tick (0→1→2→3, dann Deckel)', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 10);
  cells[idx(7, 11)] = zone('industrial', 0);
  const c = cells[idx(7, 11)];

  runSimulation(cells); assert.equal(c.level, 1);
  runSimulation(cells); assert.equal(c.level, 2);
  runSimulation(cells); assert.equal(c.level, 3);
  runSimulation(cells); assert.equal(c.level, 3, 'Level 3 ist das Maximum');
});

test('Industrie ohne Straße wächst nicht und schrumpft', () => {
  const cells = emptyCells();
  cells[idx(7, 11)] = zone('industrial', 2); // ohne Straße
  runSimulation(cells);
  assert.equal(cells[idx(7, 11)].level, 1, 'schrumpft ohne Verbindung');
});

test('Wohnen wächst nur mit Gewerbe/Industrie in Reichweite', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 20);
  const home = zone('residential', 0);
  cells[idx(6, 11)] = home;

  // Ohne Nachbar-Zone: kein Wachstum
  runSimulation(cells);
  assert.equal(home.level, 0, 'kein Wachstum ohne Gewerbe/Industrie');

  // Industrie in Radius 5 hinzufügen (muss Level>0 haben um zu zählen)
  cells[idx(9, 11)] = zone('industrial', 2);
  runSimulation(cells);
  assert.equal(home.level, 1, 'wächst mit Industrie in Reichweite');
});

test('Gewerbe wächst nur mit Wohnen in Radius 3', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 20);
  const shop = zone('commercial', 0);
  cells[idx(6, 11)] = shop;

  runSimulation(cells);
  assert.equal(shop.level, 0, 'kein Wachstum ohne Wohnen');

  cells[idx(8, 11)] = zone('residential', 2); // Distanz 2 ≤ 3
  runSimulation(cells);
  assert.equal(shop.level, 1);
});

test('Verwaltung: Level 1 wenn verbunden, sonst 0 — wächst nie höher', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 10);
  const admin = zone('admin', 0);
  cells[idx(7, 11)] = admin;

  runSimulation(cells);
  assert.equal(admin.level, 1);
  runSimulation(cells);
  assert.equal(admin.level, 1, 'Verwaltung wächst nie über 1');
});

test('Einnahmen = INCOME[zone] × level summiert über alle Zonen', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 12);
  cells[idx(7, 11)] = zone('industrial', 3); // wächst beim Tick auf 3 (Deckel)
  state.money = 0;

  const income = runSimulation(cells);
  // Nach dem Tick ist Level 3 → Einnahme = INCOME.industrial * 3
  assert.equal(income, INCOME.industrial * 3);
  assert.equal(state.money, income, 'earn() hat das Budget erhöht');
});

test('Bevölkerung steigt mit Wohn-Level', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 12);
  cells[idx(6, 11)] = zone('residential', 0);
  cells[idx(9, 11)] = zone('industrial', 2); // Wachstumstreiber

  runSimulation(cells);
  assert.ok(state.population > 0, 'Wohnzone mit Level>0 erzeugt Bevölkerung');
});

test('runSimulation ignoriert Straßen und leere Zellen', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 12);
  const income = runSimulation(cells);
  assert.equal(income, 0);
  assert.equal(state.population, 0);
});
