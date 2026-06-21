// Unit-Tests für die Wachstumssimulation (src/core/simulation.js)
// Node-Standardbibliothek, kein npm.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from '../src/core/simulation.js';
import { state, resetState, INCOME, UPKEEP } from '../src/core/state.js';

const GRID = 64;
const idx = (gx, gy) => gy * GRID + gx;

function emptyCells() {
  return new Array(GRID * GRID).fill(null);
}
const road  = () => ({ type: 'road', level: 0 });
const power = () => ({ type: 'power', level: 0 });
const zone  = (z, level = 0) => ({ type: 'zone', zone: z, level });

// Diese Tests prüfen die Wachstumslogik unabhängig vom Steuer-Würfel:
// alwaysGrow erzwingt das Wachstum, wenn die Bedingungen erfüllt sind.
const alwaysGrow = () => 0;
const sim = (cells) => runSimulation(cells, alwaysGrow);

beforeEach(() => {
  resetState();
});

/**
 * Legt eine horizontale Straße y, x=x0..x1 an und hängt ein Kraftwerk daran,
 * damit die angeschlossenen Zonen mit Strom versorgt sind (Voraussetzung fürs
 * Wachstum). Das Kraftwerk sitzt oberhalb des linken Straßenendes.
 */
function road_h(cells, y, x0, x1) {
  for (let x = x0; x <= x1; x++) cells[idx(x, y)] = road();
  cells[idx(x0, y - 1)] = power();
}

test('Industrie an Straße wächst pro Tick (0→1→2→3, dann Deckel)', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 10);
  cells[idx(7, 11)] = zone('industrial', 0);
  const c = cells[idx(7, 11)];

  sim(cells); assert.equal(c.level, 1);
  sim(cells); assert.equal(c.level, 2);
  sim(cells); assert.equal(c.level, 3);
  sim(cells); assert.equal(c.level, 3, 'Level 3 ist das Maximum');
});

test('Industrie ohne Straße wächst nicht und schrumpft', () => {
  const cells = emptyCells();
  cells[idx(7, 11)] = zone('industrial', 2); // ohne Straße
  sim(cells);
  assert.equal(cells[idx(7, 11)].level, 1, 'schrumpft ohne Verbindung');
});

test('Wohnen wächst nur mit Gewerbe/Industrie in Reichweite', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 20);
  const home = zone('residential', 0);
  cells[idx(6, 11)] = home;

  // Ohne Nachbar-Zone: kein Wachstum
  sim(cells);
  assert.equal(home.level, 0, 'kein Wachstum ohne Gewerbe/Industrie');

  // Industrie in Radius 5 hinzufügen (muss Level>0 haben um zu zählen)
  cells[idx(9, 11)] = zone('industrial', 2);
  sim(cells);
  assert.equal(home.level, 1, 'wächst mit Industrie in Reichweite');
});

test('Gewerbe wächst nur mit Wohnen in Radius 3', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 20);
  const shop = zone('commercial', 0);
  cells[idx(6, 11)] = shop;

  sim(cells);
  assert.equal(shop.level, 0, 'kein Wachstum ohne Wohnen');

  cells[idx(8, 11)] = zone('residential', 2); // Distanz 2 ≤ 3
  sim(cells);
  assert.equal(shop.level, 1);
});

test('Verwaltung: Level 1 wenn verbunden, sonst 0 — wächst nie höher', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 10);
  const admin = zone('admin', 0);
  cells[idx(7, 11)] = admin;

  sim(cells);
  assert.equal(admin.level, 1);
  sim(cells);
  assert.equal(admin.level, 1, 'Verwaltung wächst nie über 1');
});

test('Einnahmen = INCOME[zone] × level summiert über alle Zonen', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 12);          // 8 Straßenfelder
  cells[idx(7, 11)] = zone('industrial', 3);
  state.money = 50_000;

  const net = sim(cells);
  // Netto = Brutto-Steuer (Level 3, 10 %) − Unterhalt (Straßen + Kraftwerk + Zone).
  // road_h hängt ein Kraftwerk an die Straße (Stromversorgung).
  const gross  = INCOME.industrial * 3 * 0.10;
  const upkeep = UPKEEP.road * 8 + UPKEEP.power + UPKEEP.industrial * 3;
  assert.equal(net, Math.round(gross - upkeep));
  assert.equal(state.money, 50_000 + net, 'earn() hat das Budget verändert');
});

test('Bevölkerung steigt mit Wohn-Level', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 12);
  cells[idx(6, 11)] = zone('residential', 0);
  cells[idx(9, 11)] = zone('industrial', 2); // Wachstumstreiber

  sim(cells);
  assert.ok(state.population > 0, 'Wohnzone mit Level>0 erzeugt Bevölkerung');
});

test('Straßen erzeugen keine Einnahmen, nur Unterhalt', () => {
  const cells = emptyCells();
  road_h(cells, 10, 5, 12);          // 8 Straßenfelder + Kraftwerk, keine Zonen
  const net = sim(cells);
  // Unterhalt aus Straßen und dem von road_h angehängten Kraftwerk.
  assert.equal(net, -(UPKEEP.road * 8 + UPKEEP.power), 'nur Infrastruktur-Unterhalt');
  assert.equal(state.population, 0);
});
