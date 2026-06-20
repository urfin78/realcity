// Wachstumssimulation — läuft einmal pro Tick

import { state, earn, INCOME } from './state.js';
import { isConnected, hasZoneInRadius } from './network.js';

const GAME_GRID = 64;
function idx(gx, gy) { return gy * GAME_GRID + gx; }

export function runSimulation(cells) {
  let income = 0;
  let population = 0;

  for (let gy = 0; gy < GAME_GRID; gy++) {
    for (let gx = 0; gx < GAME_GRID; gx++) {
      const i = idx(gx, gy);
      const cell = cells[i];
      if (!cell || cell.type !== 'zone') continue;

      const connected = isConnected(cells, gx, gy);

      let canGrow = false;
      switch (cell.zone) {
        case 'residential':
          // Wächst wenn verbunden + Gewerbe oder Industrie in Radius 5
          canGrow = connected && (
            hasZoneInRadius(cells, gx, gy, 'commercial', 5) ||
            hasZoneInRadius(cells, gx, gy, 'industrial', 5)
          );
          break;
        case 'commercial':
          // Wächst wenn verbunden + Wohnen in Radius 3
          canGrow = connected && hasZoneInRadius(cells, gx, gy, 'residential', 3);
          break;
        case 'industrial':
          // Wächst wenn verbunden
          canGrow = connected;
          break;
        case 'admin':
          // Wächst nicht, bleibt auf Level 1 wenn verbunden
          if (connected && cell.level === 0) cell.level = 1;
          if (!connected && cell.level > 0) cell.level = 0;
          continue;
      }

      if (canGrow && cell.level < 3) {
        cell.level++;
      } else if (!canGrow && cell.level > 0) {
        cell.level--;
      }

      // Einnahmen & Bevölkerung
      if (cell.level > 0) {
        income += (INCOME[cell.zone] ?? 0) * cell.level;
        if (cell.zone === 'residential') population += 50 * cell.level;
      }
    }
  }

  earn(income);
  state.population = population;
  return income;
}
