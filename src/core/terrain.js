// Terrain-Interaktion — reine Logik-Funktionen (kein document/window).
// Höhe (elevation) ist normalisiert [0..1]; water/forest sind 0/1.
// Diese Funktionen sind bewusst frei von DOM/Canvas, damit node:test sie
// importieren kann (wie network.js / simulation.js).

// --- Hang-Aufschlag ---------------------------------------------------------
// Der Höhen-Gradient ist die größte Höhendifferenz der Zellmitte zu ihren
// Nachbarproben (jeweils [0..1]). Flaches Gelände → Faktor 1, steiles Gelände
// → bis SLOPE_MAX_FACTOR. Ab SLOPE_BLOCK ist der Bau gesperrt.
export const SLOPE_MAX_FACTOR = 3;     // maximaler Kostenfaktor am Steilhang
export const SLOPE_FULL_AT    = 0.35;  // Gradient, ab dem der Aufschlag voll greift
export const SLOPE_BLOCK      = 0.45;  // Gradient, ab dem nicht mehr gebaut werden darf

// Kostenfaktor (≥1) aus dem Höhen-Gradienten. Linear von 1 (flach) bis
// SLOPE_MAX_FACTOR (bei SLOPE_FULL_AT und darüber).
export function slopeCostFactor(gradient) {
  const g = Math.max(0, gradient);
  const t = Math.min(1, g / SLOPE_FULL_AT);
  return 1 + t * (SLOPE_MAX_FACTOR - 1);
}

// true, wenn der Hang zu steil zum Bebauen ist.
export function isTooSteep(gradient) {
  return gradient >= SLOPE_BLOCK;
}

// --- Lage-Boni (Wasser / Wald) ---------------------------------------------
// Multiplikator auf Einnahmen/Wachstum einer Zone. Nur Wohnzonen profitieren
// von Wasser- und Waldnähe (Naherholung / Wohnlage).
export const WATER_BONUS  = 0.30;  // +30 % nahe Wasser
export const FOREST_BONUS = 0.15;  // +15 % nahe ungerodetem Wald

// Einmalige Geld-Gutschrift beim Roden eines Wald-Tiles.
export const FOREST_CLEAR_REWARD = 300;

// Liefert den Lage-Multiplikator (≥1) für eine Zone.
// nearWater/nearForest: ob in kleinem Radius Wasser bzw. ungerodeter Wald liegt.
export function terrainBonus({ zone, nearWater = false, nearForest = false }) {
  if (zone !== 'residential') return 1;
  let bonus = 1;
  if (nearWater)  bonus += WATER_BONUS;
  if (nearForest) bonus += FOREST_BONUS;
  return bonus;
}
