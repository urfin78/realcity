// Wachstumssimulation — läuft einmal pro Tick

import { state, earn, INCOME, UPKEEP, serviceLoan, checkBankruptcy } from './state.js';
import { isConnected, hasZoneInRadius } from './network.js';

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

  for (let gy = 0; gy < GAME_GRID; gy++) {
    for (let gx = 0; gx < GAME_GRID; gx++) {
      const i = idx(gx, gy);
      const cell = cells[i];
      if (!cell) continue;

      if (cell.type === 'road') { upkeep += UPKEEP.road; continue; }
      if (cell.type !== 'zone') continue;

      // Unterhalt: Grundbetrag × max(level, 1), auch Level-0-Zonen kosten.
      upkeep += (UPKEEP[cell.zone] ?? 0) * Math.max(cell.level, 1);

      const connected = isConnected(cells, gx, gy);
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
          if (connected && cell.level === 0) cell.level = 1;
          if (!connected && cell.level > 0) cell.level = 0;
          // Verwaltung bringt keine Einnahmen, nur Unterhalt (oben bereits addiert)
          continue;
      }

      // Lage-Bonus (Wasser/Wald, nur Wohnzonen) verstärkt Wachstum und Einnahme.
      const bonus = cell.terrainBonus ?? 1;

      // Steuer bremst das Wachstum; der Lage-Bonus erhöht die Chance (max 1).
      if (canGrow && cell.level < 3) {
        const chance = Math.min(1, growthChance(taxRate) * bonus);
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
