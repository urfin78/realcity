// Unit-Tests für die Straßennetz-Analyse (src/core/network.js)
// Läuft mit Node-Standardbibliothek: `node --test` — kein npm, keine Dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRoadNeighbor, isConnected, hasZoneInRadius, connectedRoadSet } from '../src/core/network.js';

const GRID = 64;
const idx = (gx, gy) => gy * GRID + gx;

/** Erzeugt ein leeres Zell-Array. */
function emptyCells() {
  return new Array(GRID * GRID).fill(null);
}
const road = () => ({ type: 'road', level: 0 });
const zone = (z, level = 1) => ({ type: 'zone', zone: z, level });

test('hasRoadNeighbor: erkennt Straße in 4er-Nachbarschaft', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();
  assert.equal(hasRoadNeighbor(cells, 5, 4), true);  // oberhalb
  assert.equal(hasRoadNeighbor(cells, 5, 6), true);  // unterhalb
  assert.equal(hasRoadNeighbor(cells, 4, 5), true);  // links
  assert.equal(hasRoadNeighbor(cells, 6, 5), true);  // rechts
});

test('hasRoadNeighbor: Diagonale zählt nicht', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();
  assert.equal(hasRoadNeighbor(cells, 6, 6), false);
});

test('hasRoadNeighbor: keine Straße in der Nähe', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();
  assert.equal(hasRoadNeighbor(cells, 10, 10), false);
});

test('hasRoadNeighbor: respektiert Kartenränder ohne Absturz', () => {
  const cells = emptyCells();
  cells[idx(0, 0)] = road();
  assert.equal(hasRoadNeighbor(cells, 0, 1), true);
  // Ecke abfragen darf nicht über den Rand greifen
  assert.doesNotThrow(() => hasRoadNeighbor(cells, 0, 0));
  assert.doesNotThrow(() => hasRoadNeighbor(cells, GRID - 1, GRID - 1));
});

test('connectedRoadSet: enthält genau die Straßenzellen', () => {
  const cells = emptyCells();
  cells[idx(1, 1)] = road();
  cells[idx(2, 1)] = road();
  cells[idx(40, 40)] = zone('residential');
  const set = connectedRoadSet(cells);
  assert.equal(set.size, 2);
  assert.equal(set.has(idx(1, 1)), true);
  assert.equal(set.has(idx(2, 1)), true);
  assert.equal(set.has(idx(40, 40)), false);
});

test('isConnected: Zone neben zusammenhängendem Netz ist verbunden', () => {
  const cells = emptyCells();
  // Horizontale Straße y=10, x=5..10
  for (let x = 5; x <= 10; x++) cells[idx(x, 10)] = road();
  // Zone direkt unter der Straße
  assert.equal(isConnected(cells, 7, 11), true);
});

test('isConnected: ohne jede Straße nicht verbunden', () => {
  const cells = emptyCells();
  assert.equal(isConnected(cells, 7, 11), false);
});

test('isConnected: nur das GRÖSSTE Netz zählt — isolierte Einzelstraße nicht', () => {
  const cells = emptyCells();
  // Großes Netz: x=5..12 bei y=10
  for (let x = 5; x <= 12; x++) cells[idx(x, 10)] = road();
  // Isolierte Einzelstraße weit weg
  cells[idx(40, 40)] = road();
  // Zone am großen Netz → verbunden
  assert.equal(isConnected(cells, 8, 11), true);
  // Zone an der isolierten Einzelstraße → NICHT verbunden (nicht im größten Netz)
  assert.equal(isConnected(cells, 40, 41), false);
});

test('hasZoneInRadius: findet Zone in Manhattan-Radius, ignoriert Level 0', () => {
  const cells = emptyCells();
  cells[idx(10, 10)] = zone('commercial', 2);
  assert.equal(hasZoneInRadius(cells, 10, 13, 'commercial', 5), true);   // Distanz 3
  assert.equal(hasZoneInRadius(cells, 10, 16, 'commercial', 5), false);  // Distanz 6 > 5
  assert.equal(hasZoneInRadius(cells, 10, 11, 'industrial', 5), false);  // falscher Typ
});

test('hasZoneInRadius: Zone auf Level 0 zählt nicht (noch nicht gewachsen)', () => {
  const cells = emptyCells();
  cells[idx(10, 10)] = zone('commercial', 0);
  assert.equal(hasZoneInRadius(cells, 10, 11, 'commercial', 5), false);
});
