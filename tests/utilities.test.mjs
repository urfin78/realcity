// Unit-Tests für Versorgungsnetz + RCI-Nachfrage (src/core/utilities.js)
// Node-Standardbibliothek, kein npm.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePowered, computeDemand, demandFactor, powerDemand, POWER_CAPACITY,
} from '../src/core/utilities.js';

const GRID = 64;
const idx = (gx, gy) => gy * GRID + gx;

function emptyCells() {
  return new Array(GRID * GRID).fill(null);
}
const road  = () => ({ type: 'road', level: 0 });
const power = () => ({ type: 'power', level: 0 });
const zone  = (z, level = 0) => ({ type: 'zone', zone: z, level });

test('ohne Kraftwerk ist keine Zone versorgt', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();
  cells[idx(5, 6)] = zone('residential', 1);
  assert.equal(computePowered(cells).size, 0);
});

test('Kraftwerk versorgt direkt benachbarte Zone', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = power();
  cells[idx(6, 5)] = zone('residential', 1);
  const powered = computePowered(cells);
  assert.ok(powered.has(idx(6, 5)), 'Nachbarzone ist versorgt');
});

test('Strom breitet sich über Straßen aus', () => {
  const cells = emptyCells();
  cells[idx(0, 0)] = power();
  // Straßenkette vom Kraftwerk weg
  for (let x = 1; x <= 5; x++) cells[idx(x, 0)] = road();
  cells[idx(5, 1)] = zone('industrial', 1); // hängt am Ende der Kette
  assert.ok(computePowered(cells).has(idx(5, 1)));
});

test('nicht verbundene Zone bleibt unversorgt', () => {
  const cells = emptyCells();
  cells[idx(0, 0)] = power();
  cells[idx(40, 40)] = zone('residential', 1); // weit weg, keine Verbindung
  assert.equal(computePowered(cells).has(idx(40, 40)), false);
});

test('Zonen jenseits der Kapazität bleiben unversorgt', () => {
  const cells = emptyCells();
  cells[idx(0, 0)] = power();
  // Eine Reihe von Level-1-Zonen (Bedarf je 1) entlang einer Straße.
  // POWER_CAPACITY Zonen passen, die nächste nicht mehr.
  for (let x = 1; x <= POWER_CAPACITY + 1; x++) cells[idx(x, 0)] = zone('residential', 1);
  const powered = computePowered(cells);
  assert.equal(powered.size, POWER_CAPACITY, 'genau Kapazität-viele Zonen versorgt');
  // Die in Index-Reihenfolge letzte Zone fällt heraus.
  assert.equal(powered.has(idx(POWER_CAPACITY + 1, 0)), false);
});

test('höheres Level erhöht den Strombedarf', () => {
  assert.equal(powerDemand(zone('residential', 0)), 1, 'Level-0-Zone braucht 1');
  assert.equal(powerDemand(zone('residential', 3)), 3);
  assert.equal(powerDemand(road()), 0, 'Straße hat keinen Bedarf');
});

test('zwei Kraftwerke in einem Netz summieren ihre Kapazität', () => {
  const cells = emptyCells();
  cells[idx(0, 0)] = power();
  cells[idx(1, 0)] = power();
  // 2 × Kapazität Zonen entlang einer Straße ab den Kraftwerken
  for (let x = 2; x < 2 + 2 * POWER_CAPACITY; x++) cells[idx(x, 0)] = zone('residential', 1);
  assert.equal(computePowered(cells).size, 2 * POWER_CAPACITY);
});

test('RCI: leere Stadt hat positive Wohn-Nachfrage', () => {
  const demand = computeDemand(emptyCells());
  assert.ok(demand.residential > 0);
});

test('RCI: Überangebot an Wohnen senkt die Wohn-Nachfrage', () => {
  const cells = emptyCells();
  for (let x = 0; x < 10; x++) cells[idx(x, 0)] = zone('residential', 1);
  const demand = computeDemand(cells);
  assert.ok(demand.residential < 0, 'nur Wohnen → negative Wohn-Nachfrage');
  assert.ok(demand.commercial > 0, 'Gewerbe fehlt → positive Nachfrage');
  assert.ok(demand.industrial > 0, 'Industrie fehlt → positive Nachfrage');
});

test('demandFactor: positive Nachfrage beschleunigt, negative bremst', () => {
  assert.equal(demandFactor({ residential: 0 }, 'residential'), 1);
  assert.ok(demandFactor({ residential: 1 }, 'residential') > 1);
  assert.ok(demandFactor({ residential: -1 }, 'residential') < 1);
  assert.ok(demandFactor({ residential: -1 }, 'residential') >= 0, 'nie negativ');
});
