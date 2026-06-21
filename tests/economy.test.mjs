// Unit-Tests für Wirtschaft & Balance (Unterhalt, Steuer, Kredit, Bankrott).
// Node-Standardbibliothek, kein npm.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from '../src/core/simulation.js';
import {
  state, resetState, setTaxRate, takeLoan, serviceLoan, checkBankruptcy,
  UPKEEP, INCOME, LOAN_INTEREST, LOAN_REPAYMENT, BANKRUPTCY_TICKS, BANKRUPTCY_THRESHOLD,
} from '../src/core/state.js';

const GRID = 64;
const idx = (gx, gy) => gy * GRID + gx;

function emptyCells() { return new Array(GRID * GRID).fill(null); }
const road = () => ({ type: 'road', level: 0 });
const zone = (z, level = 0) => ({ type: 'zone', zone: z, level });

// deterministischer RNG: ≥ jede Wahrscheinlichkeit → kein Wachstums-Wurf trifft.
const neverGrow = () => 0.999;

beforeEach(() => { resetState(); });

test('Unterhalt: leere Straße zieht UPKEEP.road vom Budget ab', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();
  state.money = 10_000;
  const net = runSimulation(cells, neverGrow);
  assert.equal(net, -UPKEEP.road);
  assert.equal(state.money, 10_000 - UPKEEP.road);
});

test('Netto-Cashflow = Steuereinnahme − Unterhalt', () => {
  const cells = emptyCells();
  // Eine Industrie-Zone Level 3 an Straße, Steuer 10 %.
  for (let x = 3; x <= 8; x++) cells[idx(x, 10)] = road();
  cells[idx(5, 11)] = zone('industrial', 3);
  setTaxRate('industrial', 0.10);
  state.money = 50_000;

  // neverGrow: Level bleibt 3 (kein Wachstum, kein Schrumpfen da verbunden)
  const net = runSimulation(cells, neverGrow);

  const gross  = INCOME.industrial * 3 * 0.10;
  const upkeep = UPKEEP.road * 6 + UPKEEP.industrial * 3;
  assert.equal(net, Math.round(gross - upkeep));
});

test('Höhere Steuer → mehr Brutto-Einnahme bei gleichem Level', () => {
  function netAtTax(rate) {
    resetState();
    const cells = emptyCells();
    for (let x = 3; x <= 8; x++) cells[idx(x, 10)] = road();
    cells[idx(5, 11)] = zone('industrial', 3);
    setTaxRate('industrial', rate);
    return runSimulation(cells, neverGrow);
  }
  // Höherer Satz → höherer (weniger negativer) Netto-Cashflow.
  assert.ok(netAtTax(0.20) > netAtTax(0.05));
});

test('Steuer bremst Wachstum: bei 0 % wächst es, RNG-Schwelle sinkt mit Steuer', () => {
  // Bei voller Steuer (20 %) liegt die Wachstumschance bei 0.4.
  // Ein RNG-Wert von 0.5 lässt bei 0 % wachsen, bei 20 % nicht.
  function grewWithTax(rate) {
    resetState();
    const cells = emptyCells();
    for (let x = 3; x <= 8; x++) cells[idx(x, 10)] = road();
    const z = zone('industrial', 0);
    cells[idx(5, 11)] = z;
    setTaxRate('industrial', rate);
    runSimulation(cells, () => 0.5);
    return z.level > 0;
  }
  assert.equal(grewWithTax(0.0), true,  'ohne Steuer wächst es');
  assert.equal(grewWithTax(0.2), false, 'bei Maximalsteuer nicht');
});

test('Kredit: takeLoan erhöht Budget und Schulden', () => {
  state.money = 1_000;
  takeLoan(50_000);
  assert.equal(state.money, 51_000);
  assert.equal(state.debt, 50_000);
});

test('Kredit: serviceLoan tilgt und verzinst über Ticks', () => {
  state.money = 100_000;
  takeLoan(10_000);
  const repay = serviceLoan();
  // Schuld nach Zins: 10_000 * 1.02 = 10_200; Tilgung 5 % = 510
  const afterInterest = 10_000 * (1 + LOAN_INTEREST);
  const expectedRepay = afterInterest * LOAN_REPAYMENT;
  assert.ok(Math.abs(repay - expectedRepay) < 1e-6);
  assert.ok(Math.abs(state.debt - (afterInterest - expectedRepay)) < 1e-6);
  assert.ok(state.money < 100_000, 'Tilgung mindert das Budget');
});

test('Kredit: Schuld sinkt über viele Ticks gegen 0', () => {
  takeLoan(10_000);
  for (let i = 0; i < 500; i++) serviceLoan();
  assert.equal(state.debt, 0);
});

test('Bankrott: gameOver nach BANKRUPTCY_TICKS unter Schwelle', () => {
  state.money = BANKRUPTCY_THRESHOLD - 1;
  for (let i = 0; i < BANKRUPTCY_TICKS - 1; i++) {
    checkBankruptcy();
    assert.equal(state.gameOver, false);
  }
  checkBankruptcy();
  assert.equal(state.gameOver, true);
});

test('Bankrott: Zähler setzt zurück, sobald Budget wieder positiv', () => {
  state.money = BANKRUPTCY_THRESHOLD - 1;
  checkBankruptcy();
  checkBankruptcy();
  assert.ok(state.brokeTicks >= 2);
  state.money = 1_000;
  checkBankruptcy();
  assert.equal(state.brokeTicks, 0);
  assert.equal(state.gameOver, false);
});

test('Akzeptanz: Stadt ohne Einnahmen rutscht durch Unterhalt in den Bankrott', () => {
  const cells = emptyCells();
  cells[idx(5, 5)] = road();            // nur Unterhalt, keine Einnahmen
  state.money = UPKEEP.road * 2;        // reicht für ~2 Ticks
  for (let i = 0; i < 50 && !state.gameOver; i++) runSimulation(cells, neverGrow);
  assert.equal(state.gameOver, true);
  assert.ok(state.money < BANKRUPTCY_THRESHOLD);
});
