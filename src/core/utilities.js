// Versorgungsnetz (Strom) + RCI-Nachfrage
//
// Reine Funktionen ohne DOM/State — mit node:test prüfbar.

import { bfsFlood } from './network.js';

const GAME_GRID = 64;

// Kapazität eines Kraftwerks (Versorgungseinheiten pro Kraftwerk).
export const POWER_CAPACITY = 30;

// Strombedarf einer Zone, skaliert mit dem Level (Level-0-Zonen brauchen 1).
export function powerDemand(cell) {
  if (cell?.type !== 'zone') return 0;
  return Math.max(cell.level, 1);
}

// Conductor: Tiles, durch die sich Strom ausbreitet (Kraftwerk, Straße, Zone).
function isConductor(cell) {
  return cell && (cell.type === 'power' || cell.type === 'road' || cell.type === 'zone');
}

/**
 * Berechnet die Stromversorgung über das ganze Gitter.
 *
 * Strom breitet sich von jedem Kraftwerk via BFS über benachbarte Conductor-
 * Tiles (Kraftwerk/Straße/Zone) aus. Innerhalb einer so verbundenen Komponente
 * summiert sich die Kapazität aller enthaltenen Kraftwerke; die erreichbaren
 * Zonen werden in Index-Reihenfolge (deterministisch) bis zur Kapazitätsgrenze
 * versorgt.
 *
 * @returns {Set<number>} Zell-Indizes der versorgten Zonen.
 */
export function computePowered(cells) {
  const plants = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]?.type === 'power') plants.push(i);
  }

  const powered = new Set();
  if (plants.length === 0) return powered;

  const passable = (i) => isConductor(cells[i]);
  const seenPlants = new Set();

  for (const start of plants) {
    if (seenPlants.has(start)) continue;
    // Komponente aller über Conductor verbundenen Tiles ab diesem Kraftwerk.
    const component = bfsFlood([start], passable);

    // Kapazität = Summe aller Kraftwerke in der Komponente; jedes nur einmal.
    let capacity = 0;
    const zonesInComp = [];
    for (const i of component) {
      const c = cells[i];
      if (c?.type === 'power') { capacity += POWER_CAPACITY; seenPlants.add(i); }
      else if (c?.type === 'zone') zonesInComp.push(i);
    }

    // Zonen deterministisch (Index-Reihenfolge) bis zur Kapazität versorgen.
    zonesInComp.sort((a, b) => a - b);
    for (const i of zonesInComp) {
      const need = powerDemand(cells[i]);
      if (capacity >= need) { capacity -= need; powered.add(i); }
    }
  }
  return powered;
}

// --- RCI-Nachfrage ---------------------------------------------------------

// Idealverhältnis der Zonentypen (Wohnen : Gewerbe : Industrie).
// Wohnen bildet die Basis; Gewerbe/Industrie liefern die Arbeitsplätze dazu.
const IDEAL = { residential: 0.5, commercial: 0.2, industrial: 0.3 };

/**
 * Globale RCI-Nachfrage je Zonentyp in [-1, 1].
 *
 * Idee: Liegt der Ist-Anteil eines Typs unter seinem Idealanteil, ist die
 * Nachfrage positiv (es fehlt dieser Typ → er wächst leichter); liegt er
 * darüber, ist sie negativ (Überangebot → bremst). Ohne Zonen herrscht
 * neutrale Wohn-Nachfrage, damit eine frische Stadt überhaupt startet.
 */
export function computeDemand(cells) {
  const count = { residential: 0, commercial: 0, industrial: 0 };
  let total = 0;
  for (const c of cells) {
    if (c?.type === 'zone' && c.zone in count) { count[c.zone]++; total++; }
  }

  const demand = { residential: 0, commercial: 0, industrial: 0 };
  if (total === 0) {
    demand.residential = 1; // leere Stadt: Wohnbedarf zieht den Start an
    return demand;
  }
  for (const z of Object.keys(demand)) {
    const share = count[z] / total;
    // Abweichung vom Ideal, auf [-1, 1] normiert.
    demand[z] = Math.max(-1, Math.min(1, (IDEAL[z] - share) / IDEAL[z]));
  }
  return demand;
}

// Wachstumsfaktor aus der RCI-Nachfrage eines Zonentyps.
// demand +1 → 1.5× Chance, 0 → 1×, -1 → 0.5× (geklemmt ≥ 0).
export function demandFactor(demand, zone) {
  const d = demand?.[zone] ?? 0;
  return Math.max(0, 1 + 0.5 * d);
}

export { GAME_GRID };
