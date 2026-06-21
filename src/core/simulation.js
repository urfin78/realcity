// Wachstumssimulation — läuft einmal pro Tick

import { state, earn, INCOME, UPKEEP, serviceLoan, checkBankruptcy } from './state.js';
import { isConnected, hasZoneInRadius } from './network.js';
import { computePowered, computeDemand, demandFactor } from './utilities.js';

const GAME_GRID = 64;
function idx(gx, gy) { return gy * GAME_GRID + gx; }

// Höhere Steuer bremst das Wachstum: bei TAX_MAX (20 %) sinkt die
// Wachstumswahrscheinlichkeit auf GROWTH_AT_MAX_TAX, dazwischen linear.
const GROWTH_AT_MAX_TAX = 0.4;
function growthChance(taxRate) {
  // taxRate 0.0 → 1.0 ; 0.2 → GROWTH_AT_MAX_TAX
  return 1 - (taxRate / 0.2) * (1 - GROWTH_AT_MAX_TAX);
}

// rng erlaubt deterministisches Testen; Default ist Math.random.
export function runSimulation(cells, rng = Math.random) {
  let gross   = 0;   // Brutto-Steuereinnahmen
  let upkeep  = 0;   // laufender Unterhalt
  let population = 0;

  // Versorgungsnetz und RCI-Nachfrage einmal pro Tick vorab berechnen.
  const powered = computePowered(cells);
  const demand  = computeDemand(cells);
  state.demand  = demand;

  for (let gy = 0; gy < GAME_GRID; gy++) {
    for (let gx = 0; gx < GAME_GRID; gx++) {
      const i = idx(gx, gy);
      const cell = cells[i];
      if (!cell) continue;

      if (cell.type === 'road')  { upkeep += UPKEEP.road; continue; }
      if (cell.type === 'power') { upkeep += UPKEEP.power; continue; }
      if (cell.type !== 'zone') continue;

      // Unterhalt: Grundbetrag × max(level, 1), auch Level-0-Zonen kosten.
      upkeep += (UPKEEP[cell.zone] ?? 0) * Math.max(cell.level, 1);

      const connected = isConnected(cells, gx, gy);
      const hasPower  = powered.has(i);
      const taxRate = state.taxRates[cell.zone] ?? 0;

      let canGrow = false;
      switch (cell.zone) {
        case 'residential':
          canGrow = connected && (
            hasZoneInRadius(cells, gx, gy, 'commercial', 5) ||
            hasZoneInRadius(cells, gx, gy, 'industrial', 5)
          );
          break;
        case 'commercial':
          canGrow = connected && hasZoneInRadius(cells, gx, gy, 'residential', 3);
          break;
        case 'industrial':
          canGrow = connected;
          break;
        case 'admin':
          // Verwaltung braucht Anschluss UND Strom.
          if (connected && hasPower && cell.level === 0) cell.level = 1;
          if ((!connected || !hasPower) && cell.level > 0) cell.level = 0;
          // Verwaltung bringt keine Einnahmen, nur Unterhalt (oben bereits addiert)
          continue;
      }

      // Ohne Strom wächst keine Zone — sie verfällt wie bei fehlender Anbindung.
      canGrow = canGrow && hasPower;

      // Lage-Bonus (Wasser/Wald, nur Wohnzonen) verstärkt Wachstum und Einnahme.
      const bonus = cell.terrainBonus ?? 1;
      // RCI-Nachfrage moduliert die Wachstumschance des jeweiligen Zonentyps.
      const dFactor = demandFactor(demand, cell.zone);

      // Steuer bremst das Wachstum; Lage-Bonus und Nachfrage erhöhen die Chance.
      if (canGrow && cell.level < 3) {
        const chance = Math.min(1, growthChance(taxRate) * bonus * dFactor);
        if (rng() < chance) cell.level++;
      } else if (!canGrow && cell.level > 0) {
        cell.level--;
      }

      // Einnahmen & Bevölkerung
      if (cell.level > 0) {
        gross += (INCOME[cell.zone] ?? 0) * cell.level * taxRate * bonus;
        if (cell.zone === 'residential') population += 50 * cell.level;
      }
    }
  }

  const repayment = serviceLoan();
  const net = Math.round(gross - upkeep - repayment);

  earn(net);
  state.population = population;
  checkBankruptcy();
  return net;
}
